import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { okAsync } from 'neverthrow'
import { vi } from 'vitest'

export function createAthleteRepositoryMock(overrides: Partial<AthleteRepositoryPort> = {}): AthleteRepositoryPort {
  return {
    findById: vi.fn().mockReturnValue(okAsync(null)),
    findAll: vi.fn().mockReturnValue(okAsync({ items: [], totalCount: 0 })),
    create: vi.fn().mockReturnValue(okAsync(undefined)),
    update: vi.fn().mockReturnValue(okAsync(undefined)),
    archive: vi.fn().mockReturnValue(okAsync(undefined)),
    findByLinkedUserId: vi.fn().mockReturnValue(okAsync(null)),
    count: vi.fn().mockReturnValue(okAsync(0)),
    ...overrides,
  }
}
