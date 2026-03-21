import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type DeleteWeekInput = OrganizationContext & {
  programId: string
  weekId: string
}

export type DeleteWeekError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; weekId: string }
  | { type: 'program_not_found'; programId: string }
  | { type: 'last_week'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

export const makeDeleteWeek =
  (deps: Dependencies) =>
  (input: DeleteWeekInput): ResultAsync<void, DeleteWeekError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Get program details to verify week count
    return deps.programRepository
      .findWithDetails(ctx, input.programId)
      .mapErr(
        (e): DeleteWeekError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((program) => {
        if (!program) {
          return errAsync<void, DeleteWeekError>({ type: 'program_not_found', programId: input.programId })
        }
        // 3. Verify week exists in this program
        const week = program.weeks.find((w) => w.id === input.weekId)
        if (!week) {
          return errAsync<void, DeleteWeekError>({
            type: 'not_found',
            weekId: input.weekId,
          })
        }

        // 4. Prevent deletion if it's the last week
        if (program.weeks.length <= 1) {
          return errAsync<void, DeleteWeekError>({
            type: 'last_week',
            message: 'Cannot delete the last week of a program',
          })
        }

        // 5. Delete the week (cascades prescriptions)
        return deps.programRepository.deleteWeek(ctx, input.weekId).mapErr(
          (e): DeleteWeekError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Week not found: ${input.weekId}`,
          }),
        )
      })
  }
