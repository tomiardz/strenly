import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExerciseEntity } from '../../../__tests__/factories/exercise-factory'
import { createManagerContext, createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeArchiveExercise } from '../archive-exercise'

describe('[2.3-UNIT] archiveExercise use case', () => {
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

  describe('[2.3-UNIT] Happy Path', () => {
    it('[2.3-UNIT-001] @p0 should archive exercise successfully with admin role', async () => {
      const ctx = createManagerContext()
      const exerciseId = 'exercise-1'

      // Mock existing custom exercise (not curated)
      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Custom Bench Press',
        archivedAt: null,
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))
      vi.mocked(mockExerciseRepository.archive).mockReturnValue(okAsync(undefined))

      const archiveExercise = makeArchiveExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await archiveExercise({
        ...ctx,
        exerciseId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      // Verify repository archive called
      expect(mockExerciseRepository.archive).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        exerciseId,
      )
    })
  })

  describe('[2.3-UNIT] Authorization', () => {
    it('[2.3-UNIT-002] @p0 should return forbidden error when user lacks exercises:write permission', async () => {
      const ctx = createCoachContext() // Member role lacks write permission
      const exerciseId = 'exercise-1'

      const archiveExercise = makeArchiveExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await archiveExercise({
        ...ctx,
        exerciseId,
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
      expect(mockExerciseRepository.archive).not.toHaveBeenCalled()
    })

    it('[2.3-UNIT-003] @p0 should succeed when user has admin role (has exercises:write)', async () => {
      const ctx = createManagerContext() // Admin role has write permission
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Custom Exercise',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))
      vi.mocked(mockExerciseRepository.archive).mockReturnValue(okAsync(undefined))

      const archiveExercise = makeArchiveExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await archiveExercise({
        ...ctx,
        exerciseId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[2.3-UNIT] Not Found Errors', () => {
    it('[2.3-UNIT-004] @p1 should return not_found error when exercise does not exist', async () => {
      const ctx = createManagerContext()
      const exerciseId = 'non-existent-exercise'

      // Mock repository returning null (not found)
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(null))

      const archiveExercise = makeArchiveExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await archiveExercise({
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

      // Repository archive should NOT be called
      expect(mockExerciseRepository.archive).not.toHaveBeenCalled()
    })
  })

  describe('[2.3-UNIT] Curated Exercise Protection', () => {
    it('[2.3-UNIT-005] @p1 should return cannot_archive_curated error when trying to archive curated exercise', async () => {
      const ctx = createManagerContext()
      const exerciseId = 'curated-exercise-1'

      // Mock curated exercise (organizationId is null)
      const curatedExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: null, // Curated exercise
        name: 'Bench Press',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(curatedExercise))

      const archiveExercise = makeArchiveExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await archiveExercise({
        ...ctx,
        exerciseId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('cannot_archive_curated')
        if (error.type === 'cannot_archive_curated') {
          expect(error.message).toContain('curated')
        }
      }

      // Repository archive should NOT be called
      expect(mockExerciseRepository.archive).not.toHaveBeenCalled()
    })
  })

  describe('[2.3-UNIT] Repository Errors', () => {
    it('[2.3-UNIT-006] @p1 should return repository error when findById fails', async () => {
      const ctx = createManagerContext()
      const exerciseId = 'exercise-1'

      // Mock repository findById failure
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const archiveExercise = makeArchiveExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await archiveExercise({
        ...ctx,
        exerciseId,
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

    it('[2.3-UNIT-007] @p1 should return repository error when archive fails', async () => {
      const ctx = createManagerContext()
      const exerciseId = 'exercise-1'

      const existingExercise = createExerciseEntity({
        id: exerciseId,
        organizationId: ctx.organizationId,
        name: 'Custom Exercise',
      })

      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(existingExercise))

      // Mock repository archive failure
      vi.mocked(mockExerciseRepository.archive).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Archive failed',
        }),
      )

      const archiveExercise = makeArchiveExercise({
        exerciseRepository: mockExerciseRepository,
      })

      const result = await archiveExercise({
        ...ctx,
        exerciseId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Archive failed')
        }
      }
    })
  })
})
