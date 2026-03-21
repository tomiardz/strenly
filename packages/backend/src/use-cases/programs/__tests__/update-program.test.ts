import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramWithStructure } from '../../../__tests__/factories/program-structure-factory'
import { createManagerContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeUpdateProgram } from '../update-program'

describe('[3.31-UNIT] @p2 updateProgram use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  const programId = 'program-123'
  const orgId = 'org-456'

  beforeEach(() => {
    mockProgramRepository = {
      findById: vi.fn(),
      update: vi.fn(),
      saveProgramAggregate: vi.fn(),
    } as unknown as ProgramRepositoryPort
  })

  describe('[3.31-UNIT] @p0 Happy Path', () => {
    it('[3.31-UNIT-001] @p0 should update program name successfully', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        name: 'Old Name',
        description: 'Old description',
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'Updated Name',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.name).toBe('Updated Name')
        expect(result.value.description).toBe('Old description') // Unchanged
      }

      expect(mockProgramRepository.update).toHaveBeenCalledWith(
        ctx,
        expect.objectContaining({
          name: 'Updated Name',
        }),
      )
    })

    it('[3.31-UNIT-002] @p2 should update description and keep other fields unchanged', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        name: 'Program Name',
        description: 'Old description',
        athleteId: 'athlete-789',
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        description: 'New description',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.name).toBe('Program Name') // Unchanged
        expect(result.value.description).toBe('New description')
        expect(result.value.athleteId).toBe('athlete-789') // Unchanged
      }
    })

    it('[3.31-UNIT-003] @p2 should assign athlete to program', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        athleteId: null,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        athleteId: 'athlete-123',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.athleteId).toBe('athlete-123')
      }
    })

    it('[3.31-UNIT-004] @p2 should unassign athlete from program', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        athleteId: 'athlete-456',
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        athleteId: null,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.athleteId).toBe(null)
      }
    })

    it('[3.31-UNIT-005] @p2 should convert template to non-template', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        isTemplate: true,
        athleteId: null,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        isTemplate: false,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.isTemplate).toBe(false)
      }
    })

    it('[3.31-UNIT-006] @p2 should update status to active', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        status: 'active',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.status).toBe('active')
      }
    })
  })

  describe('[3.31-UNIT] @p0 Authorization', () => {
    it('[3.31-UNIT-007] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext()
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('forbidden')
        if (result.error.type === 'forbidden') {
          expect(result.error.message).toContain('No permission')
        }
      }

      // Repository should not be called
      expect(mockProgramRepository.findById).not.toHaveBeenCalled()
    })
  })

  describe('[3.31-UNIT] @p1 Not Found Errors', () => {
    it('[3.31-UNIT-008] @p2 should return not_found when program does not exist', async () => {
      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId: 'non-existent-id',
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('not_found')
        if (result.error.type === 'not_found') {
          expect(result.error.programId).toBe('non-existent-id')
        }
      }

      // Update should not be called
      expect(mockProgramRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('[3.31-UNIT] @p1 Validation Errors', () => {
    it('[3.31-UNIT-009] @p1 should return validation error when name is empty', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: '',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
        if (result.error.type === 'validation_error') {
          expect(result.error.message).toContain('name')
        }
      }

      // Update should not be called
      expect(mockProgramRepository.update).not.toHaveBeenCalled()
    })

    it('[3.31-UNIT-010] @p1 should return validation error when name is too short', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'A',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })

    it('[3.31-UNIT-011] @p1 should return validation error when name is too long', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'A'.repeat(300),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })
  })

  describe('[3.31-UNIT] @p1 Repository Errors', () => {
    it('[3.31-UNIT-012] @p1 should return repository error when findById fails', async () => {
      vi.mocked(mockProgramRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[3.31-UNIT-013] @p1 should return repository error when update fails', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Update failed',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('[3.31-UNIT] @p2 Edge Cases', () => {
    it('[3.31-UNIT-014] @p2 should handle partial updates without overwriting other fields', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        name: 'Original Name',
        description: 'Original Description',
        athleteId: 'athlete-123',
        isTemplate: false,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'Updated Name',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.name).toBe('Updated Name')
        expect(result.value.description).toBe('Original Description')
        expect(result.value.athleteId).toBe('athlete-123')
        expect(result.value.isTemplate).toBe(false)
      }
    })

    it('[3.31-UNIT-015] @p2 should handle setting description to null explicitly', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        description: 'Has description',
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        description: null,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.description).toBe(null)
      }
    })

    it('[3.31-UNIT-016] @p2 should handle simultaneous updates to multiple fields', async () => {
      const existing = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        name: 'Old Name',
        description: 'Old Description',
        athleteId: null,
        isTemplate: true,
      })

      vi.mocked(mockProgramRepository.findById).mockReturnValue(okAsync(existing))
      vi.mocked(mockProgramRepository.update).mockImplementation((_, program) => okAsync(program))

      const ctx = createTestContext({ organizationId: orgId })
      const updateProgram = makeUpdateProgram({ programRepository: mockProgramRepository })

      const result = await updateProgram({
        ...ctx,
        programId,
        name: 'New Name',
        description: 'New Description',
        athleteId: 'athlete-456',
        isTemplate: false,
        status: 'active',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.name).toBe('New Name')
        expect(result.value.description).toBe('New Description')
        expect(result.value.athleteId).toBe('athlete-456')
        expect(result.value.isTemplate).toBe(false)
        expect(result.value.status).toBe('active')
      }
    })
  })
})
