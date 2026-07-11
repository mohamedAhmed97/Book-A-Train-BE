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

  saveResult(
    db: DBClient,
    data: {
      bookingId: string;
      durationMs: number;
      distanceM?: number;
      avgSpeedKph?: number;
      avgPaceSecPerKm?: number;
      calories?: number;
      laps?: number;
      notes?: string;
      rawMetrics?: Record<string, string | number | boolean | null>;
    },
  ) {
    return db.workoutResult.upsert({
      where: { bookingId: data.bookingId },
      create: data,
      update: data,
    });
  },

  getResult(db: DBClient, bookingId: string) {
    return db.workoutResult.findUnique({ where: { bookingId } });
  },
};
