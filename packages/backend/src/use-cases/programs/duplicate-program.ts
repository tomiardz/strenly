import { createProgram, type Program } from '@strenly/core/domain/entities/program/program'
import type {
  ExerciseGroup,
  ExerciseGroupInput,
  GroupItem,
  GroupItemInput,
  Session,
  SessionInput,
  Week,
  WeekInput,
} from '@strenly/core/domain/entities/program/types'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type DuplicateProgramInput = OrganizationContext & {
  sourceProgramId: string
  name: string
  athleteId?: string | null
  isTemplate?: boolean
}

export type DuplicateProgramError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; programId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  generateId: () => string
}

/**
 * Clone a group item with a new ID.
 */
function cloneGroupItem(item: GroupItem, generateId: () => string): GroupItemInput {
  return {
    id: generateId(),
    exerciseId: item.exerciseId,
    orderIndex: item.orderIndex,
    series: item.series.map((s) => ({
      reps: s.reps,
      repsMax: s.repsMax,
      isAmrap: s.isAmrap,
      intensityType: s.intensityType,
      intensityValue: s.intensityValue,
      tempo: s.tempo,
      restSeconds: s.restSeconds,
    })),
  }
}

/**
 * Clone an exercise group with a new ID.
 */
function cloneExerciseGroup(group: ExerciseGroup, generateId: () => string): ExerciseGroupInput {
  return {
    id: generateId(),
    orderIndex: group.orderIndex,
    items: group.items.map((item) => cloneGroupItem(item, generateId)),
  }
}

/**
 * Clone a session with a new ID.
 */
function cloneSession(session: Session, generateId: () => string): SessionInput {
  return {
    id: generateId(),
    name: session.name,
    orderIndex: session.orderIndex,
    exerciseGroups: session.exerciseGroups.map((group) => cloneExerciseGroup(group, generateId)),
  }
}

/**
 * Clone a week with a new ID.
 */
function cloneWeek(week: Week, generateId: () => string): WeekInput {
  return {
    id: generateId(),
    name: week.name,
    orderIndex: week.orderIndex,
    sessions: week.sessions.map((session) => cloneSession(session, generateId)),
  }
}

/**
 * Duplicate a program using the aggregate pattern.
 *
 * Uses aggregate operations:
 * 1. Load source via loadProgramAggregate
 * 2. Clone with new IDs
 * 3. Validate via createProgram() domain factory
 * 4. Save via saveProgramAggregate()
 */
export const makeDuplicateProgram =
  (deps: Dependencies) =>
  (input: DuplicateProgramInput): ResultAsync<Program, DuplicateProgramError> => {
    // 1. Authorization FIRST - duplicating creates a new program
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

    // 2. Load source program aggregate
    return deps.programRepository
      .loadProgramAggregate(ctx, input.sourceProgramId)
      .mapErr(
        (e): DuplicateProgramError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((sourceProgram) => {
        if (sourceProgram === null) {
          return errAsync<Program, DuplicateProgramError>({
            type: 'not_found',
            programId: input.sourceProgramId,
          })
        }

        // 3. Clone weeks with new IDs (this recursively clones sessions, groups, items)
        const clonedWeeks = sourceProgram.weeks.map((week) => cloneWeek(week, deps.generateId))

        // 4. Create new program with cloned structure
        const programResult = createProgram({
          id: deps.generateId(),
          organizationId: input.organizationId,
          name: input.name,
          description: sourceProgram.description,
          athleteId: input.athleteId ?? null,
          isTemplate: input.isTemplate ?? false,
          status: 'draft', // Always reset to draft
          weeks: clonedWeeks,
        })

        if (programResult.isErr()) {
          return errAsync<Program, DuplicateProgramError>({
            type: 'validation_error',
            message: programResult.error.message,
          })
        }

        const newProgram = programResult.value

        // 5. Save complete aggregate
        return deps.programRepository
          .saveProgramAggregate(ctx, newProgram)
          .mapErr(
            (e): DuplicateProgramError => ({
              type: 'repository_error',
              message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
            }),
          )
          .map(() => newProgram)
      })
  }
