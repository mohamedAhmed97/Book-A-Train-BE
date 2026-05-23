import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import {
  athletesRepo,
  coachesRepo,
  sessionsRepo,
  sessionBookingsRepo,
} from "../../repos";
import { dispatchNotification, dispatchNotifications } from "../../services/notifications.service";
import { router, coachProcedure, athleteProcedure } from "../init";

export const sessionsRouter = router({
  today: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    const booking = await sessionBookingsRepo.findTodayForAthlete(db, athlete.id);
    if (!booking) return null;
    return { id: booking.id, session: booking.session, progress: booking.progress };
  }),

  myBookings: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    return sessionBookingsRepo.listForAthlete(db, athlete.id);
  }),

  mySessions: coachProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return sessionsRepo.listForCoach(db, coach.id, input.status as any);
    }),

  get: coachProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await sessionsRepo.findByIdAndCoachWithDetails(db, input.id, coach.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      return session;
    }),

  create: coachProcedure
    .input(z.object({
      title: z.string().min(1),
      sport: z.string().min(1),
      description: z.string().optional(),
      location: z.string().optional(),
      scheduledAt: z.coerce.date(),
      durationMinutes: z.number().int().min(15).max(480),
      maxAthletes: z.number().int().min(1).max(100).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return sessionsRepo.create(db, { ...input, coachId: coach.id });
    }),

  update: coachProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      sport: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      scheduledAt: z.coerce.date().optional(),
      durationMinutes: z.number().int().optional(),
      maxAthletes: z.number().int().optional(),
      status: z.enum(["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const existing = await sessionsRepo.findByIdAndCoach(db, input.id, coach.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      const { id, ...data } = input;
      return sessionsRepo.update(db, id, data);
    }),

  cancel: coachProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await sessionsRepo.findByIdAndCoachWithBookings(db, input.id, coach.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      const updated = await sessionsRepo.cancel(db, input.id);
      const recipientUserIds = Array.from(
        new Set(session.bookings.map((b: { athlete: { userId: string } }) => b.athlete.userId)),
      );
      await dispatchNotifications(
        recipientUserIds.map((userId) => ({
          userId,
          type: "SESSION_CANCELLED" as const,
          title: "Session Cancelled",
          body: `${session.title} has been cancelled`,
          data: { sessionId: session.id },
        })),
      );
      return updated;
    }),

  assignAthletes: coachProcedure
    .input(z.object({ sessionId: z.string(), athleteProfileIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await sessionsRepo.findByIdAndCoach(db, input.sessionId, coach.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      const existing = await sessionBookingsRepo.listExisting(db, input.sessionId, input.athleteProfileIds);
      const existingIds = new Set(existing.map((b: { athleteId: string }) => b.athleteId));
      const newAthleteIds = input.athleteProfileIds.filter((id) => !existingIds.has(id));
      await sessionBookingsRepo.createMany(db, input.sessionId, input.athleteProfileIds);
      if (newAthleteIds.length > 0) {
        const newAthletes = await athletesRepo.findUserIdsByProfileIds(db, newAthleteIds);
        await dispatchNotifications(
          newAthletes.map((a: { userId: string }) => ({
            userId: a.userId,
            type: "SESSION_ASSIGNED" as const,
            title: "New Session Assigned",
            body: `You have been added to ${session.title}`,
            data: { sessionId: session.id },
          })),
        );
      }
      return sessionsRepo.findWithBookingsAfter(db, input.sessionId);
    }),

  removeAthlete: coachProcedure
    .input(z.object({ sessionId: z.string(), athleteProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await sessionsRepo.findByIdAndCoach(db, input.sessionId, coach.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      await sessionBookingsRepo.removeOne(db, input.sessionId, input.athleteProfileId);
      return { success: true };
    }),

  cancelBooking: athleteProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const athlete = await athletesRepo.findByUserIdWithName(db, ctx.userId);
      if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
      const booking = await sessionBookingsRepo.findByIdAndAthleteWithSession(db, input.bookingId, athlete.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      const updated = await sessionBookingsRepo.setStatus(db, input.bookingId, "CANCELLED");
      await dispatchNotification({
        userId: booking.session.coach.userId,
        type: "SESSION_DECLINED",
        title: "Athlete Cancelled",
        body: `${athlete.user.name} cancelled their booking for ${booking.session.title}`,
        data: { sessionId: booking.sessionId, bookingId: booking.id, athleteId: athlete.id },
      });
      return updated;
    }),

  confirmBooking: athleteProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const athlete = await athletesRepo.findByUserIdWithName(db, ctx.userId);
      if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
      const booking = await sessionBookingsRepo.findByIdAndAthleteWithSession(db, input.bookingId, athlete.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      const updated = await sessionBookingsRepo.setStatus(db, input.bookingId, "CONFIRMED");
      await dispatchNotification({
        userId: booking.session.coach.userId,
        type: "SESSION_ACCEPTED",
        title: "Athlete Accepted",
        body: `${athlete.user.name} accepted ${booking.session.title}`,
        data: { sessionId: booking.sessionId, bookingId: booking.id, athleteId: athlete.id },
      });
      return updated;
    }),
});
