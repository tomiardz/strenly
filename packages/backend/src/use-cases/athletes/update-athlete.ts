import type { Athlete, AthleteGender, AthleteStatus } from '@strenly/core/domain/entities/athlete'
import { createAthlete } from '@strenly/core/domain/entities/athlete'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type UpdateAthleteInput = OrganizationContext & {
  athleteId: string
  name?: string
  email?: string | null
  phone?: string | null
  birthdate?: Date | null
  gender?: AthleteGender | null
  notes?: string | null
  status?: AthleteStatus
}

export type UpdateAthleteError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; athleteId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  athleteRepository: AthleteRepositoryPort
}

export const makeUpdateAthlete =
  (deps: Dependencies) =>
  (input: UpdateAthleteInput): ResultAsync<Athlete, UpdateAthleteError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to update athletes',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Fetch existing athlete
    return deps.athleteRepository
      .findById(ctx, input.athleteId)
      .mapErr((): UpdateAthleteError => ({ type: 'repository_error', message: 'Database operation failed' }))
      .andThen((existing) => {
        if (existing === null) {
          return errAsync<Athlete, UpdateAthleteError>({ type: 'not_found', athleteId: input.athleteId })
        }

        // 3. Merge updates with existing data
        const merged = {
          id: existing.id,
          organizationId: existing.organizationId,
          name: input.name ?? existing.name,
          email: input.email !== undefined ? input.email : existing.email,
          phone: input.phone !== undefined ? input.phone : existing.phone,
          birthdate: input.birthdate !== undefined ? input.birthdate : existing.birthdate,
          gender: input.gender !== undefined ? input.gender : existing.gender,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          status: input.status ?? existing.status,
          linkedUserId: existing.linkedUserId,
        }

        // 4. Domain validation
        const athleteResult = createAthlete(merged)

        if (athleteResult.isErr()) {
          return errAsync<Athlete, UpdateAthleteError>({
            type: 'validation_error',
            message: athleteResult.error.message,
          })
        }

        // 5. Persist
        return deps.athleteRepository.update(ctx, athleteResult.value).mapErr(
          (e): UpdateAthleteError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Athlete not found: ${e.athleteId}`,
          }),
        )
      })
  }
