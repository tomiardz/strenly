import { type Program as ProgramAggregate, reconstituteProgram } from '@strenly/core/domain/entities/program/program'
import type { Program, Series } from '@strenly/core/domain/entities/program/types'
import {
  type ExerciseGroup,
  type GroupItem,
  type IntensityType,
  isProgramStatus as isAggregateStatus,
  isProgramStatus,
  mapIntensityTypeToUnit,
  type Session,
  type Week,
} from '@strenly/core/domain/entities/program/types'
import type {
  ExerciseGroupData,
  ExerciseRowWithPrescriptions,
  PrescriptionSeriesData,
  ProgramExerciseRow,
  ProgramFilters,
  ProgramRepositoryError,
  ProgramRepositoryPort,
  ProgramSession,
  ProgramWeek,
  ProgramWithDetails,
  SaveDraftInput,
  SessionWithRows,
} from '@strenly/core/ports/program-repository.port'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import type { DbClient } from '@strenly/database'
import {
  type PrescriptionSeriesData as DbPrescriptionSeriesData,
  exerciseGroups,
  exercises,
  prescriptions,
  programExercises,
  programSessions,
  programs,
  programWeeks,
} from '@strenly/database/schema'
import { and, asc, count, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import { err, ok, ResultAsync as RA, type ResultAsync } from 'neverthrow'

// ============================================================================
// Error Helpers
// ============================================================================

function wrapDbError(error: unknown): ProgramRepositoryError {
  return {
    type: 'DATABASE_ERROR',
    message: error instanceof Error ? error.message : 'Database operation failed',
    cause: error,
  }
}

function notFoundError(
  entityType: 'program' | 'week' | 'session' | 'exercise_row' | 'prescription' | 'group',
  id: string,
): ProgramRepositoryError {
  return { type: 'NOT_FOUND', entityType, id }
}

function dbError(message: string): ProgramRepositoryError {
  return { type: 'DATABASE_ERROR', message }
}

// ============================================================================
// Type Inference
// ============================================================================

type ProgramRow = typeof programs.$inferSelect
type WeekRow = typeof programWeeks.$inferSelect
type SessionRow = typeof programSessions.$inferSelect
type ExerciseRowDb = typeof programExercises.$inferSelect
type PrescriptionRow = typeof prescriptions.$inferSelect
type ExerciseGroupRow = typeof exerciseGroups.$inferSelect

// ============================================================================
// Domain Mappers
// ============================================================================

function mapProgramToDomain(row: ProgramRow): Program {
  const status = isProgramStatus(row.status) ? row.status : 'draft'

  return reconstituteProgram({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    athleteId: row.athleteId,
    isTemplate: row.isTemplate,
    status,
    weeks: [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

function mapWeekToDomain(row: WeekRow): ProgramWeek {
  return {
    id: row.id,
    programId: row.programId,
    name: row.name,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapSessionToDomain(row: SessionRow): ProgramSession {
  return {
    id: row.id,
    programId: row.programId,
    name: row.name,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapExerciseRowToDomain(row: ExerciseRowDb): ProgramExerciseRow {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    orderIndex: row.orderIndex,
    // Group-based fields
    groupId: row.groupId,
    orderWithinGroup: row.orderWithinGroup,
    // Other fields
    setTypeLabel: row.setTypeLabel,
    notes: row.notes,
    restSeconds: row.restSeconds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapExerciseGroupToDomain(row: ExerciseGroupRow): ExerciseGroupData {
  return {
    id: row.id,
    sessionId: row.sessionId,
    orderIndex: row.orderIndex,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Map database series to domain Series format
 */
function mapDbSeriesToDomain(dbSeries: DbPrescriptionSeriesData[]): Series[] {
  return dbSeries.map((s, i) => ({
    orderIndex: i,
    reps: s.reps,
    repsMax: s.repsMax,
    isAmrap: s.isAmrap,
    intensityType: mapDbIntensityType(s.intensityType),
    intensityValue: s.intensityValue,
    tempo: s.tempo,
    restSeconds: s.restSeconds,
  }))
}

/**
 * Map domain Series array to database format for storage
 */
function mapSeriesToDb(series: Series[]): DbPrescriptionSeriesData[] {
  return series.map((s, i) => ({
    orderIndex: i,
    reps: s.reps,
    repsMax: s.repsMax,
    isAmrap: s.isAmrap,
    intensityType: s.intensityType,
    intensityValue: s.intensityValue,
    intensityUnit: mapIntensityTypeToUnit(s.intensityType),
    tempo: s.tempo,
    restSeconds: s.restSeconds,
  }))
}

/**
 * Map database intensityType to domain IntensityType
 */
function mapDbIntensityType(type: DbPrescriptionSeriesData['intensityType']): IntensityType | null {
  if (!type) return null
  return type // Types are the same: 'absolute' | 'percentage' | 'rpe' | 'rir'
}

// ============================================================================
// Repository Factory
// ============================================================================

export function createProgramRepository(db: DbClient): ProgramRepositoryPort {
  /**
   * Helper to verify a program exists and belongs to the organization.
   * Used for nested operations that need to validate ownership.
   */
  async function verifyProgramAccess(ctx: OrganizationContext, programId: string): Promise<ProgramRow | null> {
    const rows = await db
      .select()
      .from(programs)
      .where(and(eq(programs.id, programId), eq(programs.organizationId, ctx.organizationId)))

    return rows[0] ?? null
  }

  /**
   * Helper to verify a week exists and belongs to the organization.
   */
  async function verifyWeekAccess(ctx: OrganizationContext, weekId: string): Promise<WeekRow | null> {
    const rows = await db
      .select({ week: programWeeks, program: programs })
      .from(programWeeks)
      .innerJoin(programs, eq(programWeeks.programId, programs.id))
      .where(and(eq(programWeeks.id, weekId), eq(programs.organizationId, ctx.organizationId)))

    return rows[0]?.week ?? null
  }

  /**
   * Helper to verify a session exists and belongs to the organization.
   */
  async function verifySessionAccess(ctx: OrganizationContext, sessionId: string): Promise<SessionRow | null> {
    const rows = await db
      .select({ session: programSessions, program: programs })
      .from(programSessions)
      .innerJoin(programs, eq(programSessions.programId, programs.id))
      .where(and(eq(programSessions.id, sessionId), eq(programs.organizationId, ctx.organizationId)))

    return rows[0]?.session ?? null
  }

  /**
   * Helper to verify an exercise row exists and belongs to the organization.
   */
  async function verifyExerciseRowAccess(ctx: OrganizationContext, rowId: string): Promise<ExerciseRowDb | null> {
    const rows = await db
      .select({ row: programExercises, program: programs })
      .from(programExercises)
      .innerJoin(programSessions, eq(programExercises.sessionId, programSessions.id))
      .innerJoin(programs, eq(programSessions.programId, programs.id))
      .where(and(eq(programExercises.id, rowId), eq(programs.organizationId, ctx.organizationId)))

    return rows[0]?.row ?? null
  }

  /**
   * Helper to verify an exercise group exists and belongs to the organization.
   */
  async function verifyGroupAccess(ctx: OrganizationContext, groupId: string): Promise<ExerciseGroupRow | null> {
    const rows = await db
      .select({ group: exerciseGroups, program: programs })
      .from(exerciseGroups)
      .innerJoin(programSessions, eq(exerciseGroups.sessionId, programSessions.id))
      .innerJoin(programs, eq(programSessions.programId, programs.id))
      .where(and(eq(exerciseGroups.id, groupId), eq(programs.organizationId, ctx.organizationId)))

    return rows[0]?.group ?? null
  }

  return {
    // -------------------------------------------------------------------------
    // Aggregate Operations (NEW - Primary Interface)
    // -------------------------------------------------------------------------

    saveProgramAggregate(
      ctx: OrganizationContext,
      program: ProgramAggregate,
    ): ResultAsync<{ updatedAt: Date }, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: { updatedAt: Date } } | { ok: false; error: ProgramRepositoryError }> => {
          // 1. Check if program exists
          const existingProgram = await verifyProgramAccess(ctx, program.id)
          const isCreate = !existingProgram

          const updatedAt = new Date()

          await db.transaction(async (tx) => {
            if (isCreate) {
              // 2a. For CREATE: Insert the program row first
              await tx.insert(programs).values({
                id: program.id,
                organizationId: ctx.organizationId,
                name: program.name,
                description: program.description,
                athleteId: program.athleteId,
                isTemplate: program.isTemplate,
                status: program.status,
                createdAt: updatedAt,
                updatedAt,
              })
            } else {
              // 2b. For UPDATE: Delete all children in reverse dependency order
              // Get all session IDs for this program to delete their children
              const sessionRows = await tx
                .select({ id: programSessions.id })
                .from(programSessions)
                .where(eq(programSessions.programId, program.id))
              const sessionIds = sessionRows.map((s) => s.id)

              // Get all week IDs for this program
              const weekRowsForDelete = await tx
                .select({ id: programWeeks.id })
                .from(programWeeks)
                .where(eq(programWeeks.programId, program.id))
              const weekIds = weekRowsForDelete.map((w) => w.id)

              if (weekIds.length > 0) {
                await tx.delete(prescriptions).where(inArray(prescriptions.weekId, weekIds))
              }
              if (sessionIds.length > 0) {
                await tx.delete(programExercises).where(inArray(programExercises.sessionId, sessionIds))
                await tx.delete(exerciseGroups).where(inArray(exerciseGroups.sessionId, sessionIds))
              }
              await tx.delete(programSessions).where(eq(programSessions.programId, program.id))
              await tx.delete(programWeeks).where(eq(programWeeks.programId, program.id))
            }

            // 3. Insert weeks
            for (const week of program.weeks) {
              await tx.insert(programWeeks).values({
                id: week.id,
                programId: program.id,
                name: week.name,
                orderIndex: week.orderIndex,
                createdAt: updatedAt,
                updatedAt,
              })
            }

            // 4. Insert sessions ONCE (at program level)
            // Sessions are shared across weeks - take structure from first week
            const firstWeek = program.weeks[0]
            if (firstWeek) {
              for (const session of firstWeek.sessions) {
                await tx.insert(programSessions).values({
                  id: session.id,
                  programId: program.id,
                  name: session.name,
                  orderIndex: session.orderIndex,
                  createdAt: updatedAt,
                  updatedAt,
                })

                // 5. Insert exercise groups for each session
                for (const group of session.exerciseGroups) {
                  await tx.insert(exerciseGroups).values({
                    id: group.id,
                    sessionId: session.id,
                    orderIndex: group.orderIndex,
                    name: null, // Domain aggregate doesn't track group names yet
                    createdAt: updatedAt,
                    updatedAt,
                  })

                  // 6. Insert program exercises (items) for each group
                  for (const item of group.items) {
                    await tx.insert(programExercises).values({
                      id: item.id,
                      sessionId: session.id,
                      exerciseId: item.exerciseId,
                      orderIndex: item.orderIndex,
                      groupId: group.id,
                      orderWithinGroup: item.orderIndex,
                      setTypeLabel: null,
                      notes: null,
                      restSeconds: null,
                      createdAt: updatedAt,
                      updatedAt,
                    })
                  }
                }
              }
            }

            // 7. Insert prescriptions for each week
            // Each week has the same session/group/item structure but different series values
            for (const week of program.weeks) {
              for (const session of week.sessions) {
                for (const group of session.exerciseGroups) {
                  for (const item of group.items) {
                    // Only insert prescription if there are series
                    if (item.series.length > 0) {
                      const seriesData: DbPrescriptionSeriesData[] = item.series.map((s, i) => ({
                        orderIndex: i,
                        reps: s.reps,
                        repsMax: s.repsMax,
                        isAmrap: s.isAmrap,
                        intensityType: s.intensityType,
                        intensityValue: s.intensityValue,
                        intensityUnit: mapIntensityTypeToUnit(s.intensityType),
                        tempo: s.tempo,
                        restSeconds: s.restSeconds,
                      }))

                      await tx.insert(prescriptions).values({
                        id: `rx-${crypto.randomUUID()}`,
                        programExerciseId: item.id,
                        weekId: week.id,
                        series: seriesData,
                        createdAt: updatedAt,
                        updatedAt,
                      })
                    }
                  }
                }
              }
            }

            // 8. Update program metadata (only for update, not create - already inserted above)
            if (!isCreate) {
              await tx
                .update(programs)
                .set({
                  name: program.name,
                  description: program.description,
                  athleteId: program.athleteId,
                  isTemplate: program.isTemplate,
                  status: program.status,
                  updatedAt,
                })
                .where(eq(programs.id, program.id))
            }
          })

          return { ok: true, data: { updatedAt } }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    loadProgramAggregate(
      ctx: OrganizationContext,
      programId: string,
    ): ResultAsync<ProgramAggregate | null, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<
          { ok: true; data: ProgramAggregate | null } | { ok: false; error: ProgramRepositoryError }
        > => {
          // 1. Load program row
          const programRows = await db
            .select()
            .from(programs)
            .where(and(eq(programs.id, programId), eq(programs.organizationId, ctx.organizationId)))

          const programRow = programRows[0]
          if (!programRow) {
            return { ok: true, data: null }
          }

          // 2. Load weeks ordered by orderIndex
          const weekRows = await db
            .select()
            .from(programWeeks)
            .where(eq(programWeeks.programId, programId))
            .orderBy(asc(programWeeks.orderIndex))

          // 3. Load sessions (at program level) ordered by orderIndex
          const sessionRows = await db
            .select()
            .from(programSessions)
            .where(eq(programSessions.programId, programId))
            .orderBy(asc(programSessions.orderIndex))

          const sessionIds = sessionRows.map((s) => s.id)

          // 4. Load exercise groups for all sessions
          let groupRows: ExerciseGroupRow[] = []
          if (sessionIds.length > 0) {
            groupRows = await db
              .select()
              .from(exerciseGroups)
              .where(inArray(exerciseGroups.sessionId, sessionIds))
              .orderBy(asc(exerciseGroups.orderIndex))
          }

          // 5. Load program exercises (items) for all sessions
          let exerciseRows: ExerciseRowDb[] = []
          if (sessionIds.length > 0) {
            exerciseRows = await db
              .select()
              .from(programExercises)
              .where(inArray(programExercises.sessionId, sessionIds))
              .orderBy(asc(programExercises.orderIndex))
          }

          const exerciseIds = exerciseRows.map((e) => e.id)
          const weekIds = weekRows.map((w) => w.id)

          // 6. Load all prescriptions
          let prescriptionRows: PrescriptionRow[] = []
          if (exerciseIds.length > 0 && weekIds.length > 0) {
            prescriptionRows = await db
              .select()
              .from(prescriptions)
              .where(inArray(prescriptions.programExerciseId, exerciseIds))
          }

          // 7. Build lookup maps
          // Groups by session
          const groupsBySession = new Map<string, ExerciseGroupRow[]>()
          for (const group of groupRows) {
            const existing = groupsBySession.get(group.sessionId) ?? []
            existing.push(group)
            groupsBySession.set(group.sessionId, existing)
          }

          // Exercises by group (or by session if no group)
          const exercisesByGroup = new Map<string, ExerciseRowDb[]>()
          const exercisesBySession = new Map<string, ExerciseRowDb[]>()
          for (const exercise of exerciseRows) {
            if (exercise.groupId) {
              const existing = exercisesByGroup.get(exercise.groupId) ?? []
              existing.push(exercise)
              exercisesByGroup.set(exercise.groupId, existing)
            } else {
              const existing = exercisesBySession.get(exercise.sessionId) ?? []
              existing.push(exercise)
              exercisesBySession.set(exercise.sessionId, existing)
            }
          }

          // Prescriptions by (exerciseId, weekId)
          const prescriptionsByKey = new Map<string, PrescriptionRow>()
          for (const prescription of prescriptionRows) {
            const key = `${prescription.programExerciseId}:${prescription.weekId}`
            prescriptionsByKey.set(key, prescription)
          }

          // 8. Build the aggregate hierarchy
          // For each week, reconstruct the session structure with that week's prescriptions
          const weeks: Week[] = weekRows.map((weekRow) => {
            const sessions: Session[] = sessionRows.map((sessionRow) => {
              const sessionGroups = groupsBySession.get(sessionRow.id) ?? []
              const ungroupedExercises = exercisesBySession.get(sessionRow.id) ?? []

              // Build exercise groups
              const exerciseGroupsList: ExerciseGroup[] = sessionGroups.map((groupRow) => {
                const groupExercises = exercisesByGroup.get(groupRow.id) ?? []

                const items: GroupItem[] = groupExercises.map((exerciseRow) => {
                  // Get prescription for this exercise + week
                  const prescriptionKey = `${exerciseRow.id}:${weekRow.id}`
                  const prescription = prescriptionsByKey.get(prescriptionKey)

                  const series: Series[] = prescription
                    ? prescription.series.map((s, i) => ({
                        orderIndex: i,
                        reps: s.reps,
                        repsMax: s.repsMax,
                        isAmrap: s.isAmrap,
                        intensityType: mapDbIntensityType(s.intensityType),
                        intensityValue: s.intensityValue,
                        tempo: s.tempo,
                        restSeconds: s.restSeconds,
                      }))
                    : []

                  return {
                    id: exerciseRow.id,
                    exerciseId: exerciseRow.exerciseId,
                    orderIndex: exerciseRow.orderIndex,
                    series,
                  }
                })

                return {
                  id: groupRow.id,
                  orderIndex: groupRow.orderIndex,
                  items,
                }
              })

              // Add ungrouped exercises as single-item groups
              // Each ungrouped exercise becomes its own group
              let nextGroupOrder = exerciseGroupsList.length
              for (const exerciseRow of ungroupedExercises) {
                const prescriptionKey = `${exerciseRow.id}:${weekRow.id}`
                const prescription = prescriptionsByKey.get(prescriptionKey)

                const series: Series[] = prescription
                  ? prescription.series.map((s, i) => ({
                      orderIndex: i,
                      reps: s.reps,
                      repsMax: s.repsMax,
                      isAmrap: s.isAmrap,
                      intensityType: mapDbIntensityType(s.intensityType),
                      intensityValue: s.intensityValue,
                      tempo: s.tempo,
                      restSeconds: s.restSeconds,
                    }))
                  : []

                exerciseGroupsList.push({
                  id: `eg-synthetic-${exerciseRow.id}`,
                  orderIndex: nextGroupOrder++,
                  items: [
                    {
                      id: exerciseRow.id,
                      exerciseId: exerciseRow.exerciseId,
                      orderIndex: 0,
                      series,
                    },
                  ],
                })
              }

              // Sort by orderIndex
              exerciseGroupsList.sort((a, b) => a.orderIndex - b.orderIndex)

              return {
                id: sessionRow.id,
                name: sessionRow.name,
                orderIndex: sessionRow.orderIndex,
                exerciseGroups: exerciseGroupsList,
              }
            })

            return {
              id: weekRow.id,
              name: weekRow.name,
              orderIndex: weekRow.orderIndex,
              sessions,
            }
          })

          // 9. Reconstitute the program aggregate
          const status = isAggregateStatus(programRow.status) ? programRow.status : 'draft'

          const programAggregate = reconstituteProgram({
            id: programRow.id,
            organizationId: programRow.organizationId,
            name: programRow.name,
            description: programRow.description,
            athleteId: programRow.athleteId,
            isTemplate: programRow.isTemplate,
            status,
            weeks,
            createdAt: programRow.createdAt,
            updatedAt: programRow.updatedAt,
          })

          return { ok: true, data: programAggregate }
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
    // Program CRUD (Legacy)
    // -------------------------------------------------------------------------

    findById(ctx: OrganizationContext, id: string): ResultAsync<Program | null, ProgramRepositoryError> {
      return RA.fromPromise(
        db
          .select()
          .from(programs)
          .where(and(eq(programs.id, id), eq(programs.organizationId, ctx.organizationId)))
          .then((rows) => rows[0]),
        wrapDbError,
      ).andThen((row) => {
        if (!row) {
          return ok(null)
        }
        return ok(mapProgramToDomain(row))
      })
    },

    update(ctx: OrganizationContext, program: Program): ResultAsync<Program, ProgramRepositoryError> {
      return RA.fromPromise(
        db
          .update(programs)
          .set({
            name: program.name,
            description: program.description,
            athleteId: program.athleteId,
            isTemplate: program.isTemplate,
            status: program.status,
            updatedAt: new Date(),
          })
          .where(and(eq(programs.id, program.id), eq(programs.organizationId, ctx.organizationId)))
          .returning()
          .then((rows) => rows[0]),
        wrapDbError,
      ).andThen((row) => {
        if (!row) {
          return err(notFoundError('program', program.id))
        }
        return ok(mapProgramToDomain(row))
      })
    },

    list(
      ctx: OrganizationContext,
      filters: ProgramFilters,
    ): ResultAsync<{ items: Program[]; totalCount: number }, ProgramRepositoryError> {
      return RA.fromPromise(
        (async () => {
          const conditions = [eq(programs.organizationId, ctx.organizationId)]

          if (filters.status) {
            conditions.push(eq(programs.status, filters.status))
          }

          if (filters.athleteId !== undefined) {
            if (filters.athleteId === null) {
              conditions.push(isNull(programs.athleteId))
            } else {
              conditions.push(eq(programs.athleteId, filters.athleteId))
            }
          }

          if (filters.isTemplate !== undefined) {
            conditions.push(eq(programs.isTemplate, filters.isTemplate))
          }

          if (filters.search) {
            const escaped = filters.search.replace(/[%_]/g, '\\$&')
            conditions.push(ilike(programs.name, `%${escaped}%`))
          }

          const whereClause = and(...conditions)

          const [countResult, rows] = await Promise.all([
            db.select({ count: count() }).from(programs).where(whereClause),
            db
              .select()
              .from(programs)
              .where(whereClause)
              .orderBy(asc(programs.name))
              .limit(filters.limit)
              .offset(filters.offset),
          ])

          const items = rows.map(mapProgramToDomain)

          return { items, totalCount: countResult[0]?.count ?? 0 }
        })(),
        wrapDbError,
      )
    },

    findWithDetails(
      ctx: OrganizationContext,
      id: string,
    ): ResultAsync<ProgramWithDetails | null, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<
          { ok: true; data: ProgramWithDetails | null } | { ok: false; error: ProgramRepositoryError }
        > => {
          // 1. Fetch program
          const programRows = await db
            .select()
            .from(programs)
            .where(and(eq(programs.id, id), eq(programs.organizationId, ctx.organizationId)))

          const programRow = programRows[0]
          if (!programRow) {
            return { ok: true, data: null }
          }

          const program = mapProgramToDomain(programRow)

          // 2. Fetch weeks
          const weekRows = await db
            .select()
            .from(programWeeks)
            .where(eq(programWeeks.programId, id))
            .orderBy(asc(programWeeks.orderIndex))

          const weeks = weekRows.map(mapWeekToDomain)

          // 3. Fetch sessions
          const sessionRows = await db
            .select()
            .from(programSessions)
            .where(eq(programSessions.programId, id))
            .orderBy(asc(programSessions.orderIndex))

          // 3.5. Fetch exercise groups for all sessions
          const sessionIds = sessionRows.map((s) => s.id)
          let groupRows: ExerciseGroupRow[] = []
          if (sessionIds.length > 0) {
            groupRows = await db
              .select()
              .from(exerciseGroups)
              .where(inArray(exerciseGroups.sessionId, sessionIds))
              .orderBy(asc(exerciseGroups.orderIndex))
          }

          // Group exercise groups by session ID
          const groupsBySessionId = new Map<string, ExerciseGroupData[]>()
          for (const groupRow of groupRows) {
            const group = mapExerciseGroupToDomain(groupRow)
            let sessionGroupList = groupsBySessionId.get(groupRow.sessionId)
            if (!sessionGroupList) {
              sessionGroupList = []
              groupsBySessionId.set(groupRow.sessionId, sessionGroupList)
            }
            sessionGroupList.push(group)
          }

          // 4. Fetch exercise rows with exercise names
          const exerciseRowResults = await db
            .select({
              row: programExercises,
              exerciseName: exercises.name,
            })
            .from(programExercises)
            .innerJoin(programSessions, eq(programExercises.sessionId, programSessions.id))
            .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
            .where(eq(programSessions.programId, id))
            .orderBy(asc(programExercises.orderIndex))

          // 5. Fetch all prescriptions for all exercise rows
          const exerciseRowIds = exerciseRowResults.map((r) => r.row.id)
          let prescriptionRows: PrescriptionRow[] = []

          if (exerciseRowIds.length > 0) {
            prescriptionRows = await db
              .select()
              .from(prescriptions)
              .where(inArray(prescriptions.programExerciseId, exerciseRowIds))
          }

          // 6. Group prescriptions by exercise row ID
          const prescriptionsByRowId = new Map<string, Map<string, Series[]>>()
          for (const prescriptionRow of prescriptionRows) {
            const series = mapDbSeriesToDomain(prescriptionRow.series)
            if (series.length > 0) {
              let rowMap = prescriptionsByRowId.get(prescriptionRow.programExerciseId)
              if (!rowMap) {
                rowMap = new Map()
                prescriptionsByRowId.set(prescriptionRow.programExerciseId, rowMap)
              }
              rowMap.set(prescriptionRow.weekId, series)
            }
          }

          // 7. Build exercise rows with prescriptions
          const exerciseRowsMap = new Map<string, ExerciseRowWithPrescriptions>()

          for (const { row, exerciseName } of exerciseRowResults) {
            const prescriptionMap = prescriptionsByRowId.get(row.id)
            const prescriptionsByWeekId: Record<string, Series[]> = {}
            if (prescriptionMap) {
              for (const [weekId, series] of prescriptionMap) {
                prescriptionsByWeekId[weekId] = series
              }
            }

            const exerciseRow: ExerciseRowWithPrescriptions = {
              ...mapExerciseRowToDomain(row),
              exerciseName,
              prescriptionsByWeekId,
            }

            exerciseRowsMap.set(row.id, exerciseRow)
          }

          // 8. Group exercise rows by session
          const rowsBySessionId = new Map<string, ExerciseRowWithPrescriptions[]>()
          for (const row of exerciseRowsMap.values()) {
            let sessionExerciseRows = rowsBySessionId.get(row.sessionId)
            if (!sessionExerciseRows) {
              sessionExerciseRows = []
              rowsBySessionId.set(row.sessionId, sessionExerciseRows)
            }
            sessionExerciseRows.push(row)
          }

          // 9. Build sessions with rows and exercise groups
          const sessions: SessionWithRows[] = sessionRows.map((sessionRow) => ({
            ...mapSessionToDomain(sessionRow),
            rows: rowsBySessionId.get(sessionRow.id) ?? [],
            exerciseGroups: groupsBySessionId.get(sessionRow.id) ?? [],
          }))

          return {
            ok: true,
            data: {
              ...program,
              weeks,
              sessions,
            },
          }
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
    // Week Operations
    // -------------------------------------------------------------------------

    createWeek(
      ctx: OrganizationContext,
      programId: string,
      week: Omit<ProgramWeek, 'programId'>,
    ): ResultAsync<ProgramWeek, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: WeekRow } | { ok: false; error: ProgramRepositoryError }> => {
          const programRow = await verifyProgramAccess(ctx, programId)
          if (!programRow) {
            return { ok: false, error: notFoundError('program', programId) }
          }

          const rows = await db
            .insert(programWeeks)
            .values({
              id: week.id,
              programId,
              name: week.name,
              orderIndex: week.orderIndex,
              createdAt: week.createdAt,
              updatedAt: week.updatedAt,
            })
            .returning()

          const row = rows[0]
          if (!row) {
            return { ok: false, error: dbError('Failed to create week') }
          }

          return { ok: true, data: row }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapWeekToDomain(result.data))
      })
    },

    findWeekById(ctx: OrganizationContext, weekId: string): ResultAsync<ProgramWeek | null, ProgramRepositoryError> {
      return RA.fromPromise(verifyWeekAccess(ctx, weekId), wrapDbError).andThen((row) => {
        if (!row) {
          return ok(null)
        }
        return ok(mapWeekToDomain(row))
      })
    },

    updateWeek(ctx: OrganizationContext, week: ProgramWeek): ResultAsync<ProgramWeek, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: WeekRow } | { ok: false; error: ProgramRepositoryError }> => {
          const existingWeek = await verifyWeekAccess(ctx, week.id)
          if (!existingWeek) {
            return { ok: false, error: notFoundError('week', week.id) }
          }

          const rows = await db
            .update(programWeeks)
            .set({
              name: week.name,
              orderIndex: week.orderIndex,
              updatedAt: new Date(),
            })
            .where(eq(programWeeks.id, week.id))
            .returning()

          const row = rows[0]
          if (!row) {
            return { ok: false, error: dbError('Failed to update week') }
          }

          return { ok: true, data: row }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapWeekToDomain(result.data))
      })
    },

    deleteWeek(ctx: OrganizationContext, weekId: string): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          const existingWeek = await verifyWeekAccess(ctx, weekId)
          if (!existingWeek) {
            return { ok: false, error: notFoundError('week', weekId) }
          }

          // Cascading delete handles prescriptions automatically
          await db.delete(programWeeks).where(eq(programWeeks.id, weekId))
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
    // Session Operations
    // -------------------------------------------------------------------------

    findSessionById(
      ctx: OrganizationContext,
      sessionId: string,
    ): ResultAsync<ProgramSession | null, ProgramRepositoryError> {
      return RA.fromPromise(verifySessionAccess(ctx, sessionId), wrapDbError).andThen((row) => {
        if (!row) {
          return ok(null)
        }
        return ok(mapSessionToDomain(row))
      })
    },

    createSession(
      ctx: OrganizationContext,
      programId: string,
      session: Omit<ProgramSession, 'programId'>,
    ): ResultAsync<ProgramSession, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: SessionRow } | { ok: false; error: ProgramRepositoryError }> => {
          const programRow = await verifyProgramAccess(ctx, programId)
          if (!programRow) {
            return { ok: false, error: notFoundError('program', programId) }
          }

          const rows = await db
            .insert(programSessions)
            .values({
              id: session.id,
              programId,
              name: session.name,
              orderIndex: session.orderIndex,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
            })
            .returning()

          const row = rows[0]
          if (!row) {
            return { ok: false, error: dbError('Failed to create session') }
          }

          return { ok: true, data: row }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapSessionToDomain(result.data))
      })
    },

    updateSession(
      ctx: OrganizationContext,
      session: ProgramSession,
    ): ResultAsync<ProgramSession, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: SessionRow } | { ok: false; error: ProgramRepositoryError }> => {
          const existingSession = await verifySessionAccess(ctx, session.id)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', session.id) }
          }

          const rows = await db
            .update(programSessions)
            .set({
              name: session.name,
              orderIndex: session.orderIndex,
              updatedAt: new Date(),
            })
            .where(eq(programSessions.id, session.id))
            .returning()

          const row = rows[0]
          if (!row) {
            return { ok: false, error: dbError('Failed to update session') }
          }

          return { ok: true, data: row }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapSessionToDomain(result.data))
      })
    },

    deleteSession(ctx: OrganizationContext, sessionId: string): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          // Cascading delete handles exercise rows and prescriptions automatically
          await db.delete(programSessions).where(eq(programSessions.id, sessionId))
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
    // Exercise Group Operations
    // -------------------------------------------------------------------------

    createGroup(
      ctx: OrganizationContext,
      sessionId: string,
      name?: string | null,
    ): ResultAsync<ExerciseGroupData, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: ExerciseGroupRow } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify session access
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          // Get next order index
          const maxOrderResult = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${exerciseGroups.orderIndex}), -1)` })
            .from(exerciseGroups)
            .where(eq(exerciseGroups.sessionId, sessionId))

          const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1

          // Insert new group
          const rows = await db
            .insert(exerciseGroups)
            .values({
              id: `eg-${crypto.randomUUID()}`,
              sessionId,
              orderIndex: nextOrder,
              name: name ?? null,
            })
            .returning()

          const row = rows[0]
          if (!row) {
            return { ok: false, error: dbError('Failed to create exercise group') }
          }

          return { ok: true, data: row }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapExerciseGroupToDomain(result.data))
      })
    },

    updateGroup(
      ctx: OrganizationContext,
      groupId: string,
      updates: { name?: string | null; orderIndex?: number },
    ): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify group access
          const existingGroup = await verifyGroupAccess(ctx, groupId)
          if (!existingGroup) {
            return { ok: false, error: notFoundError('group', groupId) }
          }

          // Build update object
          const updateData: Partial<{ name: string | null; orderIndex: number; updatedAt: Date }> = {
            updatedAt: new Date(),
          }
          if (updates.name !== undefined) {
            updateData.name = updates.name
          }
          if (updates.orderIndex !== undefined) {
            updateData.orderIndex = updates.orderIndex
          }

          await db.update(exerciseGroups).set(updateData).where(eq(exerciseGroups.id, groupId))

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

    deleteGroup(ctx: OrganizationContext, groupId: string): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify group access
          const existingGroup = await verifyGroupAccess(ctx, groupId)
          if (!existingGroup) {
            return { ok: false, error: notFoundError('group', groupId) }
          }

          // Note: exercises with this groupId will have their groupId set to NULL due to onDelete: setNull
          await db.delete(exerciseGroups).where(eq(exerciseGroups.id, groupId))

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

    getMaxGroupOrderIndex(ctx: OrganizationContext, sessionId: string): ResultAsync<number, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: number } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify session access
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          const result = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${exerciseGroups.orderIndex}), -1)` })
            .from(exerciseGroups)
            .where(eq(exerciseGroups.sessionId, sessionId))

          return { ok: true, data: result[0]?.maxOrder ?? -1 }
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
    // Exercise Row Operations
    // -------------------------------------------------------------------------

    findExerciseRowById(
      ctx: OrganizationContext,
      rowId: string,
    ): ResultAsync<ProgramExerciseRow | null, ProgramRepositoryError> {
      return RA.fromPromise(verifyExerciseRowAccess(ctx, rowId), wrapDbError).andThen((row) => {
        if (!row) {
          return ok(null)
        }
        return ok(mapExerciseRowToDomain(row))
      })
    },

    getMaxExerciseRowOrderIndex(
      ctx: OrganizationContext,
      sessionId: string,
    ): ResultAsync<number, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: number } | { ok: false; error: ProgramRepositoryError }> => {
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          const result = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${programExercises.orderIndex}), -1)` })
            .from(programExercises)
            .where(eq(programExercises.sessionId, sessionId))

          return { ok: true, data: result[0]?.maxOrder ?? -1 }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    createExerciseRow(
      ctx: OrganizationContext,
      sessionId: string,
      row: Omit<ProgramExerciseRow, 'sessionId'>,
    ): ResultAsync<ProgramExerciseRow, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: ExerciseRowDb } | { ok: false; error: ProgramRepositoryError }> => {
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          const rows = await db
            .insert(programExercises)
            .values({
              id: row.id,
              sessionId,
              exerciseId: row.exerciseId,
              orderIndex: row.orderIndex,
              groupId: row.groupId,
              orderWithinGroup: row.orderWithinGroup,
              setTypeLabel: row.setTypeLabel,
              notes: row.notes,
              restSeconds: row.restSeconds,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            })
            .returning()

          const insertedRow = rows[0]
          if (!insertedRow) {
            return { ok: false, error: dbError('Failed to create exercise row') }
          }

          return { ok: true, data: insertedRow }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapExerciseRowToDomain(result.data))
      })
    },

    updateExerciseRow(
      ctx: OrganizationContext,
      row: ProgramExerciseRow,
    ): ResultAsync<ProgramExerciseRow, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: ExerciseRowDb } | { ok: false; error: ProgramRepositoryError }> => {
          const existingRow = await verifyExerciseRowAccess(ctx, row.id)
          if (!existingRow) {
            return { ok: false, error: notFoundError('exercise_row', row.id) }
          }

          const rows = await db
            .update(programExercises)
            .set({
              exerciseId: row.exerciseId,
              orderIndex: row.orderIndex,
              groupId: row.groupId,
              orderWithinGroup: row.orderWithinGroup,
              setTypeLabel: row.setTypeLabel,
              notes: row.notes,
              restSeconds: row.restSeconds,
              updatedAt: new Date(),
            })
            .where(eq(programExercises.id, row.id))
            .returning()

          const updatedRow = rows[0]
          if (!updatedRow) {
            return { ok: false, error: dbError('Failed to update exercise row') }
          }

          return { ok: true, data: updatedRow }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapExerciseRowToDomain(result.data))
      })
    },

    deleteExerciseRow(ctx: OrganizationContext, rowId: string): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          const existingRow = await verifyExerciseRowAccess(ctx, rowId)
          if (!existingRow) {
            return { ok: false, error: notFoundError('exercise_row', rowId) }
          }

          // Cascading delete handles prescriptions automatically
          await db.delete(programExercises).where(eq(programExercises.id, rowId))
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
    // Prescription Operations (Cell Values)
    // -------------------------------------------------------------------------

    upsertPrescription(
      ctx: OrganizationContext,
      exerciseRowId: string,
      weekId: string,
      series: Series[] | null,
    ): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify exercise row access
          const existingRow = await verifyExerciseRowAccess(ctx, exerciseRowId)
          if (!existingRow) {
            return { ok: false, error: notFoundError('exercise_row', exerciseRowId) }
          }

          // Verify week access (also validates org ownership)
          const existingWeek = await verifyWeekAccess(ctx, weekId)
          if (!existingWeek) {
            return { ok: false, error: notFoundError('week', weekId) }
          }

          if (series === null || series.length === 0) {
            // Delete the prescription
            await db
              .delete(prescriptions)
              .where(and(eq(prescriptions.programExerciseId, exerciseRowId), eq(prescriptions.weekId, weekId)))
          } else {
            // Upsert the prescription using ON CONFLICT
            const seriesData = mapSeriesToDb(series)
            await db
              .insert(prescriptions)
              .values({
                id: `rx-${crypto.randomUUID()}`,
                programExerciseId: exerciseRowId,
                weekId,
                series: seriesData,
              })
              .onConflictDoUpdate({
                target: [prescriptions.programExerciseId, prescriptions.weekId],
                set: {
                  series: seriesData,
                  updatedAt: new Date(),
                },
              })
          }

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

    updatePrescriptionSeries(
      ctx: OrganizationContext,
      exerciseRowId: string,
      weekId: string,
      series: PrescriptionSeriesData[],
    ): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify exercise row access
          const existingRow = await verifyExerciseRowAccess(ctx, exerciseRowId)
          if (!existingRow) {
            return { ok: false, error: notFoundError('exercise_row', exerciseRowId) }
          }

          // Verify week access
          const existingWeek = await verifyWeekAccess(ctx, weekId)
          if (!existingWeek) {
            return { ok: false, error: notFoundError('week', weekId) }
          }

          if (series.length === 0) {
            // Delete the prescription if series is empty
            await db
              .delete(prescriptions)
              .where(and(eq(prescriptions.programExerciseId, exerciseRowId), eq(prescriptions.weekId, weekId)))
          } else {
            // Store series directly
            const seriesData = series.map((s, i) => ({
              orderIndex: i,
              reps: s.reps,
              repsMax: s.repsMax,
              isAmrap: s.isAmrap,
              intensityType: s.intensityType,
              intensityValue: s.intensityValue,
              intensityUnit: s.intensityUnit,
              tempo: s.tempo,
              restSeconds: s.restSeconds,
            }))

            await db
              .insert(prescriptions)
              .values({
                id: `rx-${crypto.randomUUID()}`,
                programExerciseId: exerciseRowId,
                weekId,
                series: seriesData,
              })
              .onConflictDoUpdate({
                target: [prescriptions.programExerciseId, prescriptions.weekId],
                set: {
                  series: seriesData,
                  updatedAt: new Date(),
                },
              })
          }

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
    // Bulk Operations
    // -------------------------------------------------------------------------

    saveDraft(
      ctx: OrganizationContext,
      input: SaveDraftInput,
    ): ResultAsync<{ updatedAt: Date }, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: { updatedAt: Date } } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify program access
          const existingProgram = await verifyProgramAccess(ctx, input.programId)
          if (!existingProgram) {
            return { ok: false, error: notFoundError('program', input.programId) }
          }

          const updatedAt = new Date()

          await db.transaction(async (tx) => {
            // Build a map of tempId -> realId for resolving references
            const tempIdMap = new Map<string, string>()

            // 1. Create new weeks first (columns)
            if (input.newWeeks && input.newWeeks.length > 0) {
              for (const week of input.newWeeks) {
                const realId = crypto.randomUUID()
                tempIdMap.set(week.tempId, realId)

                await tx.insert(programWeeks).values({
                  id: realId,
                  programId: input.programId,
                  name: week.name,
                  orderIndex: week.orderIndex,
                  createdAt: updatedAt,
                  updatedAt,
                })
              }
            }

            // 2. Create new sessions
            if (input.newSessions && input.newSessions.length > 0) {
              for (const session of input.newSessions) {
                const realId = crypto.randomUUID()
                tempIdMap.set(session.tempId, realId)

                await tx.insert(programSessions).values({
                  id: realId,
                  programId: input.programId,
                  name: session.name,
                  orderIndex: session.orderIndex,
                  createdAt: updatedAt,
                  updatedAt,
                })
              }
            }

            // 3. Create new exercise rows (resolve session tempIds)
            if (input.newExerciseRows && input.newExerciseRows.length > 0) {
              for (const row of input.newExerciseRows) {
                const realId = crypto.randomUUID()
                tempIdMap.set(row.tempId, realId)

                // Resolve sessionId (may be tempId from a new session)
                const sessionId = tempIdMap.get(row.sessionId) ?? row.sessionId

                await tx.insert(programExercises).values({
                  id: realId,
                  sessionId,
                  exerciseId: row.exerciseId,
                  orderIndex: row.orderIndex,
                  groupId: null,
                  orderWithinGroup: null,
                  setTypeLabel: null,
                  notes: null,
                  restSeconds: null,
                  createdAt: updatedAt,
                  updatedAt,
                })
              }
            }

            // 4. Update prescriptions with series (resolve tempIds in exercise/week refs)
            if (input.prescriptionUpdates && input.prescriptionUpdates.length > 0) {
              for (const update of input.prescriptionUpdates) {
                // Resolve tempIds to real IDs
                const exerciseRowId = tempIdMap.get(update.exerciseRowId) ?? update.exerciseRowId
                const weekId = tempIdMap.get(update.weekId) ?? update.weekId

                if (update.series.length === 0) {
                  // Delete the prescription if series is empty
                  await tx
                    .delete(prescriptions)
                    .where(and(eq(prescriptions.programExerciseId, exerciseRowId), eq(prescriptions.weekId, weekId)))
                } else {
                  // Store series directly
                  const seriesData = update.series.map((s, i) => ({
                    orderIndex: i,
                    reps: s.reps,
                    repsMax: s.repsMax,
                    isAmrap: s.isAmrap,
                    intensityType: s.intensityType,
                    intensityValue: s.intensityValue,
                    intensityUnit: s.intensityUnit,
                    tempo: s.tempo,
                    restSeconds: s.restSeconds,
                  }))

                  await tx
                    .insert(prescriptions)
                    .values({
                      id: `rx-${crypto.randomUUID()}`,
                      programExerciseId: exerciseRowId,
                      weekId,
                      series: seriesData,
                    })
                    .onConflictDoUpdate({
                      target: [prescriptions.programExerciseId, prescriptions.weekId],
                      set: {
                        series: seriesData,
                        updatedAt,
                      },
                    })
                }
              }
            }

            // 5. Update exercise rows (resolve tempIds)
            if (input.exerciseRowUpdates && input.exerciseRowUpdates.length > 0) {
              for (const update of input.exerciseRowUpdates) {
                const rowId = tempIdMap.get(update.rowId) ?? update.rowId

                const updateData: Partial<{
                  exerciseId: string
                  groupId: string | null
                  orderWithinGroup: number | null
                  updatedAt: Date
                }> = { updatedAt }

                if (update.exerciseId !== undefined) {
                  updateData.exerciseId = update.exerciseId
                }
                if (update.groupId !== undefined) {
                  updateData.groupId = update.groupId
                }
                if (update.orderWithinGroup !== undefined) {
                  updateData.orderWithinGroup = update.orderWithinGroup
                }

                await tx.update(programExercises).set(updateData).where(eq(programExercises.id, rowId))
              }
            }

            // 6. Update groups
            if (input.groupUpdates && input.groupUpdates.length > 0) {
              for (const update of input.groupUpdates) {
                const updateData: Partial<{ name: string | null; orderIndex: number; updatedAt: Date }> = { updatedAt }

                if (update.name !== undefined) {
                  updateData.name = update.name
                }
                if (update.orderIndex !== undefined) {
                  updateData.orderIndex = update.orderIndex
                }

                await tx.update(exerciseGroups).set(updateData).where(eq(exerciseGroups.id, update.groupId))
              }
            }

            // 7. Update program.updatedAt
            await tx.update(programs).set({ updatedAt }).where(eq(programs.id, input.programId))
          })

          return { ok: true, data: { updatedAt } }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    reorderExerciseRows(
      ctx: OrganizationContext,
      sessionId: string,
      rowIds: string[],
    ): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          // Update each row's orderIndex
          await db.transaction(async (tx) => {
            for (let i = 0; i < rowIds.length; i++) {
              const currentRowId = rowIds[i]
              if (currentRowId) {
                await tx
                  .update(programExercises)
                  .set({ orderIndex: i, updatedAt: new Date() })
                  .where(and(eq(programExercises.id, currentRowId), eq(programExercises.sessionId, sessionId)))
              }
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

    duplicateWeek(
      ctx: OrganizationContext,
      weekId: string,
      newName: string,
    ): ResultAsync<ProgramWeek, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: WeekRow } | { ok: false; error: ProgramRepositoryError }> => {
          const existingWeek = await verifyWeekAccess(ctx, weekId)
          if (!existingWeek) {
            return { ok: false, error: notFoundError('week', weekId) }
          }

          // Get the next order index for the new week
          const maxOrderResult = await db
            .select({ maxOrder: sql<number>`MAX(${programWeeks.orderIndex})` })
            .from(programWeeks)
            .where(eq(programWeeks.programId, existingWeek.programId))

          const nextOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1

          // Create new week
          const newWeekId = `week-${crypto.randomUUID()}`
          const insertedWeeks = await db
            .insert(programWeeks)
            .values({
              id: newWeekId,
              programId: existingWeek.programId,
              name: newName,
              orderIndex: nextOrder,
            })
            .returning()

          const newWeekRow = insertedWeeks[0]
          if (!newWeekRow) {
            return { ok: false, error: dbError('Failed to create duplicate week') }
          }

          // Copy all prescriptions from the source week
          const sourcePrescriptions = await db.select().from(prescriptions).where(eq(prescriptions.weekId, weekId))

          if (sourcePrescriptions.length > 0) {
            const newPrescriptions = sourcePrescriptions.map((p) => ({
              id: `rx-${crypto.randomUUID()}`,
              programExerciseId: p.programExerciseId,
              weekId: newWeekId,
              series: p.series,
            }))

            await db.insert(prescriptions).values(newPrescriptions)
          }

          return { ok: true, data: newWeekRow }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(mapWeekToDomain(result.data))
      })
    },

    repositionRowToEndOfSession(
      ctx: OrganizationContext,
      sessionId: string,
      rowId: string,
    ): ResultAsync<void, ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true } | { ok: false; error: ProgramRepositoryError }> => {
          // Verify session access
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          // 1. Get all rows in session ordered by orderIndex
          const sessionRows = await db
            .select({
              id: programExercises.id,
              orderIndex: programExercises.orderIndex,
            })
            .from(programExercises)
            .where(eq(programExercises.sessionId, sessionId))
            .orderBy(asc(programExercises.orderIndex))

          // 2. Find the current row position
          const currentIndex = sessionRows.findIndex((r) => r.id === rowId)
          if (currentIndex === -1) {
            return { ok: true } // Row not found in session, nothing to do
          }

          // 3. If already at end, no repositioning needed
          if (currentIndex === sessionRows.length - 1) {
            return { ok: true }
          }

          // 4. Build new order: remove the row, append to end
          const currentRow = sessionRows[currentIndex]
          if (!currentRow) {
            return { ok: true }
          }
          const newOrder = sessionRows.filter((r) => r.id !== rowId)
          newOrder.push(currentRow)

          // 5. Update all orderIndex values
          await db.transaction(async (tx) => {
            for (let i = 0; i < newOrder.length; i++) {
              const row = newOrder[i]
              if (row) {
                await tx
                  .update(programExercises)
                  .set({ orderIndex: i, updatedAt: new Date() })
                  .where(eq(programExercises.id, row.id))
              }
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

    findExerciseRowsBySessionId(
      ctx: OrganizationContext,
      sessionId: string,
    ): ResultAsync<ProgramExerciseRow[], ProgramRepositoryError> {
      return RA.fromPromise(
        (async (): Promise<{ ok: true; data: ProgramExerciseRow[] } | { ok: false; error: ProgramRepositoryError }> => {
          const existingSession = await verifySessionAccess(ctx, sessionId)
          if (!existingSession) {
            return { ok: false, error: notFoundError('session', sessionId) }
          }

          const rows = await db
            .select()
            .from(programExercises)
            .where(eq(programExercises.sessionId, sessionId))
            .orderBy(asc(programExercises.orderIndex))

          return { ok: true, data: rows.map(mapExerciseRowToDomain) }
        })(),
        wrapDbError,
      ).andThen((result) => {
        if (!result.ok) {
          return err(result.error)
        }
        return ok(result.data)
      })
    },

    countByStatus(
      ctx: OrganizationContext,
    ): ResultAsync<{ draft: number; active: number; archived: number }, ProgramRepositoryError> {
      return RA.fromPromise(
        db
          .select({
            draft: count(sql`CASE WHEN ${programs.status} = 'draft' THEN 1 END`),
            active: count(sql`CASE WHEN ${programs.status} = 'active' THEN 1 END`),
            archived: count(sql`CASE WHEN ${programs.status} = 'archived' THEN 1 END`),
          })
          .from(programs)
          .where(eq(programs.organizationId, ctx.organizationId))
          .then((rows) => ({
            draft: rows[0]?.draft ?? 0,
            active: rows[0]?.active ?? 0,
            archived: rows[0]?.archived ?? 0,
          })),
        wrapDbError,
      )
    },
  }
}
