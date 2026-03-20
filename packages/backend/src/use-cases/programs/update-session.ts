import { createSession } from '@strenly/core/domain/entities/program/session'
import type { ProgramRepositoryPort, ProgramSession } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type UpdateSessionInput = OrganizationContext & {
  sessionId: string
  name: string
}

export type UpdateSessionError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; sessionId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

export const makeUpdateSession =
  (deps: Dependencies) =>
  (input: UpdateSessionInput): ResultAsync<ProgramSession, UpdateSessionError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Fetch existing session
    return deps.programRepository
      .findSessionById(ctx, input.sessionId)
      .mapErr(
        (e): UpdateSessionError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((existing) => {
        if (!existing) {
          return errAsync<ProgramSession, UpdateSessionError>({ type: 'not_found', sessionId: input.sessionId })
        }
        // 3. Validate via domain factory (handles trim)
        const sessionResult = createSession({ id: existing.id, name: input.name, orderIndex: existing.orderIndex })

        if (sessionResult.isErr()) {
          return errAsync<ProgramSession, UpdateSessionError>({
            type: 'validation_error',
            message: sessionResult.error.message,
          })
        }

        const updated: ProgramSession = {
          ...existing,
          name: sessionResult.value.name,
          updatedAt: new Date(),
        }

        // 4. Persist
        return deps.programRepository.updateSession(ctx, updated).mapErr((e): UpdateSessionError => {
          if (e.type === 'NOT_FOUND') {
            return { type: 'not_found', sessionId: input.sessionId }
          }
          return { type: 'repository_error', message: e.message }
        })
      })
  }
