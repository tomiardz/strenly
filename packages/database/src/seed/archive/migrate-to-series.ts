/**
 * Data migration script: Transform existing data to new series-based structure
 *
 * This script:
 * 1. Creates exercise_groups for each distinct superset group per session
 * 2. Updates program_exercises.groupId and orderWithinGroup
 * 3. Transforms prescription flat structure to series arrays
 *
 * **WARNING: BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT**
 *
 * Run with: npx tsx src/seed/migrate-to-series.ts
 */
import { eq, isNull, sql } from 'drizzle-orm'
import type { DbClient } from '../../client'
import { exerciseGroups } from '../../schema/exercise-groups'
import { prescriptions } from '../../schema/prescriptions'
import { programExercises } from '../../schema/program-exercises'

interface LegacyPrescriptionData {
  sets: number
  repsMin: number
  repsMax: number | null
  isAmrap: boolean
  isUnilateral: boolean
  unilateralUnit: string | null
  intensityType: 'absolute' | 'percentage' | 'rpe' | 'rir' | null
  intensityValue: number | null
  intensityUnit: 'kg' | 'lb' | '%' | 'rpe' | 'rir' | null
  tempo: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLegacyPrescriptionData(value: unknown): value is LegacyPrescriptionData {
  if (!isRecord(value)) return false
  return (
    typeof value.sets === 'number' &&
    typeof value.repsMin === 'number' &&
    typeof value.isAmrap === 'boolean' &&
    typeof value.isUnilateral === 'boolean'
  )
}

interface SeriesData {
  orderIndex: number
  reps: number | null
  repsMax: number | null
  isAmrap: boolean
  intensityType: 'absolute' | 'percentage' | 'rpe' | 'rir' | null
  intensityValue: number | null
  intensityUnit: 'kg' | 'lb' | '%' | 'rpe' | 'rir' | null
  tempo: string | null
  restSeconds: number | null
}

/**
 * Migration function to transform existing data to new structure
 *
 * @param db - Database client instance
 */
export async function migrateToSeriesStructure(db: DbClient): Promise<void> {
  console.log('=== WARNING ===')
  console.log('This script will modify existing data.')
  console.log('Ensure you have a database backup before proceeding.')
  console.log('================')
  console.log('')
  console.log('Starting data migration...')

  // Step 1: Find all sessions that have exercises without groupId assigned
  const sessionsWithExercises = await db
    .selectDistinct({ sessionId: programExercises.sessionId })
    .from(programExercises)
    .where(isNull(programExercises.groupId))

  console.log(`Found ${sessionsWithExercises.length} sessions with exercises to migrate`)

  for (const { sessionId } of sessionsWithExercises) {
    // Get all exercises in this session ordered by position
    const exercises = await db
      .select()
      .from(programExercises)
      .where(eq(programExercises.sessionId, sessionId))
      .orderBy(programExercises.orderIndex)

    // Group exercises by their supersetGroup (null = standalone, 'A'/'B'/'C' = grouped)
    const groups = new Map<string, (typeof exercises)[number][]>()

    for (const ex of exercises) {
      // If already has groupId, skip
      if (ex.groupId) continue

      // Use supersetGroup as key, or generate unique key for standalone exercises
      const key = ex.supersetGroup ?? `standalone-${ex.id}`
      const existing = groups.get(key)
      if (existing) {
        existing.push(ex)
      } else {
        groups.set(key, [ex])
      }
    }

    // Create exercise_groups and update exercises
    let groupOrderIndex = 0
    for (const [, groupExercises] of groups) {
      // Generate unique group ID
      const groupId = `eg-${crypto.randomUUID().slice(0, 8)}`

      // Create the exercise group
      await db.insert(exerciseGroups).values({
        id: groupId,
        sessionId,
        orderIndex: groupOrderIndex++,
        name: null, // Auto-generated letter (A, B, C...)
      })

      // Update each exercise in this group
      for (let i = 0; i < groupExercises.length; i++) {
        const ex = groupExercises[i]
        if (!ex) continue
        await db
          .update(programExercises)
          .set({
            groupId,
            orderWithinGroup: i,
          })
          .where(eq(programExercises.id, ex.id))
      }
    }
  }

  console.log('Groups created and exercises updated.')
  console.log('Migrating prescriptions to series arrays...')

  // Step 2: Migrate prescriptions to series array format
  // Find all prescriptions that don't have series yet
  const prescriptionsToMigrate = await db.select().from(prescriptions).where(isNull(prescriptions.series))

  console.log(`Found ${prescriptionsToMigrate.length} prescriptions to migrate`)

  let migratedCount = 0
  for (const rx of prescriptionsToMigrate) {
    if (!isLegacyPrescriptionData(rx.prescription)) {
      console.log(`Skipping prescription ${rx.id}: no legacy data or unexpected shape`)
      continue
    }

    const oldData = rx.prescription

    // Expand sets to series array
    // Each set becomes a separate series entry
    const series: SeriesData[] = []
    const setCount = oldData.sets || 1

    for (let i = 0; i < setCount; i++) {
      series.push({
        orderIndex: i,
        reps: oldData.isAmrap ? null : oldData.repsMin,
        repsMax: oldData.repsMax,
        isAmrap: oldData.isAmrap,
        intensityType: oldData.intensityType,
        intensityValue: oldData.intensityValue,
        intensityUnit: oldData.intensityUnit,
        tempo: oldData.tempo,
        restSeconds: null,
      })
    }

    await db.update(prescriptions).set({ series }).where(eq(prescriptions.id, rx.id))

    migratedCount++
  }

  console.log(`Migrated ${migratedCount} prescriptions to series arrays.`)
  console.log('')
  console.log('Migration complete!')
  console.log('')
  console.log('Summary:')
  console.log(`- Sessions processed: ${sessionsWithExercises.length}`)
  console.log(`- Prescriptions migrated: ${migratedCount}`)
}

/**
 * Verify migration results
 *
 * @param db - Database client instance
 */
export async function verifyMigration(db: DbClient): Promise<void> {
  console.log('Verifying migration...')

  // Check for exercises without groupId
  const exercisesWithoutGroup = await db
    .select({ count: sql<number>`count(*)` })
    .from(programExercises)
    .where(isNull(programExercises.groupId))

  const ungroupedCount = Number(exercisesWithoutGroup[0]?.count ?? 0)

  // Check for prescriptions without series
  const prescriptionsWithoutSeries = await db
    .select({ count: sql<number>`count(*)` })
    .from(prescriptions)
    .where(isNull(prescriptions.series))

  const unmigratedCount = Number(prescriptionsWithoutSeries[0]?.count ?? 0)

  // Check exercise_groups count
  const groupsCount = await db.select({ count: sql<number>`count(*)` }).from(exerciseGroups)

  const totalGroups = Number(groupsCount[0]?.count ?? 0)

  console.log('')
  console.log('Verification results:')
  console.log(`- Exercise groups created: ${totalGroups}`)
  console.log(`- Exercises without groupId: ${ungroupedCount}`)
  console.log(`- Prescriptions without series: ${unmigratedCount}`)

  if (ungroupedCount === 0 && unmigratedCount === 0) {
    console.log('')
    console.log('Migration verified successfully!')
  } else {
    console.log('')
    console.log(
      `WARNING: Some records were not migrated (${ungroupedCount} exercises, ${unmigratedCount} prescriptions).`,
    )
  }
}
