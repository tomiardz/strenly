import { athletes } from './athletes'
import { dashboard } from './dashboard'
import { exercises } from './exercises'
import { health } from './health/health'
import { programs } from './programs'
import { subscriptions } from './subscriptions'
import { workoutLogs } from './workout-logs'

/**
 * Main oRPC router
 * Aggregates all procedure groups for the API
 *
 * Auth and organization endpoints are handled directly by Better-Auth at /api/auth/*
 * Only custom business logic procedures (subscriptions, etc.) go through oRPC.
 *
 * In oRPC, a router is a plain object with procedures.
 * The RPCHandler handles routing based on the object keys.
 */
export const router = {
  athletes,
  dashboard,
  exercises,
  health,
  programs,
  subscriptions,
  workoutLogs,
}

export type Router = typeof router
