import { z } from "zod";
import { db } from "../../lib/db";
import { athletesRepo, coachesRepo, usersRepo } from "../../repos";
import { router, protectedProcedure, coachProcedure } from "../init";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await usersRepo.findByIdWithProfiles(db, ctx.userId);
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...safe } = user;
    return safe;
  }),

  update: protectedProcedure
    .input(z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      avatar: z.string().url().optional(),
      sport: z.string().optional(),
      sports: z.array(z.string()).optional(),
      bio: z.string().max(300).optional(),
      goals: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { name, phone, avatar, sport, sports, bio, goals } = input;
      const user = await usersRepo.updateBasics(db, ctx.userId, { name, phone, avatar });
      if (user.role === "ATHLETE" && (sport || bio || goals)) {
        await athletesRepo.updateProfile(db, ctx.userId, { sport, bio, goals });
      }
      if (user.role === "COACH" && (sports !== undefined || bio !== undefined)) {
        await coachesRepo.updateProfile(db, ctx.userId, { sports, bio });
      }
      const updated = await usersRepo.findByIdWithProfiles(db, ctx.userId);
      if (!updated) throw new Error("User not found");
      const { passwordHash: _, ...safe } = updated;
      return safe;
    }),

  coachStats: coachProcedure.query(async ({ ctx }) => {
    const coach = await coachesRepo.findByUserId(db, ctx.userId);
    if (!coach) throw new Error("Coach profile not found");
    const { athleteCount, sessionCount, upcomingCount } = await coachesRepo.stats(db, coach.id);
    return {
      athleteCount,
      sessionCount,
      upcomingCount,
      subscriptionTier: coach.subscriptionTier,
      athleteLimit: coach.athleteLimit,
    };
  }),
});
