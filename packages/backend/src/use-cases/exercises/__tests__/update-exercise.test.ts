import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExerciseEntity } from '../../../__tests__/factories/exercise-factory'
import { createCoachContext, createManagerContext, createOwnerContext } from '../../../__tests__/helpers/test-context'
import { makeUpdateExercise } from '../update-exercise'

describe('[2.2-UNIT] updateExercise use case', () => {
  let mockExerciseRepository: ExerciseRepositoryPort

  beforeEach(() => {
    // Mock repository
    mockExerciseRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
    }
  })

  describe('[2.2-UNIT] Happy Path', () => {
    it('[2.2-UNIT-001] @p0 should update exercise successfully with owner role', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      // Mock existing exercise (custom exercise, not curated)
      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Old Name',
        movementPattern: 'push',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      // Mock successful update
      const updatedExercise = createExerciseEntity({
        ...existingExercise,
        name: 'New Name',
      })
      vi.mocked(mockExerciseRepository.update).mockReturnValue(okAsync(updatedExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'New Name',
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.name).toBe('New Name')
        expect(exercise.movementPattern).toBe('push') // Unchanged
      }

      // Verify repository update called
      expect(mockExerciseRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          id: exerciseId,
          name: 'New Name',
        }),
      )
    })

    it('[2.2-UNIT-002] @p0 should update only specified fields, leaving others unchanged', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Bench Press',
        description: 'Old description',
        movementPattern: 'push',
        isUnilateral: false,
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      const updatedExercise = createExerciseEntity({
        ...existingExercise,
        description: 'New description',
      })
      vi.mocked(mockExerciseRepository.update).mockReturnValue(okAsync(updatedExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        description: 'New description',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.name).toBe('Bench Press') // Unchanged
        expect(exercise.description).toBe('New description') // Updated
        expect(exercise.movementPattern).toBe('push') // Unchanged
      }
    })

    it('[2.2-UNIT-003] @p1 should allow setting optional fields to null', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Bench Press',
        description: 'Some description',
        videoUrl: 'https://example.com/video',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      const updatedExercise = createExerciseEntity({
        ...existingExercise,
        description: null,
        videoUrl: null,
      })
      vi.mocked(mockExerciseRepository.update).mockReturnValue(okAsync(updatedExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        description: null,
        videoUrl: null,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.description).toBeNull()
        expect(exercise.videoUrl).toBeNull()
      }
    })
  })

  describe('[2.2-UNIT] Authorization', () => {
    it('[2.2-UNIT-004] @p0 should return forbidden error when user lacks exercises:write permission', async () => {
      const ctx = createManagerContext() // Manager role lacks exercises:write permission
      const exerciseId = 'exercise-1'

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'New Name',
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
      expect(mockExerciseRepository.findById).not.toHaveBeenCalled()
      expect(mockExerciseRepository.update).not.toHaveBeenCalled()
    })

    it('[2.2-UNIT-005] @p0 should succeed when user has admin role (has exercises:write)', async () => {
      const ctx = createOwnerContext() // Owner role has write permission
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Old Name',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      const updatedExercise = createExerciseEntity({
        ...existingExercise,
        name: 'New Name',
      })
      vi.mocked(mockExerciseRepository.update).mockReturnValue(okAsync(updatedExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'New Name',
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[2.2-UNIT] Validation Errors', () => {
    it('[2.2-UNIT-006] @p1 should return validation error when name is empty', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Old Name',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: '', // Invalid: empty name
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('Exercise name is required')
        }
      }

      // Repository update should NOT be called for invalid input
      expect(mockExerciseRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('[2.2-UNIT] Not Found Errors', () => {
    it('[2.2-UNIT-007] @p1 should return not_found error when exercise does not exist', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'non-existent-exercise'

      // Mock repository returning null (not found)
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(null))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.exerciseId).toBe(exerciseId)
        }
      }

      // Repository update should NOT be called
      expect(mockExerciseRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('[2.2-UNIT] Curated Exercise Protection', () => {
    it('[2.2-UNIT-008] @p1 should return cannot_edit_curated error when trying to edit curated exercise', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'curated-exercise-1'

      // Mock curated exercise (organizationId is null)
      const curatedExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: null, // Curated exercise
        name: 'Bench Press',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(curatedExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'Modified Bench Press',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('cannot_edit_curated')
        if (error.type === 'cannot_edit_curated') {
          expect(error.message).toContain('curated')
          expect(error.message).toContain('Clone')
        }
      }

      // Repository update should NOT be called
      expect(mockExerciseRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('[2.2-UNIT] Repository Errors', () => {
    it('[2.2-UNIT-009] @p1 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      // Mock repository findById failure
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Connection failed')
        }
      }
    })

    it('[2.2-UNIT-010] @p1 should return repository error when update fails', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Old Name',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      // Mock repository update failure
      vi.mocked(mockExerciseRepository.update).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Update failed',
        }),
      )

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Update failed')
        }
      }
    })
  })

  describe('[2.2-UNIT] Edge Cases', () => {
    it('[2.2-UNIT-011] @p2 should preserve clonedFromId when updating cloned exercise', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'cloned-exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Custom Bench Press',
        clonedFromId: 'curated-bench-press',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      const updatedExercise = createExerciseEntity({
        ...existingExercise,
        name: 'Modified Custom Bench Press',
      })
      vi.mocked(mockExerciseRepository.update).mockReturnValue(okAsync(updatedExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'Modified Custom Bench Press',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.clonedFromId).toBe('curated-bench-press') // Preserved
      }
    })

    it('[2.2-UNIT-012] @p2 should handle updating all fields at once', async () => {
      const ctx = createCoachContext()
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Old Name',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      const updatedExercise = createExerciseEntity({
        ...existingExercise,
        name: 'New Name',
        description: 'New description',
        instructions: 'New instructions',
        videoUrl: 'https://new-url.com',
        movementPattern: 'hinge',
        isUnilateral: true,
        primaryMuscles: ['hamstrings'],
        secondaryMuscles: ['glutes'],
      })
      vi.mocked(mockExerciseRepository.update).mockReturnValue(okAsync(updatedExercise))

      const updateExercise = makeUpdateExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExercise({
        ...ctx,
        exerciseId,
        name: 'New Name',
        description: 'New description',
        instructions: 'New instructions',
        videoUrl: 'https://new-url.com',
        movementPattern: 'hinge',
        isUnilateral: true,
        primaryMuscles: ['hamstrings'],
        secondaryMuscles: ['glutes'],
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.name).toBe('New Name')
        expect(exercise.movementPattern).toBe('hinge')
        expect(exercise.isUnilateral).toBe(true)
      }
    })
  })
})
