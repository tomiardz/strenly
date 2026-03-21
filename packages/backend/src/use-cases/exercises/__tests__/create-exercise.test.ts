import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExerciseEntity, createExerciseInput } from '../../../__tests__/factories/exercise-factory'
import { createCoachContext, createManagerContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeCreateExercise } from '../create-exercise'

describe('[2.1-UNIT] createExercise use case', () => {
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
    mockGenerateId = vi.fn(() => 'test-exercise-id')
  })

  describe('[2.1-UNIT] Happy Path', () => {
    it('[2.1-UNIT-001] @p0 should create exercise successfully with owner role', async () => {
      const ctx = createTestContext({ roles: ['owner'] })
      const input = createExerciseInput({ name: 'Bench Press', movementPattern: 'push' })

      // Mock successful repository create
      const exercise = createExerciseEntity({
        id: 'test-exercise-id',
        organizationId: ctx.organizationId,
        name: 'Bench Press',
        movementPattern: 'push',
        description: input.description,
        instructions: input.instructions,
        videoUrl: input.videoUrl,
        isUnilateral: input.isUnilateral,
        primaryMuscles: input.primaryMuscles,
        secondaryMuscles: input.secondaryMuscles,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(exercise))

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await createExercise({ ...ctx, ...input })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.id).toBe('test-exercise-id')
        expect(exercise.name).toBe('Bench Press')
        expect(exercise.movementPattern).toBe('push')
        expect(exercise.organizationId).toBe(ctx.organizationId)
      }

      // Verify repository called with correct context
      expect(mockExerciseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          roles: ['owner'],
        }),
        expect.objectContaining({
          id: 'test-exercise-id',
          name: 'Bench Press',
          movementPattern: 'push',
        }),
      )
    })

    it('[2.1-UNIT-002] @p0 should create exercise with minimal required fields', async () => {
      const ctx = createCoachContext()
      const input = { name: 'Squat' } // Only required field

      const exercise = createExerciseEntity({
        id: 'test-exercise-id',
        organizationId: ctx.organizationId,
        name: 'Squat',
        description: null,
        instructions: null,
        videoUrl: null,
        movementPattern: null,
        isUnilateral: undefined,
        primaryMuscles: undefined,
        secondaryMuscles: undefined,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(exercise))

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await createExercise({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.name).toBe('Squat')
        expect(exercise.description).toBeNull()
      }
    })
  })

  describe('[2.1-UNIT] Authorization', () => {
    it('[2.1-UNIT-003] @p0 should return forbidden error when user lacks exercises:write permission', async () => {
      const ctx = createManagerContext() // Manager role lacks exercises:write permission
      const input = createExerciseInput()

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await createExercise({ ...ctx, ...input })

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
      expect(mockExerciseRepository.create).not.toHaveBeenCalled()
    })

    it('[2.1-UNIT-004] @p0 should succeed when user has admin role (has exercises:write)', async () => {
      const ctx = createCoachContext() // Coach role has exercises:write permission
      const input = createExerciseInput()

      const exercise = createExerciseEntity({
        id: 'test-exercise-id',
        organizationId: ctx.organizationId,
        name: input.name,
        description: input.description,
        instructions: input.instructions,
        videoUrl: input.videoUrl,
        movementPattern: input.movementPattern,
        isUnilateral: input.isUnilateral,
        primaryMuscles: input.primaryMuscles,
        secondaryMuscles: input.secondaryMuscles,
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(exercise))

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await createExercise({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[2.1-UNIT] Validation Errors', () => {
    it('[2.1-UNIT-005] @p1 should return validation error when name is empty', async () => {
      const ctx = createCoachContext()
      const input = createExerciseInput({ name: '' }) // Invalid: empty name

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await createExercise({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('Exercise name is required')
        }
      }

      // Repository should NOT be called for invalid input
      expect(mockExerciseRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('[2.1-UNIT] Repository Errors', () => {
    it('[2.1-UNIT-006] @p1 should return repository error when database fails', async () => {
      const ctx = createCoachContext()
      const input = createExerciseInput()

      // Mock repository failure
      vi.mocked(mockExerciseRepository.create).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await createExercise({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Connection failed')
        }
      }
    })
  })

  describe('[2.1-UNIT] Edge Cases', () => {
    it('[2.1-UNIT-007] @p2 should handle null optional fields correctly', async () => {
      const ctx = createCoachContext()
      const input = createExerciseInput({
        description: null,
        instructions: null,
        videoUrl: null,
        movementPattern: null,
        primaryMuscles: [],
        secondaryMuscles: [],
      })

      const exercise = createExerciseEntity({
        id: 'test-exercise-id',
        organizationId: ctx.organizationId,
        name: input.name,
        description: null,
        instructions: null,
        videoUrl: null,
        movementPattern: null,
        primaryMuscles: [],
        secondaryMuscles: [],
      })
      vi.mocked(mockExerciseRepository.create).mockReturnValue(okAsync(exercise))

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: mockGenerateId,
      })

      const result = await createExercise({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const exercise = result.value
        expect(exercise.description).toBeNull()
        expect(exercise.instructions).toBeNull()
        expect(exercise.videoUrl).toBeNull()
        expect(exercise.movementPattern).toBeNull()
      }
    })

    it('[2.1-UNIT-008] @p2 should create multiple exercises with unique IDs in parallel', async () => {
      const ctx = createCoachContext()
      let idCounter = 0
      const generateUniqueId = vi.fn(() => `exercise-${++idCounter}`)

      const createExercise = makeCreateExercise({
        exerciseRepository: mockExerciseRepository,
        generateId: generateUniqueId,
      })

      const inputs = [
        createExerciseInput({ name: 'Bench Press' }),
        createExerciseInput({ name: 'Squat' }),
        createExerciseInput({ name: 'Deadlift' }),
      ]

      // Mock repository for all creates
      vi.mocked(mockExerciseRepository.create).mockImplementation((_, exercise) =>
        okAsync({
          ...exercise,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      // Create all exercises in parallel
      const results = await Promise.all(inputs.map((input) => createExercise({ ...ctx, ...input })))

      // All should succeed
      expect(results.every((r) => r.isOk())).toBe(true)

      // All should have unique IDs
      const ids = results.map((r) => (r.isOk() ? r.value.id : null))
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })
  })
})
