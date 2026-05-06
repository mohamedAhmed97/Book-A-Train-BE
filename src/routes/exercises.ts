import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { authenticate, requireCoach, type AuthRequest } from "../middleware/auth";

export const exercisesRouter = Router();
exercisesRouter.use(authenticate, requireCoach);

const exerciseShape = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  restSeconds: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  order: z.number().int().nonnegative().default(0),
});

// PUT /api/exercises/:id
exercisesRouter.put("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const result = exerciseShape.partial().safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") }); return; }

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const exercise = await db.exercise.findFirst({ where: { id: req.params["id"], session: { coachId: coach.id } } });
  if (!exercise) { res.status(404).json({ error: "Exercise not found" }); return; }

  const updated = await db.exercise.update({ where: { id: req.params["id"] }, data: result.data });
  res.json(updated);
});

// DELETE /api/exercises/:id
exercisesRouter.delete("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;

  const coach = await db.coachProfile.findUnique({ where: { userId } });
  if (!coach) { res.status(404).json({ error: "Coach profile not found" }); return; }

  const exercise = await db.exercise.findFirst({ where: { id: req.params["id"], session: { coachId: coach.id } } });
  if (!exercise) { res.status(404).json({ error: "Exercise not found" }); return; }

  await db.exercise.delete({ where: { id: req.params["id"] } });
  res.json({ success: true });
});
