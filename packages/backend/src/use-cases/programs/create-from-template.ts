import type { Program } from '@strenly/core/domain/entities/program/program'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'
import { makeDuplicateProgram } from './duplicate-program'

export type CreateFromTemplateInput = OrganizationContext & {
  templateId: string
  name: string
  athleteId?: string | null
}

export type CreateFromTemplateError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; templateId: string }
  | { type: 'not_a_template'; templateId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  generateId: () => string
}

/**
 * Create a new program from a template.
 * Verifies the source is a template before creating a deep copy.
 *
 * Returns the full Program aggregate.
 */
export const makeCreateFromTemplate =
  (deps: Dependencies) =>
  (input: CreateFromTemplateInput): ResultAsync<Program, CreateFromTemplateError> => {
    // 1. Authorization FIRST - creating from template requires programs:write
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to create programs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Verify the source is actually a template
    // Load the aggregate to check isTemplate
    return deps.programRepository
      .loadProgramAggregate(ctx, input.templateId)
      .mapErr(
        (e): CreateFromTemplateError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((program) => {
        if (program === null) {
          return errAsync<Program, CreateFromTemplateError>({
            type: 'not_found',
            templateId: input.templateId,
          })
        }

        if (!program.isTemplate) {
          return errAsync<Program, CreateFromTemplateError>({
            type: 'not_a_template',
            templateId: input.templateId,
          })
        }

        // 3. Use duplicate program to create a new program from the template
        const duplicateProgramUseCase = makeDuplicateProgram(deps)

        return duplicateProgramUseCase({
          organizationId: input.organizationId,
          userId: input.userId,
          roles: input.roles,
          sourceProgramId: input.templateId,
          name: input.name,
          athleteId: input.athleteId ?? null, // Can be assigned to an athlete
          isTemplate: false, // New program is not a template
        }).mapErr((e): CreateFromTemplateError => {
          switch (e.type) {
            case 'forbidden':
              return { type: 'forbidden', message: e.message }
            case 'not_found':
              return { type: 'not_found', templateId: e.programId }
            case 'validation_error':
              return { type: 'validation_error', message: e.message }
            case 'repository_error':
              return { type: 'repository_error', message: e.message }
          }
        })
      })
  }
