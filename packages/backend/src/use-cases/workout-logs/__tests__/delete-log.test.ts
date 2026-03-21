import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkoutLogEntity } from '../../../__tests__/factories/workout-log-factory'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeDeleteLog } from '../delete-log'

describe('deleteLog use case', () => {
  let mockWorkoutLogRepository: WorkoutLogRepositoryPort

  beforeEach(() => {
    // Mock all repository methods
    mockWorkoutLogRepository = {
      findById: vi.fn(),
      findByAthleteSessionWeek: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      listByAthlete: vi.fn(),
      listPendingWorkouts: vi.fn(),
    }
  })

  describe('Happy Path', () => {
    it('[5.1-UNIT-001] @p0 should delete workout log successfully with admin role', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      const workoutLog = createWorkoutLogEntity({
        id: logId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(workoutLog))
      vi.mocked(mockWorkoutLogRepository.delete).mockReturnValue(okAsync(undefined))

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await deleteLog({
        ...ctx,
        logId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      // Verify repository calls
      expect(mockWorkoutLogRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          roles: ['coach'],
        }),
        logId,
      )

      expect(mockWorkoutLogRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        logId,
      )
    })

    it('[5.1-UNIT-002] @p1 should delete completed log', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      const workoutLog = createWorkoutLogEntity({
        id: logId,
        organizationId: ctx.organizationId,
        status: 'completed',
      })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(workoutLog))
      vi.mocked(mockWorkoutLogRepository.delete).mockReturnValue(okAsync(undefined))

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await deleteLog({
        ...ctx,
        logId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Authorization', () => {
    it('[5.2-UNIT-001] @p0 should return forbidden error when user lacks workout_log:delete permission', async () => {
      const ctx = createCoachContext() // Member lacks delete permission
      const logId = 'log-1'

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await deleteLog({
        ...ctx,
        logId,
      })

      // Assert authorization failure
      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('forbidden')
        if (error.type === 'forbidden') {
          expect(error.message).toContain('No permission')
        }
      }

      // Repository should NOT be called
      expect(mockWorkoutLogRepository.findById).not.toHaveBeenCalled()
      expect(mockWorkoutLogRepository.delete).not.toHaveBeenCalled()
    })

    it('[5.2-UNIT-002] @p0 should succeed when user has admin role (has workout_log:delete)', async () => {
      const ctx = createManagerContext() // Admin has delete permission
      const logId = 'log-1'

      const workoutLog = createWorkoutLogEntity({
        id: logId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(workoutLog))
      vi.mocked(mockWorkoutLogRepository.delete).mockReturnValue(okAsync(undefined))

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await deleteLog({
        ...ctx,
        logId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Not Found Errors', () => {
    it('[5.3-UNIT-001] @p0 should return not_found error when log does not exist', async () => {
      const ctx = createCoachContext()
      const logId = 'non-existent-log'

      // Mock repository returning null (not found)
      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(null))

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await deleteLog({
        ...ctx,
        logId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.logId).toBe(logId)
        }
      }

      // Delete should NOT be called
      expect(mockWorkoutLogRepository.delete).not.toHaveBeenCalled()
    })
  })

  describe('Repository Errors', () => {
    it('[5.4-UNIT-001] @p1 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      // Mock repository failure
      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await deleteLog({
        ...ctx,
        logId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Connection timeout')
        }
      }
    })

    it('[5.4-UNIT-002] @p1 should return repository error when delete fails', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      const workoutLog = createWorkoutLogEntity({
        id: logId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(workoutLog))

      // Mock delete failure
      vi.mocked(mockWorkoutLogRepository.delete).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Failed to delete log',
        }),
      )

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await deleteLog({
        ...ctx,
        logId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Failed to delete log')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[5.5-UNIT-001] @p2 should handle deleting multiple logs in sequence', async () => {
      const ctx = createCoachContext()
      const logId1 = 'log-1'
      const logId2 = 'log-2'

      const log1 = createWorkoutLogEntity({ id: logId1, organizationId: ctx.organizationId })
      const log2 = createWorkoutLogEntity({ id: logId2, organizationId: ctx.organizationId })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValueOnce(okAsync(log1)).mockReturnValueOnce(okAsync(log2))

      vi.mocked(mockWorkoutLogRepository.delete).mockReturnValue(okAsync(undefined))

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result1 = await deleteLog({ ...ctx, logId: logId1 })
      const result2 = await deleteLog({ ...ctx, logId: logId2 })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      expect(mockWorkoutLogRepository.delete).toHaveBeenCalledTimes(2)
    })

    it('[5.5-UNIT-002] @p2 should be idempotent - trying to delete non-existent log after successful deletion', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      // First call: log exists
      const workoutLog = createWorkoutLogEntity({
        id: logId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockWorkoutLogRepository.findById)
        .mockReturnValueOnce(okAsync(workoutLog))
        .mockReturnValueOnce(okAsync(null)) // Second call: already deleted

      vi.mocked(mockWorkoutLogRepository.delete).mockReturnValue(okAsync(undefined))

      const deleteLog = makeDeleteLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result1 = await deleteLog({ ...ctx, logId })
      const result2 = await deleteLog({ ...ctx, logId })

      expect(result1.isOk()).toBe(true)
      expect(result2.isErr()).toBe(true)

      if (result2.isErr()) {
        expect(result2.error.type).toBe('not_found')
      }
    })
  })
})
