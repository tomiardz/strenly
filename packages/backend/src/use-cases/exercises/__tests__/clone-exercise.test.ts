import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExerciseEntity } from '../../../__tests__/factories/exercise-factory'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeCloneExercise } from '../clone-exercise'

describe('[2.4-UNIT] cloneExercise use case', () => {
  let mockExerciseRepository: ExerciseRepositoryPort
  let mockGenerateId: () => string

  beforeEach(() => {
    // Mock repository
    mockExerciseRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
    }

    // Mock ID generator
    mockGenerateId = vi.fn(() => 'cloned-exercise-id')
  })

  describe('[2.4-UNIT] Happy Path', () => {
    it('[2.4-UNIT-001] @p0 should clone curated exercise successfully with custom name', async () => {
      const ctx = createCoachContext()
      const sourceExerciseId = 'curated-bench-press'

      // Mock source curated exercise
      const sourceExercise = createExerciseEntity({
        id: sourceExerciseId,
        organizationId: null, // Curated
        name: 'Bench Press',
        description: 'Classic chest exercise',
        movementPattern: 'push',
        primaryMuscles: ['chest'],
        secondaryMuscles: ['triceps', 'shoulders'],
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(sourceExercise))

      // Mock successful clone creation
      const clonedExercise = createExerciseEntity({
        id: 'cloned-exercise-id',
        organizationId: ctx.organizationId,
        name: 'My Custom Bench Press',
        description: sourceExercise.description,
        movementPattern: sourceExercise.movementPattern,
        primaryMuscles: sourceExercise.primaryMuscles,
        secondaryMuscles: sourceExercise.secondaryMuscles,
        clonedFromId: sourceExerciseId,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(clonedExercise))

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
        name: 'My Custom Bench Press',
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.id).toBe('cloned-exercise-id')
        expect(exercise.name).toBe('My Custom Bench Press')
        expect(exercise.organizationId).toBe(ctx.organizationId)
        expect(exercise.clonedFromId).toBe(sourceExerciseId)
        expect(exercise.movementPattern).toBe('push')
        expect(exercise.primaryMuscles).toEqual(['chest'])
      }

      // Verify repository create called
      expect(mockExerciseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          id: 'cloned-exercise-id',
          name: 'My Custom Bench Press',
          clonedFromId: sourceExerciseId,
        }),
      )
    })

    it('[2.4-UNIT-002] @p0 should clone exercise with default "(Custom)" suffix when name not provided', async () => {
      const ctx = createCoachContext()
      const sourceExerciseId = 'curated-squat'

      const sourceExercise = createExerciseEntity({
        id: sourceExerciseId,
        organizationId: null,
        name: 'Back Squat',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(sourceExercise))

      const clonedExercise = createExerciseEntity({
        id: 'cloned-exercise-id',
        organizationId: ctx.organizationId,
        name: 'Back Squat (Custom)',
        clonedFromId: sourceExerciseId,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(clonedExercise))

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
        // No name provided
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.name).toBe('Back Squat (Custom)')
      }
    })

    it('[2.4-UNIT-003] @p1 should clone custom exercise from organization', async () => {
      const ctx = createCoachContext()
      const sourceExerciseId = 'org-custom-exercise'

      // Mock source custom exercise from same org
      const sourceExercise = createExerciseEntity({
        id: sourceExerciseId,
        organizationId: ctx.organizationId,
        name: 'Custom Exercise',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(sourceExercise))

      const clonedExercise = createExerciseEntity({
        id: 'cloned-exercise-id',
        organizationId: ctx.organizationId,
        name: 'Custom Exercise Copy',
        clonedFromId: sourceExerciseId,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(clonedExercise))

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
        name: 'Custom Exercise Copy',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.clonedFromId).toBe(sourceExerciseId)
      }
    })
  })

  describe('[2.4-UNIT] Authorization', () => {
    it('[2.4-UNIT-004] @p0 should return forbidden error when user lacks exercises:write permission', async () => {
      const ctx = createManagerContext() // Manager role lacks exercises:write permission
      const sourceExerciseId = 'exercise-1'

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
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
      expect(mockExerciseRepository.create).not.toHaveBeenCalled()
    })

    it('[2.4-UNIT-005] @p0 should succeed when user has admin role (has exercises:write)', async () => {
      const ctx = createCoachContext() // Coach role has exercises:write permission
      const sourceExerciseId = 'exercise-1'

      const sourceExercise = createExerciseEntity({
        id: sourceExerciseId,
        organizationId: null,
        name: 'Source Exercise',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(sourceExercise))

      const clonedExercise = createExerciseEntity({
        id: 'cloned-exercise-id',
        organizationId: ctx.organizationId,
        name: 'Source Exercise (Custom)',
        clonedFromId: sourceExerciseId,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(clonedExercise))

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[2.4-UNIT] Source Not Found Errors', () => {
    it('[2.4-UNIT-006] @p1 should return source_not_found error when source exercise does not exist', async () => {
      const ctx = createCoachContext()
      const sourceExerciseId = 'non-existent-exercise'

      // Mock repository returning null (not found)
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(null))

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('source_not_found')
        if (error.type === 'source_not_found') {
          expect(error.exerciseId).toBe(sourceExerciseId)
        }
      }

      // Repository create should NOT be called
      expect(mockExerciseRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('[2.4-UNIT] Repository Errors', () => {
    it('[2.4-UNIT-007] @p1 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()
      const sourceExerciseId = 'exercise-1'

      // Mock repository findById failure
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
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

    it('[2.4-UNIT-008] @p1 should return repository error when create fails', async () => {
      const ctx = createCoachContext()
      const sourceExerciseId = 'exercise-1'

      const sourceExercise = createExerciseEntity({
        id: sourceExerciseId,
        organizationId: null,
        name: 'Source Exercise',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(sourceExercise))

      // Mock repository create failure
      vi.mocked(mockExerciseRepository.create).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Create failed',
        }),
      )

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Create failed')
        }
      }
    })
  })

  describe('[2.4-UNIT] Edge Cases', () => {
    it('[2.4-UNIT-009] @p2 should preserve all source exercise properties except ID and organizationId', async () => {
      const ctx = createCoachContext()
      const sourceExerciseId = 'source-1'

      const sourceExercise = createExerciseEntity({
        id: sourceExerciseId,
        organizationId: null,
        name: 'Complex Exercise',
        description: 'Detailed description',
        instructions: 'Step by step',
        videoUrl: 'https://example.com/video',
        movementPattern: 'hinge',
        isUnilateral: true,
        primaryMuscles: ['hamstrings', 'glutes'],
        secondaryMuscles: ['core'],
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(sourceExercise))

      const clonedExercise = createExerciseEntity({
        id: 'cloned-exercise-id',
        organizationId: ctx.organizationId,
        name: 'Complex Exercise (Custom)',
        description: sourceExercise.description,
        instructions: sourceExercise.instructions,
        videoUrl: sourceExercise.videoUrl,
        movementPattern: sourceExercise.movementPattern,
        isUnilateral: sourceExercise.isUnilateral,
        primaryMuscles: sourceExercise.primaryMuscles,
        secondaryMuscles: sourceExercise.secondaryMuscles,
        clonedFromId: sourceExerciseId,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(clonedExercise))

      const cloneExercise = makeCloneExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await cloneExercise({
        ...ctx,
        sourceExerciseId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.description).toBe(sourceExercise.description)
        expect(exercise.instructions).toBe(sourceExercise.instructions)
        expect(exercise.videoUrl).toBe(sourceExercise.videoUrl)
        expect(exercise.movementPattern).toBe(sourceExercise.movementPattern)
        expect(exercise.isUnilateral).toBe(sourceExercise.isUnilateral)
        expect(exercise.primaryMuscles).toEqual(sourceExercise.primaryMuscles)
        expect(exercise.secondaryMuscles).toEqual(sourceExercise.secondaryMuscles)
      }
    })
  })
})
