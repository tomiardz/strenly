import type { ProgramRepositoryPort, ProgramWeek } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeUpdateWeek } from '../update-week'

describe('[3.33-UNIT] @p2 updateWeek use case', () => {
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
    }
  })

  describe('[3.33-UNIT] @p0 Happy Path', () => {
    it('[3.33-UNIT-001] @p0 should update week name successfully', async () => {
      const ctx = createCoachContext()
      const weekId = 'week-1'

      // Mock existing week
      const existingWeek: ProgramWeek = {
        id: weekId,
        programId: 'program-1',
        name: 'Old Week Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(existingWeek))

      // Mock successful update
      const updatedWeek: ProgramWeek = {
        ...existingWeek,
        name: 'New Week Name',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateWeek).mockReturnValue(okAsync(updatedWeek))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: 'New Week Name',
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const week = result.value
        expect(week.name).toBe('New Week Name')
        expect(week.orderIndex).toBe(0) // Unchanged
      }

      // Verify repository calls
      expect(mockProgramRepository.findWeekById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        weekId,
      )
      expect(mockProgramRepository.updateWeek).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          id: weekId,
          name: 'New Week Name',
        }),
      )
    })

    it('[3.33-UNIT-002] @p2 should update with same name (idempotent)', async () => {
      const ctx = createCoachContext()
      const weekId = 'week-1'

      const existingWeek: ProgramWeek = {
        id: weekId,
        programId: 'program-1',
        name: 'Week 1',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(existingWeek))

      const updatedWeek: ProgramWeek = {
        ...existingWeek,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateWeek).mockReturnValue(okAsync(updatedWeek))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: 'Week 1', // Same name
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const week = result.value
        expect(week.name).toBe('Week 1')
      }
    })

    it('[3.33-UNIT-003] @p2 should update week in multi-week program', async () => {
      const ctx = createCoachContext()
      const weekId = 'week-2'

      const existingWeek: ProgramWeek = {
        id: weekId,
        programId: 'program-1',
        name: 'Week 2',
        orderIndex: 1, // Second week
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(existingWeek))

      const updatedWeek: ProgramWeek = {
        ...existingWeek,
        name: 'Deload Week',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateWeek).mockReturnValue(okAsync(updatedWeek))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: 'Deload Week',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const week = result.value
        expect(week.name).toBe('Deload Week')
        expect(week.orderIndex).toBe(1) // Preserved
      }
    })
  })

  describe('[3.33-UNIT] @p0 Authorization', () => {
    it('[3.33-UNIT-004] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createCoachContext() // Member role lacks write permission
      const weekId = 'week-1'

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
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
      expect(mockProgramRepository.findWeekById).not.toHaveBeenCalled()
      expect(mockProgramRepository.updateWeek).not.toHaveBeenCalled()
    })

    it('[3.33-UNIT-005] @p0 should succeed when user has admin role (has programs:write)', async () => {
      const ctx = createManagerContext() // Admin role has write permission
      const weekId = 'week-1'

      const existingWeek: ProgramWeek = {
        id: weekId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(existingWeek))

      const updatedWeek: ProgramWeek = {
        ...existingWeek,
        name: 'New Name',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateWeek).mockReturnValue(okAsync(updatedWeek))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: 'New Name',
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.33-UNIT] @p1 Validation Errors', () => {
    it('[3.33-UNIT-006] @p2 should return not_found when weekId does not exist', async () => {
      const ctx = createCoachContext()
      const weekId = 'non-existent-week'

      // Mock repository returning null (not found)
      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(null))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.weekId).toBe(weekId)
        }
      }

      // Repository update should NOT be called
      expect(mockProgramRepository.updateWeek).not.toHaveBeenCalled()
    })

    it('[3.33-UNIT-007] @p1 should return validation_error when name is too long', async () => {
      const ctx = createCoachContext()
      const weekId = 'week-1'

      const existingWeek: ProgramWeek = {
        id: weekId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(existingWeek))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: 'A'.repeat(51), // Invalid: exceeds 50 character limit
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('must not exceed 50 characters')
        }
      }

      // Repository update should NOT be called for invalid input
      expect(mockProgramRepository.updateWeek).not.toHaveBeenCalled()
    })
  })

  describe('[3.33-UNIT] @p1 Repository Errors', () => {
    it('[3.33-UNIT-008] @p1 should return repository error when findWeekById fails', async () => {
      const ctx = createCoachContext()
      const weekId = 'week-1'

      // Mock repository findWeekById failure
      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
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
  })

  describe('[3.33-UNIT] @p2 Edge Cases', () => {
    it('[3.33-UNIT-009] @p2 should update week with special characters in name', async () => {
      const ctx = createCoachContext()
      const weekId = 'week-1'

      const existingWeek: ProgramWeek = {
        id: weekId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(existingWeek))

      const updatedWeek: ProgramWeek = {
        ...existingWeek,
        name: 'Week #1 - Hypertrophy (High Volume)',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateWeek).mockReturnValue(okAsync(updatedWeek))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: 'Week #1 - Hypertrophy (High Volume)',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const week = result.value
        expect(week.name).toBe('Week #1 - Hypertrophy (High Volume)')
      }
    })

    it('[3.33-UNIT-010] @p3 should use default name when input is empty', async () => {
      const ctx = createCoachContext()
      const weekId = 'week-1'

      const existingWeek: ProgramWeek = {
        id: weekId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 2, // Third week (0-indexed)
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findWeekById).mockReturnValue(okAsync(existingWeek))

      const updatedWeek: ProgramWeek = {
        ...existingWeek,
        name: 'Semana 3', // Default name based on orderIndex (2 + 1)
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateWeek).mockReturnValue(okAsync(updatedWeek))

      const updateWeek = makeUpdateWeek({
        programRepository: mockProgramRepository,
      })

      const result = await updateWeek({
        ...ctx,
        weekId,
        name: '', // Empty - will use default
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const week = result.value
        expect(week.name).toBe('Semana 3') // Default name
      }
    })
  })
})
