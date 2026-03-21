import type { AthleteInvitation } from '@strenly/core/domain/entities/athlete-invitation'
import { createAthleteInvitation } from '@strenly/core/domain/entities/athlete-invitation'
import type { AthleteInvitationRepositoryPort } from '@strenly/core/ports/athlete-invitation-repository.port'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GenerateInvitationInput = OrganizationContext & {
  athleteId: string
}

export type GenerateInvitationResult = {
  invitation: AthleteInvitation
  invitationUrl: string
}

export type GenerateInvitationError =
  | { type: 'forbidden'; message: string }
  | { type: 'athlete_not_found'; athleteId: string }
  | { type: 'already_linked'; athleteId: string; message: string }
  | { type: 'invalid_invitation'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  athleteRepository: AthleteRepositoryPort
  invitationRepository: AthleteInvitationRepositoryPort
  generateId: () => string
  generateToken: () => string
  appUrl: string
}

export const makeGenerateInvitation =
  (deps: Dependencies) =>
  (input: GenerateInvitationInput): ResultAsync<GenerateInvitationResult, GenerateInvitationError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to generate athlete invitations',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Fetch athlete
    return deps.athleteRepository
      .findById(ctx, input.athleteId)
      .mapErr(
        (e): GenerateInvitationError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Unknown error',
        }),
      )
      .andThen((athlete) => {
        if (athlete === null) {
          return errAsync<never, GenerateInvitationError>({
            type: 'athlete_not_found',
            athleteId: input.athleteId,
          })
        }
        return okAsync(athlete)
      })
      .andThen((athlete) => {
        // 3. Check if already linked
        if (athlete.linkedUserId !== null) {
          return errAsync<AthleteInvitation, GenerateInvitationError>({
            type: 'already_linked',
            athleteId: input.athleteId,
            message: 'Athlete is already linked to a user account',
          })
        }

        // 4. Revoke existing invitations if any
        return deps.invitationRepository
          .findByAthleteId(ctx, input.athleteId)
          .mapErr(
            (e): GenerateInvitationError => ({
              type: 'repository_error',
              message: e.type === 'DATABASE_ERROR' ? e.message : `Invitation error`,
            }),
          )
          .andThen((existingInvitation) => {
            if (existingInvitation !== null) {
              return deps.invitationRepository.revoke(ctx, existingInvitation.id).mapErr(
                (e): GenerateInvitationError => ({
                  type: 'repository_error',
                  message: e.type === 'DATABASE_ERROR' ? e.message : `Failed to revoke invitation`,
                }),
              )
            }
            return okAsync(undefined)
          })
          .andThen(() => {
            // 5. Create new invitation
            const invitationResult = createAthleteInvitation({
              id: deps.generateId(),
              athleteId: input.athleteId,
              organizationId: input.organizationId,
              createdByUserId: input.userId,
              token: deps.generateToken(),
            })

            if (invitationResult.isErr()) {
              return errAsync<AthleteInvitation, GenerateInvitationError>({
                type: 'invalid_invitation',
                message: invitationResult.error.message,
              })
            }

            // 6. Persist
            return deps.invitationRepository.create(ctx, invitationResult.value).mapErr(
              (e): GenerateInvitationError => ({
                type: 'repository_error',
                message: e.type === 'DATABASE_ERROR' ? e.message : `Failed to create invitation`,
              }),
            )
          })
      })
      .map((invitation) => ({
        // 7. Build URL and return
        invitation,
        invitationUrl: `${deps.appUrl}/invite/${invitation.token}`,
      }))
  }
