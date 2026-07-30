import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { athletesRepo, coachesRepo, usersRepo } from "../repos";
import { authenticate, requireCoach, type AuthRequest } from "../middleware/auth";

export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const user = await usersRepo.findByIdWithProfiles(db, userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
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
    sports: z.array(z.string()).optional(),
    bio: z.string().max(300).optional(),
    goals: z.string().max(300).optional(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") });
    return;
  }

  const { name, phone, avatar, sport, sports, bio, goals } = result.data;

  const user = await usersRepo.updateBasics(db, userId, { name, phone, avatar });

  if (user.role === "ATHLETE" && (sport || bio || goals)) {
    await athletesRepo.updateProfile(db, userId, { sport, bio, goals });
  }
  if (user.role === "COACH" && (sports !== undefined || bio !== undefined)) {
    await coachesRepo.updateProfile(db, userId, { sports, bio });
  }

  const updated = await usersRepo.findByIdWithProfiles(db, userId);
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

profileRouter.get("/coach-stats", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }
  const { athleteCount, sessionCount, upcomingCount } = await coachesRepo.stats(db, coach.id);
  res.json({
    athleteCount,
    sessionCount,
    upcomingCount,
    subscriptionTier: coach.subscriptionTier,
    athleteLimit: coach.athleteLimit,
  });
});
