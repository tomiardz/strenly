import { generateInvitationInputSchema, generateInvitationOutputSchema } from '@strenly/contracts/athletes/invitation'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { createAthleteInvitationRepository } from '../../infrastructure/repositories/athlete-invitation.repository'
import { generateInvitationToken } from '../../lib/invitation-token'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGenerateInvitation } from '../../use-cases/athletes/generate-invitation'

/**
 * Generate an invitation for an athlete
 * Requires authentication and organization context
 * Revokes any existing active invitation
 */
export const generateInvitation = authProcedure
  .input(generateInvitationInputSchema)
  .output(generateInvitationOutputSchema)
  .errors({
    FORBIDDEN: { message: 'You do not have permission to generate invitations' },
    ATHLETE_NOT_FOUND: { message: 'Athlete not found' },
    ALREADY_LINKED: { message: 'Athlete is already linked to an account' },
  })
  .handler(async ({ input, context, errors }) => {
    const useCase = makeGenerateInvitation({
      athleteRepository: createAthleteRepository(context.db),
      invitationRepository: createAthleteInvitationRepository(context.db),
      generateId: () => crypto.randomUUID(),
      generateToken: generateInvitationToken,
      appUrl: context.appUrl,
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
    })

    if (result.isErr()) {
      // Exhaustive error mapping
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'athlete_not_found':
          throw errors.ATHLETE_NOT_FOUND()
        case 'already_linked':
          throw errors.ALREADY_LINKED()
        case 'invalid_invitation':
          logger.error('Invalid invitation', { error: result.error.message, procedure: 'generateInvitation' })
          throw new Error('Internal error')
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'generateInvitation' })
          throw new Error('Internal error')
      }
    }

    return {
      invitationUrl: result.value.invitationUrl,
    }
  })
