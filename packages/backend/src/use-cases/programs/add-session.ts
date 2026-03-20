import { createSession } from '@strenly/core/domain/entities/program/session'
import type { ProgramRepositoryPort, ProgramSession } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type AddSessionInput = OrganizationContext & {
  programId: string
  name: string
}

export type AddSessionError =
  | { type: 'forbidden'; message: string }
  | { type: 'program_not_found'; programId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  generateId: () => string
}

export const makeAddSession =
  (deps: Dependencies) =>
  (input: AddSessionInput): ResultAsync<ProgramSession, AddSessionError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Get program details to calculate next orderIndex
    return deps.programRepository
      .findWithDetails(ctx, input.programId)
      .mapErr(
        (e): AddSessionError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((program) => {
        if (!program) {
          return errAsync<ProgramSession, AddSessionError>({ type: 'program_not_found', programId: input.programId })
        }
        // 3. Validate via domain factory (handles trim)
        const nextOrderIndex = program.sessions.length
        const sessionResult = createSession({ id: deps.generateId(), name: input.name, orderIndex: nextOrderIndex })

        if (sessionResult.isErr()) {
          return errAsync<ProgramSession, AddSessionError>({
            type: 'validation_error',
            message: sessionResult.error.message,
          })
        }

        const now = new Date()
        const session: Omit<ProgramSession, 'programId'> = {
          id: sessionResult.value.id,
          name: sessionResult.value.name,
          orderIndex: sessionResult.value.orderIndex,
          createdAt: now,
          updatedAt: now,
        }

        // 4. Create session via repository
        return deps.programRepository.createSession(ctx, input.programId, session).mapErr(
          (e): AddSessionError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Program not found: ${input.programId}`,
          }),
        )
      })
  }
