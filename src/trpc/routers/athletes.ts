import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { coachAthletesRepo, coachesRepo, usersRepo } from "../../repos";
import { router, coachProcedure } from "../init";

export const athletesRouter = router({
  list: coachProcedure.query(async ({ ctx }) => {
    const coach = await coachesRepo.findByUserId(db, ctx.userId);
    if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
    return coachAthletesRepo.listForCoach(db, coach.id);
  }),

  add: coachProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const currentCount = await coachAthletesRepo.count(db, coach.id);
      if (currentCount >= coach.athleteLimit)
        throw new TRPCError({ code: "FORBIDDEN", message: `Athlete limit reached (${coach.athleteLimit}). Upgrade your plan.` });
      const athleteUser = await usersRepo.findByEmailWithAthlete(db, input.email);
      if (!athleteUser || athleteUser.role !== "ATHLETE" || !athleteUser.athleteProfile)
        throw new TRPCError({ code: "NOT_FOUND", message: "No athlete found with that email" });
      const existingRelation = await coachAthletesRepo.findRelation(db, coach.id, athleteUser.athleteProfile.id);
      if (existingRelation)
        throw new TRPCError({ code: "CONFLICT", message: "Athlete is already in your roster" });
      return coachAthletesRepo.create(db, coach.id, athleteUser.athleteProfile.id);
    }),

  remove: coachProcedure
    .input(z.object({ athleteProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      await coachAthletesRepo.remove(db, coach.id, input.athleteProfileId);
      return { success: true };
    }),

  getProfile: coachProcedure
    .input(z.object({ athleteProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const relation = await coachAthletesRepo.findRelation(db, coach.id, input.athleteProfileId);
      if (!relation) throw new TRPCError({ code: "FORBIDDEN", message: "Athlete not in your roster" });
      const athlete = await db.athleteProfile.findUnique({
        where: { id: input.athleteProfileId },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          bookings: {
            where: { session: { coachId: coach.id } },
            include: {
              session: { include: { exercises: { orderBy: { order: "asc" } } } },
              progress: true,
              workoutResult: true,
            },
            orderBy: { session: { scheduledAt: "desc" } },
          },
        },
      });
      if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete not found" });
      return athlete;
    }),
});
