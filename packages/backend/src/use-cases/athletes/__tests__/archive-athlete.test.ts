import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoachContext, createNoPermissionContext } from '../../../__tests__/helpers/test-context'
import { makeArchiveAthlete } from '../archive-athlete'

describe('[1.1-UNIT] archiveAthlete use case', () => {
  let mockAthleteRepository: AthleteRepositoryPort

  beforeEach(() => {
    mockAthleteRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByLinkedUserId: vi.fn(),
      count: vi.fn(),
    }
  })

  describe('Happy Path', () => {
    it('[1.1-UNIT-001] @p0 should archive athlete successfully', async () => {
      const ctx = createCoachContext()

      // Mock successful archive
      vi.mocked(mockAthleteRepository.archive).mockReturnValue(okAsync(undefined))

      const archiveAthlete = makeArchiveAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await archiveAthlete({
        ...ctx,
        athleteId: 'athlete-123',
      })

      expect(result.isOk()).toBe(true)

      // Verify repository called with correct context and ID
      expect(mockAthleteRepository.archive).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
        }),
        'athlete-123',
      )
    })
  })

  describe('Authorization', () => {
    it('[1.1-UNIT-002] @p0 should return forbidden error when user lacks athletes:write permission', async () => {
      const ctx = createNoPermissionContext()

      const archiveAthlete = makeArchiveAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await archiveAthlete({
        ...ctx,
        athleteId: 'athlete-123',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('forbidden')
        if (result.error.type === 'forbidden') {
          expect(result.error.message).toContain('No permission')
        }
      }

      // Repository should NOT be called
      expect(mockAthleteRepository.archive).not.toHaveBeenCalled()
    })
  })

  describe('Not Found Errors', () => {
    it('[1.1-UNIT-003] @p1 should return not_found when athlete does not exist', async () => {
      const ctx = createCoachContext()

      // Mock athlete not found
      vi.mocked(mockAthleteRepository.archive).mockReturnValue(
        errAsync({
          type: 'NOT_FOUND',
          athleteId: 'nonexistent-id',
        }),
      )

      const archiveAthlete = makeArchiveAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await archiveAthlete({
        ...ctx,
        athleteId: 'nonexistent-id',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('not_found')
        if (result.error.type === 'not_found') {
          expect(result.error.athleteId).toBe('nonexistent-id')
        }
      }
    })
  })

  describe('Repository Errors', () => {
    it('[1.1-UNIT-004] @p1 should return repository error when database fails', async () => {
      const ctx = createCoachContext()

      // Mock database failure
      vi.mocked(mockAthleteRepository.archive).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const archiveAthlete = makeArchiveAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await archiveAthlete({
        ...ctx,
        athleteId: 'athlete-123',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
        if (result.error.type === 'repository_error') {
          expect(result.error.message).toContain('Connection timeout')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[1.1-UNIT-005] @p2 should handle archiving multiple athletes in sequence', async () => {
      const ctx = createCoachContext()

      vi.mocked(mockAthleteRepository.archive).mockReturnValue(okAsync(undefined))

      const archiveAthlete = makeArchiveAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const ids = ['athlete-1', 'athlete-2', 'athlete-3']

      // Archive all in sequence
      for (const id of ids) {
        const result = await archiveAthlete({
          ...ctx,
          athleteId: id,
        })
        expect(result.isOk()).toBe(true)
      }

      // All should have been called
      expect(mockAthleteRepository.archive).toHaveBeenCalledTimes(3)
    })

    it('[1.1-UNIT-006] @p2 should be idempotent - archiving already archived athlete should succeed', async () => {
      const ctx = createCoachContext()

      // Mock successful archive (repository handles idempotence)
      vi.mocked(mockAthleteRepository.archive).mockReturnValue(okAsync(undefined))

      const archiveAthlete = makeArchiveAthlete({
        athleteRepository: mockAthleteRepository,
      })

      // Archive same athlete twice
      const result1 = await archiveAthlete({
        ...ctx,
        athleteId: 'athlete-123',
      })

      const result2 = await archiveAthlete({
        ...ctx,
        athleteId: 'athlete-123',
      })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)
    })
  })
})
