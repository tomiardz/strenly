import { faker } from '@faker-js/faker'
import type { Week } from '@strenly/core/domain/entities/program/types'
import type { ProgramRepositoryPort, ProgramWithDetails } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramWithStructure } from '../../../__tests__/factories/program-structure-factory'
import { createManagerContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeAddWeek } from '../add-week'

// Helper to create program with custom weeks
function createProgramWithWeeks(weeks: Omit<Week, 'sessions'>[]): ProgramWithDetails {
  const program = createProgramWithStructure({
    weeks: weeks.map((w) => ({ ...w, sessions: [] })),
  })

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

describe('[3.19-UNIT] @p2 addWeek use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  let mockGenerateId: () => string
  const programId = 'program-123'
  const orgId = 'org-456'

  beforeEach(() => {
    mockProgramRepository = {
      findById: vi.fn(),
      findWithDetails: vi.fn(),
      update: vi.fn(),
      saveProgramAggregate: vi.fn(),
      createWeek: vi.fn(),
    } as unknown as ProgramRepositoryPort
    mockGenerateId = vi.fn(() => faker.string.uuid())
  })

  describe('[3.19-UNIT] @p0 Happy Path', () => {
    it('[3.19-UNIT-001] @p0 should add week successfully with explicit name', async () => {
      const existingProgram = createProgramWithWeeks([{ id: 'week-1', name: 'Week 1', orderIndex: 0 }])

      const newWeekId = 'week-new-123'
      vi.mocked(mockGenerateId).mockReturnValue(newWeekId)

      const createdWeek = {
        id: newWeekId,
        programId,
        name: 'Week 2',
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createWeek).mockReturnValue(okAsync(createdWeek))

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: 'Week 2',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(newWeekId)
        expect(result.value.name).toBe('Week 2')
        expect(result.value.orderIndex).toBe(1)
        expect(result.value.programId).toBe(programId)
      }

      expect(mockProgramRepository.createWeek).toHaveBeenCalledWith(
        ctx,
        programId,
        expect.objectContaining({
          id: newWeekId,
          name: 'Week 2',
          orderIndex: 1,
        }),
      )
    })

    it('[3.19-UNIT-002] @p2 should add week with auto-generated name when not provided', async () => {
      const existingProgram = createProgramWithWeeks([])

      const newWeekId = 'week-first-123'
      vi.mocked(mockGenerateId).mockReturnValue(newWeekId)

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createWeek).mockImplementation((_ctx, _pid, week) =>
        okAsync({
          ...week,
          programId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(newWeekId)
        expect(result.value.orderIndex).toBe(0)
        // Domain factory generates default name like "Week 1"
        expect(result.value.name).toBeTruthy()
      }
    })

    it('[3.19-UNIT-003] @p3 should add week to empty program with orderIndex 0', async () => {
      const emptyProgram = createProgramWithWeeks([])

      const newWeekId = 'week-first-123'
      vi.mocked(mockGenerateId).mockReturnValue(newWeekId)

      const createdWeek = {
        id: newWeekId,
        programId,
        name: 'First Week',
        orderIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(emptyProgram))
      vi.mocked(mockProgramRepository.createWeek).mockReturnValue(okAsync(createdWeek))

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: 'First Week',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.orderIndex).toBe(0)
      }
    })

    it('[3.19-UNIT-004] @p2 should trim week name when provided', async () => {
      const existingProgram = createProgramWithWeeks([])

      const createdWeek = {
        id: 'week-123',
        programId,
        name: 'Trimmed Week',
        orderIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createWeek).mockReturnValue(okAsync(createdWeek))

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: '  Trimmed Week  ',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.name).toBe('Trimmed Week')
      }
    })
  })

  describe('[3.19-UNIT] @p0 Authorization', () => {
    it('[3.19-UNIT-005] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext()
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: 'New Week',
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

  describe('[3.19-UNIT] @p1 Not Found Errors', () => {
    it('[3.19-UNIT-006] @p2 should return not_found when program does not exist', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId: 'non-existent-id',
        name: 'New Week',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('not_found')
        if (result.error.type === 'not_found') {
          expect(result.error.programId).toBe('non-existent-id')
        }
      }

      // Create should not be called
      expect(mockProgramRepository.createWeek).not.toHaveBeenCalled()
    })
  })

  describe('[3.19-UNIT] @p1 Validation Errors', () => {
    it('[3.19-UNIT-007] @p1 should return validation error when name is too long', async () => {
      const existingProgram = createProgramWithWeeks([])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: 'A'.repeat(300),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }

      // Create should not be called
      expect(mockProgramRepository.createWeek).not.toHaveBeenCalled()
    })
  })

  describe('[3.19-UNIT] @p1 Repository Errors', () => {
    it('[3.19-UNIT-008] @p1 should return repository error when findWithDetails fails', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: 'New Week',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[3.19-UNIT-009] @p1 should return repository error when createWeek fails', async () => {
      const existingProgram = createProgramWithWeeks([])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createWeek).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Insert failed',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: 'New Week',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('[3.19-UNIT] @p2 Edge Cases', () => {
    it('[3.19-UNIT-010] @p2 should handle adding multiple weeks sequentially', async () => {
      const initialProgram = createProgramWithWeeks([])
      const programWithWeek = createProgramWithWeeks([{ id: 'week-1', name: 'Week 1', orderIndex: 0 }])

      // First call returns empty, second returns with 1 week
      vi.mocked(mockProgramRepository.findWithDetails)
        .mockReturnValueOnce(okAsync(initialProgram))
        .mockReturnValueOnce(okAsync(programWithWeek))

      vi.mocked(mockProgramRepository.createWeek)
        .mockReturnValueOnce(
          okAsync({
            id: 'week-1',
            programId,
            name: 'Week 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        )
        .mockReturnValueOnce(
          okAsync({
            id: 'week-2',
            programId,
            name: 'Week 2',
            orderIndex: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        )

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      // Add first week
      const result1 = await addWeek({ ...ctx, programId, name: 'Week 1' })
      expect(result1.isOk()).toBe(true)
      if (result1.isOk()) {
        expect(result1.value.orderIndex).toBe(0)
      }

      // Add second week
      const result2 = await addWeek({ ...ctx, programId, name: 'Week 2' })
      expect(result2.isOk()).toBe(true)
      if (result2.isOk()) {
        expect(result2.value.orderIndex).toBe(1)
      }
    })

    it('[3.19-UNIT-011] @p2 should use generateId for new week ID', async () => {
      const existingProgram = createProgramWithWeeks([])

      const generatedId = 'generated-uuid-456'
      vi.mocked(mockGenerateId).mockReturnValue(generatedId)

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createWeek).mockImplementation((_ctx, _pid, week) =>
        okAsync({
          ...week,
          programId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const addWeek = makeAddWeek({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addWeek({
        ...ctx,
        programId,
        name: 'New Week',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(generatedId)
      }

      expect(mockGenerateId).toHaveBeenCalledTimes(1)
    })
  })
})
