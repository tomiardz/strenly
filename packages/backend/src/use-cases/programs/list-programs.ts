import type { Program, ProgramStatus } from '@strenly/core/domain/entities/program/types'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ListProgramsInput = OrganizationContext & {
  athleteId?: string | null
  isTemplate?: boolean
  status?: ProgramStatus
  search?: string
  limit?: number
  offset?: number
}

export type ListProgramsResult = {
  items: Program[]
  totalCount: number
}

export type ListProgramsError = { type: 'forbidden'; message: string } | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

export const makeListPrograms =
  (deps: Dependencies) =>
  (input: ListProgramsInput): ResultAsync<ListProgramsResult, ListProgramsError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to list programs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Fetch programs with filtering
    return deps.programRepository
      .list(ctx, {
        athleteId: input.athleteId,
        isTemplate: input.isTemplate,
        status: input.status,
        search: input.search,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      })
      .mapErr(
        (e): ListProgramsError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
  }
