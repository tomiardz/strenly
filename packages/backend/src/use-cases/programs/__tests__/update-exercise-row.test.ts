import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import type { ProgramExerciseRow, ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExerciseEntity } from '../../../__tests__/factories/exercise-factory'
import { createCoachContext, createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeUpdateExerciseRow } from '../update-exercise-row'

describe('[3.29-UNIT] @p2 updateExerciseRow use case', () => {
  let mockProgramRepository: ProgramRepositoryPort
  let mockExerciseRepository: ExerciseRepositoryPort

  beforeEach(() => {
    // Mock ALL program repository methods
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

    // Mock ALL exercise repository methods
    mockExerciseRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
    }
  })

  describe('[3.29-UNIT] @p0 Happy Path', () => {
    it('[3.29-UNIT-001] @p2 should update single field (exerciseId)', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'
      const newExerciseId = 'exercise-2'

      // Mock existing row
      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      // Mock successful update
      const updatedRow: ProgramExerciseRow = {
        ...existingRow,
        exerciseId: newExerciseId,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      // Mock exercise lookup
      const exercise = createExerciseEntity({ id: newExerciseId, name: 'Bench Press' })
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        exerciseId: newExerciseId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { row, exerciseName } = result.value
        expect(row.exerciseId).toBe(newExerciseId)
        expect(exerciseName).toBe('Bench Press')
      }

      // Verify repository calls
      expect(mockProgramRepository.findExerciseRowById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        rowId,
      )
      expect(mockProgramRepository.updateExerciseRow).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          id: rowId,
          exerciseId: newExerciseId,
        }),
      )
    })

    it('[3.29-UNIT-002] @p2 should update multiple fields', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updatedRow: ProgramExerciseRow = {
        ...existingRow,
        setTypeLabel: 'Warmup',
        notes: 'Focus on form',
        restSeconds: 90,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      const exercise = createExerciseEntity({ id: 'exercise-1', name: 'Squat' })
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        setTypeLabel: 'Warmup',
        notes: 'Focus on form',
        restSeconds: 90,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { row } = result.value
        expect(row.setTypeLabel).toBe('Warmup')
        expect(row.notes).toBe('Focus on form')
        expect(row.restSeconds).toBe(90)
        expect(row.exerciseId).toBe('exercise-1') // Unchanged
      }
    })

    it('[3.29-UNIT-003] @p2 should update with null values (clearing fields)', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: 'group-1',
        orderWithinGroup: 0,
        setTypeLabel: 'Warmup',
        notes: 'Old notes',
        restSeconds: 90,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updatedRow: ProgramExerciseRow = {
        ...existingRow,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      const exercise = createExerciseEntity({ id: 'exercise-1', name: 'Squat' })
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { row } = result.value
        expect(row.groupId).toBeNull()
        expect(row.orderWithinGroup).toBeNull()
        expect(row.setTypeLabel).toBeNull()
        expect(row.notes).toBeNull()
      }
    })

    it('[3.29-UNIT-004] @p2 should return exerciseName when exerciseId provided', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updatedRow: ProgramExerciseRow = { ...existingRow, updatedAt: new Date('2024-01-02') }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      const exercise = createExerciseEntity({ id: 'exercise-1', name: 'Deadlift' })
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        notes: 'Updated notes',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { row, exerciseName } = result.value
        expect(row.id).toBe(rowId)
        expect(exerciseName).toBe('Deadlift')
      }
    })
  })

  describe('[3.29-UNIT] @p0 Authorization', () => {
    it('[3.29-UNIT-005] @p0 should return forbidden error when user lacks programs:write permission', async () => {
      const ctx = createManagerContext() // Member role lacks write permission
      const rowId = 'row-1'

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        notes: 'New notes',
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
      expect(mockProgramRepository.findExerciseRowById).not.toHaveBeenCalled()
      expect(mockProgramRepository.updateExerciseRow).not.toHaveBeenCalled()
    })

    it('[3.29-UNIT-006] @p0 should succeed when user has admin role (has programs:write)', async () => {
      const ctx = createCoachContext() // Admin role has write permission
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updatedRow: ProgramExerciseRow = {
        ...existingRow,
        notes: 'New notes',
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      const exercise = createExerciseEntity({ id: 'exercise-1', name: 'Squat' })
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        notes: 'New notes',
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('[3.29-UNIT] @p1 Validation Errors', () => {
    it('[3.29-UNIT-007] @p2 should return not_found when rowId does not exist', async () => {
      const ctx = createCoachContext()
      const rowId = 'non-existent-row'

      // Mock repository returning null (not found)
      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(null))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        notes: 'New notes',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.rowId).toBe(rowId)
        }
      }

      // Repository update should NOT be called
      expect(mockProgramRepository.updateExerciseRow).not.toHaveBeenCalled()
    })

    it('[3.29-UNIT-008] @p1 should return validation_error for invalid exerciseId', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        exerciseId: '', // Invalid: empty exercise ID
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('Exercise ID is required')
        }
      }

      // Repository update should NOT be called for invalid input
      expect(mockProgramRepository.updateExerciseRow).not.toHaveBeenCalled()
    })
  })

  describe('[3.29-UNIT] @p1 Repository Errors', () => {
    it('[3.29-UNIT-009] @p1 should return repository error when findExerciseRowById fails', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      // Mock repository failure
      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        notes: 'New notes',
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

    it('[3.29-UNIT-010] @p1 should return repository error when exercise lookup fails', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updatedRow: ProgramExerciseRow = { ...existingRow, updatedAt: new Date('2024-01-02') }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      // Mock exercise lookup failure
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Exercise lookup failed',
        }),
      )

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        notes: 'New notes',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Exercise lookup failed')
        }
      }
    })
  })

  describe('[3.29-UNIT] @p2 Edge Cases', () => {
    it('[3.29-UNIT-011] @p2 should update orderWithinGroup (position change)', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: 'group-1',
        orderWithinGroup: 0,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updatedRow: ProgramExerciseRow = {
        ...existingRow,
        orderWithinGroup: 2, // Moved to third position in group
        updatedAt: new Date('2024-01-02'),
      }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      const exercise = createExerciseEntity({ id: 'exercise-1', name: 'Squat' })
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(exercise))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        orderWithinGroup: 2,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { row } = result.value
        expect(row.orderWithinGroup).toBe(2)
        expect(row.groupId).toBe('group-1') // Group unchanged
      }
    })

    it('[3.29-UNIT-012] @p1 should return Unknown when exercise not found during lookup', async () => {
      const ctx = createCoachContext()
      const rowId = 'row-1'

      const existingRow: ProgramExerciseRow = {
        id: rowId,
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        orderIndex: 0,
        groupId: null,
        orderWithinGroup: null,
        setTypeLabel: null,
        notes: null,
        restSeconds: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      vi.mocked(mockProgramRepository.findExerciseRowById).mockReturnValue(okAsync(existingRow))

      const updatedRow: ProgramExerciseRow = { ...existingRow, updatedAt: new Date('2024-01-02') }
      vi.mocked(mockProgramRepository.updateExerciseRow).mockReturnValue(okAsync(updatedRow))

      // Mock exercise not found (returns null)
      vi.mocked(mockExerciseRepository.findById).mockReturnValue(okAsync(null))

      const updateExerciseRow = makeUpdateExerciseRow({
        programRepository: mockProgramRepository,
        exerciseRepository: mockExerciseRepository,
      })

      const result = await updateExerciseRow({
        ...ctx,
        rowId,
        notes: 'New notes',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { row, exerciseName } = result.value
        expect(row.id).toBe(rowId)
        expect(exerciseName).toBe('Unknown') // Fallback when exercise not found
      }
    })
  })
})
