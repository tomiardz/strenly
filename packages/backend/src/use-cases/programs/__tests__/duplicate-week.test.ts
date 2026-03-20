import type {
  ProgramRepositoryPort,
  ProgramWeek,
  ProgramWithDetails,
} from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramWithStructure } from '../../../__tests__/factories/program-structure-factory'
import { createManagerContext, createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeDuplicateWeek } from '../duplicate-week'

describe('[3.25-UNIT] @p2 duplicateWeek use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  let mockGenerateId: () => string

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

    // Mock ID generator
    let idCounter = 0
    mockGenerateId = vi.fn(() => `test-id-${++idCounter}`)
  })

  describe('[3.25-UNIT] @p0 Happy Path', () => {
    it('[3.25-UNIT-001] @p0 should duplicate week successfully', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      // Mock program with week
      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      // Mock successful duplication
      const duplicatedWeek: ProgramWeek = {
        id: 'week-2',
        programId,
        name: 'Week 1 (copia)',
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockProgramRepository.duplicateWeek).mockReturnValue(okAsync(duplicatedWeek))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const week = result.value
        expect(week.name).toBe('Week 1 (copia)') // Default name with "(copia)"
        expect(week.programId).toBe(programId)
      }

      // Verify repository calls
      expect(mockProgramRepository.findWithDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        programId,
      )
      expect(mockProgramRepository.duplicateWeek).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        weekId,
        'Week 1 (copia)',
      )
    })

    it('[3.25-UNIT-002] @p2 should duplicate week with custom name', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      const duplicatedWeek: ProgramWeek = {
        id: 'week-2',
        programId,
        name: 'Deload Week',
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockProgramRepository.duplicateWeek).mockReturnValue(okAsync(duplicatedWeek))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
        name: 'Deload Week', // Custom name
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const week = result.value
        expect(week.name).toBe('Deload Week')
      }

      expect(mockProgramRepository.duplicateWeek).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        weekId,
        'Deload Week',
      )
    })

    it('[3.25-UNIT-003] @p2 should duplicate week with sessions and exercise rows', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [
          {
            id: 'session-1',
            programId,
            name: 'Day 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            rows: [],
          },
        ],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      const duplicatedWeek: ProgramWeek = {
        id: 'week-2',
        programId,
        name: 'Week 1 (copia)',
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockProgramRepository.duplicateWeek).mockReturnValue(okAsync(duplicatedWeek))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.25-UNIT] @p0 Authorization', () => {
    it('[3.25-UNIT-004] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createCoachContext() // Member role lacks write permission
      const programId = 'program-1'
      const weekId = 'week-1'

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
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
      expect(mockProgramRepository.findWithDetails).not.toHaveBeenCalled()
      expect(mockProgramRepository.duplicateWeek).not.toHaveBeenCalled()
    })

    it('[3.25-UNIT-005] @p0 should succeed when user has admin role (has programs:write)', async () => {
      const ctx = createManagerContext() // Admin role has write permission
      const programId = 'program-1'
      const weekId = 'week-1'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      const duplicatedWeek: ProgramWeek = {
        id: 'week-2',
        programId,
        name: 'Week 1 (copia)',
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockProgramRepository.duplicateWeek).mockReturnValue(okAsync(duplicatedWeek))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.25-UNIT] @p1 Validation Errors', () => {
    it('[3.25-UNIT-006] @p2 should return program_not_found when program does not exist', async () => {
      const ctx = createManagerContext()
      const programId = 'non-existent-program'
      const weekId = 'week-1'

      // Mock repository returning null (program not found)
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(null))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('program_not_found')
        if (error.type === 'program_not_found') {
          expect(error.programId).toBe(programId)
        }
      }

      // Repository duplicate should NOT be called
      expect(mockProgramRepository.duplicateWeek).not.toHaveBeenCalled()
    })

    it('[3.25-UNIT-007] @p2 should return not_found when source week does not exist', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'non-existent-week'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: 'week-1',
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId, // Week doesn't exist in program
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.weekId).toBe(weekId)
        }
      }

      // Repository duplicate should NOT be called
      expect(mockProgramRepository.duplicateWeek).not.toHaveBeenCalled()
    })

    it('[3.25-UNIT-008] @p1 should return validation_error when name is too long', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
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

      // Repository duplicate should NOT be called
      expect(mockProgramRepository.duplicateWeek).not.toHaveBeenCalled()
    })
  })

  describe('[3.25-UNIT] @p1 Repository Errors', () => {
    it('[3.25-UNIT-009] @p1 should return repository error when findWithDetails fails', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      // Mock repository failure
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
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

    it('[3.25-UNIT-010] @p1 should return repository error when duplicateWeek fails', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      // Mock duplication failure
      vi.mocked(mockProgramRepository.duplicateWeek).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Duplication failed',
        }),
      )

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Duplication failed')
        }
      }
    })
  })

  describe('[3.25-UNIT] @p2 Edge Cases', () => {
    it('[3.25-UNIT-011] @p3 should handle empty week (no sessions)', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [], // Empty
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      const duplicatedWeek: ProgramWeek = {
        id: 'week-2',
        programId,
        name: 'Week 1 (copia)',
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockProgramRepository.duplicateWeek).mockReturnValue(okAsync(duplicatedWeek))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
    })

    it('[3.25-UNIT-012] @p2 should duplicate week in template program', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const weekId = 'week-1'

      const program = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
        isTemplate: true,
      })

      const programWithDetails: ProgramWithDetails = {
        ...program,
        weeks: [
          {
            id: weekId,
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        sessions: [],
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithDetails))

      const duplicatedWeek: ProgramWeek = {
        id: 'week-2',
        programId,
        name: 'Week 1 (copia)',
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(mockProgramRepository.duplicateWeek).mockReturnValue(okAsync(duplicatedWeek))

      const duplicateWeek = makeDuplicateWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateWeek({
        ...ctx,
        programId,
        weekId,
      })

      expect(result.isOk()).toBe(true)
    })
  })
})
