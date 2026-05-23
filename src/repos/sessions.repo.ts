import type { SessionStatus } from "@prisma/client";
import type { DBClient } from "./types";

const sessionInclude = {
  exercises: { orderBy: { order: "asc" } },
  _count: { select: { bookings: true } },
} as const;

const sessionInclude_coach = {
  exercises: { orderBy: { order: "asc" } },
  _count: { select: { bookings: true } },
  coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
} as const;

const sessionInclude_full = {
  exercises: { orderBy: { order: "asc" } },
  bookings: {
    include: { athlete: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } } },
  },
  _count: { select: { bookings: true } },
} as const;

export const sessionsRepo = {
  findById(db: DBClient, id: string) {
    return db.session.findUnique({ where: { id } });
  },

  findByIdAndCoach(db: DBClient, id: string, coachId: string) {
    return db.session.findFirst({ where: { id, coachId } });
  },

  findByIdAndCoachWithDetails(db: DBClient, id: string, coachId: string) {
    return db.session.findFirst({ where: { id, coachId }, include: sessionInclude_full });
  },

  findByIdAndCoachWithBookings(db: DBClient, id: string, coachId: string) {
    return db.session.findFirst({
      where: { id, coachId },
      include: { bookings: { include: { athlete: { select: { userId: true } } } } },
    });
  },

  findByIdWithDetails(db: DBClient, id: string) {
    return db.session.findUnique({
      where: { id },
      include: {
        exercises: { orderBy: { order: "asc" } },
        bookings: { include: { athlete: { include: { user: { select: { id: true, name: true, avatar: true } } } } } },
        coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        _count: { select: { bookings: true } },
      },
    });
  },

  listForCoach(db: DBClient, coachId: string, status?: SessionStatus) {
    return db.session.findMany({
      where: { coachId, ...(status ? { status } : {}) },
      include: sessionInclude_full,
      orderBy: { scheduledAt: "asc" },
    });
  },

  listForAthleteUpcoming(
    db: DBClient,
    args: { coachIds: string[]; assignedSessionIds: string[] },
  ) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return db.session.findMany({
      where: {
        status: { in: ["SCHEDULED", "ONGOING"] },
        scheduledAt: { gte: startOfToday },
        OR: [
          { coachId: { in: args.coachIds } },
          { id: { in: args.assignedSessionIds } },
        ],
      },
      include: sessionInclude_coach,
      orderBy: { scheduledAt: "asc" },
    });
  },

  create(
    db: DBClient,
    args: {
      title: string;
      sport: string;
      description?: string | undefined;
      location?: string | undefined;
      scheduledAt: Date;
      durationMinutes: number;
      maxAthletes: number;
      coachId: string;
    },
  ) {
    return db.session.create({ data: args, include: sessionInclude });
  },

  update(
    db: DBClient,
    id: string,
    args: {
      title?: string;
      sport?: string;
      description?: string;
      location?: string;
      scheduledAt?: Date;
      durationMinutes?: number;
      maxAthletes?: number;
      status?: SessionStatus;
    },
  ) {
    return db.session.update({ where: { id }, data: args, include: sessionInclude });
  },

  cancel(db: DBClient, id: string) {
    return db.session.update({ where: { id }, data: { status: "CANCELLED" } });
  },

  findWithBookingsAfter(db: DBClient, id: string) {
    return db.session.findUnique({
      where: { id },
      include: { bookings: true, exercises: { orderBy: { order: "asc" } } },
    });
  },
};

export const sessionBookingsRepo = {
  findById(db: DBClient, id: string) {
    return db.sessionBooking.findUnique({ where: { id } });
  },

  findByIdAndAthlete(db: DBClient, id: string, athleteId: string) {
    return db.sessionBooking.findFirst({ where: { id, athleteId } });
  },

  findByIdAndAthleteWithSession(db: DBClient, id: string, athleteId: string) {
    return db.sessionBooking.findFirst({
      where: { id, athleteId },
      include: { session: { include: { coach: { select: { userId: true } } } } },
    });
  },

  findByIdWithOwners(db: DBClient, id: string) {
    return db.sessionBooking.findUnique({
      where: { id },
      include: {
        athlete: { select: { userId: true } },
        session: { select: { coach: { select: { userId: true } } } },
      },
    });
  },

  findTodayForAthlete(db: DBClient, athleteId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return db.sessionBooking.findFirst({
      where: {
        athleteId,
        status: "CONFIRMED",
        session: { scheduledAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
      },
      include: {
        session: {
          include: {
            exercises: { orderBy: { order: "asc" } },
            coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          },
        },
        progress: true,
      },
    });
  },

  listForAthlete(db: DBClient, athleteId: string) {
    return db.sessionBooking.findMany({
      where: { athleteId, status: "CONFIRMED" },
      include: {
        session: {
          include: {
            exercises: { orderBy: { order: "asc" } },
            coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          },
        },
        progress: true,
      },
      orderBy: { session: { scheduledAt: "asc" } },
    });
  },

  listBySession(db: DBClient, sessionId: string) {
    return db.sessionBooking.findMany({
      where: { sessionId },
      include: {
        athlete: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        progress: true,
      },
    });
  },

  listSessionIdsForAthlete(db: DBClient, athleteId: string) {
    return db.sessionBooking.findMany({
      where: { athleteId },
      select: { sessionId: true },
    });
  },

  listExisting(db: DBClient, sessionId: string, athleteIds: string[]) {
    if (athleteIds.length === 0) return Promise.resolve([] as { athleteId: string }[]);
    return db.sessionBooking.findMany({
      where: { sessionId, athleteId: { in: athleteIds } },
      select: { athleteId: true },
    });
  },

  createMany(
    db: DBClient,
    sessionId: string,
    athleteIds: string[],
  ) {
    if (athleteIds.length === 0) return Promise.resolve({ count: 0 });
    return db.sessionBooking.createMany({
      data: athleteIds.map((athleteId) => ({ sessionId, athleteId })),
      skipDuplicates: true,
    });
  },

  removeOne(db: DBClient, sessionId: string, athleteId: string) {
    return db.sessionBooking.deleteMany({ where: { sessionId, athleteId } });
  },

  setStatus(db: DBClient, id: string, status: "CONFIRMED" | "CANCELLED") {
    return db.sessionBooking.update({ where: { id }, data: { status } });
  },

  countConfirmedForAthlete(db: DBClient, athleteId: string) {
    return db.sessionBooking.count({ where: { athleteId, status: "CONFIRMED" } });
  },

  countConfirmedForAthleteThisWeek(db: DBClient, athleteId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return db.sessionBooking.count({
      where: { athleteId, status: "CONFIRMED", session: { scheduledAt: { gte: weekStart } } },
    });
  },
};
