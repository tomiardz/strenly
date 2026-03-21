import type { Program } from '@strenly/core/domain/entities/program/program'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgramRepositoryMock } from '../../../__tests__/factories/program-repository-mock'
import { createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeListPrograms } from '../list-programs'

// Helper to create minimal program for list results
function createProgramListItem(overrides: Partial<Program> = {}): Program {
  return {
    id: 'program-1',
    organizationId: 'org-1',
    name: 'Strength Program',
    description: null,
    athleteId: null,
    isTemplate: false,
    status: 'draft',
    weeks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('[3.16-UNIT] @p2 [3.16-UNIT] listPrograms use case', () => {
  let mockProgramRepository: ProgramRepositoryPort

  beforeEach(() => {
    mockProgramRepository = createProgramRepositoryMock()
  })

  describe('[3.16-UNIT] @p0 Happy Path', () => {
    it('[3.16-UNIT-001] @p0 should list programs successfully with member role', async () => {
      const ctx = createCoachContext() // Member has read permission

      const programs = [
        createProgramListItem({ name: 'Program 1' }),
        createProgramListItem({ name: 'Program 2' }),
        createProgramListItem({ name: 'Program 3' }),
      ]

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: programs,
          totalCount: 3,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({ ...ctx })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const data = result.value
        expect(data.items).toHaveLength(3)
        expect(data.totalCount).toBe(3)
        expect(data.items[0]?.name).toBe('Program 1')
      }

      // Verify repository called with default pagination
      expect(mockProgramRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          roles: ['coach'],
        }),
        expect.objectContaining({
          limit: 50,
          offset: 0,
        }),
      )
    })

    it('[3.16-UNIT-002] @p2 should list programs with custom pagination', async () => {
      const ctx = createCoachContext()

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: [],
          totalCount: 0,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({
        ...ctx,
        limit: 100,
        offset: 50,
      })

      expect(result.isOk()).toBe(true)

      // Verify custom pagination passed to repository
      expect(mockProgramRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
        expect.objectContaining({
          limit: 100,
          offset: 50,
        }),
      )
    })

    it('[3.16-UNIT-003] @p2 should list programs filtered by athleteId', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      const programs = [
        createProgramListItem({ name: 'Athlete Program 1', athleteId }),
        createProgramListItem({ name: 'Athlete Program 2', athleteId }),
      ]

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: programs,
          totalCount: 2,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({
        ...ctx,
        athleteId,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2)
        expect(result.value.items.every((p) => p.athleteId === athleteId)).toBe(true)
      }

      // Verify filter passed to repository
      expect(mockProgramRepository.list).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          athleteId,
        }),
      )
    })

    it('[3.16-UNIT-004] @p2 should list template programs when isTemplate is true', async () => {
      const ctx = createCoachContext()

      const templates = [
        createProgramListItem({ name: 'Template 1', isTemplate: true, athleteId: null }),
        createProgramListItem({ name: 'Template 2', isTemplate: true, athleteId: null }),
      ]

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: templates,
          totalCount: 2,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({
        ...ctx,
        isTemplate: true,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2)
        expect(result.value.items.every((p) => p.isTemplate === true)).toBe(true)
      }

      // Verify filter passed to repository
      expect(mockProgramRepository.list).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          isTemplate: true,
        }),
      )
    })

    it('[3.16-UNIT-005] @p2 should list programs filtered by status', async () => {
      const ctx = createCoachContext()

      const activePrograms = [
        createProgramListItem({ name: 'Active 1', status: 'active' }),
        createProgramListItem({ name: 'Active 2', status: 'active' }),
      ]

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: activePrograms,
          totalCount: 2,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({
        ...ctx,
        status: 'active',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.items.every((p) => p.status === 'active')).toBe(true)
      }

      // Verify filter passed to repository
      expect(mockProgramRepository.list).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: 'active',
        }),
      )
    })

    it('[3.16-UNIT-006] @p2 should list programs filtered by search term', async () => {
      const ctx = createCoachContext()

      const searchResults = [createProgramListItem({ name: 'Strength Training' })]

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: searchResults,
          totalCount: 1,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({
        ...ctx,
        search: 'strength',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.items).toHaveLength(1)
      }

      // Verify search passed to repository
      expect(mockProgramRepository.list).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          search: 'strength',
        }),
      )
    })
  })

  describe('[3.16-UNIT] @p1 Repository Errors', () => {
    it('[3.16-UNIT-007] @p1 should return repository error when database fails', async () => {
      const ctx = createCoachContext()

      // Mock repository failure
      vi.mocked(mockProgramRepository.list).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({ ...ctx })

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

  describe('[3.16-UNIT] @p2 Edge Cases', () => {
    it('[3.16-UNIT-008] @p3 should return empty list when no programs exist', async () => {
      const ctx = createCoachContext()

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: [],
          totalCount: 0,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({ ...ctx })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.items).toHaveLength(0)
        expect(result.value.totalCount).toBe(0)
      }
    })

    it('[3.16-UNIT-009] @p3 should handle pagination at boundary', async () => {
      const ctx = createCoachContext()

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: [],
          totalCount: 200,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({
        ...ctx,
        limit: 50,
        offset: 200, // At boundary
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.items).toHaveLength(0)
        expect(result.value.totalCount).toBe(200)
      }
    })

    it('[3.16-UNIT-010] @p2 should combine multiple filters', async () => {
      const ctx = createCoachContext()
      const athleteId = 'athlete-1'

      vi.mocked(mockProgramRepository.list).mockReturnValue(
        okAsync({
          items: [],
          totalCount: 0,
        }),
      )

      const listPrograms = makeListPrograms({
        programRepository: mockProgramRepository,
      })

      const result = await listPrograms({
        ...ctx,
        athleteId,
        status: 'active',
        search: 'strength',
        limit: 20,
        offset: 10,
      })

      expect(result.isOk()).toBe(true)

      // Verify all filters passed to repository
      expect(mockProgramRepository.list).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          athleteId,
          status: 'active',
          search: 'strength',
          limit: 20,
          offset: 10,
        }),
      )
    })
  })
})
