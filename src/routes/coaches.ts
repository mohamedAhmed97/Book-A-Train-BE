import { Router } from "express";
import { db } from "../lib/db";
import { athletesRepo, coachAthletesRepo } from "../repos";
import { authenticate, requireAthlete, type AuthRequest } from "../middleware/auth";

export const coachesRouter = Router();
coachesRouter.use(authenticate, requireAthlete);

coachesRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const athlete = await athletesRepo.findByUserId(db, userId);
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }
  const coaches = await coachAthletesRepo.listForAthlete(db, athlete.id);
  res.json(coaches);
});
