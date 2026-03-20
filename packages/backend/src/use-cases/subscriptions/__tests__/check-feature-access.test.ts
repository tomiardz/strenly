import type { PlanRepositoryPort } from '@strenly/core/ports/plan-repository.port'
import type { SubscriptionRepositoryPort } from '@strenly/core/ports/subscription-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoachContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeCheckFeatureAccess } from '../check-feature-access'

describe('checkFeatureAccess use case', () => {
  let mockSubscriptionRepository: SubscriptionRepositoryPort
  let mockPlanRepository: PlanRepositoryPort
  const orgId = 'org-123'

  beforeEach(() => {
    mockSubscriptionRepository = {
      create: vi.fn(),
      findByOrganizationId: vi.fn(),
      save: vi.fn(),
      updateAthleteCount: vi.fn(),
    } as unknown as SubscriptionRepositoryPort
    mockPlanRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findBySlug: vi.fn(),
    }
  })

  describe('Happy Path', () => {
    it('[4.1-UNIT-001] @p0 should return true when feature is available in plan', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'plan-456',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      const plan = {
        id: 'plan-456',
        name: 'Pro Plan',
        slug: 'pro-plan',
        organizationType: 'coach_solo' as const,
        athleteLimit: 50,
        coachLimit: 1,
        features: {
          templates: true,
          analytics: true,
          exportData: false,
          customExercises: true,
          multipleCoaches: false,
        },
        priceMonthly: 2900,
        priceYearly: 29000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'templates',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value).toBe(true)
      }
    })

    it('[4.1-UNIT-002] @p0 should work for different features', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'plan-456',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      const plan = {
        id: 'plan-456',
        name: 'Pro Plan',
        slug: 'pro-plan',
        organizationType: 'coach_solo' as const,
        athleteLimit: 50,
        coachLimit: 1,
        features: {
          templates: true,
          analytics: true,
          exportData: false,
          customExercises: true,
          multipleCoaches: false,
        },
        priceMonthly: 2900,
        priceYearly: 29000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      // Check analytics feature
      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'analytics',
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value).toBe(true)
      }
    })
  })

  describe('Authorization', () => {
    it('[4.2-UNIT-001] @p0 should allow viewer role to check features', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'plan-456',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      const plan = {
        id: 'plan-456',
        name: 'Basic Plan',
        slug: 'basic',
        organizationType: 'coach_solo' as const,
        athleteLimit: 10,
        coachLimit: 1,
        features: {
          templates: true,
          analytics: false,
          exportData: false,
          customExercises: true,
          multipleCoaches: false,
        },
        priceMonthly: 2900,
        priceYearly: 29000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const ctx = createCoachContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'templates',
      })

      expect(result.isOk()).toBe(true)
    })
  })

  describe('Not Found Errors', () => {
    it('[4.3-UNIT-001] @p0 should return subscription_not_found when organization has no subscription', async () => {
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'templates',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('subscription_not_found')
        if (result.error.type === 'subscription_not_found') {
          expect(result.error.organizationId).toBe(orgId)
        }
      }

      // Plan lookup should not be called
      expect(mockPlanRepository.findById).not.toHaveBeenCalled()
    })

    it('[4.3-UNIT-002] @p1 should return plan_not_found when plan does not exist', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'non-existent-plan',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'templates',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('plan_not_found')
        if (result.error.type === 'plan_not_found') {
          expect(result.error.planId).toBe('non-existent-plan')
        }
      }
    })
  })

  describe('Feature Not Available', () => {
    it('[4.4-UNIT-001] @p0 should return feature_not_available when feature is disabled in plan', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'plan-456',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      const plan = {
        id: 'plan-456',
        name: 'Basic Plan',
        slug: 'basic',
        organizationType: 'coach_solo' as const,
        athleteLimit: 10,
        coachLimit: 1,
        features: {
          templates: true,
          analytics: false,
          exportData: false,
          customExercises: true,
          multipleCoaches: false,
        },
        priceMonthly: 2900,
        priceYearly: 29000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'exportData',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('feature_not_available')
        if (result.error.type === 'feature_not_available') {
          expect(result.error.feature).toBe('exportData')
        }
      }
    })

    it('[4.4-UNIT-002] @p1 should return feature_not_available for analytics on basic plan', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'plan-456',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      const plan = {
        id: 'plan-456',
        name: 'Basic Plan',
        slug: 'basic',
        organizationType: 'coach_solo' as const,
        athleteLimit: 10,
        coachLimit: 1,
        features: {
          templates: true,
          analytics: false,
          exportData: false,
          customExercises: true,
          multipleCoaches: false,
        },
        priceMonthly: 2900,
        priceYearly: 29000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'analytics',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('feature_not_available')
      }
    })
  })

  describe('Repository Errors', () => {
    it('[4.5-UNIT-001] @p1 should return repository error when subscription lookup fails', async () => {
      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'templates',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[4.5-UNIT-002] @p1 should return repository error when plan lookup fails', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'plan-456',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query timeout',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      const result = await checkFeatureAccess({
        ...ctx,
        feature: 'templates',
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })
  })

  describe('Edge Cases', () => {
    it('[4.6-UNIT-001] @p2 should handle checking multiple features for same organization', async () => {
      const subscription = {
        id: 'sub-123',
        organizationId: orgId,
        planId: 'plan-456',
        status: 'active' as const,
        athleteCount: 5,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
      }

      const plan = {
        id: 'plan-456',
        name: 'Pro Plan',
        slug: 'pro-plan',
        organizationType: 'coach_solo' as const,
        athleteLimit: 50,
        coachLimit: 1,
        features: {
          templates: true,
          analytics: true,
          exportData: false,
          customExercises: true,
          multipleCoaches: false,
        },
        priceMonthly: 2900,
        priceYearly: 29000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockSubscriptionRepository.findByOrganizationId).mockReturnValue(okAsync(subscription))
      vi.mocked(mockPlanRepository.findById).mockReturnValue(okAsync(plan))

      const ctx = createTestContext({ organizationId: orgId })
      const checkFeatureAccess = makeCheckFeatureAccess({
        subscriptionRepository: mockSubscriptionRepository,
        planRepository: mockPlanRepository,
      })

      // Check multiple features
      const result1 = await checkFeatureAccess({ ...ctx, feature: 'templates' })
      expect(result1.isOk()).toBe(true)

      const result2 = await checkFeatureAccess({ ...ctx, feature: 'analytics' })
      expect(result2.isOk()).toBe(true)

      const result3 = await checkFeatureAccess({ ...ctx, feature: 'exportData' })
      expect(result3.isErr()).toBe(true)
    })
  })
})
