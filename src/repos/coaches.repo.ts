import type { DBClient } from "./types";

export const coachesRepo = {
  findByUserId(db: DBClient, userId: string) {
    return db.coachProfile.findUnique({ where: { userId } });
  },

  updateProfile(db: DBClient, userId: string, args: { sport?: string; bio?: string }) {
    return db.coachProfile.update({
      where: { userId },
      data: {
        ...(args.sport !== undefined && { sport: args.sport }),
        ...(args.bio !== undefined && { bio: args.bio }),
      },
    });
  },

  stats(db: DBClient, coachId: string) {
    return Promise.all([
      db.coachAthlete.count({ where: { coachId } }),
      db.session.count({ where: { coachId } }),
      db.session.count({
        where: { coachId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      }),
    ]).then(([athleteCount, sessionCount, upcomingCount]) => ({
      athleteCount,
      sessionCount,
      upcomingCount,
    }));
  },
};

export const coachAthletesRepo = {
  listForCoach(db: DBClient, coachId: string) {
    return db.coachAthlete.findMany({
      where: { coachId },
      include: {
        athlete: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            bookings: {
              where: { session: { coachId } },
              include: {
                progress: true,
                session: { select: { scheduledAt: true, title: true } },
              },
              orderBy: { session: { scheduledAt: "desc" } },
              take: 5,
            },
          },
        },
      },
    });
  },

  listForAthlete(db: DBClient, athleteId: string) {
    return db.coachAthlete.findMany({
      where: { athleteId },
      include: {
        coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
    });
  },

  count(db: DBClient, coachId: string) {
    return db.coachAthlete.count({ where: { coachId } });
  },

  findRelation(db: DBClient, coachId: string, athleteId: string) {
    return db.coachAthlete.findUnique({
      where: { coachId_athleteId: { coachId, athleteId } },
    });
  },

  create(db: DBClient, coachId: string, athleteId: string) {
    return db.coachAthlete.create({
      data: { coachId, athleteId },
      include: {
        athlete: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            bookings: {
              include: {
                progress: true,
                session: { select: { scheduledAt: true, title: true } },
              },
              take: 5,
            },
          },
        },
      },
    });
  },

  remove(db: DBClient, coachId: string, athleteId: string) {
    return db.coachAthlete.deleteMany({ where: { coachId, athleteId } });
  },
};
