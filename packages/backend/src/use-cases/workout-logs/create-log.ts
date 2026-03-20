import type { Athlete } from '@strenly/core/domain/entities/athlete'
import type { Program, Session, Week } from '@strenly/core/domain/entities/program/types'
import { buildLoggedExercises } from '@strenly/core/domain/entities/workout-log/build-logged-exercises'
import { createWorkoutLog, type WorkoutLog } from '@strenly/core/domain/entities/workout-log/workout-log'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

export type CreateLogInput = OrganizationContext & {
  athleteId: string
  programId: string
  sessionId: string
  weekId: string
  logDate: Date
}

export type CreateLogError =
  | { type: 'forbidden'; message: string }
  | { type: 'log_already_exists'; athleteId: string; sessionId: string; weekId: string }
  | { type: 'program_not_found'; programId: string }
  | { type: 'session_not_found'; sessionId: string }
  | { type: 'week_not_found'; weekId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  workoutLogRepository: WorkoutLogRepositoryPort
  programRepository: ProgramRepositoryPort
  athleteRepository: AthleteRepositoryPort
  generateId: () => string
}

/**
 * Context for display names
 */
type DisplayContext = {
  program: Program
  week: Week
  session: Session
  athlete: Athlete
}

/**
 * Build workout log from program prescription with display context.
 */
function buildWorkoutLogFromProgram(
  input: CreateLogInput,
  context: DisplayContext,
  generateId: () => string,
): ResultAsync<WorkoutLog, CreateLogError> {
  const { program, week, session, athlete } = context

  // Build logged exercises with pre-filled values from prescription
  const exercises = buildLoggedExercises(session, generateId)

  // Create domain entity via factory (validates)
  const logResult = createWorkoutLog({
    id: generateId(),
    organizationId: input.organizationId,
    athleteId: input.athleteId,
    programId: input.programId,
    sessionId: input.sessionId,
    weekId: input.weekId,
    logDate: input.logDate,
    status: 'partial', // Always starts as partial
    sessionRpe: null,
    sessionNotes: null,
    exercises,
    // Display context
    programName: program.name,
    weekName: week.name,
    sessionName: session.name,
    athleteName: athlete.name,
  })

  if (logResult.isErr()) {
    return errAsync({
      type: 'validation_error',
      message: logResult.error.message,
    })
  }

  return okAsync(logResult.value)
}

/**
 * Create a new workout log from program prescription.
 *
 * This use case:
 * 1. Checks authorization
 * 2. Checks if log already exists for athlete/session/week (returns error if so)
 * 3. Loads program aggregate to get prescription data
 * 4. Loads athlete for display name
 * 5. Extracts session and pre-fills exercises from prescription
 * 6. Creates domain entity via createWorkoutLog (validates)
 * 7. Returns pre-filled log for client-side editing (does NOT persist)
 *
 * The client will call saveLog after editing to persist.
 */
export const makeCreateLog =
  (deps: Dependencies) =>
  (input: CreateLogInput): ResultAsync<WorkoutLog, CreateLogError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'workout_log:create')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to log workouts',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Check if log already exists for this athlete/session/week
    return deps.workoutLogRepository
      .findByAthleteSessionWeek(ctx, input.athleteId, input.sessionId, input.weekId)
      .mapErr(
        (e): CreateLogError => ({
          type: 'repository_error',
          message: e.message,
        }),
      )
      .andThen((existingLog): ResultAsync<{ program: Program; athlete: Athlete }, CreateLogError> => {
        if (existingLog !== null) {
          return errAsync({
            type: 'log_already_exists',
            athleteId: input.athleteId,
            sessionId: input.sessionId,
            weekId: input.weekId,
          })
        }

        // 3. Load program and athlete in parallel for display context
        const programResult = deps.programRepository
          .loadProgramAggregate(ctx, input.programId)
          .mapErr(
            (e): CreateLogError => ({
              type: 'repository_error',
              message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
            }),
          )
          .andThen((program) => {
            if (program === null) {
              return errAsync<Program, CreateLogError>({
                type: 'program_not_found',
                programId: input.programId,
              })
            }
            return okAsync(program)
          })

        const athleteResult = deps.athleteRepository
          .findById(ctx, input.athleteId)
          .mapErr(
            (): CreateLogError => ({
              type: 'repository_error',
              message: 'Failed to load athlete',
            }),
          )
          .andThen((athlete) => {
            if (athlete === null) {
              return errAsync<Athlete, CreateLogError>({
                type: 'repository_error',
                message: `Athlete ${input.athleteId} not found`,
              })
            }
            return okAsync(athlete)
          })

        // Combine results in parallel
        return ResultAsync.combine([programResult, athleteResult]).map(([program, athlete]) => ({
          program,
          athlete,
        }))
      })
      .andThen(({ program, athlete }) => {
        // 4. Find week and session
        const week = program.weeks.find((w) => w.id === input.weekId)
        if (!week) {
          return errAsync<WorkoutLog, CreateLogError>({
            type: 'week_not_found',
            weekId: input.weekId,
          })
        }

        const session = week.sessions.find((s) => s.id === input.sessionId)
        if (!session) {
          return errAsync<WorkoutLog, CreateLogError>({
            type: 'session_not_found',
            sessionId: input.sessionId,
          })
        }

        // 5. Build log with display context
        return buildWorkoutLogFromProgram(input, { program, week, session, athlete }, deps.generateId)
      })
  }
