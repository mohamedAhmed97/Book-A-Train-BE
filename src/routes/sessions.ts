import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { authenticate, requireCoach, requireAthlete, type AuthRequest } from "../middleware/auth";

export const sessionsRouter = Router();
sessionsRouter.use(authenticate);

// GET /api/sessions — coach: own sessions; athlete: available sessions from coaches
sessionsRouter.get("/", async (req, res) => {
  const { userId, role } = req as AuthRequest;

  if (role === "COACH") {
    const coach = await db.coachProfile.findUnique({ where: { userId } });
    if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

    const status = req.query["status"] as string | undefined;
    const sessions = await db.session.findMany({
      where: { coachId: coach.id, ...(status ? { status: status as any } : {}) },
      include: {
        exercises: { orderBy: { order: "asc" } },
        bookings: { include: { athlete: { include: { user: { select: { id: true, name: true, avatar: true } } } } } },
        _count: { select: { bookings: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    res.json(sessions);
    return;
  }

  const athlete = await db.athleteProfile.findUnique({
    where: { userId },
    include: { coachAthletes: { select: { coachId: true } } },
  });
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const coachIds = athlete.coachAthletes.map((ca) => ca.coachId);

  // include sessions directly assigned via booking even if not on coach's roster
  const assignedSessions = await db.sessionBooking.findMany({
    where: { athleteId: athlete.id },
    select: { sessionId: true },
  });
  const assignedSessionIds = assignedSessions.map((b) => b.sessionId);

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const sessions = await db.session.findMany({
    where: {
      status: { in: ["SCHEDULED", "ONGOING"] },
      scheduledAt: { gte: startOfToday },
      OR: [
        { coachId: { in: coachIds } },
        { id: { in: assignedSessionIds } },
      ],
    },
    include: {
      exercises: { orderBy: { order: "asc" } },
      _count: { select: { bookings: true } },
      coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  res.json(sessions);
});

// GET /api/sessions/bookings — athlete: booked sessions
sessionsRouter.get("/bookings", requireAthlete, async (req, res) => {
  const { userId } = req as AuthRequest;
  const athlete = await db.athleteProfile.findUnique({ where: { userId } });
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const bookings = await db.sessionBooking.findMany({
    where: { athleteId: athlete.id, status: "CONFIRMED" },
    include: {
      session: {
        include: {
          exercises: { orderBy: { order: "asc" } },
          coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
      },
      progress: true,
    },
    orderBy: { session: { scheduledAt: "asc" } },
  });
  res.json(bookings);
});

// GET /api/sessions/today — athlete: today's session
sessionsRouter.get("/today", requireAthlete, async (req, res) => {
  const { userId } = req as AuthRequest;
  const athlete = await db.athleteProfile.findUnique({ where: { userId } });
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);

  const booking = await db.sessionBooking.findFirst({
    where: { athleteId: athlete.id, status: "CONFIRMED", session: { scheduledAt: { gte: start, lte: end } } },
    include: {
      session: {
        include: {
          exercises: { orderBy: { order: "asc" } },
          coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
      },
      progress: true,
    },
  });
  res.json(booking);
});

// GET /api/sessions/:id
sessionsRouter.get("/:id", async (req, res) => {
  const session = await db.session.findUnique({
    where: { id: req.params["id"] },
    include: {
      exercises: { orderBy: { order: "asc" } },
      bookings: { include: { athlete: { include: { user: { select: { id: true, name: true, avatar: true } } } } } },
      coach: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      _count: { select: { bookings: true } },
    },
  });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(session);
});

// POST /api/sessions — coach: create
sessionsRouter.post("/", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({
    title: z.string().min(1),
    sport: z.string().min(1),
    description: z.string().optional(),
    location: z.string().optional(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().min(15).max(480),
    maxAthletes: z.number().int().min(1).max(100).default(10),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") }); return; }

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await db.session.create({
    data: { ...result.data, coachId: coach.id },
    include: { exercises: { orderBy: { order: "asc" } }, _count: { select: { bookings: true } } },
  });
  res.status(201).json(session);
});

// PUT /api/sessions/:id — coach: update
sessionsRouter.put("/:id", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({
    title: z.string().optional(),
    sport: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    scheduledAt: z.coerce.date().optional(),
    durationMinutes: z.number().int().optional(),
    maxAthletes: z.number().int().optional(),
    status: z.enum(["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") }); return; }

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await db.session.findFirst({ where: { id: req.params["id"], coachId: coach.id } });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const updated = await db.session.update({
    where: { id: req.params["id"] },
    data: result.data,
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  res.json(updated);
});

// DELETE /api/sessions/:id — coach: cancel
sessionsRouter.delete("/:id", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await db.session.findFirst({
    where: { id: req.params["id"], coachId: coach.id },
    include: { bookings: { include: { athlete: { select: { userId: true } } } } },
  });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const updated = await db.session.update({ where: { id: req.params["id"] }, data: { status: "CANCELLED" } });

  const recipientUserIds = Array.from(new Set(session.bookings.map((b) => b.athlete.userId)));
  if (recipientUserIds.length > 0) {
    await db.notification.createMany({
      data: recipientUserIds.map((notifyUserId) => ({
        userId: notifyUserId,
        type: "SESSION_CANCELLED",
        title: "Session Cancelled",
        body: `${session.title} has been cancelled`,
        data: { sessionId: session.id },
      })),
    });
  }

  res.json(updated);
});

// POST /api/sessions/:id/athletes — coach: assign athletes
sessionsRouter.post("/:id/athletes", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({ athleteProfileIds: z.array(z.string()) });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await db.session.findFirst({ where: { id: req.params["id"], coachId: coach.id } });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const existing = await db.sessionBooking.findMany({
    where: { sessionId: req.params["id"]!, athleteId: { in: result.data.athleteProfileIds } },
    select: { athleteId: true },
  });
  const existingIds = new Set(existing.map((b) => b.athleteId));
  const newAthleteIds = result.data.athleteProfileIds.filter((id) => !existingIds.has(id));

  await db.sessionBooking.createMany({
    data: result.data.athleteProfileIds.map((athleteId) => ({ sessionId: req.params["id"]!, athleteId })),
    skipDuplicates: true,
  });

  if (newAthleteIds.length > 0) {
    const newAthletes = await db.athleteProfile.findMany({
      where: { id: { in: newAthleteIds } },
      select: { userId: true },
    });
    if (newAthletes.length > 0) {
      await db.notification.createMany({
        data: newAthletes.map((a) => ({
          userId: a.userId,
          type: "SESSION_ASSIGNED",
          title: "New Session Assigned",
          body: `You have been added to ${session.title}`,
          data: { sessionId: session.id },
        })),
      });
    }
  }

  const updated = await db.session.findUnique({
    where: { id: req.params["id"] },
    include: { bookings: true, exercises: { orderBy: { order: "asc" } } },
  });
  res.json(updated);
});

// POST /api/sessions/:sessionId/exercises — coach: add one exercise
sessionsRouter.post("/:sessionId/exercises", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({
    name: z.string().min(1),
    sets: z.number().int().positive().optional(),
    reps: z.number().int().positive().optional(),
    durationSeconds: z.number().int().positive().optional(),
    restSeconds: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    order: z.number().int().nonnegative().default(0),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") }); return; }

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await db.session.findFirst({ where: { id: req.params["sessionId"], coachId: coach.id } });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const exercise = await db.exercise.create({ data: { sessionId: req.params["sessionId"]!, ...result.data } });
  res.status(201).json(exercise);
});

// POST /api/sessions/:sessionId/exercises/bulk — coach: add many exercises
sessionsRouter.post("/:sessionId/exercises/bulk", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const exerciseShape = z.object({
    name: z.string().min(1),
    sets: z.number().int().positive().optional(),
    reps: z.number().int().positive().optional(),
    durationSeconds: z.number().int().positive().optional(),
    restSeconds: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    order: z.number().int().nonnegative().default(0),
  });
  const schema = z.object({ exercises: z.array(exerciseShape) });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") }); return; }

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await db.session.findFirst({ where: { id: req.params["sessionId"], coachId: coach.id } });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  await db.exercise.createMany({
    data: result.data.exercises.map((ex) => ({ sessionId: req.params["sessionId"]!, ...ex })),
  });

  const exercises = await db.exercise.findMany({
    where: { sessionId: req.params["sessionId"] },
    orderBy: { order: "asc" },
  });
  res.status(201).json(exercises);
});
