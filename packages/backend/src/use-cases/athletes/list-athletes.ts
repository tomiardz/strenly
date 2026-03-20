import type { Athlete, AthleteStatus } from '@strenly/core/domain/entities/athlete'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ListAthletesInput = OrganizationContext & {
  status?: AthleteStatus
  search?: string
  limit?: number
  offset?: number
}

export type ListAthletesResult = {
  items: Athlete[]
  totalCount: number
}

export type ListAthletesError = { type: 'forbidden'; message: string } | { type: 'repository_error'; message: string }

type Dependencies = {
  athleteRepository: AthleteRepositoryPort
}

export const makeListAthletes =
  (deps: Dependencies) =>
  (input: ListAthletesInput): ResultAsync<ListAthletesResult, ListAthletesError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to list athletes',
      })
    }

    // 2. Fetch athletes with filtering
    return deps.athleteRepository
      .findAll(
        { organizationId: input.organizationId, userId: input.userId, roles: input.roles },
        {
          status: input.status,
          search: input.search,
          limit: input.limit ?? 50,
          offset: input.offset ?? 0,
        },
      )
      .mapErr(
        (e): ListAthletesError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Athlete not found: ${e.athleteId}`,
        }),
      )
  }
