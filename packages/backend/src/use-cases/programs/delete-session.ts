import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type DeleteSessionInput = OrganizationContext & {
  programId: string
  sessionId: string
}

export type DeleteSessionError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; sessionId: string }
  | { type: 'program_not_found'; programId: string }
  | { type: 'last_session'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

export const makeDeleteSession =
  (deps: Dependencies) =>
  (input: DeleteSessionInput): ResultAsync<void, DeleteSessionError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Get program details to verify session count
    return deps.programRepository
      .findWithDetails(ctx, input.programId)
      .mapErr(
        (e): DeleteSessionError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((program) => {
        if (!program) {
          return errAsync<void, DeleteSessionError>({ type: 'program_not_found', programId: input.programId })
        }
        // 3. Verify session exists in this program
        const session = program.sessions.find((s) => s.id === input.sessionId)
        if (!session) {
          return errAsync<void, DeleteSessionError>({
            type: 'not_found',
            sessionId: input.sessionId,
          })
        }

        // 4. Prevent deletion if it's the last session
        if (program.sessions.length <= 1) {
          return errAsync<void, DeleteSessionError>({
            type: 'last_session',
            message: 'Cannot delete the last session of a program',
          })
        }

        // 5. Delete the session (cascades exercise rows and prescriptions)
        return deps.programRepository.deleteSession(ctx, input.sessionId).mapErr(
          (e): DeleteSessionError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Session not found: ${input.sessionId}`,
          }),
        )
      })
  }
