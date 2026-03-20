import type { ProgramExerciseRow, ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerContext, createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeReorderExerciseRows } from '../reorder-exercise-rows'

describe('[3.26-UNIT] @p2 reorderExerciseRows use case', () => {
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

  describe('[3.26-UNIT] @p0 Happy Path', () => {
    it('[3.26-UNIT-001] @p2 should reorder rows within single group', async () => {
      const ctx = createManagerContext()
      const sessionId = 'session-1'
      const groupId = 'group-1'

      // Mock existing rows (all in same group)
      const existingRows: ProgramExerciseRow[] = [
        {
          id: 'row-1',
          sessionId,
          exerciseId: 'ex-1',
          orderIndex: 0,
          groupId,
          orderWithinGroup: 0,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-2',
          sessionId,
          exerciseId: 'ex-2',
          orderIndex: 1,
          groupId,
          orderWithinGroup: 1,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-3',
          sessionId,
          exerciseId: 'ex-3',
          orderIndex: 2,
          groupId,
          orderWithinGroup: 2,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(okAsync(existingRows))
      vi.mocked(mockProgramRepository.reorderExerciseRows).mockReturnValue(okAsync(undefined))

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      // Reorder: swap row-1 and row-3
      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-3', 'row-2', 'row-1'],
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      // Verify repository calls
      expect(mockProgramRepository.findExerciseRowsBySessionId).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        sessionId,
      )
      expect(mockProgramRepository.reorderExerciseRows).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        sessionId,
        ['row-3', 'row-2', 'row-1'],
      )
    })

    it('[3.26-UNIT-002] @p2 should reorder multiple groups preserving adjacency', async () => {
      const ctx = createManagerContext()
      const sessionId = 'session-1'

      // Mock existing rows with 2 groups and 1 standalone
      const existingRows: ProgramExerciseRow[] = [
        {
          id: 'row-1',
          sessionId,
          exerciseId: 'ex-1',
          orderIndex: 0,
          groupId: 'group-1',
          orderWithinGroup: 0,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-2',
          sessionId,
          exerciseId: 'ex-2',
          orderIndex: 1,
          groupId: 'group-1',
          orderWithinGroup: 1,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-3',
          sessionId,
          exerciseId: 'ex-3',
          orderIndex: 2,
          groupId: null, // Standalone
          orderWithinGroup: null,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-4',
          sessionId,
          exerciseId: 'ex-4',
          orderIndex: 3,
          groupId: 'group-2',
          orderWithinGroup: 0,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-5',
          sessionId,
          exerciseId: 'ex-5',
          orderIndex: 4,
          groupId: 'group-2',
          orderWithinGroup: 1,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(okAsync(existingRows))
      vi.mocked(mockProgramRepository.reorderExerciseRows).mockReturnValue(okAsync(undefined))

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      // Try to reorder: group-2 first, then standalone, then group-1
      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-4', 'row-5', 'row-3', 'row-1', 'row-2'],
      })

      expect(result.isOk()).toBe(true)

      // Verify adjacency is preserved
      expect(mockProgramRepository.reorderExerciseRows).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        sessionId,
        ['row-4', 'row-5', 'row-3', 'row-1', 'row-2'],
      )
    })

    it('[3.26-UNIT-003] @p2 should handle no-op reorder (same order)', async () => {
      const ctx = createManagerContext()
      const sessionId = 'session-1'

      const existingRows: ProgramExerciseRow[] = [
        {
          id: 'row-1',
          sessionId,
          exerciseId: 'ex-1',
          orderIndex: 0,
          groupId: null,
          orderWithinGroup: null,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-2',
          sessionId,
          exerciseId: 'ex-2',
          orderIndex: 1,
          groupId: null,
          orderWithinGroup: null,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(okAsync(existingRows))
      vi.mocked(mockProgramRepository.reorderExerciseRows).mockReturnValue(okAsync(undefined))

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      // Same order
      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-1', 'row-2'],
      })

      expect(result.isOk()).toBe(true)

      expect(mockProgramRepository.reorderExerciseRows).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        sessionId,
        ['row-1', 'row-2'],
      )
    })
  })

  describe('[3.26-UNIT] @p0 Authorization', () => {
    it('[3.26-UNIT-004] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createCoachContext() // Member role lacks write permission
      const sessionId = 'session-1'

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-1', 'row-2'],
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
      expect(mockProgramRepository.findExerciseRowsBySessionId).not.toHaveBeenCalled()
      expect(mockProgramRepository.reorderExerciseRows).not.toHaveBeenCalled()
    })

    it('[3.26-UNIT-005] @p0 should succeed when user has admin role (has programs:write)', async () => {
      const ctx = createManagerContext() // Admin role has write permission
      const sessionId = 'session-1'

      const existingRows: ProgramExerciseRow[] = [
        {
          id: 'row-1',
          sessionId,
          exerciseId: 'ex-1',
          orderIndex: 0,
          groupId: null,
          orderWithinGroup: null,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(okAsync(existingRows))
      vi.mocked(mockProgramRepository.reorderExerciseRows).mockReturnValue(okAsync(undefined))

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-1'],
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.26-UNIT] @p1 Validation Errors', () => {
    it('[3.26-UNIT-006] @p2 should return not_found when session does not exist', async () => {
      const ctx = createManagerContext()
      const sessionId = 'non-existent-session'

      // Mock repository returning NOT_FOUND error
      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(
        errAsync({
          type: 'NOT_FOUND',
          entityType: 'session',
          id: sessionId,
        }),
      )

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-1'],
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.entityType).toBe('session')
          expect(error.id).toBe(sessionId)
        }
      }

      // Repository reorder should NOT be called
      expect(mockProgramRepository.reorderExerciseRows).not.toHaveBeenCalled()
    })

    it('[3.26-UNIT-007] @p2 should auto-fix adjacency when group members are interleaved', async () => {
      const ctx = createManagerContext()
      const sessionId = 'session-1'

      // Mock rows with interleaved groups
      const existingRows: ProgramExerciseRow[] = [
        {
          id: 'row-1',
          sessionId,
          exerciseId: 'ex-1',
          orderIndex: 0,
          groupId: 'group-1',
          orderWithinGroup: 0,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-2',
          sessionId,
          exerciseId: 'ex-2',
          orderIndex: 1,
          groupId: 'group-2',
          orderWithinGroup: 0,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-3',
          sessionId,
          exerciseId: 'ex-3',
          orderIndex: 2,
          groupId: 'group-1',
          orderWithinGroup: 1,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'row-4',
          sessionId,
          exerciseId: 'ex-4',
          orderIndex: 3,
          groupId: 'group-2',
          orderWithinGroup: 1,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(okAsync(existingRows))
      vi.mocked(mockProgramRepository.reorderExerciseRows).mockReturnValue(okAsync(undefined))

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      // Try to interleave groups: row-1 (group-1), row-2 (group-2), row-3 (group-1), row-4 (group-2)
      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-1', 'row-2', 'row-3', 'row-4'],
      })

      expect(result.isOk()).toBe(true)

      // Verify adjacency was enforced: group members consolidated
      expect(mockProgramRepository.reorderExerciseRows).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        sessionId,
        ['row-1', 'row-3', 'row-2', 'row-4'], // Group 1 members together, then Group 2 members together
      )
    })
  })

  describe('[3.26-UNIT] @p1 Repository Errors', () => {
    it('[3.26-UNIT-008] @p1 should return repository error when database fails', async () => {
      const ctx = createManagerContext()
      const sessionId = 'session-1'

      // Mock repository failure
      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-1'],
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

  describe('[3.26-UNIT] @p2 Edge Cases', () => {
    it('[3.26-UNIT-009] @p3 should handle empty session (no rows)', async () => {
      const ctx = createManagerContext()
      const sessionId = 'session-1'

      // Mock empty session
      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(okAsync([]))
      vi.mocked(mockProgramRepository.reorderExerciseRows).mockReturnValue(okAsync(undefined))

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: [],
      })

      expect(result.isOk()).toBe(true)

      expect(mockProgramRepository.reorderExerciseRows).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        sessionId,
        [],
      )
    })

    it('[3.26-UNIT-010] @p2 should handle single row (no-op)', async () => {
      const ctx = createManagerContext()
      const sessionId = 'session-1'

      const existingRows: ProgramExerciseRow[] = [
        {
          id: 'row-1',
          sessionId,
          exerciseId: 'ex-1',
          orderIndex: 0,
          groupId: null,
          orderWithinGroup: null,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(mockProgramRepository.findExerciseRowsBySessionId).mockReturnValue(okAsync(existingRows))
      vi.mocked(mockProgramRepository.reorderExerciseRows).mockReturnValue(okAsync(undefined))

      const reorderExerciseRows = makeReorderExerciseRows({
        programRepository: mockProgramRepository,
      })

      const result = await reorderExerciseRows({
        ...ctx,
        sessionId,
        rowIds: ['row-1'],
      })

      expect(result.isOk()).toBe(true)
    })
  })
})
