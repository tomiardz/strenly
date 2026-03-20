import type { Plan } from '@strenly/core/domain/entities/plan'
import type { Subscription } from '@strenly/core/domain/entities/subscription'
import type { PlanRepositoryPort } from '@strenly/core/ports/plan-repository.port'
import type { SubscriptionRepositoryPort } from '@strenly/core/ports/subscription-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerContext, createNoPermissionContext } from '../../../__tests__/helpers/test-context'
import { makeCheckAthleteLimit } from '../check-athlete-limit'

// Helper to create subscription entity
function createSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-123',
    organizationId: 'org-456',
    planId: 'plan-pro',
    status: 'active',
    athleteCount: 0,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    createdAt: new Date(),
    ...overrides,
  }
}

// Helper to create plan entity
function createPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-pro',
    name: 'Pro Plan',
    slug: 'pro',
    organizationType: 'coach_solo',
    athleteLimit: 10,
    coachLimit: 1,
    features: {
      templates: true,
      analytics: true,
      exportData: true,
      customExercises: true,
      multipleCoaches: false,
    },
    priceMonthly: 4999,
    priceYearly: 49999,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('checkAthleteLimit use case', () => {
  let mockSubscriptionRepository: SubscriptionRepositoryPort
  let mockPlanRepository: PlanRepositoryPort

  beforeEach(() => {
    // Mock subscription repository
    mockSubscriptionRepository = {
      findByOrganizationId: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      updateAthleteCount: vi.fn(),
    } as unknown as SubscriptionRepositoryPort

    // Mock plan repository
    mockPlanRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findBySlug: vi.fn(),
    } as unknown as PlanRepositoryPort
  })

  describe('Happy Path', () => {
    it('[4.1-UNIT-001] @p0 should return canAdd=true when below athlete limit', async () => {
      const ctx = createManagerContext()

      // Mock subscription with 5 athletes
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            athleteCount: 5,
          }),
        ),
      )

      // Mock plan with limit of 10 athletes
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(createPlan({ athleteLimit: 10 })))

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const limit = result.value
        expect(limit.canAdd).toBe(true)
        expect(limit.currentCount).toBe(5)
        expect(limit.limit).toBe(10)
        expect(limit.remaining).toBe(5)
      }
    })

    it('[4.1-UNIT-002] @p0 should return canAdd=false when at athlete limit', async () => {
      const ctx = createManagerContext()

      // Mock subscription at limit (10/10 athletes)
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            planId: 'plan-starter',
            athleteCount: 10,
          }),
        ),
      )

      // Mock plan with limit of 10 athletes
      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        okAsync(createPlan({ id: 'plan-starter', name: 'Starter Plan', athleteLimit: 10 })),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const limit = result.value
        expect(limit.canAdd).toBe(false)
        expect(limit.currentCount).toBe(10)
        expect(limit.limit).toBe(10)
        expect(limit.remaining).toBe(0)
      }
    })

    it('[4.1-UNIT-003] @p1 should return canAdd=false when over athlete limit', async () => {
      const ctx = createManagerContext()

      // Mock subscription over limit (15/10 athletes - legacy data)
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            planId: 'plan-starter',
            athleteCount: 15,
          }),
        ),
      )

      // Mock plan with limit of 10 athletes
      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        okAsync(createPlan({ id: 'plan-starter', name: 'Starter Plan', athleteLimit: 10 })),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const limit = result.value
        expect(limit.canAdd).toBe(false)
        expect(limit.currentCount).toBe(15)
        expect(limit.limit).toBe(10)
        expect(limit.remaining).toBe(0) // Never negative
      }
    })

    it('[4.1-UNIT-004] @p1 should handle unlimited plan (athleteLimit = -1)', async () => {
      const ctx = createManagerContext()

      // Mock subscription with many athletes
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            planId: 'plan-enterprise',
            athleteCount: 1000,
          }),
        ),
      )

      // Mock enterprise plan with unlimited athletes
      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        okAsync(createPlan({ id: 'plan-enterprise', name: 'Enterprise Plan', athleteLimit: -1 })),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const limit = result.value
        expect(limit.canAdd).toBe(true) // Always true for unlimited
      }
    })
  })

  describe('Authorization', () => {
    it('[4.2-UNIT-001] @p0 should return forbidden error when user lacks athletes:write permission', async () => {
      const ctx = createNoPermissionContext() // Unmapped role lacks write permission

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('forbidden')
        if (error.type === 'forbidden') {
          expect(error.message).toContain('No permission')
        }
      }

      // Repositories should NOT be called
      expect(mockSubscriptionRepository.findByOrganizationId).not.toHaveBeenCalled()
      expect(mockPlanRepository.findById).not.toHaveBeenCalled()
    })
  })

  describe('Not Found Errors', () => {
    it('[4.3-UNIT-001] @p0 should return subscription_not_found when organization has no subscription', async () => {
      const ctx = createManagerContext()

      // Mock no subscription found
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(null))

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('subscription_not_found')
        if (error.type === 'subscription_not_found') {
          expect(error.organizationId).toBe(ctx.organizationId)
        }
      }

      // Plan repository should NOT be called if subscription missing
      expect(mockPlanRepository.findById).not.toHaveBeenCalled()
    })

    it('[4.3-UNIT-002] @p1 should return plan_not_found when subscription references non-existent plan', async () => {
      const ctx = createManagerContext()

      // Mock subscription with invalid plan reference
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            planId: 'plan-deleted',
            athleteCount: 5,
          }),
        ),
      )

      // Mock plan not found
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(null))

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('plan_not_found')
        if (error.type === 'plan_not_found') {
          expect(error.planId).toBe('plan-deleted')
        }
      }
    })
  })

  describe('Repository Errors', () => {
    it('[4.4-UNIT-001] @p1 should return repository error when subscription fetch fails', async () => {
      const ctx = createManagerContext()

      // Mock subscription repository failure
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Failed to fetch subscription')
        }
      }
    })

    it('[4.4-UNIT-002] @p1 should return repository error when plan fetch fails', async () => {
      const ctx = createManagerContext()

      // Mock subscription success
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            athleteCount: 5,
          }),
        ),
      )

      // Mock plan repository failure
      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Database connection lost',
        }),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Database connection lost')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[4.5-UNIT-001] @p2 should handle zero athletes correctly', async () => {
      const ctx = createManagerContext()

      // Mock new subscription with no athletes yet
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            planId: 'plan-starter',
            athleteCount: 0,
          }),
        ),
      )

      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        okAsync(createPlan({ id: 'plan-starter', name: 'Starter Plan', athleteLimit: 10 })),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const limit = result.value
        expect(limit.canAdd).toBe(true)
        expect(limit.currentCount).toBe(0)
        expect(limit.remaining).toBe(10)
      }
    })

    it('[4.5-UNIT-002] @p2 should handle remaining calculation edge case (negative difference)', async () => {
      const ctx = createManagerContext()

      // Mock over limit scenario
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            planId: 'plan-starter',
            athleteCount: 20,
          }),
        ),
      )

      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        okAsync(createPlan({ id: 'plan-starter', name: 'Starter Plan', athleteLimit: 10 })),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const limit = result.value
        // Remaining should be clamped to 0, never negative
        expect(limit.remaining).toBe(0)
        expect(limit.remaining).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Business Logic', () => {
    it('[4.6-UNIT-001] @p1 should use domain helper canAddAthlete for limit check', async () => {
      const ctx = createManagerContext()

      // Test the boundary: exactly 1 remaining spot
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        okAsync(
          createSubscription({
            organizationId: ctx.organizationId,
            planId: 'plan-starter',
            athleteCount: 9, // 9 of 10
          }),
        ),
      )

      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        okAsync(createPlan({ id: 'plan-starter', name: 'Starter Plan', athleteLimit: 10 })),
      )

      const checkAthleteLimit = makeCheckAthleteLimit({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkAthleteLimit(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const limit = result.value
        expect(limit.canAdd).toBe(true) // Can add 1 more
        expect(limit.remaining).toBe(1)
      }
    })
  })
})
