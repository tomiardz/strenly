import { isValid } from '@strenly/core/domain/entities/athlete-invitation'
import type {
  AthleteInvitationRepositoryError,
  AthleteInvitationRepositoryPort,
} from '@strenly/core/ports/athlete-invitation-repository.port'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GetInvitationInfoInput = {
  token: string
}

export type GetInvitationInfoResult = {
  athleteName: string
  organizationName: string
  coachName: string
  expiresAt: Date
  isValid: boolean
}

export type GetInvitationInfoError =
  | { type: 'invalid_token'; message: string }
  | { type: 'repository_error'; message: string }

/**
 * Lookup service for organization and coach names.
 * This is a simplified interface to avoid importing full repositories.
 */
export type OrganizationLookup = {
  getOrganizationName(organizationId: string): ResultAsync<string | null, { message: string }>
  getUserName(userId: string): ResultAsync<string | null, { message: string }>
  getAthleteName(athleteId: string, organizationId: string): ResultAsync<string | null, { message: string }>
}

type Dependencies = {
  invitationRepository: AthleteInvitationRepositoryPort
  organizationLookup: OrganizationLookup
}

function mapInvitationRepoError(e: AthleteInvitationRepositoryError): GetInvitationInfoError {
  if (e.type === 'DATABASE_ERROR') {
    return { type: 'repository_error', message: e.message }
  }
  if (e.type === 'TOKEN_NOT_FOUND') {
    return { type: 'invalid_token', message: 'Invalid invitation token' }
  }
  return { type: 'repository_error', message: e.type }
}

export const makeGetInvitationInfo =
  (deps: Dependencies) =>
  (input: GetInvitationInfoInput): ResultAsync<GetInvitationInfoResult, GetInvitationInfoError> => {
    // NO authorization - public endpoint

    // 1. Lookup invitation by token
    return deps.invitationRepository
      .findByToken(input.token)
      .mapErr(mapInvitationRepoError)
      .andThen((invitation) => {
        if (invitation === null) {
          return errAsync<GetInvitationInfoResult, GetInvitationInfoError>({
            type: 'invalid_token',
            message: 'Invalid invitation token',
          })
        }

        // 2. Check if valid
        const valid = isValid(invitation)

        // 3. Lookup display info sequentially (org name, coach name, athlete name)
        return deps.organizationLookup
          .getOrganizationName(invitation.organizationId)
          .mapErr((e): GetInvitationInfoError => ({ type: 'repository_error', message: e.message }))
          .andThen((orgName) => {
            const coachNameResult = invitation.createdByUserId
              ? deps.organizationLookup
                  .getUserName(invitation.createdByUserId)
                  .mapErr((e): GetInvitationInfoError => ({ type: 'repository_error', message: e.message }))
              : okAsync<string | null, GetInvitationInfoError>(null)

            return coachNameResult.andThen((coachName) =>
              deps.organizationLookup
                .getAthleteName(invitation.athleteId, invitation.organizationId)
                .mapErr((e): GetInvitationInfoError => ({ type: 'repository_error', message: e.message }))
                .map((athleteName) => ({
                  athleteName: athleteName ?? 'Unknown',
                  organizationName: orgName ?? 'Unknown',
                  coachName: coachName ?? 'Unknown',
                  expiresAt: invitation.expiresAt,
                  isValid: valid,
                })),
            )
          })
      })
  }
