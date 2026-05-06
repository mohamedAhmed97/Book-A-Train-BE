import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { authenticate, requireAthlete, type AuthRequest } from "../middleware/auth";

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

  const athlete = await db.athleteProfile.findUnique({ where: { userId } });
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const booking = await db.sessionBooking.findFirst({ where: { id: result.data.bookingId, athleteId: athlete.id } });
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const progress = await db.workoutProgress.upsert({
    where: { bookingId_exerciseId: { bookingId: result.data.bookingId, exerciseId: result.data.exerciseId } },
    create: {
      bookingId: result.data.bookingId,
      exerciseId: result.data.exerciseId,
      completed: result.data.completed,
      completedAt: result.data.completed ? new Date() : null,
    },
    update: {
      completed: result.data.completed,
      completedAt: result.data.completed ? new Date() : null,
    },
  });
  res.json(progress);
});

// GET /api/progress/stats — athlete: summary stats
progressRouter.get("/stats", requireAthlete, async (req, res) => {
  const { userId } = req as AuthRequest;

  const athlete = await db.athleteProfile.findUnique({ where: { userId } });
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const totalSessions = await db.sessionBooking.count({ where: { athleteId: athlete.id, status: "CONFIRMED" } });

  const completedExercises = await db.workoutProgress.count({
    where: { booking: { athleteId: athlete.id }, completed: true },
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekSessions = await db.sessionBooking.count({
    where: { athleteId: athlete.id, status: "CONFIRMED", session: { scheduledAt: { gte: weekStart } } },
  });

  res.json({ totalSessions, completedExercises, thisWeekSessions });
});

// GET /api/progress/booking/:bookingId
progressRouter.get("/booking/:bookingId", async (req, res) => {
  const progress = await db.workoutProgress.findMany({ where: { bookingId: req.params["bookingId"] } });
  res.json(progress);
});

// GET /api/progress/session/:sessionId — coach: all athletes' progress in a session
progressRouter.get("/session/:sessionId", async (req, res) => {
  const bookings = await db.sessionBooking.findMany({
    where: { sessionId: req.params["sessionId"] },
    include: {
      athlete: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      progress: true,
    },
  });
  res.json(bookings);
});
