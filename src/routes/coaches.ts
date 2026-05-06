import { Router } from "express";
import { db } from "../lib/db";
import { authenticate, requireAthlete, type AuthRequest } from "../middleware/auth";

export const coachesRouter = Router();
coachesRouter.use(authenticate, requireAthlete);

// GET /api/coaches — athlete: list their coaches
coachesRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;

  const athlete = await db.athleteProfile.findUnique({ where: { userId } });
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const coaches = await db.coachAthlete.findMany({
    where: { athleteId: athlete.id },
    include: {
      coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    },
  });
  res.json(coaches);
});
