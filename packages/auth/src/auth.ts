/**
 * Better-Auth configuration for Railway
 * Factory function that creates Better Auth instances on-demand
 */

import * as schema from '@strenly/database/schemas'
import { betterAuth } from 'better-auth'
import { type DB, drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'

/**
 * Environment bindings required for Better Auth
 * These come from environment variables (Workers or Node.js)
 */
export type AuthEnv = {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  ENVIRONMENT?: 'development' | 'production' | 'test'
}

/**
 * Creates a Better Auth instance with proper Railway configuration
 *
 * This factory function accepts environment bindings and a database client,
 * allowing proper initialization in serverless/edge environments where
 * environment variables are provided per-request via Railway.
 *
 * @param env - Environment bindings from Railway
 * @param db - Database client instance
 * @returns Configured Better Auth instance
 */
export function createAuth(env: AuthEnv, db: DB) {
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET environment variable is required. Generate with: openssl rand -base64 32')
  }

  if (!env.BETTER_AUTH_URL) {
    throw new Error('BETTER_AUTH_URL environment variable is required')
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
      usePlural: true, // Tables are plural (users, sessions, etc.)
    }),
    baseURL: env.BETTER_AUTH_URL, // CRITICAL: prevents redirect_uri_mismatch
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Consider paid tier or Email OTP alternative
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: 'select_account', // Always show account picker
            },
          }
        : undefined,
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes - reduces DB queries
      },
    },
    trustedOrigins: [
      'http://localhost:5173', // Coach Web (Vite dev server)
      'http://localhost:5174', // Athlete PWA (Vite dev server)
      ...(env.ENVIRONMENT === 'production'
        ? [
            'https://www.strenly.com.ar',
            'https://app.strenly.com.ar',
            'https://athlete.strenly.com.ar',
            'https://api.strenly.com.ar',
          ]
        : []),
    ],
    advanced: {
      cookiePrefix: 'strenly',
      useSecureCookies: env.ENVIRONMENT === 'production',
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: async () => true,
        creatorRole: 'owner',
        membershipLimit: 100,
        // Custom roles: owner, manager, coach, athlete — stored as-is by Better-Auth
        // Subscription creation handled by oRPC createSubscription procedure after org creation
        // No sendInvitationEmail configured — invitation links are shared manually via the UI
      }),
    ],
  })
}

/**
 * Type for the auth instance returned by createAuth
 */
export type TAuth = ReturnType<typeof createAuth>

/**
 * Auth session types for use in procedures
 */
export type AuthType = {
  user: TAuth['$Infer']['Session']['user']
  session: TAuth['$Infer']['Session']['session']
}
