import type { ResultAsync } from 'neverthrow'
import type { Athlete, AthleteStatus } from '../domain/entities/athlete'
import type { OrganizationContext } from '../types/organization-context'
import type { RepositoryError } from './types'

export type AthleteRepositoryError = { type: 'NOT_FOUND'; athleteId: string } | RepositoryError

export type ListAthletesOptions = {
  status?: AthleteStatus
  search?: string
  limit: number
  offset: number
}

export type AthleteRepositoryPort = {
  /**
   * Find an athlete by ID within the organization.
   */
  findById(ctx: OrganizationContext, id: string): ResultAsync<Athlete | null, AthleteRepositoryError>

  /**
   * Find all athletes in the organization with optional filtering.
   */
  findAll(
    ctx: OrganizationContext,
    options: ListAthletesOptions,
  ): ResultAsync<{ items: Athlete[]; totalCount: number }, AthleteRepositoryError>

  /**
   * Find an athlete by their linked user ID (for athlete self-lookup).
   */
  findByLinkedUserId(ctx: OrganizationContext, userId: string): ResultAsync<Athlete | null, AthleteRepositoryError>

  /**
   * Create a new athlete in the organization.
   */
  create(ctx: OrganizationContext, athlete: Athlete): ResultAsync<Athlete, AthleteRepositoryError>

  /**
   * Update an existing athlete.
   */
  update(ctx: OrganizationContext, athlete: Athlete): ResultAsync<Athlete, AthleteRepositoryError>

  /**
   * Archive an athlete (soft delete).
   */
  archive(ctx: OrganizationContext, id: string): ResultAsync<void, AthleteRepositoryError>

  /**
   * Count athletes in the organization with optional status filter.
   */
  count(
    ctx: OrganizationContext,
    options?: { status?: AthleteStatus },
  ): ResultAsync<number, AthleteRepositoryError>
}
