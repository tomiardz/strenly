import { faker } from '@faker-js/faker'
import type { OrganizationRole } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'

/**
 * Create a test OrganizationContext with customizable properties
 *
 * @example
 * const ctx = createTestContext({ roles: ['manager'] })
 * const result = await createAthlete(ctx, input)
 */
export function createTestContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return {
    organizationId: overrides.organizationId ?? faker.string.uuid(),
    userId: overrides.userId ?? faker.string.uuid(),
    roles: overrides.roles ?? ['owner'],
    ...overrides,
  }
}

/**
 * Create a test context with coach role (coaching permissions)
 */
export function createCoachContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    roles: ['coach'],
    ...overrides,
  })
}

/**
 * Create a test context with athlete role (self-access only)
 */
export function createAthleteContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    roles: ['athlete'],
    ...overrides,
  })
}

/**
 * Create a test context with manager role (org management permissions)
 */
export function createManagerContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    roles: ['manager'],
    ...overrides,
  })
}

/**
 * Create a test context with owner role (all permissions including billing)
 */
export function createOwnerContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    roles: ['owner'],
    ...overrides,
  })
}

/**
 * Create a test context with no permissions (empty roles array).
 * Used to test forbidden paths in use cases when no standard role lacks a given permission.
 */
export function createNoPermissionContext(overrides: Partial<OrganizationContext> = {}): OrganizationContext {
  return createTestContext({
    roles: [] as OrganizationRole[],
    ...overrides,
  })
}
