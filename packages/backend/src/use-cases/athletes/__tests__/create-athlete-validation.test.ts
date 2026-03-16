import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAthleteEntity, createAthleteInput } from '../../../__tests__/factories/athlete-factory'
import { createAdminContext, createNoPermissionContext } from '../../../__tests__/helpers/test-context'
import { makeCreateAthlete } from '../create-athlete'

describe('[1.10-UNIT] createAthlete use case - Validation & Authorization', () => {
  let mockAthleteRepository: AthleteRepositoryPort
  let mockGenerateId: () => string

  beforeEach(() => {
    // Mock repository
    mockAthleteRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByLinkedUserId: vi.fn(),
    }

    // Mock ID generator
    mockGenerateId = vi.fn(() => 'test-athlete-id')
  })

  describe('Authorization', () => {
    it('[1.10-UNIT-001] @p0 should return forbidden error when user lacks athletes:write permission', async () => {
      const ctx = createNoPermissionContext() // Unmapped role lacks write permission
      const input = createAthleteInput()

      const createAthlete = makeCreateAthlete({
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createAthlete({ ...ctx, ...input })

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
      expect(mockAthleteRepository.create).not.toHaveBeenCalled()
    })

    it('[1.10-UNIT-002] @p0 should succeed when user has coach role (has athletes:write)', async () => {
      const ctx = createAdminContext() // Coach role has write permission
      const input = createAthleteInput()

      const athlete = createAthleteEntity({
        id: 'test-athlete-id',
        organizationId: ctx.organizationId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        birthdate: input.birthdate,
        gender: input.gender,
        notes: input.notes,
      })
      vi.mocked(mockAthleteRepository.create).mockReturnValue(okAsync(athlete))

      const createAthlete = makeCreateAthlete({
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createAthlete({ ...ctx, ...input })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Validation Errors', () => {
    it('[1.10-UNIT-003] @p1 should return validation error when name is empty', async () => {
      const ctx = createAdminContext()
      const input = createAthleteInput({ name: '' }) // Invalid: empty name

      const createAthlete = makeCreateAthlete({
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createAthlete({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message).toContain('Name')
        }
      }

      // Repository should NOT be called for invalid input
      expect(mockAthleteRepository.create).not.toHaveBeenCalled()
    })

    it('[1.10-UNIT-004] @p1 should return validation error for malformed email', async () => {
      const ctx = createAdminContext()
      const input = createAthleteInput({ email: 'invalid-email' })

      const createAthlete = makeCreateAthlete({
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createAthlete({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('validation_error')
        if (error.type === 'validation_error') {
          expect(error.message.toLowerCase()).toContain('email')
        }
      }
    })
  })

  describe('Repository Errors', () => {
    it('[1.10-UNIT-005] @p1 should return repository error when database fails', async () => {
      const ctx = createAdminContext()
      const input = createAthleteInput()

      // Mock repository failure
      vi.mocked(mockAthleteRepository.create).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const createAthlete = makeCreateAthlete({
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createAthlete({ ...ctx, ...input })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Connection failed')
        }
      }
    })
  })
})
