import { describe, expect, it } from 'vitest'
import type { Permission } from '../authorization'
import { getPermissions, hasPermission, isValidRole } from '../authorization'

describe('hasPermission', () => {
  describe('owner role', () => {
    it('has all permissions', () => {
      expect(hasPermission(['owner'], 'organization:read')).toBe(true)
      expect(hasPermission(['owner'], 'organization:manage')).toBe(true)
      expect(hasPermission(['owner'], 'organization:delete')).toBe(true)
      expect(hasPermission(['owner'], 'members:read')).toBe(true)
      expect(hasPermission(['owner'], 'members:invite')).toBe(true)
      expect(hasPermission(['owner'], 'members:remove')).toBe(true)
      expect(hasPermission(['owner'], 'members:update-role')).toBe(true)
      expect(hasPermission(['owner'], 'billing:read')).toBe(true)
      expect(hasPermission(['owner'], 'billing:manage')).toBe(true)
      expect(hasPermission(['owner'], 'athletes:read')).toBe(true)
      expect(hasPermission(['owner'], 'athletes:write')).toBe(true)
      expect(hasPermission(['owner'], 'athletes:delete')).toBe(true)
      expect(hasPermission(['owner'], 'programs:read')).toBe(true)
      expect(hasPermission(['owner'], 'programs:write')).toBe(true)
      expect(hasPermission(['owner'], 'programs:delete')).toBe(true)
      expect(hasPermission(['owner'], 'exercises:read')).toBe(true)
      expect(hasPermission(['owner'], 'exercises:write')).toBe(true)
      expect(hasPermission(['owner'], 'workout_log:create')).toBe(true)
      expect(hasPermission(['owner'], 'workout_log:read')).toBe(true)
      expect(hasPermission(['owner'], 'workout_log:update')).toBe(true)
      expect(hasPermission(['owner'], 'workout_log:delete')).toBe(true)
    })
  })

  describe('manager role', () => {
    it('has org management permissions', () => {
      expect(hasPermission(['manager'], 'organization:read')).toBe(true)
      expect(hasPermission(['manager'], 'organization:manage')).toBe(true)
      expect(hasPermission(['manager'], 'members:read')).toBe(true)
      expect(hasPermission(['manager'], 'members:invite')).toBe(true)
      expect(hasPermission(['manager'], 'members:remove')).toBe(true)
      expect(hasPermission(['manager'], 'billing:read')).toBe(true)
      expect(hasPermission(['manager'], 'athletes:read')).toBe(true)
    })

    it('does not have coaching or program permissions', () => {
      expect(hasPermission(['manager'], 'organization:delete')).toBe(false)
      expect(hasPermission(['manager'], 'members:update-role')).toBe(false)
      expect(hasPermission(['manager'], 'billing:manage')).toBe(false)
      expect(hasPermission(['manager'], 'athletes:write')).toBe(false)
      expect(hasPermission(['manager'], 'athletes:delete')).toBe(false)
      expect(hasPermission(['manager'], 'programs:read')).toBe(false)
      expect(hasPermission(['manager'], 'programs:write')).toBe(false)
      expect(hasPermission(['manager'], 'programs:delete')).toBe(false)
      expect(hasPermission(['manager'], 'exercises:read')).toBe(false)
      expect(hasPermission(['manager'], 'exercises:write')).toBe(false)
      expect(hasPermission(['manager'], 'workout_log:create')).toBe(false)
      expect(hasPermission(['manager'], 'workout_log:read')).toBe(false)
      expect(hasPermission(['manager'], 'workout_log:update')).toBe(false)
      expect(hasPermission(['manager'], 'workout_log:delete')).toBe(false)
    })
  })

  describe('coach role', () => {
    it('has coaching permissions', () => {
      expect(hasPermission(['coach'], 'members:read')).toBe(true)
      expect(hasPermission(['coach'], 'athletes:read')).toBe(true)
      expect(hasPermission(['coach'], 'athletes:write')).toBe(true)
      expect(hasPermission(['coach'], 'athletes:delete')).toBe(true)
      expect(hasPermission(['coach'], 'programs:read')).toBe(true)
      expect(hasPermission(['coach'], 'programs:write')).toBe(true)
      expect(hasPermission(['coach'], 'programs:delete')).toBe(true)
      expect(hasPermission(['coach'], 'exercises:read')).toBe(true)
      expect(hasPermission(['coach'], 'exercises:write')).toBe(true)
      expect(hasPermission(['coach'], 'workout_log:create')).toBe(true)
      expect(hasPermission(['coach'], 'workout_log:read')).toBe(true)
      expect(hasPermission(['coach'], 'workout_log:update')).toBe(true)
      expect(hasPermission(['coach'], 'workout_log:delete')).toBe(true)
    })

    it('does not have org management permissions', () => {
      expect(hasPermission(['coach'], 'organization:read')).toBe(false)
      expect(hasPermission(['coach'], 'organization:manage')).toBe(false)
      expect(hasPermission(['coach'], 'organization:delete')).toBe(false)
      expect(hasPermission(['coach'], 'members:invite')).toBe(false)
      expect(hasPermission(['coach'], 'members:remove')).toBe(false)
      expect(hasPermission(['coach'], 'members:update-role')).toBe(false)
      expect(hasPermission(['coach'], 'billing:read')).toBe(false)
      expect(hasPermission(['coach'], 'billing:manage')).toBe(false)
    })
  })

  describe('athlete role', () => {
    it('has self-access permissions only', () => {
      expect(hasPermission(['athlete'], 'programs:read')).toBe(true)
      expect(hasPermission(['athlete'], 'workout_log:create')).toBe(true)
      expect(hasPermission(['athlete'], 'workout_log:read')).toBe(true)
      expect(hasPermission(['athlete'], 'workout_log:update')).toBe(true)
    })

    it('does not have any other permissions', () => {
      expect(hasPermission(['athlete'], 'organization:read')).toBe(false)
      expect(hasPermission(['athlete'], 'organization:manage')).toBe(false)
      expect(hasPermission(['athlete'], 'organization:delete')).toBe(false)
      expect(hasPermission(['athlete'], 'members:read')).toBe(false)
      expect(hasPermission(['athlete'], 'members:invite')).toBe(false)
      expect(hasPermission(['athlete'], 'members:remove')).toBe(false)
      expect(hasPermission(['athlete'], 'members:update-role')).toBe(false)
      expect(hasPermission(['athlete'], 'billing:read')).toBe(false)
      expect(hasPermission(['athlete'], 'billing:manage')).toBe(false)
      expect(hasPermission(['athlete'], 'athletes:read')).toBe(false)
      expect(hasPermission(['athlete'], 'athletes:write')).toBe(false)
      expect(hasPermission(['athlete'], 'athletes:delete')).toBe(false)
      expect(hasPermission(['athlete'], 'programs:write')).toBe(false)
      expect(hasPermission(['athlete'], 'programs:delete')).toBe(false)
      expect(hasPermission(['athlete'], 'exercises:read')).toBe(false)
      expect(hasPermission(['athlete'], 'exercises:write')).toBe(false)
      expect(hasPermission(['athlete'], 'workout_log:delete')).toBe(false)
    })
  })

  describe('multi-role', () => {
    it('grants union of manager and coach permissions', () => {
      const roles: ('manager' | 'coach')[] = ['manager', 'coach']

      // Manager-only permissions
      expect(hasPermission(roles, 'organization:read')).toBe(true)
      expect(hasPermission(roles, 'organization:manage')).toBe(true)
      expect(hasPermission(roles, 'members:invite')).toBe(true)
      expect(hasPermission(roles, 'members:remove')).toBe(true)
      expect(hasPermission(roles, 'billing:read')).toBe(true)

      // Coach-only permissions
      expect(hasPermission(roles, 'athletes:write')).toBe(true)
      expect(hasPermission(roles, 'athletes:delete')).toBe(true)
      expect(hasPermission(roles, 'programs:write')).toBe(true)
      expect(hasPermission(roles, 'programs:delete')).toBe(true)
      expect(hasPermission(roles, 'exercises:write')).toBe(true)
      expect(hasPermission(roles, 'workout_log:create')).toBe(true)

      // Neither has these
      expect(hasPermission(roles, 'organization:delete')).toBe(false)
      expect(hasPermission(roles, 'billing:manage')).toBe(false)
      expect(hasPermission(roles, 'members:update-role')).toBe(false)
    })
  })

  describe('empty roles array', () => {
    it('denies all permissions', () => {
      const allPermissions: Permission[] = [
        'organization:read',
        'organization:manage',
        'organization:delete',
        'members:read',
        'members:invite',
        'members:remove',
        'members:update-role',
        'billing:read',
        'billing:manage',
        'athletes:read',
        'athletes:write',
        'athletes:delete',
        'programs:read',
        'programs:write',
        'programs:delete',
        'exercises:read',
        'exercises:write',
        'workout_log:create',
        'workout_log:read',
        'workout_log:update',
        'workout_log:delete',
      ]

      for (const permission of allPermissions) {
        expect(hasPermission([], permission)).toBe(false)
      }
    })
  })
})

describe('getPermissions', () => {
  it('returns owner permissions (all 21)', () => {
    const perms = getPermissions('owner')
    expect(perms).toHaveLength(21)
    expect(perms).toContain('organization:delete')
    expect(perms).toContain('billing:manage')
    expect(perms).toContain('members:update-role')
  })

  it('returns manager permissions', () => {
    const perms = getPermissions('manager')
    expect(perms).toHaveLength(7)
    expect(perms).toContain('organization:manage')
    expect(perms).not.toContain('organization:delete')
    expect(perms).not.toContain('programs:read')
  })

  it('returns coach permissions', () => {
    const perms = getPermissions('coach')
    expect(perms).toHaveLength(13)
    expect(perms).toContain('programs:write')
    expect(perms).toContain('exercises:write')
    expect(perms).not.toContain('organization:read')
  })

  it('returns athlete permissions', () => {
    const perms = getPermissions('athlete')
    expect(perms).toHaveLength(4)
    expect(perms).toContain('programs:read')
    expect(perms).toContain('workout_log:create')
    expect(perms).not.toContain('workout_log:delete')
  })
})

describe('isValidRole', () => {
  it('returns true for valid roles', () => {
    expect(isValidRole('owner')).toBe(true)
    expect(isValidRole('manager')).toBe(true)
    expect(isValidRole('coach')).toBe(true)
    expect(isValidRole('athlete')).toBe(true)
  })

  it('returns false for old/invalid roles', () => {
    expect(isValidRole('admin')).toBe(false)
    expect(isValidRole('member')).toBe(false)
    expect(isValidRole('superadmin')).toBe(false)
    expect(isValidRole('viewer')).toBe(false)
    expect(isValidRole('')).toBe(false)
  })
})
