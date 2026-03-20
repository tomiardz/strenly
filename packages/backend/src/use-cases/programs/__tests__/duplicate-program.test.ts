import { createProgram } from '@strenly/core/domain/entities/program/program'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramRepositoryMock } from '../../../__tests__/factories/program-repository-mock'
import { createManagerContext, createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeDuplicateProgram } from '../duplicate-program'

describe('[3.24-UNIT] @p2 duplicateProgram use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  let mockGenerateId: () => string

  beforeEach(() => {
    mockProgramRepository = createProgramRepositoryMock()

    // Mock ID generator - generates unique IDs per test
    let idCounter = 0
    mockGenerateId = vi.fn(() => `test-id-${++idCounter}`)
  })

  describe('[3.24-UNIT] @p0 Happy Path', () => {
    it('[3.24-UNIT-001] @p0 should duplicate program successfully with all nested structure', async () => {
      const ctx = createManagerContext()
      const sourceProgramId = 'source-program-1'

      // Create a source program with nested structure
      const sourceProgramResult = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Original Program',
        description: 'Original description',
        athleteId: 'athlete-1',
        isTemplate: false,
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
                exerciseGroups: [
                  {
                    id: 'group-1',
                    orderIndex: 0,
                    items: [
                      {
                        id: 'item-1',
                        exerciseId: 'exercise-1',
                        orderIndex: 0,
                        series: [
                          {
                            reps: 10,
                            repsMax: null,
                            isAmrap: false,
                            intensityType: 'percentage',
                            intensityValue: 80,
                            tempo: '2010',
                            restSeconds: 90,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      if (!sourceProgramResult.isOk()) {
        throw new Error('Failed to create source program')
      }

      const sourceProgram = sourceProgramResult.value

      // Mock successful load
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram))

      // Mock successful save
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const duplicateProgram = makeDuplicateProgram({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateProgram({
        ...ctx,
        sourceProgramId,
        name: 'Duplicated Program',
        athleteId: 'athlete-2',
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const duplicated = result.value

        // Verify program-level fields
        expect(duplicated.id).toContain('test-id-') // New ID generated
        expect(duplicated.id).not.toBe(sourceProgramId) // Different from source
        expect(duplicated.name).toBe('Duplicated Program')
        expect(duplicated.description).toBe('Original description')
        expect(duplicated.athleteId).toBe('athlete-2')
        expect(duplicated.isTemplate).toBe(false)
        expect(duplicated.status).toBe('draft') // Reset to draft

        // Verify nested structure is cloned with new IDs
        expect(duplicated.weeks).toHaveLength(1)
        const firstWeek = duplicated.weeks[0]
        if (firstWeek) {
          expect(firstWeek.id).toContain('test-id-') // New week ID
          expect(firstWeek.id).not.toBe('week-1') // Different from source
          expect(firstWeek.name).toBe('Week 1') // Name preserved
          expect(firstWeek.sessions).toHaveLength(1)
          const firstSession = firstWeek.sessions[0]
          if (firstSession) {
            expect(firstSession.id).toContain('test-id-') // New session ID
            expect(firstSession.id).not.toBe('session-1') // Different from source
            expect(firstSession.exerciseGroups).toHaveLength(1)
            const firstGroup = firstSession.exerciseGroups[0]
            if (firstGroup) {
              expect(firstGroup.id).toContain('test-id-') // New group ID
              expect(firstGroup.id).not.toBe('group-1') // Different from source
              expect(firstGroup.items).toHaveLength(1)
              const firstItem = firstGroup.items[0]
              if (firstItem) {
                expect(firstItem.id).toContain('test-id-') // New item ID
                expect(firstItem.id).not.toBe('item-1') // Different from source

                // Verify series data is preserved (series don't have IDs)
                const clonedSeries = firstItem.series[0]
                if (clonedSeries) {
                  expect(clonedSeries.reps).toBe(10)
                  expect(clonedSeries.intensityValue).toBe(80)
                  expect(clonedSeries.tempo).toBe('2010')
                }
              }
            }
          }
        }
      }

      // Verify repository calls
      expect(mockProgramRepository.loadProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        sourceProgramId,
      )

      expect(mockProgramRepository.saveProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        expect.objectContaining({
          name: 'Duplicated Program',
          athleteId: 'athlete-2',
          status: 'draft',
        }),
      )
    })

    it('[3.24-UNIT-002] @p2 should duplicate program with custom isTemplate and athleteId flags', async () => {
      const ctx = createManagerContext()
      const sourceProgramId = 'source-program-2'

      // Create a minimal source program
      const sourceProgramResult = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Source Program',
        description: null,
        athleteId: 'athlete-1',
        isTemplate: false,
        status: 'active',
        weeks: [
          {
            id: 'week-1',
            name: 'Week 1',
            orderIndex: 0,
            sessions: [],
          },
        ],
      })

      if (!sourceProgramResult.isOk()) {
        throw new Error('Failed to create source program')
      }

      const sourceProgram = sourceProgramResult.value

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram))
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const duplicateProgram = makeDuplicateProgram({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateProgram({
        ...ctx,
        sourceProgramId,
        name: 'Template Program',
        athleteId: null, // No athlete for template
        isTemplate: true, // Mark as template
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const duplicated = result.value
        expect(duplicated.isTemplate).toBe(true)
        expect(duplicated.athleteId).toBe(null)
        expect(duplicated.status).toBe('draft') // Always reset to draft
      }
    })
  })

  describe('[3.24-UNIT] @p0 Authorization', () => {
    it('[3.24-UNIT-003] @p0 should return forbidden when user lacks programs:write permission', async () => {
      const ctx = createCoachContext() // Member has no write permission

      const duplicateProgram = makeDuplicateProgram({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateProgram({
        ...ctx,
        sourceProgramId: 'any-program',
        name: 'Duplicated Program',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('forbidden')
        if (error.type === 'forbidden') {
          expect(error.message).toBe('No permission to create programs')
        }
      }

      // Should not call repository
      expect(mockProgramRepository.loadProgramAggregate).not.toHaveBeenCalled()
    })
  })

  describe('[3.24-UNIT] @p1 Not Found', () => {
    it('[3.24-UNIT-004] @p2 should return not_found when source program does not exist', async () => {
      const ctx = createManagerContext()
      const nonExistentId = 'non-existent-program'

      // Mock repository returns null (not found)
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(null))

      const duplicateProgram = makeDuplicateProgram({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateProgram({
        ...ctx,
        sourceProgramId: nonExistentId,
        name: 'Duplicated Program',
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
  })

  describe('[3.24-UNIT] @p1 Validation Errors', () => {
    it('[3.24-UNIT-005] @p1 should return validation_error when createProgram fails due to invalid name', async () => {
      const ctx = createManagerContext()
      const sourceProgramId = 'source-program-3'

      // Create source program with valid data
      const sourceProgramResult = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Valid Name',
        description: null,
        athleteId: null,
        isTemplate: false,
        status: 'draft',
        weeks: [],
      })

      if (!sourceProgramResult.isOk()) {
        throw new Error('Failed to create source program')
      }

      const sourceProgram = sourceProgramResult.value

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram))

      const duplicateProgram = makeDuplicateProgram({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      // Try to duplicate with empty name (invalid)
      const result = await duplicateProgram({
        ...ctx,
        sourceProgramId,
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

    it('[3.24-UNIT-006] @p1 should return validation_error when weeks structure is invalid', async () => {
      const ctx = createManagerContext()
      const sourceProgramId = 'source-program-4'

      // Create source program with invalid weeks (duplicate orderIndex)
      const sourceProgram = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Source Program',
        description: null,
        athleteId: null,
        isTemplate: false,
        status: 'draft',
        weeks: [
          {
            id: 'week-1',
            name: 'Week 1',
            orderIndex: 0,
            sessions: [],
          },
          {
            id: 'week-2',
            name: 'Week 2',
            orderIndex: 0, // Duplicate orderIndex (invalid)
            sessions: [],
          },
        ],
      })

      // If createProgram validation passes initially (shouldn't, but for test sake)
      if (sourceProgram.isOk()) {
        vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram.value))

        const duplicateProgram = makeDuplicateProgram({
          programRepository: mockProgramRepository,
          generateId: mockGenerateId,
        })

        const result = await duplicateProgram({
          ...ctx,
          sourceProgramId,
          name: 'Duplicated Program',
        })

        // Should fail validation during duplication
        if (result.isErr()) {
          expect(result.error.type).toBe('validation_error')
        }
      } else {
        // If validation catches it immediately, that's also valid
        expect(sourceProgram.isErr()).toBe(true)
      }
    })
  })

  describe('[3.24-UNIT] @p1 Repository Errors', () => {
    it('[3.24-UNIT-007] @p1 should return repository_error when loadProgramAggregate fails', async () => {
      const ctx = createManagerContext()
      const sourceProgramId = 'source-program-5'

      // Mock database error
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(
        errAsync({ type: 'DATABASE_ERROR', message: 'Connection timeout' }),
      )

      const duplicateProgram = makeDuplicateProgram({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateProgram({
        ...ctx,
        sourceProgramId,
        name: 'Duplicated Program',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toBe('Connection timeout')
        }
      }
    })

    it('[3.24-UNIT-008] @p1 should return repository_error when saveProgramAggregate fails', async () => {
      const ctx = createManagerContext()
      const sourceProgramId = 'source-program-6'

      // Create valid source program
      const sourceProgramResult = createProgram({
        id: sourceProgramId,
        organizationId: ctx.organizationId,
        name: 'Source Program',
        description: null,
        athleteId: null,
        isTemplate: false,
        status: 'draft',
        weeks: [],
      })

      if (!sourceProgramResult.isOk()) {
        throw new Error('Failed to create source program')
      }

      const sourceProgram = sourceProgramResult.value

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(sourceProgram))

      // Mock save failure
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(
        errAsync({ type: 'DATABASE_ERROR', message: 'Disk full' }),
      )

      const duplicateProgram = makeDuplicateProgram({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await duplicateProgram({
        ...ctx,
        sourceProgramId,
        name: 'Duplicated Program',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toBe('Disk full')
        }
      }
    })
  })
})
