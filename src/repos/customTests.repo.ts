import type { DBClient } from "./types";

const MOVEMENT_INCLUDE = {
  movements: { orderBy: { order: "asc" as const } },
} as const;

const MOVEMENT_RESULT_INCLUDE = {
  movements: { orderBy: { order: "asc" as const } },
} as const;

export const customTestsRepo = {
  listForCoach(db: DBClient, coachId: string) {
    return db.customTest.findMany({
      where: { coachId },
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  },

  findById(db: DBClient, id: string) {
    return db.customTest.findUnique({
      where: { id },
      include: MOVEMENT_INCLUDE,
    });
  },

  findByIdForCoach(db: DBClient, id: string, coachId: string) {
    return db.customTest.findFirst({
      where: { id, coachId },
      include: MOVEMENT_INCLUDE,
    });
  },

  create(
    db: DBClient,
    data: {
      coachId: string;
      name: string;
      description?: string;
      sport?: string;
      unit: string;
      movements: Array<{
        name: string;
        sets?: number;
        reps?: number;
        distanceMeters?: number;
        durationSeconds?: number;
        notes?: string;
        order: number;
      }>;
    },
  ) {
    const { movements, ...rest } = data;
    return db.customTest.create({
      data: {
        ...rest,
        movements: { create: movements },
      },
      include: MOVEMENT_INCLUDE,
    });
  },

  assign(db: DBClient, data: {
    customTestId: string;
    athleteId: string;
    coachId: string;
    scheduledAt?: Date;
    notes?: string;
  }) {
    return db.customTestAssignment.create({
      data,
      include: {
        customTest: { include: MOVEMENT_INCLUDE },
        athlete: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  },

  listAssignmentsForAthlete(db: DBClient, athleteId: string, coachId: string) {
    return db.customTestAssignment.findMany({
      where: { athleteId, coachId },
      include: {
        customTest: { include: MOVEMENT_INCLUDE },
        result: true,
        movementResults: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  listMyAssignments(db: DBClient, athleteId: string) {
    return db.customTestAssignment.findMany({
      where: { athleteId },
      include: {
        customTest: { include: MOVEMENT_INCLUDE },
        result: true,
        movementResults: true,
        coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findAssignmentByIdForCoach(db: DBClient, id: string, coachId: string) {
    return db.customTestAssignment.findFirst({
      where: { id, coachId },
      include: {
        customTest: { include: MOVEMENT_RESULT_INCLUDE },
        result: true,
        movementResults: true,
        athlete: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  },

  findAssignmentWithResults(db: DBClient, id: string) {
    return db.customTestAssignment.findUnique({
      where: { id },
      include: {
        customTest: { include: MOVEMENT_RESULT_INCLUDE },
        result: true,
        movementResults: true,
        athlete: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  },

  upsertMovementResult(db: DBClient, assignmentId: string, movementId: string, value: number, notes?: string) {
    return db.customTestMovementResult.upsert({
      where: { assignmentId_movementId: { assignmentId, movementId } },
      create: { assignmentId, movementId, value, notes },
      update: { value, notes },
    });
  },

  addResult(db: DBClient, assignmentId: string, value: number, unit: string, notes?: string) {
    return db.customTestResult.create({ data: { assignmentId, value, unit, notes } });
  },

  markCompleted(db: DBClient, assignmentId: string) {
    return db.customTestAssignment.update({ where: { id: assignmentId }, data: { status: "COMPLETED" } });
  },

  updateAssignment(db: DBClient, id: string, data: { scheduledAt?: Date | null; notes?: string | null }) {
    return db.customTestAssignment.update({ where: { id }, data });
  },

  deleteAssignment(db: DBClient, id: string) {
    return db.customTestAssignment.delete({ where: { id } });
  },
};
