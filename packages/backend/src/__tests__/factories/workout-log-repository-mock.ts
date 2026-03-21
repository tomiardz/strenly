import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { okAsync } from 'neverthrow'
import { vi } from 'vitest'

export function createWorkoutLogRepositoryMock(
  overrides: Partial<WorkoutLogRepositoryPort> = {},
): WorkoutLogRepositoryPort {
  return {
    findById: vi.fn().mockReturnValue(okAsync(null)),
    findByAthleteSessionWeek: vi.fn().mockReturnValue(okAsync(null)),
    save: vi.fn().mockReturnValue(okAsync(undefined)),
    delete: vi.fn().mockReturnValue(okAsync(undefined)),
    listByAthlete: vi.fn().mockReturnValue(okAsync({ items: [], totalCount: 0 })),
    listPendingWorkouts: vi.fn().mockReturnValue(okAsync({ items: [], totalCount: 0 })),
    countCompletedSince: vi.fn().mockReturnValue(okAsync(0)),
    listRecent: vi.fn().mockReturnValue(okAsync([])),
    ...overrides,
  }
}
