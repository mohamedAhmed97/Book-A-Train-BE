import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { authenticate, requireCoach, type AuthRequest } from "../middleware/auth";

export const athletesRouter = Router();
athletesRouter.use(authenticate, requireCoach);

// GET /api/athletes — coach: list athletes
athletesRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const athletes = await db.coachAthlete.findMany({
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
  res.json(athletes);
});

// POST /api/athletes — coach: add athlete by email
athletesRouter.post("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({ email: z.string().email() });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid email" }); return; }

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const currentCount = await db.coachAthlete.count({ where: { coachId: coach.id } });
  if (currentCount >= coach.athleteLimit) {
    res.status(403).json({ error: `Athlete limit reached (${coach.athleteLimit}). Upgrade your plan.` });
    return;
  }

  const athleteUser = await db.user.findUnique({
    where: { email: result.data.email },
    include: { athleteProfile: true },
  });

  if (!athleteUser || athleteUser.role !== "ATHLETE" || !athleteUser.athleteProfile) {
    res.status(404).json({ error: "No athlete found with that email" });
    return;
  }

  const existingRelation = await db.coachAthlete.findUnique({
    where: { coachId_athleteId: { coachId: coach.id, athleteId: athleteUser.athleteProfile.id } },
  });
  if (existingRelation) {
    res.status(409).json({ error: "Athlete is already in your roster" });
    return;
  }

  const relation = await db.coachAthlete.create({
    data: { coachId: coach.id, athleteId: athleteUser.athleteProfile.id },
    include: {
      athlete: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
    },
  });
  res.status(201).json(relation);
});

// DELETE /api/athletes/:athleteProfileId — coach: remove athlete
athletesRouter.delete("/:athleteProfileId", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  await db.coachAthlete.deleteMany({ where: { coachId: coach.id, athleteId: req.params["athleteProfileId"] } });
  res.json({ success: true });
});
