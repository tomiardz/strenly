import type { PlanFeatures } from '@strenly/core/domain/entities/plan'
import { hasFeature } from '@strenly/core/domain/entities/plan'
import type { PlanRepositoryPort } from '@strenly/core/ports/plan-repository.port'
import type { SubscriptionRepositoryPort } from '@strenly/core/ports/subscription-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type CheckFeatureAccessInput = OrganizationContext & {
  feature: keyof PlanFeatures
}

export type CheckFeatureAccessError =
  | { type: 'forbidden'; message: string }
  | { type: 'subscription_not_found'; organizationId: string }
  | { type: 'plan_not_found'; planId: string }
  | { type: 'feature_not_available'; feature: keyof PlanFeatures }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  subscriptionRepository: SubscriptionRepositoryPort
  planRepository: PlanRepositoryPort
}

export const makeCheckFeatureAccess =
  (deps: Dependencies) =>
  (input: CheckFeatureAccessInput): ResultAsync<boolean, CheckFeatureAccessError> => {
    // 1. Authorization FIRST (read permission sufficient for checking access)
    if (!hasPermission(input.roles, 'organization:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to check feature access',
      })
    }

    // 2. Get subscription
    return deps.subscriptionRepository
      .findByOrganizationId(input)
      .mapErr((): CheckFeatureAccessError => ({ type: 'repository_error', message: 'Failed to fetch subscription' }))
      .andThen((subscription) => {
        if (subscription === null) {
          return errAsync<boolean, CheckFeatureAccessError>({
            type: 'subscription_not_found',
            organizationId: input.organizationId,
          })
        }

        // 3. Get plan
        return deps.planRepository
          .findById(subscription.planId)
          .mapErr((e): CheckFeatureAccessError => ({ type: 'repository_error', message: e.message }))
          .andThen((plan) => {
            // Check if plan was found
            if (plan === null) {
              return errAsync<boolean, CheckFeatureAccessError>({
                type: 'plan_not_found',
                planId: subscription.planId,
              })
            }

            // 4. Use domain helper
            if (!hasFeature(plan, input.feature)) {
              return errAsync<boolean, CheckFeatureAccessError>({
                type: 'feature_not_available',
                feature: input.feature,
              })
            }
            return okAsync(true)
          })
      })
  }
