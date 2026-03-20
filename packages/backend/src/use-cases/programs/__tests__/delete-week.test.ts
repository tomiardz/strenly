import type { Week } from '@strenly/core/domain/entities/program/types'
import type { ProgramRepositoryPort, ProgramWithDetails } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramWithStructure } from '../../../__tests__/factories/program-structure-factory'
import { createCoachContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeDeleteWeek } from '../delete-week'

// Helper to create program with custom weeks for ProgramWithDetails structure
function createProgramWithWeeks(weeks: Omit<Week, 'sessions'>[]): ProgramWithDetails {
  const program = createProgramWithStructure({
    weeks: weeks.map((w) => ({ ...w, sessions: [] })),
  })

  // Convert to ProgramWithDetails structure
  return {
    ...program,
    weeks: weeks.map((w) => ({
      id: w.id,
      programId: program.id,
      name: w.name,
      orderIndex: w.orderIndex,
      createdAt: new Date(),
    })),
    sessions: [],
  } as unknown as ProgramWithDetails
}

describe('[3.23-UNIT] @p2 deleteWeek use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  const programId = 'program-123'
  const weekId = 'week-456'
  const orgId = 'org-789'

  beforeEach(() => {
    mockProgramRepository = {
      findById: vi.fn(),
      findWithDetails: vi.fn(),
      update: vi.fn(),
      saveProgramAggregate: vi.fn(),
      deleteWeek: vi.fn(),
    } as unknown as ProgramRepositoryPort
  })

  describe('[3.23-UNIT] @p0 Happy Path', () => {
    it('[3.23-UNIT-001] @p0 should delete week successfully', async () => {
      const programWithWeeks = createProgramWithWeeks([
        { id: 'week-1', name: 'Week 1', orderIndex: 0 },
        { id: weekId, name: 'Week 2', orderIndex: 1 },
        { id: 'week-3', name: 'Week 3', orderIndex: 2 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithWeeks))
      vi.mocked(mockProgramRepository.deleteWeek).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)

      expect(mockProgramRepository.deleteWeek).toHaveBeenCalledWith(ctx, weekId)
    })

    it('[3.23-UNIT-002] @p2 should delete last week when more than one week exists', async () => {
      const programWithWeeks = createProgramWithWeeks([
        { id: 'week-1', name: 'Week 1', orderIndex: 0 },
        { id: weekId, name: 'Week 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithWeeks))
      vi.mocked(mockProgramRepository.deleteWeek).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.23-UNIT] @p0 Authorization', () => {
    it('[3.23-UNIT-003] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createCoachContext()
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('forbidden')
        if (result.error.type === 'forbidden') {
          expect(result.error.message).toContain('No permission')
        }
      }

      // Repository should not be called
      expect(mockProgramRepository.findWithDetails).not.toHaveBeenCalled()
    })
  })

  describe('[3.23-UNIT] @p1 Not Found Errors', () => {
    it('[3.23-UNIT-004] @p2 should return program_not_found when program does not exist', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId: 'non-existent-program',
        weekId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('program_not_found')
        if (result.error.type === 'program_not_found') {
          expect(result.error.programId).toBe('non-existent-program')
        }
      }

      // Delete should not be called
      expect(mockProgramRepository.deleteWeek).not.toHaveBeenCalled()
    })

    it('[3.23-UNIT-005] @p2 should return not_found when week does not exist in program', async () => {
      const programWithWeeks = createProgramWithWeeks([
        { id: 'week-1', name: 'Week 1', orderIndex: 0 },
        { id: 'week-2', name: 'Week 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithWeeks))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId: 'non-existent-week',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('not_found')
        if (result.error.type === 'not_found') {
          expect(result.error.weekId).toBe('non-existent-week')
        }
      }

      // Delete should not be called
      expect(mockProgramRepository.deleteWeek).not.toHaveBeenCalled()
    })
  })

  describe('[3.23-UNIT] @p1 Validation Errors', () => {
    it('[3.23-UNIT-006] @p1 should return last_week error when trying to delete the only week', async () => {
      const programWithOneWeek = createProgramWithWeeks([{ id: weekId, name: 'Only Week', orderIndex: 0 }])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithOneWeek))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('last_week')
        if (result.error.type === 'last_week') {
          expect(result.error.message).toContain('Cannot delete the last week')
        }
      }

      // Delete should not be called
      expect(mockProgramRepository.deleteWeek).not.toHaveBeenCalled()
    })
  })

  describe('[3.23-UNIT] @p1 Repository Errors', () => {
    it('[3.23-UNIT-007] @p1 should return repository error when findWithDetails fails', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[3.23-UNIT-008] @p1 should return repository error when deleteWeek fails', async () => {
      const programWithWeeks = createProgramWithWeeks([
        { id: 'week-1', name: 'Week 1', orderIndex: 0 },
        { id: weekId, name: 'Week 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithWeeks))
      vi.mocked(mockProgramRepository.deleteWeek).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Delete failed',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('[3.23-UNIT] @p2 Edge Cases', () => {
    it('[3.23-UNIT-009] @p2 should allow deletion when exactly 2 weeks exist', async () => {
      const programWithTwoWeeks = createProgramWithWeeks([
        { id: 'week-1', name: 'Week 1', orderIndex: 0 },
        { id: weekId, name: 'Week 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithTwoWeeks))
      vi.mocked(mockProgramRepository.deleteWeek).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)

      expect(mockProgramRepository.deleteWeek).toHaveBeenCalledWith(ctx, weekId)
    })

    it('[3.23-UNIT-010] @p2 should handle deletion from middle of week list', async () => {
      const programWithWeeks = createProgramWithWeeks([
        { id: 'week-1', name: 'Week 1', orderIndex: 0 },
        { id: weekId, name: 'Week 2', orderIndex: 1 },
        { id: 'week-3', name: 'Week 3', orderIndex: 2 },
        { id: 'week-4', name: 'Week 4', orderIndex: 3 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithWeeks))
      vi.mocked(mockProgramRepository.deleteWeek).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteWeek = makeDeleteWeek({ programRepository: mockProgramRepository })

      const result = await deleteWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
    })
  })
})
