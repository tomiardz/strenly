import type { Exercise } from '@strenly/core/domain/entities/exercise'
import { reconstituteExercise } from '@strenly/core/domain/entities/exercise'
import { isValidMovementPattern } from '@strenly/core/domain/value-objects/movement-pattern'
import type { MuscleGroup } from '@strenly/core/domain/value-objects/muscle-group'
import { isValidMuscleGroup } from '@strenly/core/domain/value-objects/muscle-group'
import type {
  ExerciseRepositoryError,
  ExerciseRepositoryPort,
  ListExercisesOptions,
} from '@strenly/core/ports/exercise-repository.port'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import type { DbClient } from '@strenly/database'
import { exerciseMuscles, exercises } from '@strenly/database/schema'
import { and, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { err, ok, ResultAsync } from 'neverthrow'

function wrapDbError(error: unknown): ExerciseRepositoryError {
  return {
    type: 'DATABASE_ERROR',
    message: error instanceof Error ? error.message : 'Database operation failed',
    cause: error,
  }
}

type ExerciseRow = typeof exercises.$inferSelect
type MuscleMapping = { muscleGroupId: string; isPrimary: boolean }

/**
 * Fetch muscle mappings for an exercise
 */
async function fetchMuscleMappings(db: DbClient, exerciseId: string): Promise<MuscleMapping[]> {
  const results = await db
    .select({
      muscleGroupId: exerciseMuscles.muscleGroupId,
      isPrimary: exerciseMuscles.isPrimary,
    })
    .from(exerciseMuscles)
    .where(eq(exerciseMuscles.exerciseId, exerciseId))

  return results
}

/**
 * Map database row and muscle mappings to domain Exercise entity.
 * Uses reconstitute since DB data is already validated.
 */
function mapToDomain(row: ExerciseRow, muscleMappings: MuscleMapping[]): Exercise {
  // Safely parse movement pattern - use type guard
  let movementPattern = null
  if (row.movementPattern !== null) {
    if (isValidMovementPattern(row.movementPattern)) {
      movementPattern = row.movementPattern
    }
  }

  // Extract primary and secondary muscles from mappings
  const primaryMuscles: MuscleGroup[] = []
  const secondaryMuscles: MuscleGroup[] = []

  for (const mapping of muscleMappings) {
    // Strip mg- prefix if present (seed data uses mg-chest, validator expects chest)
    const muscleId = mapping.muscleGroupId.replace(/^mg-/, '')
    if (isValidMuscleGroup(muscleId)) {
      if (mapping.isPrimary) {
        primaryMuscles.push(muscleId)
      } else {
        secondaryMuscles.push(muscleId)
      }
    }
  }

  return reconstituteExercise({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    videoUrl: row.videoUrl,
    movementPattern,
    isUnilateral: row.isUnilateral,
    clonedFromId: row.clonedFromId,
    primaryMuscles,
    secondaryMuscles,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

export function createExerciseRepository(db: DbClient): ExerciseRepositoryPort {
  return {
    findById(ctx: OrganizationContext, id: string): ResultAsync<Exercise | null, ExerciseRepositoryError> {
      return ResultAsync.fromPromise(
        (async () => {
          // Build where clause: match ID AND (curated OR belongs to org)
          const whereClause = and(
            eq(exercises.id, id),
            or(isNull(exercises.organizationId), eq(exercises.organizationId, ctx.organizationId)),
          )

          const row = await db
            .select()
            .from(exercises)
            .where(whereClause)
            .then((rows) => rows[0])

          if (!row) {
            return null
          }

          const muscleMappings = await fetchMuscleMappings(db, id)
          return { row, muscleMappings }
        })(),
        wrapDbError,
      ).andThen((data) => {
        if (!data) {
          return ok(null)
        }

        return ok(mapToDomain(data.row, data.muscleMappings))
      })
    },

    findAll(
      ctx: OrganizationContext,
      options: ListExercisesOptions,
    ): ResultAsync<{ items: Exercise[]; totalCount: number }, ExerciseRepositoryError> {
      return ResultAsync.fromPromise(
        (async () => {
          const conditions = []

          // Always scope to curated exercises + org-specific exercises
          conditions.push(or(isNull(exercises.organizationId), eq(exercises.organizationId, ctx.organizationId)))

          // Filter by movement pattern
          if (options?.movementPattern) {
            conditions.push(eq(exercises.movementPattern, options.movementPattern))
          }

          // Filter by search term (case-insensitive, escape wildcards)
          if (options?.search) {
            const escaped = options.search.replace(/[%_]/g, '\\$&')
            conditions.push(ilike(exercises.name, `%${escaped}%`))
          }

          // Exclude archived by default
          if (!options?.includeArchived) {
            conditions.push(isNull(exercises.archivedAt))
          }

          // Build base query conditions
          const whereClause = conditions.length > 0 ? and(...conditions) : undefined

          // If filtering by muscle group, we need a subquery
          let exerciseIdsWithMuscle: string[] | null = null
          if (options?.muscleGroup) {
            // Database stores with mg- prefix, so add it for the query
            const dbMuscleGroupId = `mg-${options.muscleGroup}`
            const muscleResults = await db
              .select({ exerciseId: exerciseMuscles.exerciseId })
              .from(exerciseMuscles)
              .where(eq(exerciseMuscles.muscleGroupId, dbMuscleGroupId))
            exerciseIdsWithMuscle = muscleResults.map((r) => r.exerciseId)

            // If no exercises match the muscle group, return empty
            if (exerciseIdsWithMuscle.length === 0) {
              return { items: [], totalCount: 0 }
            }
          }

          // Build final where clause with muscle group filter
          let finalWhereClause = whereClause
          if (exerciseIdsWithMuscle !== null && exerciseIdsWithMuscle.length > 0) {
            const muscleCondition = inArray(exercises.id, exerciseIdsWithMuscle)
            finalWhereClause = whereClause ? and(whereClause, muscleCondition) : muscleCondition
          }

          // Get count and rows in parallel
          const [countResult, rows] = await Promise.all([
            db.select({ count: count() }).from(exercises).where(finalWhereClause),
            db
              .select()
              .from(exercises)
              .where(finalWhereClause)
              .orderBy(exercises.name)
              .limit(options.limit)
              .offset(options.offset),
          ])

          // Fetch muscle mappings for all exercises
          const exerciseIds = rows.map((r) => r.id)
          let allMuscleMappings: Array<{ exerciseId: string; muscleGroupId: string; isPrimary: boolean }> = []

          if (exerciseIds.length > 0) {
            allMuscleMappings = await db
              .select({
                exerciseId: exerciseMuscles.exerciseId,
                muscleGroupId: exerciseMuscles.muscleGroupId,
                isPrimary: exerciseMuscles.isPrimary,
              })
              .from(exerciseMuscles)
              .where(inArray(exerciseMuscles.exerciseId, exerciseIds))
          }

          // Group muscle mappings by exercise ID
          const muscleMappingsByExercise = new Map<string, MuscleMapping[]>()
          for (const mapping of allMuscleMappings) {
            const existing = muscleMappingsByExercise.get(mapping.exerciseId) ?? []
            existing.push({ muscleGroupId: mapping.muscleGroupId, isPrimary: mapping.isPrimary })
            muscleMappingsByExercise.set(mapping.exerciseId, existing)
          }

          // Map rows to domain entities
          const items = rows.map((row) => mapToDomain(row, muscleMappingsByExercise.get(row.id) ?? []))

          return {
            items,
            totalCount: countResult[0]?.count ?? 0,
          }
        })(),
        wrapDbError,
      )
    },

    create(ctx: OrganizationContext, exercise: Exercise): ResultAsync<Exercise, ExerciseRepositoryError> {
      return ResultAsync.fromPromise(
        db.transaction(async (tx) => {
          // Insert the exercise with organization scope from context
          const rows = await tx
            .insert(exercises)
            .values({
              id: exercise.id,
              organizationId: ctx.organizationId,
              name: exercise.name,
              description: exercise.description,
              instructions: exercise.instructions,
              videoUrl: exercise.videoUrl,
              movementPattern: exercise.movementPattern,
              isUnilateral: exercise.isUnilateral,
              isCurated: exercise.organizationId === null,
              clonedFromId: exercise.clonedFromId,
              archivedAt: exercise.archivedAt,
              createdAt: exercise.createdAt,
              updatedAt: exercise.updatedAt,
            })
            .returning()

          const createdRow = rows[0]
          if (!createdRow) {
            // Throw to abort the transaction — caught by ResultAsync.fromPromise wrapper
            throw new Error('Insert did not return a row')
          }

          // Insert muscle mappings
          const muscleMappings: Array<{ exerciseId: string; muscleGroupId: string; isPrimary: boolean }> = []

          for (const muscle of exercise.primaryMuscles) {
            muscleMappings.push({
              exerciseId: exercise.id,
              muscleGroupId: muscle,
              isPrimary: true,
            })
          }

          for (const muscle of exercise.secondaryMuscles) {
            muscleMappings.push({
              exerciseId: exercise.id,
              muscleGroupId: muscle,
              isPrimary: false,
            })
          }

          if (muscleMappings.length > 0) {
            await tx.insert(exerciseMuscles).values(muscleMappings)
          }

          return mapToDomain(createdRow, muscleMappings)
        }),
        wrapDbError,
      )
    },

    update(ctx: OrganizationContext, exercise: Exercise): ResultAsync<Exercise, ExerciseRepositoryError> {
      return ResultAsync.fromPromise(
        db.transaction(async (tx) => {
          // Update the exercise scoped to organization
          const [updatedRow] = await tx
            .update(exercises)
            .set({
              name: exercise.name,
              description: exercise.description,
              instructions: exercise.instructions,
              videoUrl: exercise.videoUrl,
              movementPattern: exercise.movementPattern,
              isUnilateral: exercise.isUnilateral,
              updatedAt: new Date(),
            })
            .where(and(eq(exercises.id, exercise.id), eq(exercises.organizationId, ctx.organizationId)))
            .returning()

          if (!updatedRow) {
            // Throw to abort the transaction — caught by ResultAsync.fromPromise wrapper
            throw new Error('Exercise not found')
          }

          // Delete existing muscle mappings
          await tx.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, exercise.id))

          // Insert new muscle mappings
          const muscleMappings: Array<{ exerciseId: string; muscleGroupId: string; isPrimary: boolean }> = []

          for (const muscle of exercise.primaryMuscles) {
            muscleMappings.push({
              exerciseId: exercise.id,
              muscleGroupId: muscle,
              isPrimary: true,
            })
          }

          for (const muscle of exercise.secondaryMuscles) {
            muscleMappings.push({
              exerciseId: exercise.id,
              muscleGroupId: muscle,
              isPrimary: false,
            })
          }

          if (muscleMappings.length > 0) {
            await tx.insert(exerciseMuscles).values(muscleMappings)
          }

          // Fetch updated muscle mappings to reconstitute from DB state
          const newMappings = await fetchMuscleMappings(tx, exercise.id)
          return mapToDomain(updatedRow, newMappings)
        }),
        wrapDbError,
      )
    },

    archive(ctx: OrganizationContext, id: string): ResultAsync<void, ExerciseRepositoryError> {
      return ResultAsync.fromPromise(
        db
          .update(exercises)
          .set({
            archivedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(exercises.id, id), eq(exercises.organizationId, ctx.organizationId)))
          .returning(),
        wrapDbError,
      ).andThen((rows) => {
        if (rows.length === 0) {
          return err({ type: 'NOT_FOUND', exerciseId: id } as const)
        }
        return ok(undefined)
      })
    },
  }
}
