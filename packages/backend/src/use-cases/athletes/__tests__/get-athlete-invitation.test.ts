import type { AthleteInvitationRepositoryPort } from '@strenly/core/ports/athlete-invitation-repository.port'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAthleteEntity } from '../../../__tests__/factories/athlete-factory'
import { createAthleteInvitationRepositoryMock } from '../../../__tests__/factories/athlete-invitation-repository-mock'
import { createAthleteRepositoryMock } from '../../../__tests__/factories/athlete-repository-mock'
import {
  createAcceptedInvitation,
  createExpiredInvitation,
  createInvitationData,
  createRevokedInvitation,
} from '../../../__tests__/factories/invitation-factory'
import { createManagerContext } from '../../../__tests__/helpers/test-context'
import { makeGetAthleteInvitation } from '../get-athlete-invitation'

describe('[1.8-UNIT] getAthleteInvitation use case', () => {
  let mockAthleteRepository: AthleteRepositoryPort
  let mockInvitationRepository: AthleteInvitationRepositoryPort

  beforeEach(() => {
    mockAthleteRepository = createAthleteRepositoryMock()
    mockInvitationRepository = createAthleteInvitationRepositoryMock()
  })

  describe('Happy Path', () => {
    it('[1.8-UNIT-001] @p0 should get pending invitation successfully', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'
      const appUrl = 'https://app.example.com'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
      })

      const invitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl,
      })

      const result = await getAthleteInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.athleteId).toBe(athleteId)
        expect(result.value.status).toBe('pending')
        expect(result.value.invitationUrl).toContain(invitation.token)
      }

      expect(mockAthleteRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        athleteId,
      )
    })

    it('[1.8-UNIT-002] @p0 should get accepted invitation', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
      })

      const invitation = createAcceptedInvitation({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result = await getAthleteInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.status).toBe('accepted')
        expect(result.value.acceptedAt).not.toBeNull()
      }
    })

    it('[1.8-UNIT-003] @p1 should get expired invitation', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
      })

      const invitation = createExpiredInvitation({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result = await getAthleteInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.status).toBe('expired')
      }
    })

    it('[1.8-UNIT-004] @p1 should get revoked invitation', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
      })

      const invitation = createRevokedInvitation({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result = await getAthleteInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.status).toBe('revoked')
      }
    })
  })

  describe('Not Found Errors', () => {
    it('[1.8-UNIT-005] @p1 should return athlete_not_found error when athlete does not exist', async () => {
      const ctx = createManagerContext()
      const athleteId = 'non-existent-athlete'

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(null))

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result = await getAthleteInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('athlete_not_found')
        if (error.type === 'athlete_not_found') {
          expect(error.athleteId).toBe(athleteId)
        }
      }

      expect(mockInvitationRepository.findByAthleteId).not.toHaveBeenCalled()
    })

    it('[1.8-UNIT-006] @p1 should return no_invitation error when invitation does not exist', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result = await getAthleteInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('no_invitation')
        if (error.type === 'no_invitation') {
          expect(error.athleteId).toBe(athleteId)
        }
      }
    })
  })

  describe('Repository Errors', () => {
    it('[1.8-UNIT-007] @p1 should return repository error when athlete findById fails', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result = await getAthleteInvitation({
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

    it('[1.8-UNIT-008] @p1 should return repository error when invitation findByAthleteId fails', async () => {
      const ctx = createManagerContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query failed',
        }),
      )

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result = await getAthleteInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Query failed')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[1.8-UNIT-009] @p2 should handle getting invitations for multiple athletes', async () => {
      const ctx = createManagerContext()
      const athleteId1 = 'athlete-1'
      const athleteId2 = 'athlete-2'

      const athlete1 = createAthleteEntity({ id: athleteId1, organizationId: ctx.organizationId })
      const athlete2 = createAthleteEntity({ id: athleteId2, organizationId: ctx.organizationId })

      const invitation1 = createInvitationData({ athleteId: athleteId1, organizationId: ctx.organizationId })
      const invitation2 = createInvitationData({ athleteId: athleteId2, organizationId: ctx.organizationId })

      vi.mocked(mockAthleteRepository.findById)
        .mockReturnValueOnce(okAsync(athlete1))
        .mockReturnValueOnce(okAsync(athlete2))

      vi.mocked(mockInvitationRepository.findByAthleteId)
        .mockReturnValueOnce(okAsync(invitation1))
        .mockReturnValueOnce(okAsync(invitation2))

      const getAthleteInvitation = makeGetAthleteInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        appUrl: 'https://app.example.com',
      })

      const result1 = await getAthleteInvitation({ ...ctx, athleteId: athleteId1 })
      const result2 = await getAthleteInvitation({ ...ctx, athleteId: athleteId2 })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.athleteId).toBe(athleteId1)
        expect(result2.value.athleteId).toBe(athleteId2)
      }
    })
  })
})
