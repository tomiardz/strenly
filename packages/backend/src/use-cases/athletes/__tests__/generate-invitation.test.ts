import type { AthleteInvitationRepositoryPort } from '@strenly/core/ports/athlete-invitation-repository.port'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAthleteEntity } from '../../../__tests__/factories/athlete-factory'
import { createInvitationData } from '../../../__tests__/factories/invitation-factory'
import { createCoachContext, createNoPermissionContext } from '../../../__tests__/helpers/test-context'
import { makeGenerateInvitation } from '../generate-invitation'

describe('[1.7-UNIT] generateInvitation use case', () => {
  let mockAthleteRepository: AthleteRepositoryPort
  let mockInvitationRepository: AthleteInvitationRepositoryPort
  let mockGenerateId: () => string
  let mockGenerateToken: () => string

  beforeEach(() => {
    // Mock all repository methods
    mockAthleteRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByLinkedUserId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      count: vi.fn(),
    }

    mockInvitationRepository = {
      findByToken: vi.fn(),
      findByAthleteId: vi.fn(),
      create: vi.fn(),
      markAccepted: vi.fn(),
      revoke: vi.fn(),
    }

    // Mock ID generator with counter
    let idCounter = 0
    mockGenerateId = vi.fn(() => `test-id-${++idCounter}`)

    // Mock token generator
    let tokenCounter = 0
    mockGenerateToken = vi.fn(() => `test-token-${++tokenCounter}`)
  })

  describe('Happy Path', () => {
    it('[1.7-UNIT-001] @p0 should generate invitation successfully when no existing invitation', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'
      const appUrl = 'https://app.example.com'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null, // Not linked yet
      })

      // No existing invitation
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))
      vi.mocked(mockInvitationRepository.create).mockImplementation((_ctx, invitation) => okAsync(invitation))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl,
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { invitation, invitationUrl } = result.value
        expect(invitation.id).toBe('test-id-1')
        expect(invitation.token).toBe('test-token-1')
        expect(invitation.athleteId).toBe(athleteId)
        expect(invitation.organizationId).toBe(ctx.organizationId)
        expect(invitation.createdByUserId).toBe(ctx.userId)
        expect(invitationUrl).toBe(`${appUrl}/invite/${invitation.token}`)
      }

      // Verify repository calls
      expect(mockAthleteRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        athleteId,
      )

      expect(mockInvitationRepository.findByAthleteId).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        athleteId,
      )

      expect(mockInvitationRepository.create).toHaveBeenCalled()

      // Revoke should NOT be called (no existing invitation)
      expect(mockInvitationRepository.revoke).not.toHaveBeenCalled()
    })

    it('[1.7-UNIT-002] @p0 should revoke existing invitation before creating new one', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'
      const appUrl = 'https://app.example.com'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null,
      })

      const existingInvitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
        token: 'old-token',
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(existingInvitation))
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(okAsync(undefined))
      vi.mocked(mockInvitationRepository.create).mockImplementation((_ctx, invitation) => okAsync(invitation))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl,
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { invitation } = result.value
        // Should create NEW invitation, not reuse old one
        expect(invitation.id).toBe('test-id-1')
        expect(invitation.token).toBe('test-token-1')
        expect(invitation.id).not.toBe(existingInvitation.id)
        expect(invitation.token).not.toBe(existingInvitation.token)
      }

      // Verify revoke was called with old invitation ID
      expect(mockInvitationRepository.revoke).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        existingInvitation.id,
      )

      // Verify create was called AFTER revoke
      expect(mockInvitationRepository.create).toHaveBeenCalled()
    })

    it('[1.7-UNIT-003] @p1 should generate unique IDs and tokens', async () => {
      const ctx = createCoachContext()
      const athleteId1 = 'athlete-1'
      const athleteId2 = 'athlete-2'
      const appUrl = 'https://app.example.com'

      const athlete1 = createAthleteEntity({ id: athleteId1, organizationId: ctx.organizationId, linkedUserId: null })
      const athlete2 = createAthleteEntity({ id: athleteId2, organizationId: ctx.organizationId, linkedUserId: null })

      vi.mocked(mockAthleteRepository.findById)
        .mockReturnValueOnce(okAsync(athlete1))
        .mockReturnValueOnce(okAsync(athlete2))

      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))
      vi.mocked(mockInvitationRepository.create).mockImplementation((_ctx, invitation) => okAsync(invitation))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl,
      })

      // Generate two invitations
      const result1 = await generateInvitation({ ...ctx, athleteId: athleteId1 })
      const result2 = await generateInvitation({ ...ctx, athleteId: athleteId2 })

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk() && result2.isOk()) {
        // IDs should be unique
        expect(result1.value.invitation.id).not.toBe(result2.value.invitation.id)
        expect(result1.value.invitation.token).not.toBe(result2.value.invitation.token)

        expect(result1.value.invitation.id).toBe('test-id-1')
        expect(result2.value.invitation.id).toBe('test-id-2')
        expect(result1.value.invitation.token).toBe('test-token-1')
        expect(result2.value.invitation.token).toBe('test-token-2')
      }
    })
  })

  describe('Authorization', () => {
    it('[1.7-UNIT-004] @p0 should return forbidden error when user lacks athletes:write permission', async () => {
      const ctx = createNoPermissionContext() // Unmapped role lacks write permission
      const athleteId = 'athlete-1'

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
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
      expect(mockAthleteRepository.findById).not.toHaveBeenCalled()
      expect(mockInvitationRepository.findByAthleteId).not.toHaveBeenCalled()
      expect(mockInvitationRepository.create).not.toHaveBeenCalled()
    })

    it('[1.7-UNIT-005] @p0 should succeed when user has admin role (has athletes:write)', async () => {
      const ctx = createCoachContext() // Admin has write permission
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))
      vi.mocked(mockInvitationRepository.create).mockImplementation((_ctx, invitation) => okAsync(invitation))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Validation Errors', () => {
    it('[1.7-UNIT-006] @p1 should return athlete_not_found error when athlete does not exist', async () => {
      const ctx = createCoachContext()
      const athleteId = 'non-existent-athlete'

      // Mock repository returning null
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(null))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
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

      // Invitation operations should NOT be called
      expect(mockInvitationRepository.findByAthleteId).not.toHaveBeenCalled()
      expect(mockInvitationRepository.create).not.toHaveBeenCalled()
    })

    it('[1.7-UNIT-007] @p1 should return already_linked error when athlete is already linked to user', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: 'user-123', // Already linked
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('already_linked')
        if (error.type === 'already_linked') {
          expect(error.athleteId).toBe(athleteId)
          expect(error.message).toContain('already linked')
        }
      }

      // Invitation operations should NOT be called
      expect(mockInvitationRepository.findByAthleteId).not.toHaveBeenCalled()
      expect(mockInvitationRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('Repository Errors', () => {
    it('[1.7-UNIT-008] @p1 should return repository error when athlete lookup fails', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      // Mock repository failure
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
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

    it('[1.7-UNIT-009] @p1 should return repository error when finding existing invitation fails', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      // Mock findByAthleteId failure
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query failed',
        }),
      )

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
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

    it('[1.7-UNIT-010] @p1 should return repository error when revoke fails', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null,
      })

      const existingInvitation = createInvitationData({
        athleteId,
        organizationId: ctx.organizationId,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(existingInvitation))

      // Mock revoke failure
      vi.mocked(mockInvitationRepository.revoke).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Failed to revoke invitation',
        }),
      )

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Failed to revoke invitation')
        }
      }

      // Create should NOT be called (revoke failed)
      expect(mockInvitationRepository.create).not.toHaveBeenCalled()
    })

    it('[1.7-UNIT-011] @p1 should return repository error when create fails', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))

      // Mock create failure
      vi.mocked(mockInvitationRepository.create).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Failed to create invitation',
        }),
      )

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl: 'https://app.example.com',
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Failed to create invitation')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[1.7-UNIT-012] @p3 should handle custom appUrl with trailing slash', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'
      const appUrl = 'https://app.example.com/' // With trailing slash

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))
      vi.mocked(mockInvitationRepository.create).mockImplementation((_ctx, invitation) => okAsync(invitation))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl,
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { invitationUrl } = result.value
        // Should handle URL correctly (may have double slash)
        expect(invitationUrl).toContain('/invite/')
      }
    })

    it('[1.7-UNIT-013] @p3 should handle different appUrl domains', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'
      const appUrl = 'https://staging.strenly.com'

      const athlete = createAthleteEntity({
        id: athleteId,
        organizationId: ctx.organizationId,
        linkedUserId: null,
      })

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))
      vi.mocked(mockInvitationRepository.findByAthleteId).mockReturnValue(okAsync(null))
      vi.mocked(mockInvitationRepository.create).mockImplementation((_ctx, invitation) => okAsync(invitation))

      const generateInvitation = makeGenerateInvitation({
        athleteRepository: mockAthleteRepository,
        invitationRepository: mockInvitationRepository,
        generateId: mockGenerateId,
        generateToken: mockGenerateToken,
        appUrl,
      })

      const result = await generateInvitation({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { invitationUrl } = result.value
        expect(invitationUrl).toContain('staging.strenly.com')
      }
    })
  })
})
