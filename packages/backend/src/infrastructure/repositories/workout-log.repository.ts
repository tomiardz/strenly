/**
 * WorkoutLogRepository Implementation
 *
 * Provides data access layer for workout logs following the aggregate pattern.
 * Uses DELETE + INSERT for save operations (same as program repository approach).
 *
 * All methods filter by organizationId for multi-tenancy.
 */

import type { LoggedExercise, LoggedSeries, WorkoutLog } from '@strenly/core/domain/entities/workout-log/types'
import { isLogStatus } from '@strenly/core/domain/entities/workout-log/types'
import { reconstituteWorkoutLog } from '@strenly/core/domain/entities/workout-log/workout-log'
import type {
  PendingWorkout,
  RecentActivityEntry,
  WorkoutLogFilters,
  WorkoutLogRepositoryError,
  WorkoutLogRepositoryPort,
} from '@strenly/core/ports/workout-log-repository.port'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import type { DbClient } from '@strenly/database'
import {
  athletes,
  type LoggedSeriesData,
  loggedExercises,
  programSessions,
  programs,
  programWeeks,
  workoutLogs,
} from '@strenly/database/schema'
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import { err, ok, ResultAsync as RA, type ResultAsync } from 'neverthrow'

// ============================================================================
// Error Helpers
// ============================================================================

function wrapDbError(error: unknown): WorkoutLogRepositoryError {
  // Check for constraint violations (unique constraint on athlete_session_week)
  if (error instanceof Error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return {
        type: 'CONFLICT',
        message: 'A workout log already exists for this athlete, session, and week',
      }
    }
  }

  return {
    type: 'DATABASE_ERROR',
    message: error instanceof Error ? error.message : 'Database operation failed',
    cause: error,
  }
}

function notFoundError(message: string): WorkoutLogRepositoryError {
  return { type: 'NOT_FOUND', message }
}

// ============================================================================
// Type Inference
// ============================================================================

type WorkoutLogRow = typeof workoutLogs.$inferSelect
type LoggedExerciseRow = typeof loggedExercises.$inferSelect

// ============================================================================
// Domain Mappers
// ============================================================================

/**
 * Map database series JSONB to domain LoggedSeries
 */
function mapDbSeriesToDomain(dbSeries: LoggedSeriesData[]): LoggedSeries[] {
  return dbSeries.map((s, index) => ({
    orderIndex: s.orderIndex ?? index,
    repsPerformed: s.repsPerformed,
    weightUsed: s.weightUsed,
    rpe: s.rpe,
    skipped: s.skipped,
    prescribedReps: s.prescribedReps,
    prescribedWeight: s.prescribedWeight,
    // Extended prescription snapshot
    prescribedRepsMax: s.prescribedRepsMax ?? null,
    prescribedIsAmrap: s.prescribedIsAmrap ?? false,
    prescribedIntensityType: s.prescribedIntensityType ?? null,
    prescribedIntensityValue: s.prescribedIntensityValue ?? null,
    prescribedTempo: s.prescribedTempo ?? null,
    prescribedRestSeconds: s.prescribedRestSeconds ?? null,
  }))
}

/**
 * Map domain LoggedSeries to database JSONB format
 */
function mapSeriesToDb(series: ReadonlyArray<LoggedSeries>): LoggedSeriesData[] {
  return series.map((s, index) => ({
    orderIndex: s.orderIndex ?? index,
    repsPerformed: s.repsPerformed,
    weightUsed: s.weightUsed,
    rpe: s.rpe,
    skipped: s.skipped,
    prescribedReps: s.prescribedReps,
    prescribedWeight: s.prescribedWeight,
    // Extended prescription snapshot
    prescribedRepsMax: s.prescribedRepsMax,
    prescribedIsAmrap: s.prescribedIsAmrap,
    prescribedIntensityType: s.prescribedIntensityType,
    prescribedIntensityValue: s.prescribedIntensityValue,
    prescribedTempo: s.prescribedTempo,
    prescribedRestSeconds: s.prescribedRestSeconds,
  }))
}

/**
 * Map database rows to domain LoggedExercise
 */
function mapExerciseRowToDomain(row: LoggedExerciseRow): LoggedExercise {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    groupItemId: row.groupItemId,
    orderIndex: row.orderIndex,
    notes: row.notes,
    skipped: row.skipped,
    series: mapDbSeriesToDomain(row.series),
    // Group display info
    groupLabel: row.groupLabel,
    groupOrder: row.groupOrder,
  }
}

/**
 * Map database workout log row with exercises to domain WorkoutLog
 */
function mapToDomain(logRow: WorkoutLogRow, exerciseRows: LoggedExerciseRow[]): WorkoutLog {
  const status = isLogStatus(logRow.status) ? logRow.status : 'partial'

  return reconstituteWorkoutLog({
    id: logRow.id,
    organizationId: logRow.organizationId,
    athleteId: logRow.athleteId,
    programId: logRow.programId,
    sessionId: logRow.sessionId,
    weekId: logRow.weekId,
    logDate: logRow.logDate,
    status,
    sessionRpe: logRow.sessionRpe,
    sessionNotes: logRow.sessionNotes,
    exercises: exerciseRows.map(mapExerciseRowToDomain),
    createdAt: logRow.createdAt,
    updatedAt: logRow.updatedAt,
    // Display context
    programName: logRow.programName,
    weekName: logRow.weekName,
    sessionName: logRow.sessionName,
    athleteName: logRow.athleteName,
  })
}

/**
 * Ensure log ID has 'log-' prefix
 */
function ensureLogPrefix(id: string): string {
  return id.startsWith('log-') ? id : `log-${id}`
}

/**
 * Ensure logged exercise ID has 'lex-' prefix
 */
function ensureLexPrefix(id: string): string {
  return id.startsWith('lex-') ? id : `lex-${id}`
}

// ============================================================================
// Repository Factory
// ============================================================================

export function createWorkoutLogRepository(db: DbClient): WorkoutLogRepositoryPort {
  /**
   * Helper to verify a workout log exists and belongs to the organization
   */
  async function verifyLogAccess(ctx: OrganizationContext, logId: string): Promise<WorkoutLogRow | null> {
    const rows = await db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.organizationId, ctx.organizationId)))

    return rows[0] ?? null
  }

  /**
   * Helper to load exercises for a workout log
   */
  async function loadExercisesForLog(logId: string): Promise<LoggedExerciseRow[]> {
    return db.select().from(loggedExercises).where(eq(loggedExercises.logId, logId)).orderBy(loggedExercises.orderIndex)
  }

  return {
    // -------------------------------------------------------------------------
    // save - Atomic DELETE + INSERT for aggregate persistence
    // -------------------------------------------------------------------------

    save(ctx: OrganizationContext, log: WorkoutLog): ResultAsync<void, WorkoutLogRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: WorkoutLogRepositoryError }> => {
          const logId = ensureLogPrefix(log.id)
          const now = new Date()

          await db.transaction(async (tx) => {
            // 1. DELETE existing logged_exercises for this log (if exists)
            await tx.delete(loggedExercises).where(eq(loggedExercises.logId, logId))

            // 2. DELETE existing workout_log record (if exists)
            await tx.delete(workoutLogs).where(eq(workoutLogs.id, logId))

            // 3. INSERT new workout_log record
            await tx.insert(workoutLogs).values({
              id: logId,
              organizationId: ctx.organizationId,
              athleteId: log.athleteId,
              programId: log.programId,
              sessionId: log.sessionId,
              weekId: log.weekId,
              logDate: log.logDate,
              status: log.status,
              sessionRpe: log.sessionRpe,
              sessionNotes: log.sessionNotes,
              // Display context
              programName: log.programName,
              weekName: log.weekName,
              sessionName: log.sessionName,
              athleteName: log.athleteName,
              createdAt: log.createdAt ?? now,
              updatedAt: now,
            })

            // 4. INSERT all logged_exercises with series as JSONB
            for (const exercise of log.exercises) {
              await tx.insert(loggedExercises).values({
                id: ensureLexPrefix(exercise.id),
                logId,
                exerciseId: exercise.exerciseId,
                groupItemId: exercise.groupItemId,
                orderIndex: exercise.orderIndex,
                notes: exercise.notes,
                skipped: exercise.skipped,
                series: mapSeriesToDb(exercise.series),
                // Group display info
                groupLabel: exercise.groupLabel,
                groupOrder: exercise.groupOrder,
                createdAt: now,
                updatedAt: now,
              })
            }
          })

          return { ok: true }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(undefined)
      })
    },

    // -------------------------------------------------------------------------
    // findById - Load workout log with all exercises
    // -------------------------------------------------------------------------

    findById(ctx: OrganizationContext, logId: string): ResultAsync<WorkoutLog | null, WorkoutLogRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: WorkoutLog | null } | { ok: false; error: WorkoutLogRepositoryError }> => {
          const prefixedId = ensureLogPrefix(logId)

          // Query workout_logs with organizationId filter
          const logRow = await verifyLogAccess(ctx, prefixedId)
          if (!logRow) {
            return { ok: true, data: null }
          }

          // Load exercises for this log
          const exerciseRows = await loadExercisesForLog(prefixedId)

          return { ok: true, data: mapToDomain(logRow, exerciseRows) }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    // -------------------------------------------------------------------------
    // findByAthleteSessionWeek - Check existence before creating new log
    // -------------------------------------------------------------------------

    findByAthleteSessionWeek(
      ctx: OrganizationContext,
      athleteId: string,
      sessionId: string,
      weekId: string,
    ): ResultAsync<WorkoutLog | null, WorkoutLogRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: WorkoutLog | null } | { ok: false; error: WorkoutLogRepositoryError }> => {
          // Query with all three conditions + organizationId
          const logRows = await db
            .select()
            .from(workoutLogs)
            .where(
              and(
                eq(workoutLogs.organizationId, ctx.organizationId),
                eq(workoutLogs.athleteId, athleteId),
                eq(workoutLogs.sessionId, sessionId),
                eq(workoutLogs.weekId, weekId),
              ),
            )

          const logRow = logRows[0]
          if (!logRow) {
            return { ok: true, data: null }
          }

          // Load exercises for this log
          const exerciseRows = await loadExercisesForLog(logRow.id)

          return { ok: true, data: mapToDomain(logRow, exerciseRows) }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    // -------------------------------------------------------------------------
    // listByAthlete - Paginated list with filters
    // -------------------------------------------------------------------------

    listByAthlete(
      ctx: OrganizationContext,
      athleteId: string,
      filters: Omit<WorkoutLogFilters, 'athleteId'>,
    ): ResultAsync<{ items: WorkoutLog[]; totalCount: number }, WorkoutLogRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<
          | { ok: true; data: { items: WorkoutLog[]; totalCount: number } }
          | { ok: false; error: WorkoutLogRepositoryError }
        > => {
          // Build conditions
          const conditions = [eq(workoutLogs.organizationId, ctx.organizationId), eq(workoutLogs.athleteId, athleteId)]

          // Optional status filter
          if (filters.status) {
            conditions.push(eq(workoutLogs.status, filters.status))
          }

          // Optional date range filters
          if (filters.fromDate) {
            conditions.push(gte(workoutLogs.logDate, filters.fromDate))
          }
          if (filters.toDate) {
            conditions.push(lte(workoutLogs.logDate, filters.toDate))
          }

          // Optional program filter
          if (filters.programId) {
            conditions.push(eq(workoutLogs.programId, filters.programId))
          }

          const whereClause = and(...conditions)

          // Get total count and paginated logs in parallel
          const [countResult, logRows] = await Promise.all([
            db.select({ count: count() }).from(workoutLogs).where(whereClause),
            db
              .select()
              .from(workoutLogs)
              .where(whereClause)
              .orderBy(desc(workoutLogs.logDate))
              .limit(filters.limit)
              .offset(filters.offset),
          ])

          const totalCount = countResult[0]?.count ?? 0

          // Batch load exercises for all logs to avoid N+1
          if (logRows.length === 0) {
            return { ok: true, data: { items: [], totalCount } }
          }

          const logIds = logRows.map((l) => l.id)
          const allExercises = await db
            .select()
            .from(loggedExercises)
            .where(inArray(loggedExercises.logId, logIds))
            .orderBy(loggedExercises.orderIndex)

          // Group exercises by log ID
          const exercisesByLogId = new Map<string, LoggedExerciseRow[]>()
          for (const exercise of allExercises) {
            const existing = exercisesByLogId.get(exercise.logId) ?? []
            existing.push(exercise)
            exercisesByLogId.set(exercise.logId, existing)
          }

          // Map to domain
          const items = logRows.map((logRow) => {
            const exercises = exercisesByLogId.get(logRow.id) ?? []
            return mapToDomain(logRow, exercises)
          })

          return { ok: true, data: { items, totalCount } }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    // -------------------------------------------------------------------------
    // listPendingWorkouts - Sessions without logs for dashboard
    // -------------------------------------------------------------------------

    listPendingWorkouts(
      ctx: OrganizationContext,
      filters: { limit: number; offset: number },
    ): ResultAsync<{ items: PendingWorkout[]; totalCount: number }, WorkoutLogRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<
          | { ok: true; data: { items: PendingWorkout[]; totalCount: number } }
          | { ok: false; error: WorkoutLogRepositoryError }
        > => {
          const { limit, offset } = filters

          const whereConditions = and(
            eq(programs.organizationId, ctx.organizationId),
            eq(programs.status, 'active'),
            isNotNull(programs.athleteId),
            isNull(workoutLogs.id),
          )

          const [pendingRows, countResult] = await Promise.all([
            db
              .selectDistinct({
                athleteId: athletes.id,
                athleteName: athletes.name,
                programId: programs.id,
                programName: programs.name,
                sessionId: programSessions.id,
                sessionName: programSessions.name,
                weekId: programWeeks.id,
                weekName: programWeeks.name,
              })
              .from(programs)
              .innerJoin(athletes, eq(programs.athleteId, athletes.id))
              .innerJoin(programWeeks, eq(programWeeks.programId, programs.id))
              .innerJoin(programSessions, eq(programSessions.programId, programs.id))
              .leftJoin(
                workoutLogs,
                and(
                  eq(workoutLogs.athleteId, athletes.id),
                  eq(workoutLogs.sessionId, programSessions.id),
                  eq(workoutLogs.weekId, programWeeks.id),
                ),
              )
              .where(whereConditions)
              .orderBy(
                asc(athletes.name),
                asc(programs.name),
                asc(programWeeks.orderIndex),
                asc(programSessions.orderIndex),
              )
              .limit(limit)
              .offset(offset),

            db
              .select({ count: count() })
              .from(programs)
              .innerJoin(athletes, eq(programs.athleteId, athletes.id))
              .innerJoin(programWeeks, eq(programWeeks.programId, programs.id))
              .innerJoin(programSessions, eq(programSessions.programId, programs.id))
              .leftJoin(
                workoutLogs,
                and(
                  eq(workoutLogs.athleteId, athletes.id),
                  eq(workoutLogs.sessionId, programSessions.id),
                  eq(workoutLogs.weekId, programWeeks.id),
                ),
              )
              .where(whereConditions),
          ])

          const items: PendingWorkout[] = pendingRows.map((row) => ({
            athleteId: row.athleteId,
            athleteName: row.athleteName,
            programId: row.programId,
            programName: row.programName,
            sessionId: row.sessionId,
            sessionName: row.sessionName,
            weekId: row.weekId,
            weekName: row.weekName,
          }))

          const totalCount = countResult[0]?.count ?? 0

          return { ok: true, data: { items, totalCount } }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    // -------------------------------------------------------------------------
    // delete - Remove workout log (cascade handles logged_exercises)
    // -------------------------------------------------------------------------

    delete(ctx: OrganizationContext, logId: string): ResultAsync<void, WorkoutLogRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: WorkoutLogRepositoryError }> => {
          const prefixedId = ensureLogPrefix(logId)

          // Verify log exists and belongs to organization
          const existingLog = await verifyLogAccess(ctx, prefixedId)
          if (!existingLog) {
            return { ok: false, error: notFoundError(`Workout log not found: ${logId}`) }
          }

          // DELETE from workout_logs (cascade handles logged_exercises)
          await db.delete(workoutLogs).where(eq(workoutLogs.id, prefixedId))

          return { ok: true }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(undefined)
      })
    },

    // -------------------------------------------------------------------------
    // countCompletedSince - Count completed/partial logs since a date
    // -------------------------------------------------------------------------

    countCompletedSince(ctx: OrganizationContext, since: Date): ResultAsync<number, WorkoutLogRepositoryError> {
      return RA.fromPromise(
        db
          .select({ count: count() })
          .from(workoutLogs)
          .where(
            and(
              eq(workoutLogs.organizationId, ctx.organizationId),
              gte(workoutLogs.logDate, since),
              inArray(workoutLogs.status, ['completed', 'partial']),
            ),
          )
          .then((rows) => rows[0]?.count ?? 0),
        wrapDbError,
      )
    },

    // -------------------------------------------------------------------------
    // listRecent - Most recent workout logs with denormalized fields
    // -------------------------------------------------------------------------

    listRecent(ctx: OrganizationContext, limit: number): ResultAsync<RecentActivityEntry[], WorkoutLogRepositoryError> {
      return RA.fromPromise(
        db
          .select({
            id: workoutLogs.id,
            athleteName: workoutLogs.athleteName,
            sessionName: workoutLogs.sessionName,
            programName: workoutLogs.programName,
            logDate: workoutLogs.logDate,
            status: workoutLogs.status,
          })
          .from(workoutLogs)
          .where(eq(workoutLogs.organizationId, ctx.organizationId))
          .orderBy(desc(workoutLogs.logDate))
          .limit(limit)
          .then((rows) =>
            rows.map((row) => ({
              id: row.id,
              athleteName: row.athleteName,
              sessionName: row.sessionName,
              programName: row.programName,
              logDate: row.logDate,
              status: isLogStatus(row.status) ? row.status : ('partial' as const),
            })),
          ),
        wrapDbError,
      )
    },
  }
}
