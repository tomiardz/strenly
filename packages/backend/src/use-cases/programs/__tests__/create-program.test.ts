import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAthleteEntity } from '../../../__tests__/factories/athlete-factory'
import { createProgramInput, createTemplateProgramInput } from '../../../__tests__/factories/program-factory'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeCreateProgram } from '../create-program'

describe('[3.1-UNIT] createProgram use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  let mockAthleteRepository: AthleteRepositoryPort
  let mockGenerateId: () => string

  beforeEach(() => {
    // Mock repositories
    mockProgramRepository = {
      loadProgramAggregate: vi.fn(),
      saveProgramAggregate: vi.fn(),
      list: vi.fn(),
    } as unknown as ProgramRepositoryPort

    mockAthleteRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByLinkedUserId: vi.fn(),
      count: vi.fn(),
    }

    // Mock ID generator - generates unique IDs per test
    let idCounter = 0
    mockGenerateId = vi.fn(() => `test-id-${++idCounter}`)
  })

  describe('[3.1-UNIT] @p0 Happy Path', () => {
    it('[3.1-UNIT-001] @p0 should create program successfully with admin role', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'
      const input = createProgramInput({ name: 'Strength Program', athleteId })

      // Mock athlete exists
      const athlete = createAthleteEntity({ id: athleteId, organizationId: ctx.organizationId })
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      // Mock successful program save
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.name).toBe('Strength Program')
        expect(program.athleteId).toBe(athleteId)
        expect(program.organizationId).toBe(ctx.organizationId)
        expect(program.weeks).toBeDefined()
        expect(program.weeks.length).toBeGreaterThan(0)
      }

      // Verify athlete was checked
      expect(mockAthleteRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        athleteId,
      )

      // Verify program was saved
      expect(mockProgramRepository.saveProgramAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ctx.organizationId }),
        expect.objectContaining({
          name: 'Strength Program',
          athleteId,
        }),
      )
    })

    it('[3.1-UNIT-002] @p0 should create program with default 4 weeks and 3 sessions', async () => {
      const ctx = createCoachContext()
      // Omit weeksCount and sessionsCount to use defaults
      const input = { name: 'Default Program', athleteId: null }

      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.weeks).toHaveLength(4)
        expect(program.weeks[0]?.sessions).toHaveLength(3)
      }
    })

    it('[3.1-UNIT-003] @p1 should create program with custom weeks and sessions count', async () => {
      const ctx = createCoachContext()
      const input = createProgramInput({
        name: 'Custom Program',
        athleteId: null,
        weeksCount: 8,
        sessionsCount: 5,
      })

      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.weeks).toHaveLength(8)
        expect(program.weeks[0]?.sessions).toHaveLength(5)
      }
    })

    it('[3.1-UNIT-004] @p1 should create template program without athlete', async () => {
      const ctx = createCoachContext()
      const input = createTemplateProgramInput({ name: 'Template Program' })

      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value
        expect(program.isTemplate).toBe(true)
        expect(program.athleteId).toBeNull()
      }

      // Verify athlete was NOT checked
      expect(mockAthleteRepository.findById).not.toHaveBeenCalled()
    })
  })

  describe('[3.2-UNIT] @p0 Authorization', () => {
    it('[3.2-UNIT-001] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext() // Member role lacks write permission
      const input = createProgramInput()

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

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
      expect(mockProgramRepository.saveProgramAggregate).not.toHaveBeenCalled()
    })

    it('[3.2-UNIT-002] @p0 should succeed when user has admin role (has programs:write)', async () => {
      const ctx = createCoachContext()
      const input = createProgramInput({ athleteId: null })

      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.3-UNIT] @p1 Validation Errors', () => {
    it('[3.3-UNIT-001] @p1 should return validation error when name is empty', async () => {
      const ctx = createCoachContext()
      const input = createProgramInput({ name: '', athleteId: null })

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message.toLowerCase()).toContain('name')
        }
      }

      // Repository should NOT be called for invalid input
      expect(mockProgramRepository.saveProgramAggregate).not.toHaveBeenCalled()
    })
  })

  describe('[3.4-UNIT] @p1 Athlete Not Found Errors', () => {
    it('[3.4-UNIT-001] @p1 should return athlete_not_found error when athlete does not exist', async () => {
      const ctx = createCoachContext()
      const athleteId = 'non-existent-athlete'
      const input = createProgramInput({ athleteId })

      // Mock athlete not found
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(null))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('athlete_not_found')
        if (error.type === 'athlete_not_found') {
          expect(error.athleteId).toBe(athleteId)
        }
      }

      // Repository save should NOT be called
      expect(mockProgramRepository.saveProgramAggregate).not.toHaveBeenCalled()
    })
  })

  describe('[3.5-UNIT] @p2 Repository Errors', () => {
    it('[3.5-UNIT-001] @p2 should return repository error when athlete lookup fails', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'
      const input = createProgramInput({ athleteId })

      // Mock athlete repository failure
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Connection failed')
        }
      }
    })

    it('[3.5-UNIT-002] @p2 should return repository error when program save fails', async () => {
      const ctx = createCoachContext()
      const input = createProgramInput({ athleteId: null })

      // Mock program save failure
      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Save failed',
        }),
      )

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Save failed')
        }
      }
    })
  })

  describe('[3.6-UNIT] @p2 Edge Cases', () => {
    it('[3.6-UNIT-001] @p2 should generate unique IDs for weeks and sessions', async () => {
      const ctx = createCoachContext()
      const input = createProgramInput({
        name: 'Program',
        athleteId: null,
        weeksCount: 2,
        sessionsCount: 2,
      })

      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value

        // Collect all IDs
        const weekIds = program.weeks.map((w) => w.id)
        const sessionIds = program.weeks.flatMap((w) => w.sessions.map((s) => s.id))
        const allIds = [program.id, ...weekIds, ...sessionIds]

        // Verify all IDs are unique
        const uniqueIds = new Set(allIds)
        expect(uniqueIds.size).toBe(allIds.length)
      }
    })

    it('[3.6-UNIT-002] @p2 should set correct order indices for weeks and sessions', async () => {
      const ctx = createCoachContext()
      const input = createProgramInput({
        name: 'Program',
        athleteId: null,
        weeksCount: 3,
        sessionsCount: 4,
      })

      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value

        // Verify week order indices
        program.weeks.forEach((week, index) => {
          expect(week.orderIndex).toBe(index)
        })

        // Verify session order indices
        program.weeks.forEach((week) => {
          week.sessions.forEach((session, index) => {
            expect(session.orderIndex).toBe(index)
          })
        })
      }
    })

    it('[3.6-UNIT-003] @p3 should set default Spanish names for weeks and sessions', async () => {
      const ctx = createCoachContext()
      const input = createProgramInput({
        name: 'Program',
        athleteId: null,
        weeksCount: 2,
        sessionsCount: 2,
      })

      vi.mocked(mockProgramRepository.saveProgramAggregate).mockReturnValue(okAsync({ updatedAt: new Date() }))

      const createProgram = makeCreateProgram({
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createProgram({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const program = result.value

        // Verify week names
        expect(program.weeks[0]?.name).toBe('Semana 1')
        expect(program.weeks[1]?.name).toBe('Semana 2')

        // Verify session names
        expect(program.weeks[0]?.sessions[0]?.name).toBe('Dia 1')
        expect(program.weeks[0]?.sessions[1]?.name).toBe('Dia 2')
      }
    })
  })
})
