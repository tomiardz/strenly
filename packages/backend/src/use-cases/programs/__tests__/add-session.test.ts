import { faker } from '@faker-js/faker'
import type { Session } from '@strenly/core/domain/entities/program/types'
import type { ProgramRepositoryPort, ProgramWithDetails } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramWithStructure } from '../../../__tests__/factories/program-structure-factory'
import { createCoachContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeAddSession } from '../add-session'

// Helper to create program with custom sessions
function createProgramWithSessions(sessions: Omit<Session, 'exerciseGroups'>[]): ProgramWithDetails {
  const program = createProgramWithStructure({
    weeks: [
      {
        id: 'week-1',
        name: 'Week 1',
        orderIndex: 0,
        sessions: sessions.map((s) => ({ ...s, exerciseGroups: [] })),
      },
    ],
  })

  return {
    ...program,
    weeks: [
      {
        id: 'week-1',
        programId: program.id,
        name: 'Week 1',
        orderIndex: 0,
        createdAt: new Date(),
      },
    ],
    sessions: sessions.map((s) => ({
      ...s,
      exerciseGroups: [],
      rows: [],
    })) as unknown as ProgramWithDetails['sessions'],
  } as unknown as ProgramWithDetails
}

describe('[3.18-UNIT] @p2 addSession use case', () => {
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
      createSession: vi.fn(),
    } as unknown as ProgramRepositoryPort
    mockGenerateId = vi.fn(() => faker.string.uuid())
  })

  describe('[3.18-UNIT] @p0 Happy Path', () => {
    it('[3.18-UNIT-001] @p0 should add session successfully to existing program', async () => {
      const existingProgram = createProgramWithSessions([
        { id: 'session-1', name: 'Day 1', orderIndex: 0 },
        { id: 'session-2', name: 'Day 2', orderIndex: 1 },
      ])

      const newSessionId = 'session-new-123'
      vi.mocked(mockGenerateId).mockReturnValue(newSessionId)

      const createdSession = {
        id: newSessionId,
        programId,
        name: 'Day 3',
        orderIndex: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createSession).mockReturnValue(okAsync(createdSession))

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: 'Day 3',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(newSessionId)
        expect(result.value.name).toBe('Day 3')
        expect(result.value.orderIndex).toBe(2)
        expect(result.value.programId).toBe(programId)
      }

      expect(mockProgramRepository.createSession).toHaveBeenCalledWith(
        ctx,
        programId,
        expect.objectContaining({
          id: newSessionId,
          name: 'Day 3',
          orderIndex: 2,
        }),
      )
    })

    it('[3.18-UNIT-002] @p3 should add session to empty program with orderIndex 0', async () => {
      const emptyProgram = createProgramWithSessions([])

      const newSessionId = 'session-first-123'
      vi.mocked(mockGenerateId).mockReturnValue(newSessionId)

      const createdSession = {
        id: newSessionId,
        programId,
        name: 'First Session',
        orderIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(emptyProgram))
      vi.mocked(mockProgramRepository.createSession).mockReturnValue(okAsync(createdSession))

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: 'First Session',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.orderIndex).toBe(0)
      }
    })

    it('[3.18-UNIT-003] @p2 should trim session name', async () => {
      const existingProgram = createProgramWithSessions([])

      const createdSession = {
        id: 'session-123',
        programId,
        name: 'Trimmed Name',
        orderIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createSession).mockReturnValue(okAsync(createdSession))

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: '  Trimmed Name  ',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.name).toBe('Trimmed Name')
      }
    })
  })

  describe('[3.18-UNIT] @p0 Authorization', () => {
    it('[3.18-UNIT-004] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createCoachContext()
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: 'New Session',
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

  describe('[3.18-UNIT] @p1 Not Found Errors', () => {
    it('[3.18-UNIT-005] @p2 should return program_not_found when program does not exist', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId: 'non-existent-id',
        name: 'New Session',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('program_not_found')
        if (result.error.type === 'program_not_found') {
          expect(result.error.programId).toBe('non-existent-id')
        }
      }

      // Create should not be called
      expect(mockProgramRepository.createSession).not.toHaveBeenCalled()
    })
  })

  describe('[3.18-UNIT] @p1 Validation Errors', () => {
    it('[3.18-UNIT-006] @p1 should return validation error when name is empty', async () => {
      const existingProgram = createProgramWithSessions([])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
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

      // Create should not be called
      expect(mockProgramRepository.createSession).not.toHaveBeenCalled()
    })

    it('[3.18-UNIT-007] @p1 should return validation error when name is only whitespace', async () => {
      const existingProgram = createProgramWithSessions([])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: '   ',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })

    it('[3.18-UNIT-008] @p1 should return validation error when name is too long', async () => {
      const existingProgram = createProgramWithSessions([])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
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

  describe('[3.18-UNIT] @p1 Repository Errors', () => {
    it('[3.18-UNIT-009] @p1 should return repository error when findWithDetails fails', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: 'New Session',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[3.18-UNIT-010] @p1 should return repository error when createSession fails', async () => {
      const existingProgram = createProgramWithSessions([])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createSession).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Insert failed',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: 'New Session',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('[3.18-UNIT] @p2 Edge Cases', () => {
    it('[3.18-UNIT-011] @p2 should handle adding multiple sessions sequentially', async () => {
      const initialProgram = createProgramWithSessions([])

      // First call returns empty, second returns with 1 session
      vi.mocked(mockProgramRepository.findWithDetails)
        .mockReturnValueOnce(okAsync(initialProgram))
        .mockReturnValueOnce(okAsync(createProgramWithSessions([{ id: 'session-1', name: 'Day 1', orderIndex: 0 }])))

      vi.mocked(mockProgramRepository.createSession)
        .mockReturnValueOnce(
          okAsync({
            id: 'session-1',
            programId,
            name: 'Day 1',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        )
        .mockReturnValueOnce(
          okAsync({
            id: 'session-2',
            programId,
            name: 'Day 2',
            orderIndex: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        )

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      // Add first session
      const result1 = await addSession({ ...ctx, programId, name: 'Day 1' })
      expect(result1.isOk()).toBe(true)
      if (result1.isOk()) {
        expect(result1.value.orderIndex).toBe(0)
      }

      // Add second session
      const result2 = await addSession({ ...ctx, programId, name: 'Day 2' })
      expect(result2.isOk()).toBe(true)
      if (result2.isOk()) {
        expect(result2.value.orderIndex).toBe(1)
      }
    })

    it('[3.18-UNIT-012] @p2 should use generateId for new session ID', async () => {
      const existingProgram = createProgramWithSessions([])

      const generatedId = 'generated-uuid-123'
      vi.mocked(mockGenerateId).mockReturnValue(generatedId)

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(existingProgram))
      vi.mocked(mockProgramRepository.createSession).mockImplementation((_ctx, _pid, session) =>
        okAsync({
          ...session,
          programId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const addSession = makeAddSession({
        programRepository: mockProgramRepository,
        generateId: mockGenerateId,
      })

      const result = await addSession({
        ...ctx,
        programId,
        name: 'New Session',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(generatedId)
      }

      expect(mockGenerateId).toHaveBeenCalledTimes(1)
    })
  })
})
