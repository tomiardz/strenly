import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExerciseEntity } from '../../../__tests__/factories/exercise-factory'
import { createExerciseRepositoryMock } from '../../../__tests__/factories/exercise-repository-mock'
import { createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeListExercises } from '../list-exercises'

describe('[2.6-UNIT] listExercises use case', () => {
  let mockExerciseRepository: ExerciseRepositoryPort

  beforeEach(() => {
    mockExerciseRepository = createExerciseRepositoryMock()
  })

  describe('[2.6-UNIT] Happy Path', () => {
    it('[2.6-UNIT-001] @p0 should list exercises successfully', async () => {
      const ctx = createManagerContext()

      const exercises = [
        createExerciseEntity({ id: 'exercise-1', organizationId: ctx.organizationId }),
        createExerciseEntity({ id: 'exercise-2', organizationId: ctx.organizationId }),
      ]

      vi.mocked(mockExerciseRepository.findAll).mockReturnValue(okAsync({ items: exercises, totalCount: 2 }))

      const listExercises = makeListExercises({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await listExercises(ctx)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2)
        expect(result.value.totalCount).toBe(2)
      }

      expect(mockExerciseRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          limit: 10,
          offset: 0,
        }),
      )
    })

    it('[2.6-UNIT-002] @p1 should filter by movement pattern', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockExerciseRepository.findAll).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listExercises = makeListExercises({
        exerciseRepository: mockExerciseRepository,
      })

      await listExercises({
        ...ctx,
        movementPattern: 'squat',
      })

      expect(mockExerciseRepository.findAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          movementPattern: 'squat',
        }),
      )
    })

    it('[2.6-UNIT-003] @p1 should filter by muscle group', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockExerciseRepository.findAll).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listExercises = makeListExercises({
        exerciseRepository: mockExerciseRepository,
      })

      await listExercises({
        ...ctx,
        muscleGroup: 'quads',
      })

      expect(mockExerciseRepository.findAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          muscleGroup: 'quads',
        }),
      )
    })

    it('[2.6-UNIT-004] @p1 should apply search filter', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockExerciseRepository.findAll).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listExercises = makeListExercises({
        exerciseRepository: mockExerciseRepository,
      })

      await listExercises({
        ...ctx,
        search: 'squat',
      })

      expect(mockExerciseRepository.findAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          search: 'squat',
        }),
      )
    })

    it('[2.6-UNIT-005] @p2 should apply pagination', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockExerciseRepository.findAll).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listExercises = makeListExercises({
        exerciseRepository: mockExerciseRepository,
      })

      await listExercises({
        ...ctx,
        limit: 20,
        offset: 10,
      })

      expect(mockExerciseRepository.findAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          limit: 20,
          offset: 10,
        }),
      )
    })
  })

  describe('[2.6-UNIT] Repository Errors', () => {
    it('[2.6-UNIT-006] @p1 should return repository error when findAll fails', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockExerciseRepository.findAll).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query failed',
        }),
      )

      const listExercises = makeListExercises({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await listExercises(ctx)

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

  describe('[2.6-UNIT] Edge Cases', () => {
    it('[2.6-UNIT-007] @p2 should return empty list when no exercises exist', async () => {
      const ctx = createManagerContext()

      vi.mocked(mockExerciseRepository.findAll).mockReturnValue(okAsync({ items: [], totalCount: 0 }))

      const listExercises = makeListExercises({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await listExercises(ctx)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(0)
        expect(result.value.totalCount).toBe(0)
      }
    })
  })
})
