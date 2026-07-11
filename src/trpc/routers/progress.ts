import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { athletesRepo, notificationsRepo, progressRepo, sessionBookingsRepo } from "../../repos";
import { router, athleteProcedure } from "../init";

export const progressRouter = router({
  stats: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    const [totalSessions, thisWeekSessions, completedExercises] = await Promise.all([
      sessionBookingsRepo.countConfirmedForAthlete(db, athlete.id),
      sessionBookingsRepo.countConfirmedForAthleteThisWeek(db, athlete.id),
      progressRepo.countCompletedForAthlete(db, athlete.id),
    ]);
    return { totalSessions, thisWeekSessions, completedExercises };
  }),

  toggle: athleteProcedure
    .input(z.object({ bookingId: z.string(), exerciseId: z.string(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const athlete = await athletesRepo.findByUserId(db, ctx.userId);
      if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
      const booking = await sessionBookingsRepo.findByIdAndAthlete(db, input.bookingId, athlete.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      return progressRepo.upsert(db, input);
    }),

  complete: athleteProcedure
    .input(
      z.object({
        bookingId: z.string(),
        durationMs: z.number().int().positive(),
        distanceM: z.number().positive().optional(),
        avgSpeedKph: z.number().positive().optional(),
        avgPaceSecPerKm: z.number().positive().optional(),
        calories: z.number().int().positive().optional(),
        laps: z.number().int().positive().optional(),
        notes: z.string().optional(),
        rawMetrics: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const athlete = await athletesRepo.findByUserIdWithName(db, ctx.userId);
      if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });

      const booking = await sessionBookingsRepo.findByIdAndAthleteWithSession(db, input.bookingId, athlete.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });

      const result = await progressRepo.saveResult(db, input);

      await notificationsRepo.createOne(db, {
        userId: booking.session.coach.userId,
        type: "WORKOUT_COMPLETED",
        title: "Workout Completed 🎉",
        body: `${athlete.user.name} completed ${booking.session.title}`,
        data: { bookingId: booking.id, sessionId: booking.sessionId },
      });

      return result;
    }),

  getResult: athleteProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const athlete = await athletesRepo.findByUserId(db, ctx.userId);
      if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
      const booking = await sessionBookingsRepo.findByIdAndAthlete(db, input.bookingId, athlete.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      return progressRepo.getResult(db, input.bookingId);
    }),
});
