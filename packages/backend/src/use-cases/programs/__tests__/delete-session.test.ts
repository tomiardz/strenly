import type { Session } from '@strenly/core/domain/entities/program/types'
import type { ProgramRepositoryPort, ProgramWithDetails } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramWithStructure } from '../../../__tests__/factories/program-structure-factory'
import { createManagerContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeDeleteSession } from '../delete-session'

// Helper to create program with custom sessions for ProgramWithDetails structure
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

  // Convert to ProgramWithDetails structure (flat sessions + weeks)
  return {
    ...program,
    weeks: program.weeks.map((w) => ({
      id: w.id,
      programId: program.id,
      name: w.name,
      orderIndex: w.orderIndex,
      createdAt: new Date(),
    })),
    sessions: sessions.map((s) => ({
      ...s,
      exerciseGroups: [],
      rows: [],
    })) as unknown as ProgramWithDetails['sessions'],
  } as ProgramWithDetails
}

describe('[3.22-UNIT] @p2 deleteSession use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  const programId = 'program-123'
  const sessionId = 'session-456'
  const orgId = 'org-789'

  beforeEach(() => {
    mockProgramRepository = {
      findById: vi.fn(),
      findWithDetails: vi.fn(),
      update: vi.fn(),
      saveProgramAggregate: vi.fn(),
      deleteSession: vi.fn(),
    } as unknown as ProgramRepositoryPort
  })

  describe('[3.22-UNIT] @p0 Happy Path', () => {
    it('[3.22-UNIT-001] @p0 should delete session successfully', async () => {
      const programWithSessions = createProgramWithSessions([
        { id: 'session-1', name: 'Day 1', orderIndex: 0 },
        { id: sessionId, name: 'Day 2', orderIndex: 1 },
        { id: 'session-3', name: 'Day 3', orderIndex: 2 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithSessions))
      vi.mocked(mockProgramRepository.deleteSession).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
      })

      expect(result.isOk()).toBe(true)

      expect(mockProgramRepository.deleteSession).toHaveBeenCalledWith(ctx, sessionId)
    })

    it('[3.22-UNIT-002] @p2 should delete last session when more than one session exists', async () => {
      const programWithSessions = createProgramWithSessions([
        { id: 'session-1', name: 'Day 1', orderIndex: 0 },
        { id: sessionId, name: 'Day 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithSessions))
      vi.mocked(mockProgramRepository.deleteSession).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.22-UNIT] @p0 Authorization', () => {
    it('[3.22-UNIT-003] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext() // Manager lacks coaching/write permission
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
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

  describe('[3.22-UNIT] @p1 Not Found Errors', () => {
    it('[3.22-UNIT-004] @p2 should return program_not_found when program does not exist', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId: 'non-existent-program',
        sessionId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('program_not_found')
        if (result.error.type === 'program_not_found') {
          expect(result.error.programId).toBe('non-existent-program')
        }
      }

      // Delete should not be called
      expect(mockProgramRepository.deleteSession).not.toHaveBeenCalled()
    })

    it('[3.22-UNIT-005] @p2 should return not_found when session does not exist in program', async () => {
      const programWithSessions = createProgramWithSessions([
        { id: 'session-1', name: 'Day 1', orderIndex: 0 },
        { id: 'session-2', name: 'Day 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithSessions))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId: 'non-existent-session',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('not_found')
        if (result.error.type === 'not_found') {
          expect(result.error.sessionId).toBe('non-existent-session')
        }
      }

      // Delete should not be called
      expect(mockProgramRepository.deleteSession).not.toHaveBeenCalled()
    })
  })

  describe('[3.22-UNIT] @p1 Validation Errors', () => {
    it('[3.22-UNIT-006] @p1 should return last_session error when trying to delete the only session', async () => {
      const programWithOneSession = createProgramWithSessions([{ id: sessionId, name: 'Only Session', orderIndex: 0 }])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithOneSession))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('last_session')
        if (result.error.type === 'last_session') {
          expect(result.error.message).toContain('Cannot delete the last session')
        }
      }

      // Delete should not be called
      expect(mockProgramRepository.deleteSession).not.toHaveBeenCalled()
    })
  })

  describe('[3.22-UNIT] @p1 Repository Errors', () => {
    it('[3.22-UNIT-007] @p1 should return repository error when findWithDetails fails', async () => {
      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[3.22-UNIT-008] @p1 should return repository error when deleteSession fails', async () => {
      const programWithSessions = createProgramWithSessions([
        { id: 'session-1', name: 'Day 1', orderIndex: 0 },
        { id: sessionId, name: 'Day 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithSessions))
      vi.mocked(mockProgramRepository.deleteSession).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Delete failed',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('[3.22-UNIT] @p2 Edge Cases', () => {
    it('[3.22-UNIT-009] @p2 should allow deletion when exactly 2 sessions exist', async () => {
      const programWithTwoSessions = createProgramWithSessions([
        { id: 'session-1', name: 'Day 1', orderIndex: 0 },
        { id: sessionId, name: 'Day 2', orderIndex: 1 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithTwoSessions))
      vi.mocked(mockProgramRepository.deleteSession).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
      })

      expect(result.isOk()).toBe(true)

      expect(mockProgramRepository.deleteSession).toHaveBeenCalledWith(ctx, sessionId)
    })

    it('[3.22-UNIT-010] @p2 should handle deletion from middle of session list', async () => {
      const programWithSessions = createProgramWithSessions([
        { id: 'session-1', name: 'Day 1', orderIndex: 0 },
        { id: sessionId, name: 'Day 2', orderIndex: 1 },
        { id: 'session-3', name: 'Day 3', orderIndex: 2 },
        { id: 'session-4', name: 'Day 4', orderIndex: 3 },
      ])

      vi.mocked(mockProgramRepository.findWithDetails).mockReturnValue(okAsync(programWithSessions))
      vi.mocked(mockProgramRepository.deleteSession).mockReturnValue(okAsync(undefined))

      const ctx = createTestContext({ organizationId: orgId })
      const deleteSession = makeDeleteSession({ programRepository: mockProgramRepository })

      const result = await deleteSession({
        ...ctx,
        programId,
        sessionId,
      })

      expect(result.isOk()).toBe(true)
    })
  })
})
