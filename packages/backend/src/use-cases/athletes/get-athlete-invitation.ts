import { isAccepted, isExpired, isRevoked } from '@strenly/core/domain/entities/athlete-invitation'
import type { AthleteInvitationRepositoryPort } from '@strenly/core/ports/athlete-invitation-repository.port'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GetAthleteInvitationInput = OrganizationContext & {
  athleteId: string
}

export type GetAthleteInvitationResult = {
  id: string
  athleteId: string
  invitationUrl: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: Date
  createdAt: Date
  acceptedAt: Date | null
}

export type GetAthleteInvitationError =
  | { type: 'forbidden'; message: string }
  | { type: 'athlete_not_found'; athleteId: string }
  | { type: 'no_invitation'; athleteId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  athleteRepository: AthleteRepositoryPort
  invitationRepository: AthleteInvitationRepositoryPort
  appUrl: string
}

export const makeGetAthleteInvitation =
  (deps: Dependencies) =>
  (input: GetAthleteInvitationInput): ResultAsync<GetAthleteInvitationResult, GetAthleteInvitationError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to view athlete invitations',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Verify athlete exists and belongs to org
    return deps.athleteRepository
      .findById(ctx, input.athleteId)
      .mapErr(
        (e): GetAthleteInvitationError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Unknown error',
        }),
      )
      .andThen((athlete) => {
        if (athlete === null) {
          return errAsync<GetAthleteInvitationResult, GetAthleteInvitationError>({
            type: 'athlete_not_found',
            athleteId: input.athleteId,
          })
        }
        return okAsync(athlete)
      })
      .andThen(() => {
        // 3. Get active invitation
        return deps.invitationRepository.findByAthleteId(ctx, input.athleteId).mapErr(
          (e): GetAthleteInvitationError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : 'Invitation error',
          }),
        )
      })
      .andThen((invitation) => {
        if (!invitation) {
          return errAsync<GetAthleteInvitationResult, GetAthleteInvitationError>({
            type: 'no_invitation',
            athleteId: input.athleteId,
          })
        }

        // Determine status using domain helpers
        let status: 'pending' | 'accepted' | 'expired' | 'revoked' = 'pending'
        if (isAccepted(invitation)) {
          status = 'accepted'
        } else if (isRevoked(invitation)) {
          status = 'revoked'
        } else if (isExpired(invitation)) {
          status = 'expired'
        }

        return okAsync({
          id: invitation.id,
          athleteId: invitation.athleteId,
          invitationUrl: `${deps.appUrl}/invite/${invitation.token}`,
          status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          acceptedAt: invitation.acceptedAt,
        })
      })
  }
