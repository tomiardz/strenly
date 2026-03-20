import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProgramWithStructure,
  createTemplateProgram,
} from '../../../__tests__/factories/program-structure-factory'
import { createCoachContext, createManagerContext, createOwnerContext } from '../../../__tests__/helpers/test-context'
import { makeArchiveProgram } from '../archive-program'

describe('[3.11-UNIT] archiveProgram use case', () => {
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

  describe('[3.11-UNIT] @p0 Happy Path', () => {
    it('[3.11-UNIT-001] @p0 should archive active program', async () => {
      const ctx = createCoachContext()
      const programId = 'program-1'

      // Mock existing active program
      const existingProgram = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
        status: 'active',
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existingProgram))

      // Mock successful update
      const archivedProgram = {
        ...existingProgram,
        status: 'archived' as const,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.update).mockReturnValue(okAsync(archivedProgram))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.status).toBe('archived')
        expect(program.id).toBe(programId)
      }

      // Verify repository calls
      expect(mockProgramRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        programId,
      )
      expect(mockProgramRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          id: programId,
          status: 'archived',
        }),
      )
    })

    it('[3.11-UNIT-002] @p0 should archive draft program', async () => {
      const ctx = createCoachContext()
      const programId = 'program-1'

      // Mock existing draft program
      const existingProgram = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
        status: 'draft',
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existingProgram))

      const archivedProgram = {
        ...existingProgram,
        status: 'archived' as const,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.update).mockReturnValue(okAsync(archivedProgram))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.status).toBe('archived')
      }
    })

    it('[3.11-UNIT-003] @p2 should verify updatedAt timestamp is set', async () => {
      const ctx = createCoachContext()
      const programId = 'program-1'

      const existingProgram = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
        status: 'active',
        updatedAt: new Date('2024-01-01'),
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existingProgram))

      const archivedProgram = {
        ...existingProgram,
        status: 'archived' as const,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.update).mockReturnValue(okAsync(archivedProgram))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.updatedAt).not.toEqual(existingProgram.updatedAt)
      }
    })
  })

  describe('[3.12-UNIT] @p0 Authorization', () => {
    it('[3.12-UNIT-001] @p0 should return forbidden error when user lacks programs:delete permission', async () => {
      const ctx = createManagerContext() // Member role lacks delete permission
      const programId = 'program-1'

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
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
      expect(mockProgramRepository.findById).not.toHaveBeenCalled()
      expect(mockProgramRepository.update).not.toHaveBeenCalled()
    })

    it('[3.12-UNIT-002] @p0 should succeed when user has admin/owner role', async () => {
      const ctx = createOwnerContext() // Owner role has delete permission
      const programId = 'program-1'

      const existingProgram = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
        status: 'active',
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existingProgram))

      const archivedProgram = {
        ...existingProgram,
        status: 'archived' as const,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.update).mockReturnValue(okAsync(archivedProgram))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.13-UNIT] @p1 Validation Errors', () => {
    it('[3.13-UNIT-001] @p1 should return not_found when program does not exist', async () => {
      const ctx = createCoachContext()
      const programId = 'non-existent-program'

      // Mock repository returning null (not found)
      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(null))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.programId).toBe(programId)
        }
      }

      // Repository update should NOT be called
      expect(mockProgramRepository.update).not.toHaveBeenCalled()
    })

    it('[3.13-UNIT-002] @p1 should return invalid_transition when already archived', async () => {
      const ctx = createCoachContext()
      const programId = 'program-1'

      // Mock existing archived program
      const existingProgram = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
        status: 'archived', // Already archived
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existingProgram))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('invalid_transition')
        if (error.type === 'invalid_transition') {
          expect(error.message).toContain('Cannot transition from archived to archived')
        }
      }

      // Repository update should NOT be called for invalid transition
      expect(mockProgramRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('[3.14-UNIT] @p2 Repository Errors', () => {
    it('[3.14-UNIT-001] @p2 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()
      const programId = 'program-1'

      // Mock repository findById failure
      vi.mocked(mockProgramRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
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

  describe('[3.15-UNIT] @p2 Edge Cases', () => {
    it('[3.15-UNIT-001] @p2 should archive template program', async () => {
      const ctx = createCoachContext()
      const programId = 'program-1'

      // Mock existing template program
      const existingProgram = createTemplateProgram({
        id: programId,
        organizationId: ctx.organizationId,
        status: 'active',
        isTemplate: true,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existingProgram))

      const archivedProgram = {
        ...existingProgram,
        status: 'archived' as const,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.update).mockReturnValue(okAsync(archivedProgram))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.status).toBe('archived')
        expect(program.isTemplate).toBe(true)
      }
    })

    it('[3.15-UNIT-002] @p2 should archive program with athletes assigned', async () => {
      const ctx = createCoachContext()
      const programId = 'program-1'
      const athleteId = 'athlete-1'

      const existingProgram = createProgramWithStructure({
        id: programId,
        organizationId: ctx.organizationId,
        status: 'active',
        athleteId,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existingProgram))

      const archivedProgram = {
        ...existingProgram,
        status: 'archived' as const,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.update).mockReturnValue(okAsync(archivedProgram))

      const archiveProgram = makeArchiveProgram({
        programRepository: mockProgramRepository,
      })

      const result = await archiveProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.status).toBe('archived')
        expect(program.athleteId).toBe(athleteId) // Athlete assignment preserved
      }
    })
  })
})
