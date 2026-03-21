import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoachContext, createNoPermissionContext } from '../../../__tests__/helpers/test-context'
import { makeUpdateAthlete } from '../update-athlete'

describe('[1.4-UNIT] updateAthlete use case', () => {
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
    it('[1.4-UNIT-001] @p0 should update athlete successfully', async () => {
      const ctx = createCoachContext()
      const existingAthlete = {
        id: 'athlete-123',
        organizationId: ctx.organizationId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        birthdate: new Date('1990-01-01'),
        gender: 'male' as const,
        notes: 'Original notes',
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock findById - return existing athlete
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(existingAthlete))

      // Mock update - return updated athlete
      vi.mocked(mockAthleteRepository.update).mockReturnValue(
        okAsync({
          ...existingAthlete,
          name: 'Jane Doe',
          email: 'jane@example.com',
        }),
      )

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const athlete = result.value
        expect(athlete.name).toBe('Jane Doe')
        expect(athlete.email).toBe('jane@example.com')
        // Other fields should remain unchanged
        expect(athlete.phone).toBe('555-0100')
      }
    })

    it('[1.4-UNIT-002] @p0 should update only specified fields', async () => {
      const ctx = createCoachContext()
      const existingAthlete = {
        id: 'athlete-123',
        organizationId: ctx.organizationId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        birthdate: new Date('1990-01-01'),
        gender: 'male' as const,
        notes: 'Original notes',
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(existingAthlete))
      vi.mocked(mockAthleteRepository.update).mockImplementation((_, athlete) => okAsync(athlete))

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      // Only update name
      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        name: 'Jane Doe',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const athlete = result.value
        expect(athlete.name).toBe('Jane Doe')
        // All other fields unchanged
        expect(athlete.email).toBe('john@example.com')
        expect(athlete.phone).toBe('555-0100')
      }
    })

    it('[1.4-UNIT-003] @p1 should allow setting fields to null', async () => {
      const ctx = createCoachContext()
      const existingAthlete = {
        id: 'athlete-123',
        organizationId: ctx.organizationId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        birthdate: new Date('1990-01-01'),
        gender: 'male' as const,
        notes: 'Some notes',
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(existingAthlete))
      vi.mocked(mockAthleteRepository.update).mockImplementation((_, athlete) => okAsync(athlete))

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        email: null,
        phone: null,
        notes: null,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const athlete = result.value
        expect(athlete.email).toBeNull()
        expect(athlete.phone).toBeNull()
        expect(athlete.notes).toBeNull()
      }
    })
  })

  describe('Authorization', () => {
    it('[1.4-UNIT-004] @p0 should return forbidden error when user lacks athletes:write permission', async () => {
      const ctx = createNoPermissionContext()

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('forbidden')
      }

      expect(mockAthleteRepository.findById).not.toHaveBeenCalled()
    })
  })

  describe('Not Found Errors', () => {
    it('[1.4-UNIT-005] @p1 should return not_found when athlete does not exist', async () => {
      const ctx = createCoachContext()

      // Mock findById - return null (not found)
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(null))

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'nonexistent-id',
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('not_found')
        if (result.error.type === 'not_found') {
          expect(result.error.athleteId).toBe('nonexistent-id')
        }
      }

      // Update should NOT be called
      expect(mockAthleteRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('Validation Errors', () => {
    it('[1.4-UNIT-006] @p1 should return validation error when name is empty', async () => {
      const ctx = createCoachContext()
      const existingAthlete = {
        id: 'athlete-123',
        organizationId: ctx.organizationId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(existingAthlete))

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        name: '', // Invalid: empty name
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }

      expect(mockAthleteRepository.update).not.toHaveBeenCalled()
    })

    it('[1.4-UNIT-007] @p1 should return validation error for invalid email', async () => {
      const ctx = createCoachContext()
      const existingAthlete = {
        id: 'athlete-123',
        organizationId: ctx.organizationId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(existingAthlete))

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        email: 'invalid-email',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('validation_error')
      }
    })
  })

  describe('Repository Errors', () => {
    it('[1.4-UNIT-008] @p1 should return repository error when findById fails', async () => {
      const ctx = createCoachContext()

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[1.4-UNIT-009] @p1 should return repository error when update fails', async () => {
      const ctx = createCoachContext()
      const existingAthlete = {
        id: 'athlete-123',
        organizationId: ctx.organizationId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(existingAthlete))
      vi.mocked(mockAthleteRepository.update).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Update failed',
        }),
      )

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        name: 'New Name',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('Edge Cases', () => {
    it('[1.4-UNIT-010] @p2 should handle partial updates correctly', async () => {
      const ctx = createCoachContext()
      const existingAthlete = {
        id: 'athlete-123',
        organizationId: ctx.organizationId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        birthdate: new Date('1990-01-01'),
        gender: 'male' as const,
        notes: 'Notes',
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(existingAthlete))
      vi.mocked(mockAthleteRepository.update).mockImplementation((_, athlete) => okAsync(athlete))

      const updateAthlete = makeUpdateAthlete({
        athleteRepository: mockAthleteRepository,
      })

      // Update only phone
      const result = await updateAthlete({
        ...ctx,
        athleteId: 'athlete-123',
        phone: '555-9999',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const athlete = result.value
        expect(athlete.phone).toBe('555-9999')
        // All other fields preserved
        expect(athlete.name).toBe('John Doe')
        expect(athlete.email).toBe('john@example.com')
      }
    })
  })
})
