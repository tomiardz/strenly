import type { Plan } from '@strenly/core/domain/entities/plan'
import { reconstituteSubscription, type Subscription } from '@strenly/core/domain/entities/subscription'
import type { PlanRepositoryPort } from '@strenly/core/ports/plan-repository.port'
import type { SubscriptionRepositoryPort } from '@strenly/core/ports/subscription-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerContext, createCoachContext } from '../../../__tests__/helpers/test-context'
import { makeGetSubscription } from '../get-subscription'

// Helper to create plan entity
function createPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-456',
    name: 'Pro Plan',
    slug: 'pro',
    organizationType: 'coach_solo',
    athleteLimit: 50,
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
    ...overrides,
  } as Plan
}

// Helper to create subscription entity
function createSubscription(organizationId: string, planId: string): Subscription {
  const now = new Date()
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + 30)

  return reconstituteSubscription({
    id: 'sub-123',
    organizationId,
    planId,
    status: 'active',
    athleteCount: 5,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    // Active subscription
    createdAt: now,
  })
}

describe('getSubscription use case', () => {
  let mockSubscriptionRepository: SubscriptionRepositoryPort
  let mockPlanRepository: PlanRepositoryPort

  beforeEach(() => {
    mockSubscriptionRepository = {
      create: vi.fn(),
      findByOrganizationId: vi.fn(),
      save: vi.fn(),
      updateAthleteCount: vi.fn(),
    }
    mockPlanRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findBySlug: vi.fn(),
    }
  })

  describe('Happy Path', () => {
    it('[4.1-UNIT-001] @p0 should get subscription with plan successfully', async () => {
      const ctx = createManagerContext()
      const planId = 'plan-456'

      const subscription = createSubscription(ctx.organizationId, planId)
      const plan = createPlan({ id: planId })

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      // Assert success
      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        const { subscription: sub, plan: returnedPlan } = result.value
        expect(sub.id).toBe('sub-123')
        expect(sub.organizationId).toBe(ctx.organizationId)
        expect(sub.planId).toBe(planId)
        expect(sub.status).toBe('active')
        expect(returnedPlan.id).toBe(planId)
        expect(returnedPlan.name).toBe('Pro Plan')
      }

      // Verify repository calls
      expect(mockSubscriptionRepository.findByOrganizationId).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ctx.organizationId,
        }),
      )

      expect(mockPlanRepository.findById).toHaveBeenCalledWith(planId)
    })

    it('[4.1-UNIT-002] @p1 should get active subscription', async () => {
      const ctx = createManagerContext()
      const planId = 'plan-456'

      const subscription = createSubscription(ctx.organizationId, planId)
      const plan = createPlan({ id: planId })

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.subscription.status).toBe('active')
      }
    })

    it('[4.1-UNIT-003] @p2 should get subscription with athlete count', async () => {
      const ctx = createManagerContext()
      const planId = 'plan-456'

      const subscription = createSubscription(ctx.organizationId, planId)
      const plan = createPlan({ id: planId, athleteLimit: 50 })

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.subscription.athleteCount).toBe(5)
        expect(result.value.plan.athleteLimit).toBe(50)
      }
    })
  })

  describe('Authorization', () => {
    it('[4.2-UNIT-001] @p0 should return forbidden error when user lacks billing:read permission', async () => {
      // Create context with role that lacks billing permission
      const ctx = createCoachContext() // Member lacks billing:read

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

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
      expect(mockSubscriptionRepository.findByOrganizationId).not.toHaveBeenCalled()
      expect(mockPlanRepository.findById).not.toHaveBeenCalled()
    })

    it('[4.2-UNIT-002] @p0 should succeed when user has admin role (has billing:read)', async () => {
      const ctx = createManagerContext() // Admin has billing permission
      const planId = 'plan-456'

      const subscription = createSubscription(ctx.organizationId, planId)
      const plan = createPlan({ id: planId })

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Not Found Errors', () => {
    it('[4.3-UNIT-001] @p0 should return subscription_not_found error when organization has no subscription', async () => {
      const ctx = createManagerContext()

      // Mock repository returning null (no subscription)
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(null))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('subscription_not_found')
        if (error.type === 'subscription_not_found') {
          expect(error.organizationId).toBe(ctx.organizationId)
        }
      }

      // Plan lookup should NOT be called
      expect(mockPlanRepository.findById).not.toHaveBeenCalled()
    })

    it('[4.3-UNIT-002] @p1 should return plan_not_found error when subscription references non-existent plan', async () => {
      const ctx = createManagerContext()
      const planId = 'non-existent-plan'

      const subscription = createSubscription(ctx.organizationId, planId)

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      // Plan not found
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(null))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('plan_not_found')
        if (error.type === 'plan_not_found') {
          expect(error.planId).toBe(planId)
        }
      }
    })
  })

  describe('Repository Errors', () => {
    it('[4.4-UNIT-001] @p1 should return repository error when subscription lookup fails', async () => {
      const ctx = createManagerContext()

      // Mock repository failure
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection timeout',
        }),
      )

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Failed to fetch subscription')
        }
      }
    })

    it('[4.4-UNIT-002] @p1 should return repository error when plan lookup fails', async () => {
      const ctx = createManagerContext()
      const planId = 'plan-456'

      const subscription = createSubscription(ctx.organizationId, planId)

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))

      // Mock plan lookup failure
      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query failed',
        }),
      )

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await getSubscription(ctx)

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        const error = result.error
        expect(error.type).toBe('repository_error')
        if (error.type === 'repository_error') {
          expect(error.message).toContain('Query failed')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[4.5-UNIT-001] @p2 should handle subscription with cancelAtPeriodEnd flag', async () => {
      const ctx = createManagerContext()
      const planId = 'plan-456'

      const now = new Date()
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 30)

      const subscriptionData = {
        id: 'sub-123',
        organizationId: ctx.organizationId,
        planId,
        status: 'canceled' as const,
        athleteCount: 5,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        createdAt: now,
      }

      const subscription = reconstituteSubscription(subscriptionData)

      const plan = createPlan({ id: planId })

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const fetchResult = await getSubscription(ctx)

      expect(fetchResult.isOk()).toBe(true)

      if (fetchResult.isOk()) {
        expect(fetchResult.value.subscription.status).toBe('canceled')
      }
    })

    it('[4.5-UNIT-002] @p3 should handle subscription near period end', async () => {
      const ctx = createManagerContext()
      const planId = 'plan-456'

      const now = new Date()
      const periodEnd = new Date()
      periodEnd.setHours(periodEnd.getHours() + 2) // 2 hours until renewal

      const subscriptionData = {
        id: 'sub-123',
        organizationId: ctx.organizationId,
        planId,
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        // Active subscription
        createdAt: now,
        updatedAt: now,
      }

      const subscription = reconstituteSubscription(subscriptionData)

      const plan = createPlan({ id: planId })

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const getSubscription = makeGetSubscription({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const fetchResult = await getSubscription(ctx)

      expect(fetchResult.isOk()).toBe(true)

      if (fetchResult.isOk()) {
        expect(fetchResult.value.subscription.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now())
      }
    })
  })
})
