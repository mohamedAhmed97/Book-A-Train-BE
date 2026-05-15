import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { router, coachProcedure } from "../init";

export const athletesRouter = router({
  list: coachProcedure.query(async ({ ctx }) => {
    const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
    if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
    return db.coachAthlete.findMany({
      where: { coachId: coach.id },
      include: {
        athlete: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            bookings: {
              where: { session: { coachId: coach.id } },
              include: { progress: true, session: { select: { scheduledAt: true, title: true } } },
              orderBy: { session: { scheduledAt: "desc" } },
              take: 5,
            },
          },
        },
      },
    });
  }),

  add: coachProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const currentCount = await db.coachAthlete.count({ where: { coachId: coach.id } });
      if (currentCount >= coach.athleteLimit)
        throw new TRPCError({ code: "FORBIDDEN", message: `Athlete limit reached (${coach.athleteLimit}). Upgrade your plan.` });
      const athleteUser = await db.user.findUnique({
        where: { email: input.email },
        include: { athleteProfile: true },
      });
      if (!athleteUser || athleteUser.role !== "ATHLETE" || !athleteUser.athleteProfile)
        throw new TRPCError({ code: "NOT_FOUND", message: "No athlete found with that email" });
      const existingRelation = await db.coachAthlete.findUnique({
        where: { coachId_athleteId: { coachId: coach.id, athleteId: athleteUser.athleteProfile.id } },
      });
      if (existingRelation)
        throw new TRPCError({ code: "CONFLICT", message: "Athlete is already in your roster" });
      return db.coachAthlete.create({
        data: { coachId: coach.id, athleteId: athleteUser.athleteProfile.id },
        include: {
          athlete: {
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true } },
              bookings: { include: { progress: true, session: { select: { scheduledAt: true, title: true } } }, take: 5 },
            },
          },
        },
      });
    }),

  remove: coachProcedure
    .input(z.object({ athleteProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      await db.coachAthlete.deleteMany({ where: { coachId: coach.id, athleteId: input.athleteProfileId } });
      return { success: true };
    }),
});
