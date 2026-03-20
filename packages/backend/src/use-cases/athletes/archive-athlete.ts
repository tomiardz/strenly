import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ArchiveAthleteInput = OrganizationContext & {
  athleteId: string
}

export type ArchiveAthleteError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; athleteId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  athleteRepository: AthleteRepositoryPort
}

export const makeArchiveAthlete =
  (deps: Dependencies) =>
  (input: ArchiveAthleteInput): ResultAsync<void, ArchiveAthleteError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to archive athletes',
      })
    }

    // 2. Archive (soft delete - sets status to inactive)
    return deps.athleteRepository
      .archive(
        { organizationId: input.organizationId, userId: input.userId, roles: input.roles },
        input.athleteId,
      )
      .mapErr((e): ArchiveAthleteError => {
        if (e.type === 'NOT_FOUND') {
          return { type: 'not_found', athleteId: input.athleteId }
        }
        return { type: 'repository_error', message: e.type === 'DATABASE_ERROR' ? e.message : `Unknown error` }
      })
  }
