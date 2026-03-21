import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeDeleteExerciseRow } from '../delete-exercise-row'

describe('[3.21-UNIT] @p2 deleteExerciseRow use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  const rowId = 'row-123'
  const orgId = 'org-456'

  beforeEach(() => {
    mockProgramRepository = {
      findById: vi.fn(),
      update: vi.fn(),
      saveProgramAggregate: vi.fn(),
      deleteExerciseRow: vi.fn(),
    } as unknown as ProgramRepositoryPort
  })

  describe('[3.21-UNIT] @p0 Happy Path', () => {
    it('[3.21-UNIT-001] @p0 should delete exercise row successfully', async () => {
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result = await deleteExerciseRow({
        ...ctx,
        rowId,
      })

      expect(result.isOk()).toBe(true)

      expect(mockProgramRepository.deleteExerciseRow).toHaveBeenCalledWith(ctx, rowId)
    })

    it('[3.21-UNIT-002] @p2 should handle deletion of multiple rows', async () => {
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      // Delete first row
      const result1 = await deleteExerciseRow({ ...ctx, rowId: 'row-1' })
      expect(result1.isOk()).toBe(true)

      // Delete second row
      const result2 = await deleteExerciseRow({ ...ctx, rowId: 'row-2' })
      expect(result2.isOk()).toBe(true)

      expect(mockProgramRepository.deleteExerciseRow).toHaveBeenCalledTimes(2)
    })
  })

  describe('[3.21-UNIT] @p0 Authorization', () => {
    it('[3.21-UNIT-003] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext() // Manager lacks coaching/write permission
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result = await deleteExerciseRow({
        ...ctx,
        rowId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('forbidden')
        if (result.error.type === 'forbidden') {
          expect(result.error.message).toContain('No permission')
        }
      }

      // Repository should not be called
      expect(mockProgramRepository.deleteExerciseRow).not.toHaveBeenCalled()
    })
  })

  describe('[3.21-UNIT] @p1 Not Found Errors', () => {
    it('[3.21-UNIT-004] @p2 should return not_found when row does not exist', async () => {
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(
        errAsync({
          type: 'NOT_FOUND',
          entityType: 'exercise_row',
          id: rowId,
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result = await deleteExerciseRow({
        ...ctx,
        rowId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('not_found')
        if (result.error.type === 'not_found') {
          expect(result.error.rowId).toBe(rowId)
        }
      }
    })
  })

  describe('[3.21-UNIT] @p1 Repository Errors', () => {
    it('[3.21-UNIT-005] @p1 should return repository error when deleteExerciseRow fails', async () => {
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result = await deleteExerciseRow({
        ...ctx,
        rowId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
        if (result.error.type === 'repository_error') {
          expect(result.error.message).toContain('Connection lost')
        }
      }
    })

    it('[3.21-UNIT-006] @p1 should return repository error for other database failures', async () => {
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Foreign key constraint violation',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result = await deleteExerciseRow({
        ...ctx,
        rowId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('[3.21-UNIT] @p2 Edge Cases', () => {
    it('[3.21-UNIT-007] @p2 should allow deleting the last exercise row in a session', async () => {
      // Unlike sessions/weeks, exercise rows can ALL be deleted (no minimum)
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result = await deleteExerciseRow({
        ...ctx,
        rowId: 'last-row-123',
      })

      expect(result.isOk()).toBe(true)
    })

    it('[3.21-UNIT-008] @p2 should handle cascade deletion of related prescriptions', async () => {
      // Repository handles cascading via foreign keys - use case just calls delete
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result = await deleteExerciseRow({
        ...ctx,
        rowId,
      })

      expect(result.isOk()).toBe(true)
      expect(mockProgramRepository.deleteExerciseRow).toHaveBeenCalledWith(ctx, rowId)
    })

    it('[3.21-UNIT-009] @p2 should handle deleting row from different organizations', async () => {
      // Organization scoping is enforced at repository level via context
      vi.mocked(mockProgramRepository.deleteExerciseRow).mockReturnValue(okAsync(undefined))

      const org1Context = createTestContext({ organizationId: 'org-1' })
      const org2Context = createTestContext({ organizationId: 'org-2' })

      const deleteExerciseRow = makeDeleteExerciseRow({
        programRepository: mockProgramRepository,
      })

      const result1 = await deleteExerciseRow({ ...org1Context, rowId: 'row-org1' })
      expect(result1.isOk()).toBe(true)

      const result2 = await deleteExerciseRow({ ...org2Context, rowId: 'row-org2' })
      expect(result2.isOk()).toBe(true)

      expect(mockProgramRepository.deleteExerciseRow).toHaveBeenCalledTimes(2)
      expect(mockProgramRepository.deleteExerciseRow).toHaveBeenNthCalledWith(1, org1Context, 'row-org1')
      expect(mockProgramRepository.deleteExerciseRow).toHaveBeenNthCalledWith(2, org2Context, 'row-org2')
    })
  })
})
