import { faker } from '@faker-js/faker'
import type { Exercise } from '@strenly/core/domain/entities/exercise'
import type { MovementPattern } from '@strenly/core/domain/value-objects/movement-pattern'
import type { MuscleGroup } from '@strenly/core/domain/value-objects/muscle-group'
import type { CreateExerciseInput } from '../../use-cases/exercises/create-exercise'

/**
 * Factory for CreateExerciseInput (for use case inputs)
 *
 * @example
 * const input = createExerciseInput({ name: 'Bench Press' })
 * const result = await createExercise({ ...ctx, ...input })
 */
export function createExerciseInput(
  overrides: Partial<Omit<CreateExerciseInput, 'organizationId' | 'userId' | 'roles'>> = {},
): Omit<CreateExerciseInput, 'organizationId' | 'userId' | 'roles'> {
  return {
    name: faker.helpers.arrayElement(['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row']),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }) ?? null,
    instructions: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.5 }) ?? null,
    videoUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }) ?? null,
    movementPattern:
      (faker.helpers.maybe(() => faker.helpers.arrayElement(['squat', 'hinge', 'push', 'pull', 'carry']), {
        probability: 0.7,
      }) as MovementPattern) ?? null,
    isUnilateral: faker.datatype.boolean(),
    primaryMuscles: faker.helpers.arrayElements(
      ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core', 'calves'],
      { min: 1, max: 2 },
    ) as MuscleGroup[],
    secondaryMuscles: faker.helpers.arrayElements(
      ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core', 'calves'],
      { min: 0, max: 2 },
    ) as MuscleGroup[],
    ...overrides,
  }
}

/**
 * Factory for complete Exercise entity (for mocking repository returns)
 *
 * @example
 * const exercise = createExerciseEntity({ name: 'Bench Press' })
 * vi.mocked(exerciseRepository.findById).mockReturnValue(okAsync(exercise))
 */
export function createExerciseEntity(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: faker.string.uuid(),
    organizationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.5 }) ?? null,
    name: faker.helpers.arrayElement(['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row']),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }) ?? null,
    instructions: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.5 }) ?? null,
    videoUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }) ?? null,
    movementPattern:
      faker.helpers.maybe(() => faker.helpers.arrayElement(['squat', 'hinge', 'push', 'pull', 'carry']), {
        probability: 0.7,
      }) ?? null,
    isUnilateral: faker.datatype.boolean(),
    clonedFromId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.2 }) ?? null,
    primaryMuscles: faker.helpers.arrayElements(
      ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core', 'calves'],
      { min: 1, max: 2 },
    ),
    secondaryMuscles: faker.helpers.arrayElements(
      ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core', 'calves'],
      { min: 0, max: 2 },
    ),
    archivedAt: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}
