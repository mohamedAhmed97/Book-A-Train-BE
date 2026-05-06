import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { authenticate, requireCoach, type AuthRequest } from "../middleware/auth";

export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { athleteProfile: true, coachProfile: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _, ...safe } = user;
  res.json(safe);
});

profileRouter.put("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    avatar: z.string().url().optional(),
    sport: z.string().optional(),
    bio: z.string().max(300).optional(),
    goals: z.string().max(300).optional(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") });
    return;
  }

  const { name, phone, avatar, sport, bio, goals } = result.data;

  const user = await db.user.update({
    where: { id: userId },
    data: { ...(name && { name }), ...(phone && { phone }), ...(avatar && { avatar }) },
  });

  if (user.role === "ATHLETE" && (sport || bio || goals)) {
    await db.athleteProfile.update({
      where: { userId },
      data: { ...(sport && { sport }), ...(bio && { bio }), ...(goals && { goals }) },
    });
  }

  if (user.role === "COACH" && (sport || bio)) {
    await db.coachProfile.update({
      where: { userId },
      data: { ...(sport && { sport }), ...(bio && { bio }) },
    });
  }

  const updated = await db.user.findUnique({
    where: { id: userId },
    include: { athleteProfile: true, coachProfile: true },
  });
  res.json(updated);
});

profileRouter.get("/coach-stats", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) {
    res.status(404).json({ error: "Coach profile not found" });
    return;
  }

  const [athleteCount, sessionCount, upcomingCount] = await Promise.all([
    db.coachAthlete.count({ where: { coachId: coach.id } }),
    db.session.count({ where: { coachId: coach.id } }),
    db.session.count({
      where: { coachId: coach.id, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
    }),
  ]);

  res.json({
    athleteCount,
    sessionCount,
    upcomingCount,
    subscriptionTier: coach.subscriptionTier,
    athleteLimit: coach.athleteLimit,
  });
});
