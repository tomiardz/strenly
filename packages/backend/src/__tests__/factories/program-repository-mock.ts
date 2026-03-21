import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { okAsync } from 'neverthrow'
import { vi } from 'vitest'

export function createProgramRepositoryMock(overrides: Partial<ProgramRepositoryPort> = {}): ProgramRepositoryPort {
  return {
    loadProgramAggregate: vi.fn().mockReturnValue(okAsync(null)),
    saveProgramAggregate: vi.fn().mockReturnValue(okAsync({ updatedAt: new Date() })),
    findById: vi.fn().mockReturnValue(okAsync(null)),
    update: vi.fn().mockReturnValue(okAsync(null)),
    list: vi.fn().mockReturnValue(okAsync({ items: [], totalCount: 0 })),
    findWithDetails: vi.fn().mockReturnValue(okAsync(null)),
    createWeek: vi.fn().mockReturnValue(okAsync(undefined)),
    findWeekById: vi.fn().mockReturnValue(okAsync(null)),
    updateWeek: vi.fn().mockReturnValue(okAsync(undefined)),
    deleteWeek: vi.fn().mockReturnValue(okAsync(undefined)),
    findSessionById: vi.fn().mockReturnValue(okAsync(null)),
    createSession: vi.fn().mockReturnValue(okAsync(undefined)),
    updateSession: vi.fn().mockReturnValue(okAsync(undefined)),
    deleteSession: vi.fn().mockReturnValue(okAsync(undefined)),
    createGroup: vi.fn().mockReturnValue(okAsync(undefined)),
    updateGroup: vi.fn().mockReturnValue(okAsync(undefined)),
    deleteGroup: vi.fn().mockReturnValue(okAsync(undefined)),
    getMaxGroupOrderIndex: vi.fn().mockReturnValue(okAsync(-1)),
    findExerciseRowById: vi.fn().mockReturnValue(okAsync(null)),
    getMaxExerciseRowOrderIndex: vi.fn().mockReturnValue(okAsync(-1)),
    createExerciseRow: vi.fn().mockReturnValue(okAsync(undefined)),
    updateExerciseRow: vi.fn().mockReturnValue(okAsync(undefined)),
    deleteExerciseRow: vi.fn().mockReturnValue(okAsync(undefined)),
    upsertPrescription: vi.fn().mockReturnValue(okAsync(undefined)),
    updatePrescriptionSeries: vi.fn().mockReturnValue(okAsync(undefined)),
    saveDraft: vi.fn().mockReturnValue(okAsync({ updatedAt: new Date() })),
    reorderExerciseRows: vi.fn().mockReturnValue(okAsync(undefined)),
    duplicateWeek: vi.fn().mockReturnValue(okAsync(undefined)),
    repositionRowToEndOfSession: vi.fn().mockReturnValue(okAsync(undefined)),
    findExerciseRowsBySessionId: vi.fn().mockReturnValue(okAsync([])),
    countByStatus: vi.fn().mockReturnValue(okAsync({ draft: 0, active: 0, archived: 0 })),
    ...overrides,
  }
}
