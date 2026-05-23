import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import {
  athletesRepo,
  coachesRepo,
  exercisesRepo,
  sessionsRepo,
  sessionBookingsRepo,
} from "../repos";
import { dispatchNotifications } from "../services/notifications.service";
import { authenticate, requireCoach, requireAthlete, type AuthRequest } from "../middleware/auth";

export const sessionsRouter = Router();
sessionsRouter.use(authenticate);

// GET /api/sessions — coach: own sessions; athlete: available sessions from coaches
sessionsRouter.get("/", async (req, res) => {
  const { userId, role } = req as AuthRequest;

  if (role === "COACH") {
    const coach = await coachesRepo.findByUserId(db, userId);
    if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }
    const status = req.query["status"] as string | undefined;
    res.json(await sessionsRepo.listForCoach(db, coach.id, status as any));
    return;
  }

  const athlete = await athletesRepo.findByUserIdWithCoaches(db, userId);
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }

  const coachIds = athlete.coachAthletes.map((ca: { coachId: string }) => ca.coachId);
  const assigned = await sessionBookingsRepo.listSessionIdsForAthlete(db, athlete.id);
  const assignedSessionIds = assigned.map((b: { sessionId: string }) => b.sessionId);

  res.json(await sessionsRepo.listForAthleteUpcoming(db, { coachIds, assignedSessionIds }));
});

// GET /api/sessions/bookings — athlete: booked sessions
sessionsRouter.get("/bookings", requireAthlete, async (req, res) => {
  const { userId } = req as AuthRequest;
  const athlete = await athletesRepo.findByUserId(db, userId);
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }
  res.json(await sessionBookingsRepo.listForAthlete(db, athlete.id));
});

// GET /api/sessions/today — athlete: today's session
sessionsRouter.get("/today", requireAthlete, async (req, res) => {
  const { userId } = req as AuthRequest;
  const athlete = await athletesRepo.findByUserId(db, userId);
  if (!athlete) { res.status(404).json({ error: "Athlete profile not found" }); return; }
  res.json(await sessionBookingsRepo.findTodayForAthlete(db, athlete.id));
});

// GET /api/sessions/:id
sessionsRouter.get("/:id", async (req, res) => {
  const session = await sessionsRepo.findByIdWithDetails(db, req.params["id"]!);
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

  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await sessionsRepo.create(db, { ...result.data, coachId: coach.id });
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

  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await sessionsRepo.findByIdAndCoach(db, req.params["id"]!, coach.id);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const updated = await sessionsRepo.update(db, req.params["id"]!, result.data);
  res.json(updated);
});

// DELETE /api/sessions/:id — coach: cancel
sessionsRouter.delete("/:id", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;

  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await sessionsRepo.findByIdAndCoachWithBookings(db, req.params["id"]!, coach.id);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const updated = await sessionsRepo.cancel(db, req.params["id"]!);

  const recipientUserIds = Array.from(
    new Set(session.bookings.map((b: { athlete: { userId: string } }) => b.athlete.userId)),
  );
  await dispatchNotifications(
    recipientUserIds.map((notifyUserId) => ({
      userId: notifyUserId,
      type: "SESSION_CANCELLED" as const,
      title: "Session Cancelled",
      body: `${session.title} has been cancelled`,
      data: { sessionId: session.id },
    })),
  );

  res.json(updated);
});

// POST /api/sessions/:id/athletes — coach: assign athletes
sessionsRouter.post("/:id/athletes", requireCoach, async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({ athleteProfileIds: z.array(z.string()) });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await sessionsRepo.findByIdAndCoach(db, req.params["id"]!, coach.id);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const existing = await sessionBookingsRepo.listExisting(db, req.params["id"]!, result.data.athleteProfileIds);
  const existingIds = new Set(existing.map((b: { athleteId: string }) => b.athleteId));
  const newAthleteIds = result.data.athleteProfileIds.filter((id) => !existingIds.has(id));

  await sessionBookingsRepo.createMany(db, req.params["id"]!, result.data.athleteProfileIds);

  if (newAthleteIds.length > 0) {
    const newAthletes = await athletesRepo.findUserIdsByProfileIds(db, newAthleteIds);
    await dispatchNotifications(
      newAthletes.map((a: { userId: string }) => ({
        userId: a.userId,
        type: "SESSION_ASSIGNED" as const,
        title: "New Session Assigned",
        body: `You have been added to ${session.title}`,
        data: { sessionId: session.id },
      })),
    );
  }

  res.json(await sessionsRepo.findWithBookingsAfter(db, req.params["id"]!));
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

  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await sessionsRepo.findByIdAndCoach(db, req.params["sessionId"]!, coach.id);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const exercise = await exercisesRepo.createOne(db, req.params["sessionId"]!, result.data);
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

  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const session = await sessionsRepo.findByIdAndCoach(db, req.params["sessionId"]!, coach.id);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  await exercisesRepo.createMany(db, req.params["sessionId"]!, result.data.exercises);
  res.status(201).json(await exercisesRepo.listForSession(db, req.params["sessionId"]!));
});
