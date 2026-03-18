import type { AthleteInvitationRepositoryPort } from '@strenly/core/ports/athlete-invitation-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInvitationData } from '../../../__tests__/factories/invitation-factory'
import { createAdminContext, createNoPermissionContext } from '../../../__tests__/helpers/test-context'
import { makeRevokeInvitation } from '../revoke-invitation'

describe('[1.5-UNIT] revokeInvitation use case', () => {
  let mockInvitationRepository: AthleteInvitationRepositoryPort

  beforeEach(() => {
    // Mock all repository methods
    mockInvitationRepository = {
      findByToken: vi.fn(),
      findByAthleteId: vi.fn(),
      create: vi.fn(),
      markAccepted: vi.fn(),
      revoke: vi.fn(),
    }
  })

  describe('Happy Path', () => {
    it('[1.5-UNIT-001] @p0 should revoke invitation successfully with admin role', async () => {
      const ctx = createAdminContext()
      const athleteId = 'athlete-1'

      const invitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(okAsync(undefined))

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      // Verify repository calls
      expect(mockInvitationRepository.findByAthleteId).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          memberRole: 'admin',
        }),
        athleteId,
      )

      expect(mockInvitationRepository.revoke).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        invitation.id,
      )
    })

    it('[1.5-UNIT-002] @p0 should revoke pending invitation', async () => {
      const ctx = createAdminContext()
      const athleteId = 'athlete-1'

      const invitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
        acceptedAt: null,
        revokedAt: null,
      })

      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(okAsync(undefined))

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Authorization', () => {
    it('[1.5-UNIT-003] @p0 should return forbidden error when user lacks athletes:write permission', async () => {
      const ctx = createNoPermissionContext() // Unmapped role lacks write permission
      const athleteId = 'athlete-1'

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
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
      expect(mockInvitationRepository.findByAthleteId).not.toHaveBeenCalled()
      expect(mockInvitationRepository.revoke).not.toHaveBeenCalled()
    })

    it('[1.5-UNIT-004] @p0 should succeed when user has admin role (has athletes:write)', async () => {
      const ctx = createAdminContext() // Admin has write permission
      const athleteId = 'athlete-1'

      const invitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(okAsync(undefined))

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Not Found Errors', () => {
    it('[1.5-UNIT-005] @p1 should return invitation_not_found error when no invitation exists for athlete', async () => {
      const ctx = createAdminContext()
      const athleteId = 'athlete-without-invitation'

      // Mock repository returning null (no invitation found)
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('invitation_not_found')
        if (error.type === 'invitation_not_found') {
          expect(error.athleteId).toBe(athleteId)
        }
      }

      // Revoke should NOT be called
      expect(mockInvitationRepository.revoke).not.toHaveBeenCalled()
    })
  })

  describe('Repository Errors', () => {
    it('[1.5-UNIT-006] @p1 should return repository error when findByAthleteId fails', async () => {
      const ctx = createAdminContext()
      const athleteId = 'athlete-1'

      // Mock repository failure
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
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

    it('[1.5-UNIT-007] @p1 should return repository error when revoke fails', async () => {
      const ctx = createAdminContext()
      const athleteId = 'athlete-1'

      const invitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))

      // Mock revoke failure
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Failed to update invitation',
        }),
      )

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Failed to update invitation')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[1.5-UNIT-008] @p2 should handle revoking already accepted invitation', async () => {
      const ctx = createAdminContext()
      const athleteId = 'athlete-1'

      // Invitation that was already accepted
      const invitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
        acceptedAt: new Date('2024-01-01'),
        revokedAt: null,
      })

      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(okAsync(undefined))

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
      })

      // Should still allow revoke (business logic may want to prevent reuse)
      expect(result.isOk()).toBe(true)
    })

    it('[1.5-UNIT-009] @p2 should handle revoking expired invitation', async () => {
      const ctx = createAdminContext()
      const athleteId = 'athlete-1'

      // Expired invitation
      const invitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
        expiresAt: new Date('2020-01-01'), // Past date
        acceptedAt: null,
        revokedAt: null,
      })

      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(invitation))
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(okAsync(undefined))

      const revokeInvitation = makeRevokeInvitation({
        invitationRepository: mockInvitationRepository,
      })

      const result = await revokeInvitation({
        ...ctx,
        athleteId,
      })

      // Should still allow explicit revoke of expired invitation
      expect(result.isOk()).toBe(true)
    })
  })
})
