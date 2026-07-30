import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { athletesRepo, notificationsRepo, progressRepo, sessionBookingsRepo, integrationsRepo } from "../../repos";
import { router, athleteProcedure } from "../init";
import * as strava from "../../services/strava";

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

      syncToStrava(athlete.id, {
        bookingId: input.bookingId,
        sessionTitle: booking.session.title,
        sport: booking.session.sport,
        startDate: new Date(result.completedAt.getTime() - input.durationMs),
        durationMs: input.durationMs,
        distanceM: input.distanceM,
        calories: input.calories,
        notes: input.notes,
      }).catch((e) => console.error("[Strava sync]", e));

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

async function syncToStrava(
  athleteId: string,
  data: {
    bookingId: string;
    sessionTitle: string;
    sport: string;
    startDate: Date;
    durationMs: number;
    distanceM?: number;
    calories?: number;
    notes?: string;
  },
) {
  const integration = await integrationsRepo.findStravaByAthleteId(db, athleteId);
  if (!integration) return;

  let accessToken = integration.accessToken;
  if (integration.expiresAt <= new Date()) {
    const refreshed = await strava.refreshTokens(integration.refreshToken);
    await integrationsRepo.updateStravaTokens(db, athleteId, refreshed);
    accessToken = refreshed.accessToken;
  }

  const activityId = await strava.createActivity(accessToken, {
    name: data.sessionTitle,
    sport: data.sport,
    startDate: data.startDate,
    elapsedSec: data.durationMs / 1000,
    distanceM: data.distanceM,
    description: data.notes,
    calories: data.calories,
  });

  await db.workoutResult.update({
    where: { bookingId: data.bookingId },
    data: { stravaActivityId: activityId },
  });
}
