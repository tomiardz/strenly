import type { TAuth } from '@strenly/auth'
import type { OrganizationRole } from '@strenly/core/services/authorization'
import type { DbClient } from '@strenly/database'

/**
 * Base context provided to all procedures
 * Contains database, auth, request headers, and environment config
 */
export type BaseContext = {
  db: DbClient
  auth: TAuth
  headers: Headers
  appUrl: string
}

/**
 * Context with authenticated user session
 * Used for endpoints requiring login but no organization context
 */
export type SessionContext = BaseContext & {
  user: { id: string; name: string; email: string; image?: string }
  session: { id: string; expiresAt: Date }
}

/**
 * Context with authenticated user and organization
 * Used for most endpoints requiring organization membership
 */
export type AuthContext = SessionContext & {
  organization: { id: string; name: string; slug: string }
  membership: { id: string; roles: OrganizationRole[] }
}
