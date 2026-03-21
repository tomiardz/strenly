import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAthleteEntity } from '../../../__tests__/factories/athlete-factory'
import { createAthleteRepositoryMock } from '../../../__tests__/factories/athlete-repository-mock'
import { createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeGetAthlete } from '../get-athlete'

describe('[1.2-UNIT] getAthlete use case', () => {
  let mockAthleteRepository: AthleteRepositoryPort

  beforeEach(() => {
    mockAthleteRepository = createAthleteRepositoryMock()
  })

  describe('Happy Path', () => {
    it('[1.2-UNIT-001] @p0 should get athlete successfully with admin role', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const getAthlete = makeGetAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await getAthlete({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.id).toBe(athleteId)
      }

      expect(mockAthleteRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          roles: ['manager'],
        }),
        athleteId,
      )
    })

    it('[1.2-UNIT-002] @p0 should get active athlete', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        status: 'active',
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const getAthlete = makeGetAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await getAthlete({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.status).toBe('active')
      }
    })
  })

  describe('Not Found Errors', () => {
    it('[1.2-UNIT-003] @p1 should return not_found error when athlete does not exist', async () => {
      const ctx = createCoachContext()
      const athleteId = 'non-existent-athlete'

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(null))

      const getAthlete = makeGetAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await getAthlete({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('not_found')
        if (error.type === 'not_found') {
          expect(error.athleteId).toBe(athleteId)
        }
      }
    })
  })

  describe('Repository Errors', () => {
    it('[1.2-UNIT-004] @p1 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const getAthlete = makeGetAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await getAthlete({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Connection timeout')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[1.2-UNIT-005] @p2 should handle getting multiple athletes in sequence', async () => {
      const ctx = createCoachContext()
      const athleteId1 = 'athlete-1'
      const athleteId2 = 'athlete-2'

      const athlete1 = createAthleteEntity({ id: athleteId1, organizationId: ctx.organizationId })
      const athlete2 = createAthleteEntity({ id: athleteId2, organizationId: ctx.organizationId })

      vi.mocked(mockAthleteRepository.findById)
        .mockReturnValueOnce(okAsync(athlete1))
        .mockReturnValueOnce(okAsync(athlete2))

      const getAthlete = makeGetAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result1 = await getAthlete({ ...ctx, athleteId: athleteId1 })
      const result2 = await getAthlete({ ...ctx, athleteId: athleteId2 })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.id).toBe(athleteId1)
        expect(result2.value.id).toBe(athleteId2)
      }
    })
  })
})
