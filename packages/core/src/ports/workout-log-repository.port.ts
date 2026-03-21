import type { ResultAsync } from 'neverthrow'
import type { WorkoutLog } from '../domain/entities/workout-log/types'
import type { OrganizationContext } from '../types/organization-context'
import type { RepositoryError } from './types'

// ============================================================================
// Error Types
// ============================================================================

export type WorkoutLogRepositoryError =
  | { type: 'NOT_FOUND'; message: string }
  | { type: 'CONFLICT'; message: string } // Duplicate log for session/week
  | RepositoryError

// ============================================================================
// Filter Types
// ============================================================================

export type WorkoutLogFilters = {
  athleteId?: string
  programId?: string
  status?: 'completed' | 'partial' | 'skipped'
  fromDate?: Date
  toDate?: Date
  limit: number
  offset: number
}

// ============================================================================
// Recent Activity Entry (for dashboard)
// ============================================================================

export type RecentActivityEntry = {
  id: string
  athleteName: string | null
  sessionName: string | null
  programName: string | null
  logDate: Date
  status: 'completed' | 'partial' | 'skipped'
}

// ============================================================================
// Pending Workout (for dashboard)
// ============================================================================

export type PendingWorkout = {
  athleteId: string
  athleteName: string
  programId: string
  programName: string
  sessionId: string
  sessionName: string
  weekId: string
  weekName: string
}

// ============================================================================
// Repository Port
// ============================================================================

export type WorkoutLogRepositoryPort = {
  /**
   * Save a workout log (insert or replace)
   * Uses DELETE + INSERT for simplicity (same as program aggregate pattern)
   */
  save(ctx: OrganizationContext, log: WorkoutLog): ResultAsync<void, WorkoutLogRepositoryError>

  /**
   * Find a workout log by ID
   * Returns full aggregate with exercises and series
   */
  findById(ctx: OrganizationContext, logId: string): ResultAsync<WorkoutLog | null, WorkoutLogRepositoryError>

  /**
   * Find log by athlete + session + week combination
   * Used to check if log already exists before creating
   */
  findByAthleteSessionWeek(
    ctx: OrganizationContext,
    athleteId: string,
    sessionId: string,
    weekId: string,
  ): ResultAsync<WorkoutLog | null, WorkoutLogRepositoryError>

  /**
   * List logs for an athlete with pagination
   * Returns items sorted by logDate descending (most recent first)
   */
  listByAthlete(
    ctx: OrganizationContext,
    athleteId: string,
    filters: Omit<WorkoutLogFilters, 'athleteId'>,
  ): ResultAsync<{ items: WorkoutLog[]; totalCount: number }, WorkoutLogRepositoryError>

  /**
   * List pending workouts for all athletes in organization
   * Returns sessions that have no log yet for current week
   * Used for logging dashboard
   */
  listPendingWorkouts(
    ctx: OrganizationContext,
    filters: { limit: number; offset: number },
  ): ResultAsync<{ items: PendingWorkout[]; totalCount: number }, WorkoutLogRepositoryError>

  /**
   * Delete a workout log by ID
   * Cascades to logged_exercises
   */
  delete(ctx: OrganizationContext, logId: string): ResultAsync<void, WorkoutLogRepositoryError>

  /**
   * Count workout logs with status 'completed' or 'partial' since the given date.
   */
  countCompletedSince(
    ctx: OrganizationContext,
    since: Date,
  ): ResultAsync<number, WorkoutLogRepositoryError>

  /**
   * List the N most recent workout logs with denormalized display fields.
   * Returns entries sorted by logDate descending.
   */
  listRecent(
    ctx: OrganizationContext,
    limit: number,
  ): ResultAsync<RecentActivityEntry[], WorkoutLogRepositoryError>
}
