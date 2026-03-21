import type { Program } from '@strenly/core/domain/entities/program/program'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GetProgramInput = OrganizationContext & {
  programId: string
}

export type GetProgramError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; programId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

/**
 * Get a program with full aggregate hierarchy.
 *
 * Uses loadProgramAggregate to return the complete program with:
 * weeks -> sessions -> exerciseGroups -> items -> series
 *
 * The procedure is responsible for mapping this to the expected output format.
 */
export const makeGetProgram =
  (deps: Dependencies) =>
  (input: GetProgramInput): ResultAsync<Program, GetProgramError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to view programs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Load full program aggregate
    return deps.programRepository
      .loadProgramAggregate(ctx, input.programId)
      .mapErr(
        (e): GetProgramError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((program) => {
        if (program === null) {
          return errAsync<Program, GetProgramError>({ type: 'not_found', programId: input.programId })
        }
        return okAsync(program)
      })
  }
