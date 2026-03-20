import { listProgramsOutputSchema, listProgramsQuerySchema } from '@strenly/contracts/programs/program'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeListPrograms } from '../../use-cases/programs/list-programs'
import { mapProgramToOutput } from './map-program-to-output'

/**
 * List programs with optional filters
 * Requires authentication and programs:read permission
 */
export const listPrograms = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to list programs' },
  })
  .input(listProgramsQuerySchema)
  .output(listProgramsOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const listProgramsUseCase = makeListPrograms({
      programRepository: createProgramRepository(context.db),
    })

    const result = await listProgramsUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
      isTemplate: input.isTemplate,
      status: input.status,
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'list' })
          throw new Error('Internal error')
      }
    }

    const { items, totalCount } = result.value

    return {
      items: items.map(mapProgramToOutput),
      totalCount,
    }
  })
