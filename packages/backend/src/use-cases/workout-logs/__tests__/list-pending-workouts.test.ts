import type { PendingWorkout, WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkoutLogRepositoryMock } from '../../../__tests__/factories/workout-log-repository-mock'
import { createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeListPendingWorkouts } from '../list-pending-workouts'

// Helper to create pending workout data
function createPendingWorkout(overrides: Partial<PendingWorkout> = {}): PendingWorkout {
  return {
    athleteId: 'athlete-1',
    athleteName: 'John Doe',
    programId: 'program-1',
    programName: 'Strength Program',
    sessionId: 'session-1',
    sessionName: 'Day 1',
    weekId: 'week-1',
    weekName: 'Week 1',
    ...overrides,
  }
}

describe('listPendingWorkouts use case', () => {
  let mockWorkoutLogRepository: WorkoutLogRepositoryPort

  beforeEach(() => {
    mockWorkoutLogRepository = createWorkoutLogRepositoryMock()
  })

  describe('Happy Path', () => {
    it('[5.1-UNIT-001] @p0 should list pending workouts successfully', async () => {
      const ctx = createManagerContext()

      const pendingWorkouts = [
        createPendingWorkout({ athleteId: 'athlete-1', sessionId: 'session-1' }),
        createPendingWorkout({ athleteId: 'athlete-2', sessionId: 'session-2' }),
      ]

      vi.mocked(mockWorkoutLogRepository.listPendingWorkouts).mockReturnValue(
        okAsync({ items: pendingWorkouts, totalCount: 2 }),
      )

      const listPendingWorkouts = makeListPendingWorkouts({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await listPendingWorkouts(ctx)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2)
        expect(result.value.totalCount).toBe(2)
      }

      expect(mockWorkoutLogRepository.listPendingWorkouts).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          limit: 50,
          offset: 0,
        }),
      )
    })

    it('[5.1-UNIT-002] @p2 should apply default pagination', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockWorkoutLogRepository.listPendingWorkouts).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listPendingWorkouts = makeListPendingWorkouts({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      await listPendingWorkouts(ctx)

      expect(mockWorkoutLogRepository.listPendingWorkouts).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          limit: 50,
          offset: 0,
        }),
      )
    })

    it('[5.1-UNIT-003] @p2 should apply custom pagination', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockWorkoutLogRepository.listPendingWorkouts).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listPendingWorkouts = makeListPendingWorkouts({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      await listPendingWorkouts({ ...ctx, limit: 10, offset: 5 })

      expect(mockWorkoutLogRepository.listPendingWorkouts).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          limit: 10,
          offset: 5,
        }),
      )
    })
  })

  describe('Repository Errors', () => {
    it('[5.2-UNIT-001] @p1 should return repository error when listPendingWorkouts fails', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockWorkoutLogRepository.listPendingWorkouts).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query failed',
        }),
      )

      const listPendingWorkouts = makeListPendingWorkouts({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await listPendingWorkouts(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Query failed')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[5.3-UNIT-001] @p2 should return empty list when no pending workouts exist', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockWorkoutLogRepository.listPendingWorkouts).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listPendingWorkouts = makeListPendingWorkouts({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await listPendingWorkouts(ctx)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(0)
        expect(result.value.totalCount).toBe(0)
      }
    })
  })
})
