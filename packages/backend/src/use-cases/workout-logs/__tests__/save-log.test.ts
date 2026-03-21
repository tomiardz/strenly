import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeSaveLog } from '../save-log'

describe('saveLog use case', () => {
  let mockWorkoutLogRepository: WorkoutLogRepositoryPort
  const logId = 'log-123'
  const athleteId = 'athlete-456'
  const programId = 'program-789'
  const sessionId = 'session-abc'
  const weekId = 'week-def'
  const orgId = 'org-xyz'

  beforeEach(() => {
    mockWorkoutLogRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByAthleteSessionWeek: vi.fn(),
      listByAthlete: vi.fn(),
      listPendingWorkouts: vi.fn(),
      delete: vi.fn(),
      countCompletedSince: vi.fn(),
      listRecent: vi.fn(),
    }
  })

  describe('Happy Path', () => {
    it('[5.1-UNIT-001] @p0 should save workout log successfully', async () => {
      const exercises = [
        {
          id: 'ex-log-1',
          exerciseId: 'exercise-1',
          groupItemId: 'group-item-1',
          orderIndex: 0,
          notes: null,
          skipped: false,
          groupLabel: null,
          groupOrder: 0,
          series: [
            {
              orderIndex: 0,
              repsPerformed: 10,
              weightUsed: 100,
              rpe: null,
              skipped: false,
              prescribedReps: 10,
              prescribedWeight: null,
              prescribedRepsMax: null,
              prescribedIsAmrap: false,
              prescribedIntensityType: null,
              prescribedIntensityValue: null,
              prescribedTempo: null,
              prescribedRestSeconds: null,
            },
          ],
        },
      ]

      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const logDate = new Date('2024-01-15')

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate,
        sessionRpe: 8,
        sessionNotes: 'Great session',
        exercises,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(logId)
        expect(result.value.sessionRpe).toBe(8)
        expect(result.value.sessionNotes).toBe('Great session')
        expect(result.value.exercises).toEqual(exercises)
      }

      expect(mockWorkoutLogRepository.save).toHaveBeenCalledWith(
        ctx,
        expect.objectContaining({
          id: logId,
          athleteId,
          programId,
          sessionId,
          weekId,
          logDate,
        }),
      )
    })

    it('[5.1-UNIT-002] @p1 should calculate status automatically from exercises', async () => {
      const partialExercises = [
        {
          id: 'ex-log-1',
          exerciseId: 'exercise-1',
          groupItemId: 'group-item-1',
          orderIndex: 0,
          sets: [
            {
              setNumber: 1,
              prescribedReps: 10,
              prescribedIntensity: 80,
              performedReps: null,
              performedWeight: null,
              prescribedTempo: null,
              prescribedRest: 90,
              notes: null,
              status: 'partial' as const,
            },
          ],
        },
      ]

      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: partialExercises,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        // Status should be calculated automatically (not manually set)
        expect(result.value.status).toBeDefined()
      }
    })

    it('[5.1-UNIT-003] @p2 should save log with null sessionRpe and sessionNotes', async () => {
      const exercises = [
        {
          id: 'ex-log-1',
          exerciseId: 'exercise-1',
          groupItemId: 'group-item-1',
          orderIndex: 0,
          sets: [],
        },
      ]

      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.sessionRpe).toBe(null)
        expect(result.value.sessionNotes).toBe(null)
      }
    })

    it('[5.1-UNIT-004] @p2 should save log with empty exercises array', async () => {
      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.exercises).toEqual([])
      }
    })
  })

  describe('Authorization', () => {
    it('[5.2-UNIT-001] @p0 should return forbidden error when user lacks workout_log:update permission', async () => {
      const ctx = createManagerContext()
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('forbidden')
        expect(result.error.message).toContain('No permission')
      }

      // Repository should not be called
      expect(mockWorkoutLogRepository.save).not.toHaveBeenCalled()
    })
  })

  describe('Validation Errors', () => {
    it('[5.3-UNIT-001] @p1 should return validation error when domain factory fails', async () => {
      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      // Pass invalid sessionRpe (must be 1-10)
      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        sessionRpe: 15, // Invalid - must be 1-10
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }

      // Save should not be called
      expect(mockWorkoutLogRepository.save).not.toHaveBeenCalled()
    })

    it('[5.3-UNIT-002] @p1 should return validation error when athleteId is invalid', async () => {
      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId: '',
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })

    it('[5.3-UNIT-003] @p1 should return validation error when programId is invalid', async () => {
      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId: '',
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })

    it('[5.3-UNIT-004] @p1 should return validation error when sessionId is invalid', async () => {
      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId: '',
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })

    it('[5.3-UNIT-005] @p1 should return validation error when weekId is invalid', async () => {
      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId: '',
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })
  })

  describe('Repository Errors', () => {
    it('[5.4-UNIT-001] @p1 should return repository error when save fails', async () => {
      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[5.4-UNIT-002] @p1 should return repository error when database insert fails', async () => {
      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Foreign key constraint violation',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('Edge Cases', () => {
    it('[5.5-UNIT-001] @p2 should handle optional fields correctly', async () => {
      const exercises = [
        {
          id: 'ex-log-1',
          exerciseId: 'exercise-1',
          groupItemId: 'group-item-1',
          orderIndex: 0,
          sets: [],
        },
      ]

      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      // Omit optional fields
      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.sessionRpe).toBe(null)
        expect(result.value.sessionNotes).toBe(null)
      }
    })

    it('[5.5-UNIT-002] @p2 should pass through sessionRpe and sessionNotes to domain entity', async () => {
      const exercises = [
        {
          id: 'ex-log-1',
          exerciseId: 'exercise-1',
          groupItemId: 'group-item-1',
          orderIndex: 0,
          sets: [],
        },
      ]

      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        sessionRpe: 9,
        sessionNotes: 'Very hard session',
        exercises,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.sessionRpe).toBe(9)
        expect(result.value.sessionNotes).toBe('Very hard session')
      }
    })

    it('[5.5-UNIT-003] @p2 should handle saving log for different organizations', async () => {
      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const org1Context = createTestContext({ organizationId: 'org-1' })
      const org2Context = createTestContext({ organizationId: 'org-2' })

      // Save for org 1
      const result1 = await saveLog({
        ...org1Context,
        id: 'log-org1',
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result1.isOk()).toBe(true)

      // Save for org 2
      const result2 = await saveLog({
        ...org2Context,
        id: 'log-org2',
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        exercises: [],
      })

      expect(result2.isOk()).toBe(true)

      expect(mockWorkoutLogRepository.save).toHaveBeenCalledTimes(2)
    })

    it('[5.5-UNIT-004] @p3 should return the validated log entity after save', async () => {
      const exercises = [
        {
          id: 'ex-log-1',
          exerciseId: 'exercise-1',
          groupItemId: 'group-item-1',
          orderIndex: 0,
          sets: [],
        },
      ]

      vi.mocked(mockWorkoutLogRepository.save).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const saveLog = makeSaveLog({ workoutLogRepository: mockWorkoutLogRepository })

      const logDate = new Date('2024-01-15')

      const result = await saveLog({
        ...ctx,
        id: logId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate,
        exercises,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        // Verify the returned entity has all fields
        expect(result.value).toHaveProperty('id')
        expect(result.value).toHaveProperty('organizationId')
        expect(result.value).toHaveProperty('athleteId')
        expect(result.value).toHaveProperty('programId')
        expect(result.value).toHaveProperty('sessionId')
        expect(result.value).toHaveProperty('weekId')
        expect(result.value).toHaveProperty('logDate')
        expect(result.value).toHaveProperty('status')
        expect(result.value).toHaveProperty('exercises')
      }
    })
  })
})
