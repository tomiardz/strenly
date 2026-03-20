import type { Athlete } from '@strenly/core/domain/entities/athlete'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GetAthleteInput = OrganizationContext & {
  athleteId: string
}

export type GetAthleteError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; athleteId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  athleteRepository: AthleteRepositoryPort
}

export const makeGetAthlete =
  (deps: Dependencies) =>
  (input: GetAthleteInput): ResultAsync<Athlete, GetAthleteError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to view athletes',
      })
    }

    // 2. Fetch athlete
    return deps.athleteRepository
      .findById(
        { organizationId: input.organizationId, userId: input.userId, roles: input.roles },
        input.athleteId,
      )
      .mapErr(
        (e): GetAthleteError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Failed to find athlete`,
        }),
      )
      .andThen((athlete) => {
        if (athlete === null) {
          return errAsync<Athlete, GetAthleteError>({
            type: 'not_found',
            athleteId: input.athleteId,
          })
        }
        return okAsync(athlete)
      })
  }
