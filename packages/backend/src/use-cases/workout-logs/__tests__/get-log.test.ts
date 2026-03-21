import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkoutLogEntity } from '../../../__tests__/factories/workout-log-factory'
import { createWorkoutLogRepositoryMock } from '../../../__tests__/factories/workout-log-repository-mock'
import { createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeGetLog } from '../get-log'

describe('getLog use case', () => {
  let mockWorkoutLogRepository: WorkoutLogRepositoryPort

  beforeEach(() => {
    mockWorkoutLogRepository = createWorkoutLogRepositoryMock()
  })

  describe('Happy Path', () => {
    it('[5.1-UNIT-001] @p0 should get workout log successfully with admin role', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      const workoutLog = createWorkoutLogEntity({
        id: logId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(workoutLog))

      const getLog = makeGetLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await getLog({
        ...ctx,
        logId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.id).toBe(logId)
      }

      expect(mockWorkoutLogRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          roles: ['coach'],
        }),
        logId,
      )
    })

    it('[5.1-UNIT-002] @p1 should get completed log', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      const workoutLog = createWorkoutLogEntity({
        id: logId,
        organizationId: ctx.organizationId,
        status: 'completed',
      })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(workoutLog))

      const getLog = makeGetLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await getLog({
        ...ctx,
        logId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.status).toBe('completed')
      }
    })
  })

  describe('Not Found Errors', () => {
    it('[5.2-UNIT-001] @p0 should return not_found error when log does not exist', async () => {
      const ctx = createCoachContext()
      const logId = 'non-existent-log'

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(okAsync(null))

      const getLog = makeGetLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await getLog({
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
    })
  })

  describe('Repository Errors', () => {
    it('[5.3-UNIT-001] @p1 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()
      const logId = 'log-1'

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const getLog = makeGetLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await getLog({
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
  })

  describe('Edge Cases', () => {
    it('[5.4-UNIT-001] @p2 should handle getting multiple logs in sequence', async () => {
      const ctx = createCoachContext()
      const logId1 = 'log-1'
      const logId2 = 'log-2'

      const log1 = createWorkoutLogEntity({ id: logId1, organizationId: ctx.organizationId })
      const log2 = createWorkoutLogEntity({ id: logId2, organizationId: ctx.organizationId })

      vi.mocked(mockWorkoutLogRepository.findById).mockReturnValueOnce(okAsync(log1)).mockReturnValueOnce(okAsync(log2))

      const getLog = makeGetLog({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result1 = await getLog({ ...ctx, logId: logId1 })
      const result2 = await getLog({ ...ctx, logId: logId2 })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.id).toBe(logId1)
        expect(result2.value.id).toBe(logId2)
      }
    })
  })
})
