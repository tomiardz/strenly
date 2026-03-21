import type { MuscleGroupRepositoryPort } from '@strenly/core/ports/muscle-group-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMuscleGroupRepositoryMock } from '../../../__tests__/factories/muscle-group-repository-mock'
import { createCoachContext, createOwnerContext } from '../../../__tests__/helpers/test-context'
import { makeListMuscleGroups } from '../list-muscle-groups'

describe('[2.7-UNIT] listMuscleGroups use case', () => {
  let mockMuscleGroupRepository: MuscleGroupRepositoryPort

  beforeEach(() => {
    mockMuscleGroupRepository = createMuscleGroupRepositoryMock()
  })

  describe('[2.7-UNIT] Happy Path', () => {
    it('[2.7-UNIT-001] @p0 should list muscle groups successfully with member role', async () => {
      const ctx = createCoachContext() // Member has read permission

      const muscleGroups = [
        { id: 'chest', name: 'chest' as const, displayName: 'Chest', bodyRegion: 'upper' as const },
        { id: 'back', name: 'back' as const, displayName: 'Back', bodyRegion: 'upper' as const },
        { id: 'shoulders', name: 'shoulders' as const, displayName: 'Shoulders', bodyRegion: 'upper' as const },
        { id: 'biceps', name: 'biceps' as const, displayName: 'Biceps', bodyRegion: 'upper' as const },
        { id: 'triceps', name: 'triceps' as const, displayName: 'Triceps', bodyRegion: 'upper' as const },
        { id: 'quads', name: 'quads' as const, displayName: 'Quadriceps', bodyRegion: 'lower' as const },
        { id: 'hamstrings', name: 'hamstrings' as const, displayName: 'Hamstrings', bodyRegion: 'lower' as const },
        { id: 'glutes', name: 'glutes' as const, displayName: 'Glutes', bodyRegion: 'lower' as const },
        { id: 'core', name: 'core' as const, displayName: 'Core', bodyRegion: 'core' as const },
        { id: 'calves', name: 'calves' as const, displayName: 'Calves', bodyRegion: 'lower' as const },
      ]

      vi.mocked(mockMuscleGroupRepository.findAll).mockReturnValue(okAsync(muscleGroups))

      const listMuscleGroups = makeListMuscleGroups({
        muscleGroupRepository: mockMuscleGroupRepository,
      })

      const result = await listMuscleGroups({ ...ctx })

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const groups = result.value
        expect(groups).toHaveLength(10)
        const firstGroup = groups[0]
        if (firstGroup) {
          expect(firstGroup.id).toBe('chest')
          expect(firstGroup.displayName).toBe('Chest')
        }
      }

      // Verify repository called
      expect(mockMuscleGroupRepository.findAll).toHaveBeenCalledTimes(1)
    })

    it('[2.7-UNIT-002] @p0 should succeed with admin role', async () => {
      const ctx = createOwnerContext()

      const muscleGroups = [{ id: 'chest', name: 'chest' as const, displayName: 'Chest', bodyRegion: 'upper' as const }]

      vi.mocked(mockMuscleGroupRepository.findAll).mockReturnValue(okAsync(muscleGroups))

      const listMuscleGroups = makeListMuscleGroups({
        muscleGroupRepository: mockMuscleGroupRepository,
      })

      const result = await listMuscleGroups({ ...ctx })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
      }
    })
  })

  describe('[2.7-UNIT] Repository Errors', () => {
    it('[2.7-UNIT-003] @p1 should return repository error when database fails', async () => {
      const ctx = createCoachContext()

      // Mock repository failure
      vi.mocked(mockMuscleGroupRepository.findAll).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection failed',
        }),
      )

      const listMuscleGroups = makeListMuscleGroups({
        muscleGroupRepository: mockMuscleGroupRepository,
      })

      const result = await listMuscleGroups({ ...ctx })

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

  describe('[2.7-UNIT] Edge Cases', () => {
    it('[2.7-UNIT-004] @p2 should return empty list when no muscle groups exist', async () => {
      const ctx = createCoachContext()

      vi.mocked(mockMuscleGroupRepository.findAll).mockReturnValue(okAsync([]))

      const listMuscleGroups = makeListMuscleGroups({
        muscleGroupRepository: mockMuscleGroupRepository,
      })

      const result = await listMuscleGroups({ ...ctx })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value).toHaveLength(0)
      }
    })

    it('[2.7-UNIT-005] @p2 should handle muscle groups with all fields populated', async () => {
      const ctx = createCoachContext()

      const muscleGroups = [
        {
          id: 'chest',
          name: 'chest' as const,
          displayName: 'Chest',
          bodyRegion: 'upper' as const,
        },
      ]

      vi.mocked(mockMuscleGroupRepository.findAll).mockReturnValue(okAsync(muscleGroups))

      const listMuscleGroups = makeListMuscleGroups({
        muscleGroupRepository: mockMuscleGroupRepository,
      })

      const result = await listMuscleGroups({ ...ctx })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const group = result.value[0]
        if (group) {
          expect(group.id).toBe('chest')
          expect(group.name).toBe('chest')
          expect(group.displayName).toBe('Chest')
          expect(group.bodyRegion).toBe('upper')
        }
      }
    })
  })
})
