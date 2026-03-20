import {
  getAthleteInvitationInputSchema,
  getAthleteInvitationOutputSchema,
} from '@strenly/contracts/athletes/invitation'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { createAthleteInvitationRepository } from '../../infrastructure/repositories/athlete-invitation.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGetAthleteInvitation } from '../../use-cases/athletes/get-athlete-invitation'

/**
 * Get an athlete's current invitation
 * Requires authentication and organization context
 * Returns full invitation details including URL, status, and expiration
 */
export const getAthleteInvitation = authProcedure
  .input(getAthleteInvitationInputSchema)
  .output(getAthleteInvitationOutputSchema)
  .errors({
    FORBIDDEN: { message: 'You do not have permission to view invitations' },
    ATHLETE_NOT_FOUND: { message: 'Athlete not found' },
    NO_INVITATION: { message: 'No active invitation for this athlete' },
  })
  .handler(async ({ input, context, errors }) => {
    const useCase = makeGetAthleteInvitation({
      athleteRepository: createAthleteRepository(context.db),
      invitationRepository: createAthleteInvitationRepository(context.db),
      appUrl: context.appUrl,
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'athlete_not_found':
          throw errors.ATHLETE_NOT_FOUND()
        case 'no_invitation':
          throw errors.NO_INVITATION()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'getAthleteInvitation' })
          throw new Error('Internal error')
      }
    }

    const inv = result.value
    return {
      id: inv.id,
      athleteId: inv.athleteId,
      invitationUrl: inv.invitationUrl,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      acceptedAt: inv.acceptedAt?.toISOString() ?? null,
    }
  })
