import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkoutLogEntity } from '../../../__tests__/factories/workout-log-factory'
import { createWorkoutLogRepositoryMock } from '../../../__tests__/factories/workout-log-repository-mock'
import { createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeListAthleteLogs } from '../list-athlete-logs'

describe('listAthleteLogs use case', () => {
  let mockWorkoutLogRepository: WorkoutLogRepositoryPort

  beforeEach(() => {
    mockWorkoutLogRepository = createWorkoutLogRepositoryMock()
  })

  describe('Happy Path', () => {
    it('[5.1-UNIT-001] @p0 should list athlete logs successfully', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      const logs = [
        createWorkoutLogEntity({ id: 'log-1', organizationId: ctx.organizationId }),
        createWorkoutLogEntity({ id: 'log-2', organizationId: ctx.organizationId }),
      ]

      vi.mocked(mockWorkoutLogRepository.listByAthlete).mockReturnValue(okAsync({ items: logs, totalCount: 2 }))

      const listAthleteLogs = makeListAthleteLogs({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await listAthleteLogs({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2)
        expect(result.value.totalCount).toBe(2)
      }

      expect(mockWorkoutLogRepository.listByAthlete).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        athleteId,
        expect.objectContaining({
          limit: 20,
          offset: 0,
        }),
      )
    })

    it('[5.1-UNIT-002] @p1 should filter by status', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      vi.mocked(mockWorkoutLogRepository.listByAthlete).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listAthleteLogs = makeListAthleteLogs({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      await listAthleteLogs({
        ...ctx,
        athleteId,
        status: 'completed',
      })

      expect(mockWorkoutLogRepository.listByAthlete).toHaveBeenCalledWith(
        expect.anything(),
        athleteId,
        expect.objectContaining({
          status: 'completed',
        }),
      )
    })

    it('[5.1-UNIT-003] @p2 should apply pagination', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      vi.mocked(mockWorkoutLogRepository.listByAthlete).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listAthleteLogs = makeListAthleteLogs({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      await listAthleteLogs({
        ...ctx,
        athleteId,
        limit: 10,
        offset: 5,
      })

      expect(mockWorkoutLogRepository.listByAthlete).toHaveBeenCalledWith(
        expect.anything(),
        athleteId,
        expect.objectContaining({
          limit: 10,
          offset: 5,
        }),
      )
    })
  })

  describe('Repository Errors', () => {
    it('[5.2-UNIT-001] @p1 should return repository error when listByAthlete fails', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      vi.mocked(mockWorkoutLogRepository.listByAthlete).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query failed',
        }),
      )

      const listAthleteLogs = makeListAthleteLogs({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await listAthleteLogs({
        ...ctx,
        athleteId,
      })

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
    it('[5.3-UNIT-001] @p2 should return empty list when athlete has no logs', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      vi.mocked(mockWorkoutLogRepository.listByAthlete).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listAthleteLogs = makeListAthleteLogs({
        workoutLogRepository: mockWorkoutLogRepository,
      })

      const result = await listAthleteLogs({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(0)
        expect(result.value.totalCount).toBe(0)
      }
    })
  })
})
