import { createProgram, type Program } from '@strenly/core/domain/entities/program/program'
import type { CreateProgramInput, ProgramStatus, WeekInput } from '@strenly/core/domain/entities/program/types'
import type { ProgramRepositoryError, ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

/**
 * Program data input from the procedure (without id/organizationId).
 * The use case adds these from context.
 */
export type ProgramDataInput = {
  name: string
  description?: string | null
  athleteId?: string | null
  isTemplate?: boolean
  status?: ProgramStatus
  weeks?: WeekInput[]
}

/**
 * Input for saveDraft use case.
 * Includes OrganizationContext (standard single-input signature).
 */
export type SaveDraftInput = OrganizationContext & {
  programId: string
  program: ProgramDataInput
  lastLoadedAt?: Date // For optimistic locking
}

export type SaveDraftError =
  | { type: 'forbidden'; message: string }
  | { type: 'validation_error'; message: string; details?: unknown }
  | { type: 'program_not_found'; programId: string }
  | { type: 'conflict'; message: string; serverUpdatedAt: Date }
  | { type: 'repository_error'; message: string }

export type SaveDraftResult = {
  updatedAt: Date
  conflictWarning: string | null
}

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

/**
 * Map repository error to use case error.
 */
function mapRepoError(e: ProgramRepositoryError): SaveDraftError {
  if (e.type === 'DATABASE_ERROR') {
    return { type: 'repository_error', message: e.message }
  }
  return { type: 'program_not_found', programId: e.id }
}

/**
 * Save a validated program aggregate.
 */
function saveProgram(
  deps: Dependencies,
  ctx: OrganizationContext,
  program: Program,
  conflictWarning: string | null,
): ResultAsync<SaveDraftResult, SaveDraftError> {
  return deps.programRepository
    .saveProgramAggregate(ctx, program)
    .mapErr(mapRepoError)
    .map((result) => ({ updatedAt: result.updatedAt, conflictWarning }))
}

/**
 * Save draft changes to a program using the aggregate pattern.
 *
 * This use case:
 * 1. Checks authorization
 * 2. Optionally checks for conflicts (via lastLoadedAt)
 * 3. Validates the entire aggregate via createProgram() domain factory
 * 4. Persists via saveProgramAggregate() (replace-on-save)
 *
 * The frontend sends the complete program aggregate, not delta changes.
 */
export const makeSaveDraft =
  (deps: Dependencies) =>
  (input: SaveDraftInput): ResultAsync<SaveDraftResult, SaveDraftError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to edit programs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Build CreateProgramInput by adding id and organizationId
    const createInput: CreateProgramInput = {
      ...input.program,
      id: input.programId,
      organizationId: input.organizationId,
    }

    // 3. Validate aggregate via domain factory
    const programResult = createProgram(createInput)

    if (programResult.isErr()) {
      return errAsync({
        type: 'validation_error',
        message: programResult.error.message,
        details: programResult.error,
      })
    }

    const program = programResult.value

    // 4. Optional conflict check - load current program to compare updatedAt
    if (input.lastLoadedAt) {
      const lastLoadedAt = input.lastLoadedAt // Capture for closure
      return deps.programRepository
        .loadProgramAggregate(ctx, input.programId)
        .mapErr(mapRepoError)
        .andThen((currentProgram) => {
          if (currentProgram === null) {
            return errAsync<SaveDraftResult, SaveDraftError>({
              type: 'program_not_found',
              programId: input.programId,
            })
          }

          const conflictWarning =
            currentProgram.updatedAt > lastLoadedAt
              ? 'Program was modified by another user. Your changes were saved but may overwrite recent changes.'
              : null

          // 5. Save aggregate (replace-on-save)
          return saveProgram(deps, ctx, program, conflictWarning)
        })
    }

    // No conflict check needed - just save
    return saveProgram(deps, ctx, program, null)
  }
