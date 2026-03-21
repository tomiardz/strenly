import type { ResultAsync } from 'neverthrow'
import type { Program, ProgramStatus, Series } from '../domain/entities/program/types'
import type { OrganizationContext } from '../types/organization-context'
import type { RepositoryError } from './types'

// ============================================================================
// Error Types
// ============================================================================

export type ProgramRepositoryError =
  | {
      type: 'NOT_FOUND'
      entityType: 'program' | 'week' | 'session' | 'exercise_row' | 'prescription' | 'group'
      id: string
    }
  | RepositoryError

// ============================================================================
// Filter Types
// ============================================================================

export type ProgramFilters = {
  status?: ProgramStatus
  athleteId?: string | null // null = templates only, string = athlete programs, undefined = all
  isTemplate?: boolean
  search?: string
  limit: number
  offset: number
}

// ============================================================================
// Nested Entity Types (for grid operations)
// ============================================================================

export type ProgramWeek = {
  readonly id: string
  readonly programId: string
  readonly name: string
  readonly orderIndex: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type ProgramSession = {
  readonly id: string
  readonly programId: string
  readonly name: string
  readonly orderIndex: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type ProgramExerciseRow = {
  readonly id: string
  readonly sessionId: string
  readonly exerciseId: string
  readonly orderIndex: number
  // Group-based fields
  readonly groupId: string | null
  readonly orderWithinGroup: number | null
  // Other fields
  readonly setTypeLabel: string | null
  readonly notes: string | null
  readonly restSeconds: number | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Exercise group data (for grid operations)
 */
export type ExerciseGroupData = {
  readonly id: string
  readonly sessionId: string
  readonly orderIndex: number
  readonly name: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Prescription series data (individual set within a prescription)
 */
export type PrescriptionSeriesData = {
  readonly orderIndex: number
  readonly reps: number | null
  readonly repsMax: number | null
  readonly isAmrap: boolean
  readonly intensityType: 'absolute' | 'percentage' | 'rpe' | 'rir' | null
  readonly intensityValue: number | null
  readonly intensityUnit: 'kg' | 'lb' | '%' | 'rpe' | 'rir' | null
  readonly tempo: string | null
  readonly restSeconds: number | null
}

/**
 * Input for saveDraft bulk save operation
 */
export type SaveDraftInput = {
  readonly programId: string
  // Existing changes
  readonly prescriptionUpdates?: ReadonlyArray<{
    readonly exerciseRowId: string
    readonly weekId: string
    readonly series: PrescriptionSeriesData[]
  }>
  readonly exerciseRowUpdates?: ReadonlyArray<{
    readonly rowId: string
    readonly exerciseId?: string
    readonly groupId?: string | null
    readonly orderWithinGroup?: number | null
  }>
  readonly groupUpdates?: ReadonlyArray<{
    readonly groupId: string
    readonly name?: string | null
    readonly orderIndex?: number
  }>
  // Structural changes (new entities)
  readonly newWeeks?: ReadonlyArray<{
    readonly tempId: string
    readonly name: string
    readonly orderIndex: number
  }>
  readonly newSessions?: ReadonlyArray<{
    readonly tempId: string
    readonly name: string
    readonly orderIndex: number
  }>
  readonly newExerciseRows?: ReadonlyArray<{
    readonly tempId: string
    readonly sessionId: string // May be tempId
    readonly exerciseId: string
    readonly orderIndex: number
  }>
}

export type PrescriptionCell = {
  readonly id: string
  readonly programExerciseId: string
  readonly weekId: string
  readonly series: Series[]
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ============================================================================
// Composite Types (for full grid view)
// ============================================================================

/**
 * Exercise row with series keyed by week ID
 */
export type ExerciseRowWithPrescriptions = ProgramExerciseRow & {
  readonly exerciseName: string // Joined from exercises table
  readonly prescriptionsByWeekId: Record<string, Series[]>
}

/**
 * Session with exercise rows and exercise groups
 */
export type SessionWithRows = ProgramSession & {
  readonly rows: ExerciseRowWithPrescriptions[]
  readonly exerciseGroups?: ExerciseGroupData[]
}

/**
 * Full program with all nested data for grid view
 * @deprecated Use loadProgramAggregate which returns a full Program instead
 */
export type ProgramWithDetails = Omit<Program, 'weeks'> & {
  readonly weeks: ProgramWeek[]
  readonly sessions: SessionWithRows[]
}

// ============================================================================
// Repository Port
// ============================================================================

export type ProgramRepositoryPort = {
  // ---------------------------------------------------------------------------
  // Aggregate Operations (NEW - Primary Interface)
  // ---------------------------------------------------------------------------

  /**
   * Load a complete program aggregate with full hierarchy
   * Used for editing - returns Program with weeks/sessions/groups/items/series
   */
  loadProgramAggregate(ctx: OrganizationContext, programId: string): ResultAsync<Program | null, ProgramRepositoryError>

  /**
   * Save a complete program aggregate (replace-on-save)
   * Deletes all children and re-inserts the entire hierarchy atomically
   * Used after client edits to persist the complete state
   */
  saveProgramAggregate(
    ctx: OrganizationContext,
    program: Program,
  ): ResultAsync<{ updatedAt: Date }, ProgramRepositoryError>

  // ---------------------------------------------------------------------------
  // Program CRUD (Legacy)
  // ---------------------------------------------------------------------------

  /**
   * Find a program by ID (without nested hierarchy)
   * @deprecated Use loadProgramAggregate for new implementations
   * TODO: Migrate archive-program and update-program use cases to use loadProgramAggregate + saveProgramAggregate
   */
  findById(ctx: OrganizationContext, id: string): ResultAsync<Program | null, ProgramRepositoryError>

  /**
   * Update a program
   * @deprecated Use saveProgramAggregate for new implementations
   * TODO: Migrate archive-program and update-program use cases to use saveProgramAggregate
   */
  update(ctx: OrganizationContext, program: Program): ResultAsync<Program, ProgramRepositoryError>

  /**
   * List programs with optional filters
   * @deprecated Use loadProgramAggregate for individual programs
   * TODO: Migrate list-programs use case to a dedicated list query or aggregate approach
   */
  list(
    ctx: OrganizationContext,
    filters: ProgramFilters,
  ): ResultAsync<{ items: Program[]; totalCount: number }, ProgramRepositoryError>

  /**
   * Get full program with nested data for grid view
   * @deprecated Use loadProgramAggregate which returns a full ProgramAggregate instead
   * TODO: Migrate add-week, add-session, duplicate-week, delete-session, delete-week use cases
   */
  findWithDetails(ctx: OrganizationContext, id: string): ResultAsync<ProgramWithDetails | null, ProgramRepositoryError>

  // ---------------------------------------------------------------------------
  // Week Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a week (column) for a program
   */
  createWeek(
    ctx: OrganizationContext,
    programId: string,
    week: Omit<ProgramWeek, 'programId'>,
  ): ResultAsync<ProgramWeek, ProgramRepositoryError>

  /**
   * Find a week by ID
   */
  findWeekById(ctx: OrganizationContext, weekId: string): ResultAsync<ProgramWeek | null, ProgramRepositoryError>

  /**
   * Update a week
   */
  updateWeek(ctx: OrganizationContext, week: ProgramWeek): ResultAsync<ProgramWeek, ProgramRepositoryError>

  /**
   * Delete a week (cascades to prescriptions)
   */
  deleteWeek(ctx: OrganizationContext, weekId: string): ResultAsync<void, ProgramRepositoryError>

  // ---------------------------------------------------------------------------
  // Session Operations
  // ---------------------------------------------------------------------------

  /**
   * Find a session by ID
   */
  findSessionById(
    ctx: OrganizationContext,
    sessionId: string,
  ): ResultAsync<ProgramSession | null, ProgramRepositoryError>

  /**
   * Create a session (training day) for a program
   */
  createSession(
    ctx: OrganizationContext,
    programId: string,
    session: Omit<ProgramSession, 'programId'>,
  ): ResultAsync<ProgramSession, ProgramRepositoryError>

  /**
   * Update a session
   */
  updateSession(ctx: OrganizationContext, session: ProgramSession): ResultAsync<ProgramSession, ProgramRepositoryError>

  /**
   * Delete a session (cascades to exercise rows and prescriptions)
   */
  deleteSession(ctx: OrganizationContext, sessionId: string): ResultAsync<void, ProgramRepositoryError>

  // ---------------------------------------------------------------------------
  // Exercise Group Operations
  // ---------------------------------------------------------------------------

  /**
   * Create an exercise group for a session
   */
  createGroup(
    ctx: OrganizationContext,
    sessionId: string,
    name?: string | null,
  ): ResultAsync<ExerciseGroupData, ProgramRepositoryError>

  /**
   * Update an exercise group
   */
  updateGroup(
    ctx: OrganizationContext,
    groupId: string,
    updates: { name?: string | null; orderIndex?: number },
  ): ResultAsync<void, ProgramRepositoryError>

  /**
   * Delete an exercise group (exercises will cascade)
   */
  deleteGroup(ctx: OrganizationContext, groupId: string): ResultAsync<void, ProgramRepositoryError>

  /**
   * Get the maximum order index for groups in a session
   * Returns -1 if no groups exist
   */
  getMaxGroupOrderIndex(ctx: OrganizationContext, sessionId: string): ResultAsync<number, ProgramRepositoryError>

  // ---------------------------------------------------------------------------
  // Exercise Row Operations
  // ---------------------------------------------------------------------------

  /**
   * Find an exercise row by ID
   */
  findExerciseRowById(
    ctx: OrganizationContext,
    rowId: string,
  ): ResultAsync<ProgramExerciseRow | null, ProgramRepositoryError>

  /**
   * Get the maximum order index for exercise rows in a session
   * Returns -1 if no rows exist
   */
  getMaxExerciseRowOrderIndex(ctx: OrganizationContext, sessionId: string): ResultAsync<number, ProgramRepositoryError>

  /**
   * Create an exercise row for a session
   */
  createExerciseRow(
    ctx: OrganizationContext,
    sessionId: string,
    row: Omit<ProgramExerciseRow, 'sessionId'>,
  ): ResultAsync<ProgramExerciseRow, ProgramRepositoryError>

  /**
   * Update an exercise row
   */
  updateExerciseRow(
    ctx: OrganizationContext,
    row: ProgramExerciseRow,
  ): ResultAsync<ProgramExerciseRow, ProgramRepositoryError>

  /**
   * Delete an exercise row (cascades to prescriptions)
   */
  deleteExerciseRow(ctx: OrganizationContext, rowId: string): ResultAsync<void, ProgramRepositoryError>

  // ---------------------------------------------------------------------------
  // Prescription Operations (Cell Values)
  // ---------------------------------------------------------------------------

  /**
   * Create or update a prescription for a specific cell (exercise row + week)
   * Pass null series to delete the cell value
   */
  upsertPrescription(
    ctx: OrganizationContext,
    exerciseRowId: string,
    weekId: string,
    series: Series[] | null,
  ): ResultAsync<void, ProgramRepositoryError>

  /**
   * Update prescription with series array
   * Replaces the series array for a specific cell
   */
  updatePrescriptionSeries(
    ctx: OrganizationContext,
    exerciseRowId: string,
    weekId: string,
    series: PrescriptionSeriesData[],
  ): ResultAsync<void, ProgramRepositoryError>

  // ---------------------------------------------------------------------------
  // Bulk Operations
  // ---------------------------------------------------------------------------

  /**
   * Save draft changes atomically (bulk save operation)
   * Updates prescriptions, exercise rows, and groups in a single transaction
   */
  saveDraft(ctx: OrganizationContext, input: SaveDraftInput): ResultAsync<{ updatedAt: Date }, ProgramRepositoryError>

  /**
   * Reorder exercise rows within a session
   */
  reorderExerciseRows(
    ctx: OrganizationContext,
    sessionId: string,
    rowIds: string[],
  ): ResultAsync<void, ProgramRepositoryError>

  /**
   * Duplicate a week with all prescriptions
   */
  duplicateWeek(
    ctx: OrganizationContext,
    weekId: string,
    newName: string,
  ): ResultAsync<ProgramWeek, ProgramRepositoryError>

  /**
   * Reposition a row to the end of a session.
   * Used when removing a row from a superset to prevent it staying between group members.
   */
  repositionRowToEndOfSession(
    ctx: OrganizationContext,
    sessionId: string,
    rowId: string,
  ): ResultAsync<void, ProgramRepositoryError>

  /**
   * Find all exercise rows for a session.
   * Used for validating reorder operations.
   */
  findExerciseRowsBySessionId(
    ctx: OrganizationContext,
    sessionId: string,
  ): ResultAsync<ProgramExerciseRow[], ProgramRepositoryError>

  /**
   * Count programs grouped by status for the organization.
   */
  countByStatus(
    ctx: OrganizationContext,
  ): ResultAsync<{ draft: number; active: number; archived: number }, ProgramRepositoryError>
}
