import { createProgram } from '@strenly/core/domain/entities/program/program'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramRepositoryMock } from '../../../__tests__/factories/program-repository-mock'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeSaveAsTemplate } from '../save-as-template'

describe('[3.27-UNIT] @p2 saveAsTemplate use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  let mockGenerateId: () => string

  beforeEach(() => {
    mockProgramRepository = createProgramRepositoryMock()

    // Mock ID generator
    let idCounter = 0
    mockGenerateId = vi.fn(() => `template-id-${++idCounter}`)
  })

  describe('[3.27-UNIT] @p0 Happy Path', () => {
    it('[3.27-UNIT-001] @p2 should save program as template with correct flags', async () => {
      const ctx = createCoachContext()
      const sourceProgramId = 'program-1'

      // Create a source program (regular program with athlete)
      const sourceProgramResult = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Athlete Program',
        description: 'Program for specific athlete',
        athleteId: 'athlete-1', // Has athlete
        isTemplate: false, // Not a template
        status: 'active',
        weeks: [
          {
            id: 'week-1',
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: 'session-1',
                name: 'Session 1',
                orderIndex: 0,
                exerciseGroups: [],
              },
            ],
          },
        ],
      })

      if (!sourceProgramResult.isOk()) {
        throw new Error('Failed to create source program')
      }

      const sourceProgram = sourceProgramResult.value

      // Mock successful load and save
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram))
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const saveAsTemplate = makeSaveAsTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await saveAsTemplate({
        ...ctx,
        programId: sourceProgramId,
        name: 'Strength Template',
        description: 'Reusable template for strength training',
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const template = result.value

        // Verify template flags are set correctly
        expect(template.isTemplate).toBe(true) // Marked as template
        expect(template.athleteId).toBe(null) // No athlete assigned
        expect(template.name).toBe('Strength Template')
        expect(template.status).toBe('draft') // Reset to draft

        // Verify nested structure was cloned
        expect(template.weeks).toHaveLength(1)
        const firstWeek = template.weeks[0]
        if (firstWeek) {
          expect(firstWeek.sessions).toHaveLength(1)
          expect(firstWeek.id).not.toBe('week-1')
        }

        // Verify new IDs were generated (not same as source)
        expect(template.id).not.toBe(sourceProgramId)
      }

      // Verify repository interactions
      expect(mockProgramRepository.loadProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        sourceProgramId,
      )

      expect(mockProgramRepository.saveProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        expect.objectContaining({
          name: 'Strength Template',
          isTemplate: true,
          athleteId: null,
        }),
      )
    })
  })

  describe('[3.27-UNIT] @p0 Authorization', () => {
    it('[3.27-UNIT-002] @p0 should return forbidden when user lacks programs:write permission', async () => {
      const ctx = createManagerContext() // Manager lacks coaching/write permission

      const saveAsTemplate = makeSaveAsTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await saveAsTemplate({
        ...ctx,
        programId: 'any-program',
        name: 'Template Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('forbidden')
        if (error.type === 'forbidden') {
          expect(error.message).toBe('No permission to create templates')
        }
      }

      // Should not call repository
      expect(mockProgramRepository.loadProgramAggregate).not.toHaveBeenCalled()
    })
  })

  describe('[3.27-UNIT] @p1 Error Delegation from duplicate-program', () => {
    it('[3.27-UNIT-003] @p2 should return not_found when source program does not exist', async () => {
      const ctx = createCoachContext()
      const nonExistentId = 'non-existent-program'

      // Mock repository returns null (not found)
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(null))

      const saveAsTemplate = makeSaveAsTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await saveAsTemplate({
        ...ctx,
        programId: nonExistentId,
        name: 'Template Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.programId).toBe(nonExistentId)
        }
      }
    })

    it('[3.27-UNIT-004] @p1 should return validation_error when duplicate-program validation fails', async () => {
      const ctx = createCoachContext()
      const sourceProgramId = 'program-2'

      // Create source program
      const sourceProgram = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Source Program',
        description: null,
        athleteId: null,
        isTemplate: false,
        status: 'draft',
        weeks: [],
      })

      if (!sourceProgram.isOk()) {
        throw new Error('Failed to create source program')
      }

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram.value))

      const saveAsTemplate = makeSaveAsTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      // Try to save with invalid name (empty)
      const result = await saveAsTemplate({
        ...ctx,
        programId: sourceProgramId,
        name: '', // Invalid: empty name
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('name')
        }
      }
    })

    it('[3.27-UNIT-005] @p1 should return repository_error when duplicate-program repository fails', async () => {
      const ctx = createCoachContext()
      const sourceProgramId = 'program-3'

      // Create source program
      const sourceProgram = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Source Program',
        description: null,
        athleteId: null,
        isTemplate: false,
        status: 'draft',
        weeks: [],
      })

      if (!sourceProgram.isOk()) {
        throw new Error('Failed to create source program')
      }

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram.value))

      // Mock save failure
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(
        errAsync({ type: 'DATABASE_ERROR', message: 'Connection lost' }),
      )

      const saveAsTemplate = makeSaveAsTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await saveAsTemplate({
        ...ctx,
        programId: sourceProgramId,
        name: 'Template Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toBe('Connection lost')
        }
      }
    })
  })
})
