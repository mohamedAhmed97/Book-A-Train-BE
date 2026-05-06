import { z } from "zod";
import { db } from "../../lib/db";
import { router, protectedProcedure, coachProcedure } from "../init";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      include: { athleteProfile: true, coachProfile: true },
    });
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
      bio: z.string().max(300).optional(),
      goals: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { name, phone, avatar, sport, bio, goals } = input;
      const user = await db.user.update({
        where: { id: ctx.userId },
        data: { ...(name && { name }), ...(phone && { phone }), ...(avatar && { avatar }) },
      });
      if (user.role === "ATHLETE" && (sport || bio || goals)) {
        await db.athleteProfile.update({
          where: { userId: ctx.userId },
          data: { ...(sport && { sport }), ...(bio && { bio }), ...(goals && { goals }) },
        });
      }
      if (user.role === "COACH" && (sport || bio)) {
        await db.coachProfile.update({
          where: { userId: ctx.userId },
          data: { ...(sport && { sport }), ...(bio && { bio }) },
        });
      }
      const updated = await db.user.findUnique({
        where: { id: ctx.userId },
        include: { athleteProfile: true, coachProfile: true },
      });
      if (!updated) throw new Error("User not found");
      const { passwordHash: _, ...safe } = updated;
      return safe;
    }),

  coachStats: coachProcedure.query(async ({ ctx }) => {
    const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
    if (!coach) throw new Error("Coach profile not found");
    const [athleteCount, sessionCount, upcomingCount] = await Promise.all([
      db.coachAthlete.count({ where: { coachId: coach.id } }),
      db.session.count({ where: { coachId: coach.id } }),
      db.session.count({ where: { coachId: coach.id, status: "SCHEDULED", scheduledAt: { gte: new Date() } } }),
    ]);
    return { athleteCount, sessionCount, upcomingCount, subscriptionTier: coach.subscriptionTier, athleteLimit: coach.athleteLimit };
  }),
});
