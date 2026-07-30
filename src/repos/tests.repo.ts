import type { DBClient } from "./types";

export const testsRepo = {
  listCatalog(db: DBClient, coachId: string) {
    return db.test.findMany({
      where: { OR: [{ isGlobal: true }, { coachId }] },
      orderBy: [{ isGlobal: "desc" }, { name: "asc" }],
    });
  },

  findById(db: DBClient, id: string) {
    return db.test.findUnique({ where: { id } });
  },

  createTest(db: DBClient, data: { name: string; description?: string; sport?: string; unit: string; coachId: string }) {
    return db.test.create({ data });
  },

  assign(db: DBClient, data: { testId: string; athleteId: string; coachId: string; scheduledAt?: Date; notes?: string }) {
    return db.athleteTest.create({
      data,
      include: {
        test: true,
        athlete: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  },

  findAthleteTestById(db: DBClient, id: string) {
    return db.athleteTest.findUnique({
      where: { id },
      include: {
        test: true,
        result: true,
        athlete: { include: { user: { select: { id: true, name: true } } } },
        coach: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  },

  findAthleteTestByIdForCoach(db: DBClient, id: string, coachId: string) {
    return db.athleteTest.findFirst({
      where: { id, coachId },
      include: {
        test: true,
        result: true,
        athlete: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  },

  listForAthlete(db: DBClient, athleteId: string, coachId: string) {
    return db.athleteTest.findMany({
      where: { athleteId, coachId },
      include: { test: true, result: true },
      orderBy: { createdAt: "desc" },
    });
  },

  listMyTests(db: DBClient, athleteId: string) {
    return db.athleteTest.findMany({
      where: { athleteId },
      include: {
        test: true,
        result: true,
        coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  addResult(db: DBClient, athleteTestId: string, value: number, unit: string, notes?: string) {
    return db.testResult.create({ data: { athleteTestId, value, unit, notes } });
  },

  markCompleted(db: DBClient, athleteTestId: string) {
    return db.athleteTest.update({ where: { id: athleteTestId }, data: { status: "COMPLETED" } });
  },

  updateAssignment(db: DBClient, id: string, data: { scheduledAt?: Date | null; notes?: string | null }) {
    return db.athleteTest.update({ where: { id }, data });
  },

  deleteAssignment(db: DBClient, id: string) {
    return db.athleteTest.delete({ where: { id } });
  },
};
