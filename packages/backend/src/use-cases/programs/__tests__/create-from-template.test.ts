import { createProgram } from '@strenly/core/domain/entities/program/program'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramRepositoryMock } from '../../../__tests__/factories/program-repository-mock'
import { createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeCreateFromTemplate } from '../create-from-template'

describe('[3.20-UNIT] @p2 createFromTemplate use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  let mockGenerateId: () => string

  beforeEach(() => {
    mockProgramRepository = createProgramRepositoryMock()

    // Mock ID generator
    let idCounter = 0
    mockGenerateId = vi.fn(() => `program-id-${++idCounter}`)
  })

  describe('[3.20-UNIT] @p0 Happy Path', () => {
    it('[3.20-UNIT-001] @p0 should create program from template successfully', async () => {
      const ctx = createCoachContext()
      const templateId = 'template-1'

      // Create a template program (isTemplate: true, no athlete)
      const templateProgram = createProgram({
        id: templateId,
        organizationId: ctx.organizationId,
        name: 'Strength Template',
        description: 'Base template for strength training',
        athleteId: null, // Templates have no athlete
        isTemplate: true, // Marked as template
        status: 'active',
        weeks: [
          {
            id: 'template-week-1',
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: 'template-session-1',
                name: 'Upper Body',
                orderIndex: 0,
                exerciseGroups: [
                  {
                    id: 'template-group-1',
                    orderIndex: 0,
                    items: [
                      {
                        id: 'template-item-1',
                        exerciseId: 'bench-press',
                        orderIndex: 0,
                        series: [
                          {
                            reps: 5,
                            repsMax: null,
                            isAmrap: false,
                            intensityType: 'percentage',
                            intensityValue: 85,
                            tempo: '2010',
                            restSeconds: 180,
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

      if (!templateProgram.isOk()) {
        throw new Error('Failed to create template program')
      }

      // Mock successful load and save
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(templateProgram.value))
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createFromTemplate = makeCreateFromTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await createFromTemplate({
        ...ctx,
        templateId,
        name: 'John Doe - Strength Program',
        athleteId: null, // No athlete assigned yet
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const newProgram = result.value

        // Verify it's NOT a template anymore
        expect(newProgram.isTemplate).toBe(false)
        expect(newProgram.name).toBe('John Doe - Strength Program')
        expect(newProgram.athleteId).toBe(null)
        expect(newProgram.status).toBe('draft')

        // Verify structure was cloned
        expect(newProgram.weeks).toHaveLength(1)
        const firstWeek = newProgram.weeks[0]
        if (firstWeek) {
          expect(firstWeek.sessions).toHaveLength(1)
          const firstSession = firstWeek.sessions[0]
          if (firstSession) {
            expect(firstSession.exerciseGroups).toHaveLength(1)
          }
        }

        // Verify new IDs were generated
        expect(newProgram.id).not.toBe(templateId)
        if (firstWeek) {
          expect(firstWeek.id).not.toBe('template-week-1')
        }
      }

      // Verify repository interactions
      expect(mockProgramRepository.loadProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        templateId,
      )

      expect(mockProgramRepository.saveProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        expect.objectContaining({
          name: 'John Doe - Strength Program',
          isTemplate: false,
          athleteId: null,
        }),
      )
    })

    it('[3.20-UNIT-002] @p2 should create program from template with athleteId assigned', async () => {
      const ctx = createCoachContext()
      const templateId = 'template-2'
      const athleteId = 'athlete-123'

      // Create template
      const templateProgram = createProgram({
        id: templateId,
        organizationId: ctx.organizationId,
        name: 'Hypertrophy Template',
        description: 'Muscle building template',
        athleteId: null,
        isTemplate: true,
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

      if (!templateProgram.isOk()) {
        throw new Error('Failed to create template program')
      }

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(templateProgram.value))
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createFromTemplate = makeCreateFromTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await createFromTemplate({
        ...ctx,
        templateId,
        name: 'Jane Doe - Hypertrophy',
        athleteId, // Assign to specific athlete
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const newProgram = result.value

        // Verify athlete assignment
        expect(newProgram.athleteId).toBe(athleteId)
        expect(newProgram.isTemplate).toBe(false)
      }

      expect(mockProgramRepository.saveProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        expect.objectContaining({
          athleteId,
          isTemplate: false,
        }),
      )
    })
  })

  describe('[3.20-UNIT] @p0 Authorization', () => {
    it('[3.20-UNIT-003] @p0 should return forbidden when user lacks programs:write permission', async () => {
      const ctx = createCoachContext() // Member has no write permission

      const createFromTemplate = makeCreateFromTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await createFromTemplate({
        ...ctx,
        templateId: 'any-template',
        name: 'New Program',
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

  describe('[3.20-UNIT] @p1 Not Found', () => {
    it('[3.20-UNIT-004] @p2 should return not_found when template does not exist', async () => {
      const ctx = createCoachContext()
      const nonExistentId = 'non-existent-template'

      // Mock repository returns null (not found)
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(null))

      const createFromTemplate = makeCreateFromTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await createFromTemplate({
        ...ctx,
        templateId: nonExistentId,
        name: 'New Program',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.templateId).toBe(nonExistentId)
        }
      }
    })
  })

  describe('[3.20-UNIT] @p1 Template Validation', () => {
    it('[3.20-UNIT-005] @p2 should return not_a_template when source program is not a template', async () => {
      const ctx = createCoachContext()
      const regularProgramId = 'regular-program-1'

      // Create a REGULAR program (not a template)
      const regularProgram = createProgram({
        id: regularProgramId,
        organizationId: ctx.organizationId,
        name: 'Regular Program',
        description: 'Just a regular program',
        athleteId: 'athlete-1',
        isTemplate: false, // NOT a template
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

      if (!regularProgram.isOk()) {
        throw new Error('Failed to create regular program')
      }

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(regularProgram.value))

      const createFromTemplate = makeCreateFromTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await createFromTemplate({
        ...ctx,
        templateId: regularProgramId,
        name: 'New Program',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_a_template')
        if (error.type === 'not_a_template') {
          expect(error.templateId).toBe(regularProgramId)
        }
      }

      // Should NOT attempt to save (validation failed)
      expect(mockProgramRepository.saveProgramAggregate).not.toHaveBeenCalled()
    })
  })

  describe('[3.20-UNIT] @p1 Error Delegation from duplicate-program', () => {
    it('[3.20-UNIT-006] @p1 should return repository_error when duplicate-program repository fails', async () => {
      const ctx = createCoachContext()
      const templateId = 'template-3'

      // Create valid template
      const templateProgram = createProgram({
        id: templateId,
        organizationId: ctx.organizationId,
        name: 'Template',
        description: null,
        athleteId: null,
        isTemplate: true,
        status: 'active',
        weeks: [],
      })

      if (!templateProgram.isOk()) {
        throw new Error('Failed to create template program')
      }

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(templateProgram.value))

      // Mock save failure
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(
        errAsync({ type: 'DATABASE_ERROR', message: 'Write conflict' }),
      )

      const createFromTemplate = makeCreateFromTemplate({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await createFromTemplate({
        ...ctx,
        templateId,
        name: 'New Program',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toBe('Write conflict')
        }
      }
    })
  })
})
