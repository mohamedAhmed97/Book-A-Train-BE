import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { athletesRepo, progressRepo, sessionBookingsRepo } from "../../repos";
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
});
