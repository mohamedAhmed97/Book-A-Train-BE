import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { router, coachProcedure, athleteProcedure } from "../init";

export const sessionsRouter = router({
  today: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await db.athleteProfile.findUnique({ where: { userId: ctx.userId } });
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    const booking = await db.sessionBooking.findFirst({
      where: {
        athleteId: athlete.id,
        status: "CONFIRMED",
        session: { scheduledAt: { gte: startOfDay, lte: endOfDay }, status: { not: "CANCELLED" } },
      },
      include: {
        session: {
          include: {
            exercises: { orderBy: { order: "asc" } },
            coach: { include: { user: { select: { name: true, avatar: true } } } },
          },
        },
        progress: true,
      },
    });
    if (!booking) return null;
    return { id: booking.id, session: booking.session, progress: booking.progress };
  }),

  myBookings: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await db.athleteProfile.findUnique({ where: { userId: ctx.userId } });
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    return db.sessionBooking.findMany({
      where: { athleteId: athlete.id, status: "CONFIRMED" },
      include: {
        session: {
          include: {
            exercises: { orderBy: { order: "asc" } },
            coach: { include: { user: { select: { name: true } } } },
          },
        },
        progress: true,
      },
      orderBy: { session: { scheduledAt: "asc" } },
    });
  }),

  mySessions: coachProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return db.session.findMany({
        where: { coachId: coach.id, ...(input.status ? { status: input.status as any } : {}) },
        include: {
          exercises: { orderBy: { order: "asc" } },
          bookings: { include: { athlete: { include: { user: { select: { id: true, name: true, avatar: true } } } } } },
          _count: { select: { bookings: true } },
        },
        orderBy: { scheduledAt: "asc" },
      });
    }),

  get: coachProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await db.session.findFirst({
        where: { id: input.id, coachId: coach.id },
        include: {
          exercises: { orderBy: { order: "asc" } },
          bookings: { include: { athlete: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } } } },
          _count: { select: { bookings: true } },
        },
      });
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
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return db.session.create({
        data: { ...input, coachId: coach.id },
        include: { exercises: { orderBy: { order: "asc" } }, _count: { select: { bookings: true } } },
      });
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
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await db.session.findFirst({ where: { id: input.id, coachId: coach.id } });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      const { id, ...data } = input;
      return db.session.update({
        where: { id },
        data,
        include: { exercises: { orderBy: { order: "asc" } }, _count: { select: { bookings: true } } },
      });
    }),

  cancel: coachProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await db.session.findFirst({ where: { id: input.id, coachId: coach.id } });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      return db.session.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
    }),

  assignAthletes: coachProcedure
    .input(z.object({ sessionId: z.string(), athleteProfileIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await db.session.findFirst({ where: { id: input.sessionId, coachId: coach.id } });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      await db.sessionBooking.createMany({
        data: input.athleteProfileIds.map((athleteId) => ({ sessionId: input.sessionId, athleteId })),
        skipDuplicates: true,
      });
      return db.session.findUnique({
        where: { id: input.sessionId },
        include: { bookings: true, exercises: { orderBy: { order: "asc" } } },
      });
    }),

  removeAthlete: coachProcedure
    .input(z.object({ sessionId: z.string(), athleteProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      await db.sessionBooking.deleteMany({ where: { sessionId: input.sessionId, athleteId: input.athleteProfileId } });
      return { success: true };
    }),
});
