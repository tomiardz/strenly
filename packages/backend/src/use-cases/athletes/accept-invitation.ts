import type { Athlete } from '@strenly/core/domain/entities/athlete'
import { isAccepted, isExpired, isRevoked } from '@strenly/core/domain/entities/athlete-invitation'
import type {
  AthleteInvitationRepositoryError,
  AthleteInvitationRepositoryPort,
} from '@strenly/core/ports/athlete-invitation-repository.port'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import type { OrganizationRole } from '@strenly/core/services/authorization'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type AcceptInvitationInput = {
  token: string
  userId: string
}

export type AcceptInvitationResult = {
  athlete: Athlete
  organizationId: string
}

export type AcceptInvitationError =
  | { type: 'invalid_token'; message: string }
  | { type: 'expired'; message: string }
  | { type: 'already_accepted'; message: string }
  | { type: 'already_revoked'; message: string }
  | { type: 'athlete_not_found'; athleteId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  invitationRepository: AthleteInvitationRepositoryPort
  athleteRepository: AthleteRepositoryPort
}

function mapInvitationRepoError(e: AthleteInvitationRepositoryError): AcceptInvitationError {
  if (e.type === 'DATABASE_ERROR') {
    return { type: 'repository_error', message: e.message }
  }
  if (e.type === 'TOKEN_NOT_FOUND') {
    return { type: 'invalid_token', message: 'Invalid invitation token' }
  }
  return { type: 'repository_error', message: e.type }
}

export const makeAcceptInvitation =
  (deps: Dependencies) =>
  (input: AcceptInvitationInput): ResultAsync<AcceptInvitationResult, AcceptInvitationError> => {
    // NO authorization - public endpoint with token

    // 1. Lookup invitation by token
    return deps.invitationRepository
      .findByToken(input.token)
      .mapErr(mapInvitationRepoError)
      .andThen((invitation) => {
        if (invitation === null) {
          return errAsync<AcceptInvitationResult, AcceptInvitationError>({
            type: 'invalid_token',
            message: 'Invalid invitation token',
          })
        }

        // 2. Validate invitation state
        if (isExpired(invitation)) {
          return errAsync<AcceptInvitationResult, AcceptInvitationError>({
            type: 'expired',
            message: 'Invitation has expired',
          })
        }

        if (isRevoked(invitation)) {
          return errAsync<AcceptInvitationResult, AcceptInvitationError>({
            type: 'already_revoked',
            message: 'Invitation has been revoked',
          })
        }

        if (isAccepted(invitation)) {
          return errAsync<AcceptInvitationResult, AcceptInvitationError>({
            type: 'already_accepted',
            message: 'Invitation has already been accepted',
          })
        }

        // 3. Mark accepted (this also updates athlete.linkedUserId)
        return deps.invitationRepository
          .markAccepted(input.token, input.userId)
          .mapErr(mapInvitationRepoError)
          .andThen(() => {
            // 4. Fetch updated athlete
            // Note: We need to create a context for the athlete repository
            // The athlete should now be accessible since we just linked it
            const ctx = {
              organizationId: invitation.organizationId,
              userId: input.userId,
              roles: ['athlete'] as OrganizationRole[],
            }

            return deps.athleteRepository
              .findById(ctx, invitation.athleteId)
              .mapErr(
                (e): AcceptInvitationError => ({
                  type: 'repository_error',
                  message: e.type === 'DATABASE_ERROR' ? e.message : `Athlete ${e.athleteId} not found`,
                }),
              )
              .andThen((athlete) => {
                if (athlete === null) {
                  return errAsync<AcceptInvitationResult, AcceptInvitationError>({
                    type: 'athlete_not_found',
                    athleteId: invitation.athleteId,
                  })
                }
                return okAsync({
                  athlete,
                  organizationId: invitation.organizationId,
                })
              })
          })
      })
  }
