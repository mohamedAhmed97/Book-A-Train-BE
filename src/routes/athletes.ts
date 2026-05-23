import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { coachAthletesRepo, coachesRepo, usersRepo } from "../repos";
import { authenticate, requireCoach, type AuthRequest } from "../middleware/auth";

export const athletesRouter = Router();
athletesRouter.use(authenticate, requireCoach);

athletesRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }
  const athletes = await coachAthletesRepo.listForCoach(db, coach.id);
  res.json(athletes);
});

athletesRouter.post("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({ email: z.string().email() });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid email" }); return; }

  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const currentCount = await coachAthletesRepo.count(db, coach.id);
  if (currentCount >= coach.athleteLimit) {
    res.status(403).json({ error: `Athlete limit reached (${coach.athleteLimit}). Upgrade your plan.` });
    return;
  }

  const athleteUser = await usersRepo.findByEmailWithAthlete(db, result.data.email);
  if (!athleteUser || athleteUser.role !== "ATHLETE" || !athleteUser.athleteProfile) {
    res.status(404).json({ error: "No athlete found with that email" });
    return;
  }

  const existingRelation = await coachAthletesRepo.findRelation(db, coach.id, athleteUser.athleteProfile.id);
  if (existingRelation) {
    res.status(409).json({ error: "Athlete is already in your roster" });
    return;
  }

  const relation = await coachAthletesRepo.create(db, coach.id, athleteUser.athleteProfile.id);
  res.status(201).json(relation);
});

athletesRouter.delete("/:athleteProfileId", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }
  await coachAthletesRepo.remove(db, coach.id, req.params["athleteProfileId"]!);
  res.json({ success: true });
});
