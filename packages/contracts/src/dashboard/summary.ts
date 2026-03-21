/**
 * Dashboard Summary API Schemas
 *
 * Output schemas for the dashboard summary endpoint that returns
 * aggregated stats and recent activity.
 */

import { z } from 'zod'

// ============================================================================
// Recent Activity Entry
// ============================================================================

/**
 * A single recent workout log activity entry for the dashboard feed.
 */
export const recentActivitySchema = z.object({
  id: z.string(),
  athleteName: z.string().nullable(),
  sessionName: z.string().nullable(),
  programName: z.string().nullable(),
  logDate: z.string(), // ISO date string
  status: z.enum(['completed', 'partial', 'skipped']),
})

export type RecentActivity = z.infer<typeof recentActivitySchema>

// ============================================================================
// Dashboard Summary Output
// ============================================================================

/**
 * Aggregated dashboard summary with athlete counts, program status distribution,
 * sessions completed this week, and recent workout log activity.
 */
export const dashboardSummaryOutputSchema = z.object({
  totalAthletes: z.number().int().min(0),
  activeAthletes: z.number().int().min(0),
  programsByStatus: z.object({
    draft: z.number(),
    active: z.number(),
    archived: z.number(),
  }),
  sessionsCompletedThisWeek: z.number().int().min(0),
  recentActivity: z.array(recentActivitySchema),
})

export type DashboardSummaryOutput = z.infer<typeof dashboardSummaryOutputSchema>
