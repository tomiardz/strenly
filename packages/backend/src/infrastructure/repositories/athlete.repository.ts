import type { Athlete, AthleteGender, AthleteStatus } from '@strenly/core/domain/entities/athlete'
import { reconstituteAthlete } from '@strenly/core/domain/entities/athlete'
import type {
  AthleteRepositoryError,
  AthleteRepositoryPort,
  ListAthletesOptions,
} from '@strenly/core/ports/athlete-repository.port'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import type { DbClient } from '@strenly/database'
import { athletes } from '@strenly/database/schema'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { err, ok, ResultAsync as RA, type ResultAsync } from 'neverthrow'

function wrapDbError(error: unknown): AthleteRepositoryError {
  return {
    type: 'DATABASE_ERROR',
    message: error instanceof Error ? error.message : 'Database operation failed',
    cause: error,
  }
}

/**
 * Type guard for valid athlete status values
 */
function isAthleteStatus(value: string): value is AthleteStatus {
  return value === 'active' || value === 'inactive'
}

/**
 * Type guard for valid athlete gender values
 */
function isAthleteGender(value: string): value is AthleteGender {
  return value === 'male' || value === 'female' || value === 'other'
}

/**
 * Safely parse athlete status from database
 */
function parseStatus(value: string): AthleteStatus {
  return isAthleteStatus(value) ? value : 'active'
}

/**
 * Safely parse athlete gender from database
 */
function parseGender(value: string | null): AthleteGender | null {
  if (value === null) return null
  return isAthleteGender(value) ? value : null
}

/**
 * Maps a database row to an Athlete domain entity.
 * Uses reconstitute since DB data is already validated.
 */
function mapToDomain(row: typeof athletes.$inferSelect): Athlete {
  const birthdate = row.birthdate ? new Date(row.birthdate) : null

  return reconstituteAthlete({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    birthdate,
    gender: parseGender(row.gender),
    notes: row.notes,
    status: parseStatus(row.status),
    linkedUserId: row.linkedUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

export function createAthleteRepository(db: DbClient): AthleteRepositoryPort {
  return {
    findById(ctx: OrganizationContext, id: string): ResultAsync<Athlete | null, AthleteRepositoryError> {
      return RA.fromPromise(
        db
          .select()
          .from(athletes)
          .where(and(eq(athletes.id, id), eq(athletes.organizationId, ctx.organizationId)))
          .then((rows) => rows[0]),
        wrapDbError,
      ).map((row) => (row ? mapToDomain(row) : null))
    },

    findAll(
      ctx: OrganizationContext,
      options: ListAthletesOptions,
    ): ResultAsync<{ items: Athlete[]; totalCount: number }, AthleteRepositoryError> {
      return RA.fromPromise(
        (async () => {
          const conditions = [eq(athletes.organizationId, ctx.organizationId)]

          // Optional status filter
          if (options.status) {
            conditions.push(eq(athletes.status, options.status))
          }

          // Optional search filter (ILIKE on name, escape wildcards)
          if (options.search) {
            const escaped = options.search.replace(/[%_]/g, '\\$&')
            conditions.push(ilike(athletes.name, `%${escaped}%`))
          }

          const whereClause = and(...conditions)

          const [countResult, rows] = await Promise.all([
            db.select({ count: count() }).from(athletes).where(whereClause),
            db
              .select()
              .from(athletes)
              .where(whereClause)
              .orderBy(desc(athletes.updatedAt))
              .limit(options.limit)
              .offset(options.offset),
          ])

          const items = rows.map(mapToDomain)

          return {
            items,
            totalCount: countResult[0]?.count ?? 0,
          }
        })(),
        wrapDbError,
      )
    },

    findByLinkedUserId(ctx: OrganizationContext, userId: string): ResultAsync<Athlete | null, AthleteRepositoryError> {
      return RA.fromPromise(
        db
          .select()
          .from(athletes)
          .where(and(eq(athletes.linkedUserId, userId), eq(athletes.organizationId, ctx.organizationId)))
          .then((rows) => rows[0]),
        wrapDbError,
      ).map((row) => {
        if (!row) {
          return null
        }
        return mapToDomain(row)
      })
    },

    create(ctx: OrganizationContext, athlete: Athlete): ResultAsync<Athlete, AthleteRepositoryError> {
      return RA.fromPromise(
        db
          .insert(athletes)
          .values({
            id: athlete.id,
            organizationId: ctx.organizationId,
            name: athlete.name,
            email: athlete.email,
            phone: athlete.phone,
            birthdate: athlete.birthdate?.toISOString().split('T')[0],
            gender: athlete.gender,
            notes: athlete.notes,
            status: athlete.status,
            linkedUserId: athlete.linkedUserId,
          })
          .returning()
          .then((rows) => rows[0]),
        wrapDbError,
      ).andThen((row) => {
        if (!row) {
          return err({ type: 'DATABASE_ERROR', message: 'Failed to create athlete' } as const)
        }
        return ok(mapToDomain(row))
      })
    },

    update(ctx: OrganizationContext, athlete: Athlete): ResultAsync<Athlete, AthleteRepositoryError> {
      return RA.fromPromise(
        db
          .update(athletes)
          .set({
            name: athlete.name,
            email: athlete.email,
            phone: athlete.phone,
            birthdate: athlete.birthdate?.toISOString().split('T')[0],
            gender: athlete.gender,
            notes: athlete.notes,
            status: athlete.status,
            linkedUserId: athlete.linkedUserId,
            updatedAt: new Date(),
          })
          .where(and(eq(athletes.id, athlete.id), eq(athletes.organizationId, ctx.organizationId)))
          .returning()
          .then((rows) => rows[0]),
        wrapDbError,
      ).andThen((row) => {
        if (!row) {
          return err({ type: 'NOT_FOUND', athleteId: athlete.id } as const)
        }
        return ok(mapToDomain(row))
      })
    },

    archive(ctx: OrganizationContext, id: string): ResultAsync<void, AthleteRepositoryError> {
      return RA.fromPromise(
        db
          .update(athletes)
          .set({
            status: 'inactive',
            updatedAt: new Date(),
          })
          .where(and(eq(athletes.id, id), eq(athletes.organizationId, ctx.organizationId)))
          .returning()
          .then((rows) => rows[0]),
        wrapDbError,
      ).andThen((row) => {
        if (!row) {
          return err({ type: 'NOT_FOUND', athleteId: id } as const)
        }
        return ok(undefined)
      })
    },

    count(ctx: OrganizationContext, options?: { status?: AthleteStatus }): ResultAsync<number, AthleteRepositoryError> {
      const conditions = [eq(athletes.organizationId, ctx.organizationId)]

      if (options?.status) {
        conditions.push(eq(athletes.status, options.status))
      }

      return RA.fromPromise(
        db
          .select({ count: count() })
          .from(athletes)
          .where(and(...conditions))
          .then((rows) => rows[0]?.count ?? 0),
        wrapDbError,
      )
    },
  }
}
