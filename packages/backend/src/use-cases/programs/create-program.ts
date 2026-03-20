import { createProgram, type Program } from '@strenly/core/domain/entities/program/program'
import type { SessionInput, WeekInput } from '@strenly/core/domain/entities/program/types'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type CreateProgramInput = OrganizationContext & {
  name: string
  description?: string | null
  athleteId?: string | null
  isTemplate?: boolean
  weeksCount?: number
  sessionsCount?: number
}

export type CreateProgramError =
  | { type: 'forbidden'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'athlete_not_found'; athleteId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  athleteRepository: AthleteRepositoryPort
  generateId: () => string
}

/**
 * Generate default weeks with empty sessions for a new program.
 *
 * Each week contains the same sessions (by structure, not by ID).
 * Sessions have exerciseGroups: [] (empty).
 */
function generateDefaultWeeks(weeksCount: number, sessionsCount: number, generateId: () => string): WeekInput[] {
  const weeks: WeekInput[] = []

  for (let w = 0; w < weeksCount; w++) {
    const sessions: SessionInput[] = []

    for (let s = 0; s < sessionsCount; s++) {
      sessions.push({
        id: generateId(),
        name: `Dia ${s + 1}`,
        orderIndex: s,
        exerciseGroups: [],
      })
    }

    weeks.push({
      id: generateId(),
      name: `Semana ${w + 1}`,
      orderIndex: w,
      sessions,
    })
  }

  return weeks
}

/**
 * Create a new program with default weeks and sessions.
 *
 * Uses the aggregate pattern:
 * 1. Validates input via createProgram() domain factory
 * 2. Generates default weeks with empty sessions
 * 3. Saves the complete aggregate via saveProgramAggregate()
 */
export const makeCreateProgram =
  (deps: Dependencies) =>
  (input: CreateProgramInput): ResultAsync<Program, CreateProgramError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to create programs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Generate default weeks with empty sessions
    const weeksCount = input.weeksCount ?? 4
    const sessionsCount = input.sessionsCount ?? 3
    const weeks = generateDefaultWeeks(weeksCount, sessionsCount, deps.generateId)

    // 3. Domain validation - create full aggregate
    const programResult = createProgram({
      id: deps.generateId(),
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      athleteId: input.athleteId,
      isTemplate: input.isTemplate,
      weeks,
    })

    if (programResult.isErr()) {
      return errAsync({
        type: 'validation_error',
        message: programResult.error.message,
      })
    }

    const program = programResult.value

    // 4. If athleteId provided, verify athlete exists in organization
    const athleteCheck: ResultAsync<void, CreateProgramError> = input.athleteId
      ? deps.athleteRepository
          .findById(ctx, input.athleteId)
          .mapErr(
            (e): CreateProgramError => ({
              type: 'repository_error',
              message: e.type === 'DATABASE_ERROR' ? e.message : `Failed to find athlete`,
            }),
          )
          .andThen((athlete) => {
            if (athlete === null) {
              return errAsync<void, CreateProgramError>({
                type: 'athlete_not_found',
                athleteId: input.athleteId ?? '',
              })
            }
            return okAsync(undefined)
          })
      : okAsync(undefined)

    // 5. Save complete aggregate
    return athleteCheck.andThen(() =>
      deps.programRepository
        .saveProgramAggregate(ctx, program)
        .mapErr(
          (e): CreateProgramError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
          }),
        )
        .map(() => program),
    )
  }
