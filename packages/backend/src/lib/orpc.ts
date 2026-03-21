import { os } from '@orpc/server'
import type { AuthContext, BaseContext, SessionContext } from './context'
import { authErrors, commonErrors } from './errors'
import { parseRoles } from './roles'

/**
 * Public procedure - No authentication required
 * Used for: health checks, public plan listing, etc.
 */
export const publicProcedure = os.$context<BaseContext>().errors(commonErrors)

/**
 * Session procedure - User authenticated, no organization context
 * Used for: onboarding, organization selection, creating organizations
 */
export const sessionProcedure = os
  .$context<BaseContext>()
  .errors({ ...commonErrors, ...authErrors })
  .use(async ({ context, next, errors }) => {
    const session = await context.auth.api.getSession({
      headers: context.headers,
    })
    if (!session?.user) {
      throw errors.UNAUTHORIZED()
    }
    // Explicitly map user fields to avoid leaking Better-Auth implementation details
    const user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? undefined,
    }
    return next({
      context: {
        ...context,
        user,
        session: session.session,
      } satisfies SessionContext,
    })
  })

/**
 * Auth procedure - User authenticated + organization context
 * Used for: most endpoints requiring organization membership
 *
 * Validates:
 * 1. User has valid session
 * 2. X-Organization-Slug header is present
 * 3. Organization exists and user is a member
 * 4. Role is valid (owner, admin, or member)
 */
export const authProcedure = os
  .$context<BaseContext>()
  .errors({ ...commonErrors, ...authErrors })
  .use(async ({ context, next, errors }) => {
    // 1. Validate session
    const session = await context.auth.api.getSession({
      headers: context.headers,
    })
    if (!session?.user) {
      throw errors.UNAUTHORIZED()
    }

    // 2. Get organization slug from header
    const orgSlug = context.headers.get('X-Organization-Slug')
    if (!orgSlug) {
      throw errors.ORG_NOT_FOUND()
    }

    // 3. Find organization and validate membership using Better-Auth's organization plugin
    // getFullOrganization returns the org with members array if user has access
    const org = await context.auth.api.getFullOrganization({
      headers: context.headers,
      query: { organizationSlug: orgSlug },
    })

    if (!org) {
      throw errors.ORG_NOT_FOUND()
    }

    // Find user's membership in this organization
    const membership = org.members.find((m) => m.userId === session.user.id)
    if (!membership) {
      throw errors.NOT_A_MEMBER()
    }

    // Explicitly map user fields to avoid leaking Better-Auth implementation details
    const user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? undefined,
    }
    return next({
      context: {
        ...context,
        user,
        session: session.session,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
        membership: {
          id: membership.id,
          roles: parseRoles(membership.role),
        },
      } satisfies AuthContext,
    })
  })
