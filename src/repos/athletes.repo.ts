import type { DBClient } from "./types";

export const athletesRepo = {
  findByUserId(db: DBClient, userId: string) {
    return db.athleteProfile.findUnique({ where: { userId } });
  },

  findByUserIdWithName(db: DBClient, userId: string) {
    return db.athleteProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });
  },

  findByUserIdWithCoaches(db: DBClient, userId: string) {
    return db.athleteProfile.findUnique({
      where: { userId },
      include: { coachAthletes: { select: { coachId: true } } },
    });
  },

  findUserIdsByProfileIds(db: DBClient, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([] as { userId: string }[]);
    return db.athleteProfile.findMany({
      where: { id: { in: ids } },
      select: { userId: true },
    });
  },

  updateProfile(
    db: DBClient,
    userId: string,
    args: { sport?: string; bio?: string; goals?: string },
  ) {
    return db.athleteProfile.update({
      where: { userId },
      data: {
        ...(args.sport !== undefined && { sport: args.sport }),
        ...(args.bio !== undefined && { bio: args.bio }),
        ...(args.goals !== undefined && { goals: args.goals }),
      },
    });
  },
};
