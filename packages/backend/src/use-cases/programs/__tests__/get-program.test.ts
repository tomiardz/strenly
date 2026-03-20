import type { Program } from '@strenly/core/domain/entities/program/program'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramRepositoryMock } from '../../../__tests__/factories/program-repository-mock'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeGetProgram } from '../get-program'

// Helper to create minimal program aggregate
function createProgramAggregate(overrides: Partial<Program> = {}): Program {
  return {
    id: 'program-1',
    organizationId: 'org-1',
    name: 'Strength Program',
    description: 'Build strength and muscle',
    athleteId: null,
    isTemplate: false,
    status: 'draft',
    weeks: [
      {
        id: 'week-1',
        name: 'Semana 1',
        orderIndex: 0,
        sessions: [
          {
            id: 'session-1',
            name: 'Dia 1',
            orderIndex: 0,
            exerciseGroups: [],
          },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('[3.7-UNIT] getProgram use case', () => {
  let mockProgramRepository: ProgramRepositoryPort

  beforeEach(() => {
    mockProgramRepository = createProgramRepositoryMock()
  })

  describe('[3.7-UNIT] @p0 Happy Path', () => {
    it('[3.7-UNIT-001] @p0 should get program successfully with member role', async () => {
      const ctx = createCoachContext() // Member has read permission
      const programId = 'program-1'

      const program = createProgramAggregate({ id: programId, organizationId: ctx.organizationId })

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.id).toBe(programId)
        expect(program.name).toBe('Strength Program')
        expect(program.weeks).toHaveLength(1)
        expect(program.weeks[0]?.sessions).toHaveLength(1)
      }

      // Verify repository called with correct context
      expect(mockProgramRepository.loadProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          roles: ['coach'],
        }),
        programId,
      )
    })

    it('[3.7-UNIT-002] @p1 should get template program', async () => {
      const ctx = createManagerContext()
      const programId = 'template-1'

      const program = createProgramAggregate({
        id: programId,
        organizationId: ctx.organizationId,
        isTemplate: true,
        athleteId: null,
      })

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.isTemplate).toBe(true)
        expect(result.value.athleteId).toBeNull()
      }
    })

    it('[3.7-UNIT-003] @p1 should get program assigned to athlete', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'
      const athleteId = 'athlete-1'

      const program = createProgramAggregate({
        id: programId,
        organizationId: ctx.organizationId,
        athleteId,
      })

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.athleteId).toBe(athleteId)
      }
    })

    it('[3.7-UNIT-004] @p2 should get program with complete aggregate hierarchy', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'

      const program = createProgramAggregate({
        id: programId,
        organizationId: ctx.organizationId,
        weeks: [
          {
            id: 'week-1',
            name: 'Semana 1',
            orderIndex: 0,
            sessions: [
              {
                id: 'session-1',
                name: 'Dia 1',
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
                        series: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.weeks).toHaveLength(1)
        expect(program.weeks[0]?.sessions).toHaveLength(1)
        expect(program.weeks[0]?.sessions[0]?.exerciseGroups).toHaveLength(1)
        expect(program.weeks[0]?.sessions[0]?.exerciseGroups[0]?.items).toHaveLength(1)
      }
    })
  })

  describe('[3.8-UNIT] @p1 Not Found Errors', () => {
    it('[3.8-UNIT-001] @p1 should return not_found error when program does not exist', async () => {
      const ctx = createManagerContext()
      const programId = 'non-existent-program'

      // Mock repository returning null (not found)
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(null))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
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
    })

    it('[3.8-UNIT-002] @p1 should return not_found error when user lacks access to program from other organization', async () => {
      const ctx = createManagerContext()
      const programId = 'other-org-program'

      // Repository returns null when program belongs to another organization
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(null))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
      }
    })
  })

  describe('[3.9-UNIT] @p2 Repository Errors', () => {
    it('[3.9-UNIT-001] @p2 should return repository error when database fails', async () => {
      const ctx = createManagerContext()
      const programId = 'program-1'

      // Mock repository failure
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Connection timeout')
        }
      }
    })
  })

  describe('[3.10-UNIT] @p2 Edge Cases', () => {
    it('[3.10-UNIT-001] @p2 should handle program with no weeks', async () => {
      const ctx = createManagerContext()
      const programId = 'empty-program'

      const program = createProgramAggregate({
        id: programId,
        organizationId: ctx.organizationId,
        weeks: [],
      })

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.weeks).toHaveLength(0)
      }
    })

    it('[3.10-UNIT-002] @p3 should handle archived program', async () => {
      const ctx = createManagerContext()
      const programId = 'archived-program'

      const program = createProgramAggregate({
        id: programId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))

      const getProgram = makeGetProgram({
        programRepository: mockProgramRepository,
      })

      const result = await getProgram({
        ...ctx,
        programId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.status).toBe('draft')
      }
    })
  })
})
