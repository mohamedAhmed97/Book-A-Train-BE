import type { DBClient } from "./types";

export const progressRepo = {
  upsert(
    db: DBClient,
    args: { bookingId: string; exerciseId: string; completed: boolean },
  ) {
    return db.workoutProgress.upsert({
      where: { bookingId_exerciseId: { bookingId: args.bookingId, exerciseId: args.exerciseId } },
      create: {
        bookingId: args.bookingId,
        exerciseId: args.exerciseId,
        completed: args.completed,
        completedAt: args.completed ? new Date() : null,
      },
      update: {
        completed: args.completed,
        completedAt: args.completed ? new Date() : null,
      },
    });
  },

  listForBooking(db: DBClient, bookingId: string) {
    return db.workoutProgress.findMany({ where: { bookingId } });
  },

  countCompletedForAthlete(db: DBClient, athleteId: string) {
    return db.workoutProgress.count({
      where: { booking: { athleteId }, completed: true },
    });
  },
};
