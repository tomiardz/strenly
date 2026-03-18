import { faker } from '@faker-js/faker'
import type { OrganizationContext } from '@strenly/core/types/organization-context'

/**
 * Create a test OrganizationContext with customizable properties
 *
 * @example
 * const ctx = createTestContext({ memberRole: 'admin' })
 * const result = await createAthlete(ctx, input)
 */
export function createTestContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return {
    organizationId: overrides.organizationId ?? faker.string.uuid(),
    userId: overrides.userId ?? faker.string.uuid(),
    memberRole: overrides.memberRole ?? 'owner',
    ...overrides,
  }
}

/**
 * Create a test context with member role (read-only permissions)
 */
export function createMemberContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    memberRole: 'member',
    ...overrides,
  })
}

/**
 * Create a test context with admin role (all permissions except billing)
 */
export function createAdminContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    memberRole: 'admin',
    ...overrides,
  })
}

/**
 * Create a test context with owner role (all permissions including billing)
 */
export function createOwnerContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    memberRole: 'owner',
    ...overrides,
  })
}

/**
 * Create a test context with an unmapped role (simulates a role with no permissions).
 * Used to test forbidden paths in use cases when no standard role lacks a given permission.
 */
export function createNoPermissionContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return {
    ...createTestContext(overrides),
    memberRole: 'viewer' as unknown as 'member',
  }
}
