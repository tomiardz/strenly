import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeUpdatePrescription } from '../update-prescription'

describe('[3.30-UNIT] @p2 updatePrescription use case', () => {
  let mockProgramRepository: ProgramRepositoryPort

  beforeEach(() => {
    // Mock ALL repository methods
    mockProgramRepository = {
      loadProgramAggregate: vi.fn(),
      saveProgramAggregate: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      findWithDetails: vi.fn(),
      createWeek: vi.fn(),
      findWeekById: vi.fn(),
      updateWeek: vi.fn(),
      deleteWeek: vi.fn(),
      findSessionById: vi.fn(),
      createSession: vi.fn(),
      updateSession: vi.fn(),
      deleteSession: vi.fn(),
      createGroup: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getMaxGroupOrderIndex: vi.fn(),
      findExerciseRowById: vi.fn(),
      getMaxExerciseRowOrderIndex: vi.fn(),
      createExerciseRow: vi.fn(),
      updateExerciseRow: vi.fn(),
      deleteExerciseRow: vi.fn(),
      upsertPrescription: vi.fn(),
      updatePrescriptionSeries: vi.fn(),
      saveDraft: vi.fn(),
      reorderExerciseRows: vi.fn(),
      duplicateWeek: vi.fn(),
      repositionRowToEndOfSession: vi.fn(),
      findExerciseRowsBySessionId: vi.fn(),
      countByStatus: vi.fn(),
    }
  })

  describe('[3.30-UNIT] @p0 Happy Path', () => {
    it('[3.30-UNIT-001] @p2 should update with valid notation "3x8@120kg"', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@120kg',
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const notation = result.value
        expect(notation).toBe('3x8@120kg') // Returns formatted notation
      }

      // Verify repository call
      expect(mockProgramRepository.upsertPrescription).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        exerciseRowId,
        weekId,
        expect.arrayContaining([
          expect.objectContaining({
            orderIndex: 0,
            reps: 8,
            intensityValue: 120,
          }),
        ]),
      )
    })

    it('[3.30-UNIT-002] @p3 should update with empty string (clears cell)', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '', // Empty - clears cell
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const notation = result.value
        expect(notation).toBeNull() // Cell cleared
      }

      // Verify cell was cleared (null passed to upsert)
      expect(mockProgramRepository.upsertPrescription).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        exerciseRowId,
        weekId,
        null,
      )
    })

    it('[3.30-UNIT-003] @p2 should update with notation "-" (rest day)', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '-', // Rest day marker
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const notation = result.value
        expect(notation).toBeNull() // Cell cleared
      }

      // Verify cell was cleared
      expect(mockProgramRepository.upsertPrescription).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        exerciseRowId,
        weekId,
        null,
      )
    })

    it('[3.30-UNIT-004] @p2 should update existing prescription (upsert)', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '4x10@100kg',
      })

      expect(result.isOk()).toBe(true)

      // Upsert should be called (creates or updates)
      expect(mockProgramRepository.upsertPrescription).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        exerciseRowId,
        weekId,
        expect.any(Array),
      )
    })

    it('[3.30-UNIT-005] @p2 should handle notation with sets and reps only', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x10', // No weight specified
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const notation = result.value
        expect(notation).toBe('3x10')
      }
    })
  })

  describe('[3.30-UNIT] @p0 Authorization', () => {
    it('[3.30-UNIT-006] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext() // Member role lacks write permission
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@120kg',
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
      expect(mockProgramRepository.upsertPrescription).not.toHaveBeenCalled()
    })

    it('[3.30-UNIT-007] @p0 should succeed when user has admin role (has programs:write)', async () => {
      const ctx = createCoachContext() // Admin role has write permission
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@120kg',
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.30-UNIT] @p1 Validation Errors', () => {
    it('[3.30-UNIT-008] @p2 should return not_found when row does not exist', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'non-existent-row'
      const weekId = 'week-1'

      // Mock repository returning NOT_FOUND error
      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(
        errAsync({
          type: 'NOT_FOUND',
          entityType: 'exercise_row',
          id: exerciseRowId,
        }),
      )

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@120kg',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.entityType).toBe('exercise_row')
          expect(error.id).toBe(exerciseRowId)
        }
      }
    })

    it('[3.30-UNIT-009] @p2 should return not_found when week does not exist', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'non-existent-week'

      // Mock repository returning NOT_FOUND error
      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(
        errAsync({
          type: 'NOT_FOUND',
          entityType: 'week',
          id: weekId,
        }),
      )

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@120kg',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.entityType).toBe('week')
          expect(error.id).toBe(weekId)
        }
      }
    })

    it('[3.30-UNIT-010] @p1 should return validation_error for invalid notation format', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: 'invalid notation!!', // Unparseable
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('Invalid prescription notation')
        }
      }

      // Repository should NOT be called for invalid notation
      expect(mockProgramRepository.upsertPrescription).not.toHaveBeenCalled()
    })

    it('[3.30-UNIT-011] @p1 should return validation_error for invalid series values', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      // Negative reps should fail validation
      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x-5@120kg', // Negative reps
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
      }

      // Repository should NOT be called
      expect(mockProgramRepository.upsertPrescription).not.toHaveBeenCalled()
    })
  })

  describe('[3.30-UNIT] @p1 Repository Errors', () => {
    it('[3.30-UNIT-012] @p1 should return repository error when database fails', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      // Mock repository failure
      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@120kg',
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
  })

  describe('[3.30-UNIT] @p2 Edge Cases', () => {
    it('[3.30-UNIT-013] @p2 should handle updating multiple cells in sequence', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      // First update
      const result1 = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@120kg',
      })

      expect(result1.isOk()).toBe(true)

      // Second update (same cell)
      const result2 = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '4x10@100kg',
      })

      expect(result2.isOk()).toBe(true)

      // Repository should have been called twice
      expect(mockProgramRepository.upsertPrescription).toHaveBeenCalledTimes(2)
    })

    it('[3.30-UNIT-014] @p2 should handle notation with percentage "3x8@70%"', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '3x8@70%',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const notation = result.value
        expect(notation).toContain('%') // Percentage preserved
      }
    })

    it('[3.30-UNIT-015] @p2 should handle whitespace in notation', async () => {
      const ctx = createCoachContext()
      const exerciseRowId = 'row-1'
      const weekId = 'week-1'

      vi.mocked(mockProgramRepository.upsertPrescription).mockReturnValue(okAsync(undefined))

      const updatePrescription = makeUpdatePrescription({
        programRepository: mockProgramRepository,
      })

      const result = await updatePrescription({
        ...ctx,
        exerciseRowId,
        weekId,
        notation: '  3x8@120kg  ', // Extra whitespace
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const notation = result.value
        expect(notation).toBe('3x8@120kg') // Whitespace trimmed
      }
    })
  })
})
