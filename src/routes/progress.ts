import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import {
  athletesRepo,
  coachesRepo,
  progressRepo,
  sessionBookingsRepo,
  sessionsRepo,
} from "../repos";
import { authenticate, requireAthlete, requireCoach, type AuthRequest } from "../middleware/auth";

export const progressRouter = Router();
progressRouter.use(authenticate);

// POST /api/progress/toggle — athlete: mark exercise done/undone
progressRouter.post("/toggle", requireAthlete, async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({
    bookingId: z.string(),
    exerciseId: z.string(),
    completed: z.boolean(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") }); return; }

  const athlete = await athletesRepo.findByUserId(db, userId);
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const booking = await sessionBookingsRepo.findByIdAndAthlete(db, result.data.bookingId, athlete.id);
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const progress = await progressRepo.upsert(db, result.data);
  res.json(progress);
});

// GET /api/progress/stats — athlete: summary stats
progressRouter.get("/stats", requireAthlete, async (req, res) => {
  const { userId } = req as AuthRequest;
  const athlete = await athletesRepo.findByUserId(db, userId);
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const [totalSessions, completedExercises, thisWeekSessions] = await Promise.all([
    sessionBookingsRepo.countConfirmedForAthlete(db, athlete.id),
    progressRepo.countCompletedForAthlete(db, athlete.id),
    sessionBookingsRepo.countConfirmedForAthleteThisWeek(db, athlete.id),
  ]);

  res.json({ totalSessions, completedExercises, thisWeekSessions });
});

// GET /api/progress/booking/:bookingId — booking owner (athlete) or owning coach
progressRouter.get("/booking/:bookingId", async (req, res) => {
  const { userId, role } = req as unknown as AuthRequest;

  const booking = await sessionBookingsRepo.findByIdWithOwners(db, req.params["bookingId"]!);
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const isAthlete = role === "ATHLETE" && booking.athlete.userId === userId;
  const isCoach = role === "COACH" && booking.session.coach.userId === userId;
  if (!isAthlete && !isCoach) { res.status(403).json({ error: "Forbidden" }); return; }

  const progress = await progressRepo.listForBooking(db, req.params["bookingId"]!);
  res.json(progress);
});

// GET /api/progress/session/:sessionId — coach: all athletes' progress in a session
progressRouter.get("/session/:sessionId", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await sessionsRepo.findByIdAndCoach(db, req.params["sessionId"]!, coach.id);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const bookings = await sessionBookingsRepo.listBySession(db, req.params["sessionId"]!);
  res.json(bookings);
});
