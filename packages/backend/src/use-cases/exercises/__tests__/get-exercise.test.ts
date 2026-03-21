import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExerciseEntity } from '../../../__tests__/factories/exercise-factory'
import { createExerciseRepositoryMock } from '../../../__tests__/factories/exercise-repository-mock'
import { createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeGetExercise } from '../get-exercise'

describe('[2.5-UNIT] getExercise use case', () => {
  let mockExerciseRepository: ExerciseRepositoryPort

  beforeEach(() => {
    mockExerciseRepository = createExerciseRepositoryMock()
  })

  describe('[2.5-UNIT] Happy Path', () => {
    it('[2.5-UNIT-001] @p0 should get exercise successfully with admin role', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      const exercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const getExercise = makeGetExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await getExercise({
        ...ctx,
        exerciseId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.id).toBe(exerciseId)
      }

      expect(mockExerciseRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        exerciseId,
      )
    })

    it('[2.5-UNIT-002] @p1 should get exercise with complete data', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      const exercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const getExercise = makeGetExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await getExercise({
        ...ctx,
        exerciseId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.name).toBeDefined()
      }
    })
  })

  describe('[2.5-UNIT] Not Found Errors', () => {
    it('[2.5-UNIT-003] @p1 should return not_found error when exercise does not exist', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'non-existent-exercise'

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(null))

      const getExercise = makeGetExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await getExercise({
        ...ctx,
        exerciseId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.exerciseId).toBe(exerciseId)
        }
      }
    })
  })

  describe('[2.5-UNIT] Repository Errors', () => {
    it('[2.5-UNIT-004] @p1 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const getExercise = makeGetExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await getExercise({
        ...ctx,
        exerciseId,
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

  describe('[2.5-UNIT] Edge Cases', () => {
    it('[2.5-UNIT-005] @p2 should handle getting multiple exercises in sequence', async () => {
      const ctx = createCoachContext()
      const exerciseId1 = 'exercise-1'
      const exerciseId2 = 'exercise-2'

      const exercise1 = createExerciseEntity({ id: exerciseId1, organizationId: ctx.organizationId })
      const exercise2 = createExerciseEntity({ id: exerciseId2, organizationId: ctx.organizationId })

      vi.mocked(mockExerciseRepository.findById)
        .mockReturnValueOnce(okAsync(exercise1))
        .mockReturnValueOnce(okAsync(exercise2))

      const getExercise = makeGetExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result1 = await getExercise({ ...ctx, exerciseId: exerciseId1 })
      const result2 = await getExercise({ ...ctx, exerciseId: exerciseId2 })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.id).toBe(exerciseId1)
        expect(result2.value.id).toBe(exerciseId2)
      }
    })
  })
})
