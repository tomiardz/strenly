import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkoutLogEntity } from '../../../__tests__/factories/workout-log-factory'
import { createWorkoutLogRepositoryMock } from '../../../__tests__/factories/workout-log-repository-mock'
import { createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeGetLogBySession } from '../get-log-by-session'

describe('getLogBySession use case', () => {
  let mockWorkoutLogRepository: WorkoutLogRepositoryPort

  beforeEach(() => {
    mockWorkoutLogRepository = createWorkoutLogRepositoryMock()
  })

  describe('Happy Path', () => {
    it('[5.1-UNIT-001] @p0 should get workout log by session successfully', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'
      const sessionId = 'session-1'
      const weekId = 'week-1'

      const workoutLog = createWorkoutLogEntity({
        id: 'log-1',
        organizationId: ctx.organizationId,
        athleteId,
        sessionId,
        weekId,
      })

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(workoutLog))

      const getLogBySession = makeGetLogBySession({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await getLogBySession({
        ...ctx,
        athleteId,
        sessionId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).not.toBeNull()
        if (result.value) {
          expect(result.value.athleteId).toBe(athleteId)
          expect(result.value.sessionId).toBe(sessionId)
          expect(result.value.weekId).toBe(weekId)
        }
      }

      expect(mockWorkoutLogRepository.findByAthleteSessionWeek).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        athleteId,
        sessionId,
        weekId,
      )
    })

    it('[5.1-UNIT-002] @p1 should return null when log does not exist', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'
      const sessionId = 'session-1'
      const weekId = 'week-1'

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))

      const getLogBySession = makeGetLogBySession({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await getLogBySession({
        ...ctx,
        athleteId,
        sessionId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeNull()
      }
    })
  })

  describe('Repository Errors', () => {
    it('[5.2-UNIT-001] @p1 should return repository error when findByAthleteSessionWeek fails', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'
      const sessionId = 'session-1'
      const weekId = 'week-1'

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const getLogBySession = makeGetLogBySession({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await getLogBySession({
        ...ctx,
        athleteId,
        sessionId,
        weekId,
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
    it('[5.3-UNIT-001] @p2 should handle querying multiple sessions in sequence', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'
      const sessionId1 = 'session-1'
      const sessionId2 = 'session-2'
      const weekId = 'week-1'

      const log1 = createWorkoutLogEntity({ sessionId: sessionId1, organizationId: ctx.organizationId })
      const log2 = createWorkoutLogEntity({ sessionId: sessionId2, organizationId: ctx.organizationId })

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek)
        .mockReturnValueOnce(okAsync(log1))
        .mockReturnValueOnce(okAsync(log2))

      const getLogBySession = makeGetLogBySession({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result1 = await getLogBySession({ ...ctx, athleteId, sessionId: sessionId1, weekId })
      const result2 = await getLogBySession({ ...ctx, athleteId, sessionId: sessionId2, weekId })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk() && result2.isOk() && result1.value && result2.value) {
        expect(result1.value.sessionId).toBe(sessionId1)
        expect(result2.value.sessionId).toBe(sessionId2)
      }
    })
  })
})
