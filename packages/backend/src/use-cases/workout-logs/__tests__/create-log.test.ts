import { faker } from '@faker-js/faker'
import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAthleteEntity } from '../../../__tests__/factories/athlete-factory'
import { createProgramWithStructure } from '../../../__tests__/factories/program-structure-factory'
import { createManagerContext, createTestContext } from '../../../__tests__/helpers/test-context'
import { makeCreateLog } from '../create-log'

describe('createLog use case', () => {
  let mockWorkoutLogRepository: WorkoutLogRepositoryPort
  let mockProgramRepository: ProgramRepositoryPort
  let mockAthleteRepository: AthleteRepositoryPort
  let mockGenerateId: () => string
  const athleteId = 'athlete-123'
  const programId = 'program-456'
  const sessionId = 'session-789'
  const weekId = 'week-abc'
  const orgId = 'org-xyz'

  beforeEach(() => {
    mockWorkoutLogRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByAthleteSessionWeek: vi.fn(),
      delete: vi.fn(),
      listByAthlete: vi.fn(),
      listPendingWorkouts: vi.fn(),
    } as unknown as WorkoutLogRepositoryPort
    mockProgramRepository = {
      findById: vi.fn(),
      update: vi.fn(),
      saveProgramAggregate: vi.fn(),
      loadProgramAggregate: vi.fn(),
    } as unknown as ProgramRepositoryPort
    mockAthleteRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByLinkedUserId: vi.fn(),
      count: vi.fn(),
    }
    mockGenerateId = vi.fn(() => faker.string.uuid())
  })

  describe('Happy Path', () => {
    it('[5.1-UNIT-001] @p0 should create log from program prescription successfully', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        name: 'Test Program',
        weeks: [
          {
            id: weekId,
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: sessionId,
                name: 'Day 1',
                orderIndex: 0,
                exerciseGroups: [],
              },
            ],
          },
        ],
      })

      const athlete = {
        id: athleteId,
        organizationId: orgId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const logId = 'log-new-123'
      vi.mocked(mockGenerateId).mockReturnValue(logId)

      // No existing log
      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const logDate = new Date('2024-01-15')

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate,
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(logId)
        expect(result.value.athleteId).toBe(athleteId)
        expect(result.value.programId).toBe(programId)
        expect(result.value.sessionId).toBe(sessionId)
        expect(result.value.weekId).toBe(weekId)
        expect(result.value.logDate).toEqual(logDate)
        expect(result.value.status).toBe('partial')
        expect(result.value.programName).toBe('Test Program')
        expect(result.value.weekName).toBe('Week 1')
        expect(result.value.sessionName).toBe('Day 1')
        expect(result.value.athleteName).toBe('John Doe')
      }

      // Verify log check was performed
      expect(mockWorkoutLogRepository.findByAthleteSessionWeek).toHaveBeenCalledWith(ctx, athleteId, sessionId, weekId)
    })

    it('[5.1-UNIT-002] @p1 should pre-fill exercises from program prescription', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        weeks: [
          {
            id: weekId,
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: sessionId,
                name: 'Day 1',
                orderIndex: 0,
                exerciseGroups: [
                  {
                    id: 'group-1',
                    orderIndex: 0,
                    items: [
                      {
                        id: 'item-1',
                        exerciseId: 'ex-1',
                        orderIndex: 0,
                        series: [
                          {
                            orderIndex: 0,
                            reps: 10,
                            repsMax: null,
                            isAmrap: false,
                            intensityType: 'percentage',
                            intensityValue: 80,
                            tempo: null,
                            restSeconds: 90,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      const athlete = {
        id: athleteId,
        organizationId: orgId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.exercises).toHaveLength(1)
        expect(result.value.exercises[0]?.exerciseId).toBe('ex-1')
      }
    })
  })

  describe('Authorization', () => {
    it('[5.2-UNIT-001] @p0 should return forbidden error when user lacks workout_log:create permission', async () => {
      const ctx = createManagerContext()
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('forbidden')
        if (result.error.type === 'forbidden') {
          expect(result.error.message).toContain('No permission')
        }
      }

      // Repository should not be called
      expect(mockWorkoutLogRepository.findByAthleteSessionWeek).not.toHaveBeenCalled()
    })
  })

  describe('Log Already Exists', () => {
    it('[5.3-UNIT-001] @p0 should return log_already_exists when log exists for athlete/session/week', async () => {
      const existingLog = {
        id: 'existing-log-123',
        organizationId: orgId,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
        status: 'completed' as const,
        sessionRpe: 8,
        sessionNotes: 'Good session',
        exercises: [],
        programName: 'Test Program',
        weekName: 'Week 1',
        sessionName: 'Day 1',
        athleteName: 'John Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(existingLog))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('log_already_exists')
        if (result.error.type === 'log_already_exists') {
          expect(result.error.athleteId).toBe(athleteId)
          expect(result.error.sessionId).toBe(sessionId)
          expect(result.error.weekId).toBe(weekId)
        }
      }

      // Program load should not be called
      expect(mockProgramRepository.loadProgramAggregate).not.toHaveBeenCalled()
    })
  })

  describe('Not Found Errors', () => {
    it('[5.4-UNIT-001] @p0 should return program_not_found when program does not exist', async () => {
      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(null))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        okAsync(createAthleteEntity({ id: athleteId, organizationId: orgId, name: 'Test Athlete' })),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId: 'non-existent-program',
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('program_not_found')
        if (result.error.type === 'program_not_found') {
          expect(result.error.programId).toBe('non-existent-program')
        }
      }
    })

    it('[5.4-UNIT-002] @p1 should return week_not_found when week does not exist in program', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        weeks: [
          {
            id: 'different-week',
            name: 'Week 1',
            orderIndex: 0,
            sessions: [],
          },
        ],
      })

      const athlete = {
        id: athleteId,
        organizationId: orgId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId: 'non-existent-week',
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('week_not_found')
        if (result.error.type === 'week_not_found') {
          expect(result.error.weekId).toBe('non-existent-week')
        }
      }
    })

    it('[5.4-UNIT-003] @p1 should return session_not_found when session does not exist in week', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        weeks: [
          {
            id: weekId,
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: 'different-session',
                name: 'Day 1',
                orderIndex: 0,
                exerciseGroups: [],
              },
            ],
          },
        ],
      })

      const athlete = {
        id: athleteId,
        organizationId: orgId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId: 'non-existent-session',
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('session_not_found')
        if (result.error.type === 'session_not_found') {
          expect(result.error.sessionId).toBe('non-existent-session')
        }
      }
    })
  })

  describe('Repository Errors', () => {
    it('[5.5-UNIT-001] @p1 should return repository error when log check fails', async () => {
      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[5.5-UNIT-002] @p1 should return repository error when program load fails', async () => {
      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Query timeout',
        }),
      )
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        okAsync(createAthleteEntity({ id: athleteId, organizationId: orgId, name: 'Test Athlete' })),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[5.5-UNIT-003] @p1 should return repository error when athlete lookup fails', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        weeks: [
          {
            id: weekId,
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: sessionId,
                name: 'Day 1',
                orderIndex: 0,
                exerciseGroups: [],
              },
            ],
          },
        ],
      })

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(
        errAsync({
          type: 'DATABASE_ERROR',
          message: 'Connection lost',
        }),
      )

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
      }
    })

    it('[5.5-UNIT-004] @p1 should return repository error when athlete not found', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        weeks: [
          {
            id: weekId,
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: sessionId,
                name: 'Day 1',
                orderIndex: 0,
                exerciseGroups: [],
              },
            ],
          },
        ],
      })

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(null))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isErr()).toBe(true)

      if (result.isErr()) {
        expect(result.error.type).toBe('repository_error')
        if (result.error.type === 'repository_error') {
          expect(result.error.message).toContain('not found')
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('[5.6-UNIT-001] @p2 should not persist the log (returned for client-side editing)', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        weeks: [
          {
            id: weekId,
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: sessionId,
                name: 'Day 1',
                orderIndex: 0,
                exerciseGroups: [],
              },
            ],
          },
        ],
      })

      const athlete = {
        id: athleteId,
        organizationId: orgId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isOk()).toBe(true)

      // Verify save was NOT called (log is returned for client editing)
      expect(mockWorkoutLogRepository.save).not.toHaveBeenCalled()
    })

    it('[5.6-UNIT-002] @p2 should use generateId for workout log ID', async () => {
      const program = createProgramWithStructure({
        id: programId,
        organizationId: orgId,
        weeks: [
          {
            id: weekId,
            name: 'Week 1',
            orderIndex: 0,
            sessions: [
              {
                id: sessionId,
                name: 'Day 1',
                orderIndex: 0,
                exerciseGroups: [],
              },
            ],
          },
        ],
      })

      const athlete = {
        id: athleteId,
        organizationId: orgId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        birthdate: null,
        gender: null,
        notes: null,
        archivedAt: null,
        status: 'active' as const,
        linkedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const generatedId = 'generated-log-uuid'
      vi.mocked(mockGenerateId).mockReturnValue(generatedId)

      vi.mocked(mockWorkoutLogRepository.findByAthleteSessionWeek).mockReturnValue(okAsync(null))
      vi.mocked(mockProgramRepository.loadProgramAggregate).mockReturnValue(okAsync(program))
      vi.mocked(mockAthleteRepository.findById).mockReturnValue(okAsync(athlete))

      const ctx = createTestContext({ organizationId: orgId })
      const createLog = makeCreateLog({
        workoutLogRepository: mockWorkoutLogRepository,
        programRepository: mockProgramRepository,
        athleteRepository: mockAthleteRepository,
        generateId: mockGenerateId,
      })

      const result = await createLog({
        ...ctx,
        athleteId,
        programId,
        sessionId,
        weekId,
        logDate: new Date(),
      })

      expect(result.isOk()).toBe(true)

      if (result.isOk()) {
        expect(result.value.id).toBe(generatedId)
      }
    })
  })
})
