import type { Plan } from '@strenly/core/domain/entities/plan'
import type { Subscription } from '@strenly/core/domain/entities/subscription'
import type { PlanRepositoryPort } from '@strenly/core/ports/plan-repository.port'
import type { SubscriptionRepositoryPort } from '@strenly/core/ports/subscription-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GetSubscriptionInput = OrganizationContext

export type GetSubscriptionResult = {
  subscription: Subscription
  plan: Plan
}

export type GetSubscriptionError =
  | { type: 'forbidden'; message: string }
  | { type: 'subscription_not_found'; organizationId: string }
  | { type: 'plan_not_found'; planId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  subscriptionRepository: SubscriptionRepositoryPort
  planRepository: PlanRepositoryPort
}

export const makeGetSubscription =
  (deps: Dependencies) =>
  (input: GetSubscriptionInput): ResultAsync<GetSubscriptionResult, GetSubscriptionError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'billing:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to view subscription',
      })
    }

    // 2. Get subscription
    return deps.subscriptionRepository
      .findByOrganizationId(input)
      .mapErr((): GetSubscriptionError => ({ type: 'repository_error', message: 'Failed to fetch subscription' }))
      .andThen((subscription) => {
        if (subscription === null) {
          return errAsync<GetSubscriptionResult, GetSubscriptionError>({
            type: 'subscription_not_found',
            organizationId: input.organizationId,
          })
        }

        // 3. Get plan
        return deps.planRepository
          .findById(subscription.planId)
          .mapErr((e): GetSubscriptionError => ({ type: 'repository_error', message: e.message }))
          .andThen((plan) => {
            // Check if plan was found
            if (plan === null) {
              return errAsync<GetSubscriptionResult, GetSubscriptionError>({
                type: 'plan_not_found',
                planId: subscription.planId,
              })
            }
            return okAsync({ subscription, plan })
          })
      })
  }
