import type { ProgramRepositoryPort, ProgramSession } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoachContext, createManagerContext, createOwnerContext } from '../../../__tests__/helpers/test-context'
import { makeUpdateSession } from '../update-session'

describe('[3.32-UNIT] @p2 updateSession use case', () => {
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
      countByStatus: vi.fn(),
    }
  })

  describe('[3.32-UNIT] @p0 Happy Path', () => {
    it('[3.32-UNIT-001] @p0 should update session name successfully', async () => {
      const ctx = createCoachContext()
      const sessionId = 'session-1'

      // Mock existing session
      const existingSession: ProgramSession = {
        id: sessionId,
        programId: 'program-1',
        name: 'Old Session Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(existingSession))

      // Mock successful update
      const updatedSession: ProgramSession = {
        ...existingSession,
        name: 'New Session Name',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateSession).mockReturnValue(okAsync(updatedSession))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'New Session Name',
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const session = result.value
        expect(session.name).toBe('New Session Name')
        expect(session.orderIndex).toBe(0) // Unchanged
      }

      // Verify repository calls
      expect(mockProgramRepository.findSessionById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        sessionId,
      )
      expect(mockProgramRepository.updateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          id: sessionId,
          name: 'New Session Name',
        }),
      )
    })

    it('[3.32-UNIT-002] @p2 should update with same name (idempotent)', async () => {
      const ctx = createCoachContext()
      const sessionId = 'session-1'

      const existingSession: ProgramSession = {
        id: sessionId,
        programId: 'program-1',
        name: 'Day 1',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(existingSession))

      const updatedSession: ProgramSession = {
        ...existingSession,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateSession).mockReturnValue(okAsync(updatedSession))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'Day 1', // Same name
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const session = result.value
        expect(session.name).toBe('Day 1')
      }
    })

    it('[3.32-UNIT-003] @p2 should update session in multi-session program', async () => {
      const ctx = createCoachContext()
      const sessionId = 'session-3'

      const existingSession: ProgramSession = {
        id: sessionId,
        programId: 'program-1',
        name: 'Day 3',
        orderIndex: 2, // Third session
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(existingSession))

      const updatedSession: ProgramSession = {
        ...existingSession,
        name: 'Upper Body',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateSession).mockReturnValue(okAsync(updatedSession))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'Upper Body',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const session = result.value
        expect(session.name).toBe('Upper Body')
        expect(session.orderIndex).toBe(2) // Preserved
      }
    })
  })

  describe('[3.32-UNIT] @p0 Authorization', () => {
    it('[3.32-UNIT-004] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext() // Manager role lacks coaching/write permission
      const sessionId = 'session-1'

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'New Name',
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
      expect(mockProgramRepository.findSessionById).not.toHaveBeenCalled()
      expect(mockProgramRepository.updateSession).not.toHaveBeenCalled()
    })

    it('[3.32-UNIT-005] @p0 should succeed when user has admin role (has programs:write)', async () => {
      const ctx = createOwnerContext() // Owner role has write permission
      const sessionId = 'session-1'

      const existingSession: ProgramSession = {
        id: sessionId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(existingSession))

      const updatedSession: ProgramSession = {
        ...existingSession,
        name: 'New Name',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateSession).mockReturnValue(okAsync(updatedSession))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'New Name',
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.32-UNIT] @p1 Validation Errors', () => {
    it('[3.32-UNIT-006] @p2 should return not_found when sessionId does not exist', async () => {
      const ctx = createCoachContext()
      const sessionId = 'non-existent-session'

      // Mock repository returning null (not found)
      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(null))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.sessionId).toBe(sessionId)
        }
      }

      // Repository update should NOT be called
      expect(mockProgramRepository.updateSession).not.toHaveBeenCalled()
    })

    it('[3.32-UNIT-007] @p1 should return validation_error when name is too long', async () => {
      const ctx = createCoachContext()
      const sessionId = 'session-1'

      const existingSession: ProgramSession = {
        id: sessionId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(existingSession))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'A'.repeat(51), // Invalid: exceeds 50 character limit
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('must not exceed 50 characters')
        }
      }

      // Repository update should NOT be called for invalid input
      expect(mockProgramRepository.updateSession).not.toHaveBeenCalled()
    })
  })

  describe('[3.32-UNIT] @p1 Repository Errors', () => {
    it('[3.32-UNIT-008] @p1 should return repository error when findSessionById fails', async () => {
      const ctx = createCoachContext()
      const sessionId = 'session-1'

      // Mock repository findSessionById failure
      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'New Name',
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

  describe('[3.32-UNIT] @p2 Edge Cases', () => {
    it('[3.32-UNIT-009] @p2 should update session with special characters in name', async () => {
      const ctx = createCoachContext()
      const sessionId = 'session-1'

      const existingSession: ProgramSession = {
        id: sessionId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(existingSession))

      const updatedSession: ProgramSession = {
        ...existingSession,
        name: 'Day #1 - Push (Chest/Shoulders)',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateSession).mockReturnValue(okAsync(updatedSession))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: 'Day #1 - Push (Chest/Shoulders)',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const session = result.value
        expect(session.name).toBe('Day #1 - Push (Chest/Shoulders)')
      }
    })

    it('[3.32-UNIT-010] @p1 should return validation_error when name is empty', async () => {
      const ctx = createCoachContext()
      const sessionId = 'session-1'

      const existingSession: ProgramSession = {
        id: sessionId,
        programId: 'program-1',
        name: 'Old Name',
        orderIndex: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findSessionById).mockReturnValue(okAsync(existingSession))

      const updateSession = makeUpdateSession({
        programRepository: mockProgramRepository,
      })

      const result = await updateSession({
        ...ctx,
        sessionId,
        name: '', // Empty - should fail
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('Session name is required')
        }
      }

      // Repository update should NOT be called for invalid input
      expect(mockProgramRepository.updateSession).not.toHaveBeenCalled()
    })
  })
})
