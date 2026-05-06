import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { router, athleteProcedure } from "../init";

export const progressRouter = router({
  stats: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await db.athleteProfile.findUnique({ where: { userId: ctx.userId } });
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });

    const totalSessions = await db.sessionBooking.count({
      where: { athleteId: athlete.id, status: "CONFIRMED" },
    });

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeekSessions = await db.sessionBooking.count({
      where: {
        athleteId: athlete.id,
        status: "CONFIRMED",
        session: { scheduledAt: { gte: startOfWeek } },
      },
    });

    const completedExercises = await db.workoutProgress.count({
      where: { booking: { athleteId: athlete.id }, completed: true },
    });

    return { totalSessions, thisWeekSessions, completedExercises };
  }),

  toggle: athleteProcedure
    .input(z.object({ bookingId: z.string(), exerciseId: z.string(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const athlete = await db.athleteProfile.findUnique({ where: { userId: ctx.userId } });
      if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
      const booking = await db.sessionBooking.findFirst({
        where: { id: input.bookingId, athleteId: athlete.id },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      return db.workoutProgress.upsert({
        where: { bookingId_exerciseId: { bookingId: input.bookingId, exerciseId: input.exerciseId } },
        update: { completed: input.completed, completedAt: input.completed ? new Date() : null },
        create: { bookingId: input.bookingId, exerciseId: input.exerciseId, completed: input.completed, completedAt: input.completed ? new Date() : null },
      });
    }),
});
