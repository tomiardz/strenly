import type {
  AthleteInvitationRepositoryError,
  AthleteInvitationRepositoryPort,
} from '@strenly/core/ports/athlete-invitation-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type RevokeInvitationInput = OrganizationContext & {
  athleteId: string
}

export type RevokeInvitationError =
  | { type: 'forbidden'; message: string }
  | { type: 'invitation_not_found'; athleteId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  invitationRepository: AthleteInvitationRepositoryPort
}

function mapInvitationRepoError(e: AthleteInvitationRepositoryError): RevokeInvitationError {
  if (e.type === 'DATABASE_ERROR') {
    return { type: 'repository_error', message: e.message }
  }
  return { type: 'repository_error', message: e.type }
}

export const makeRevokeInvitation =
  (deps: Dependencies) =>
  (input: RevokeInvitationInput): ResultAsync<void, RevokeInvitationError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to revoke athlete invitations',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Find invitation for athlete
    return deps.invitationRepository
      .findByAthleteId(ctx, input.athleteId)
      .mapErr(mapInvitationRepoError)
      .andThen((invitation) => {
        if (invitation === null) {
          return errAsync<void, RevokeInvitationError>({
            type: 'invitation_not_found',
            athleteId: input.athleteId,
          })
        }

        // 3. Revoke the invitation
        return deps.invitationRepository.revoke(ctx, invitation.id).mapErr(mapInvitationRepoError)
      })
      .andThen(() => okAsync(undefined))
  }
