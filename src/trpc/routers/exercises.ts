import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import {
  coachesRepo,
  exercisesRepo,
  sessionsRepo,
} from "../../repos";
import { dispatchNotifications } from "../../services/notifications.service";
import { router, coachProcedure } from "../init";

const exerciseShape = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  restSeconds: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  order: z.number().int().nonnegative().default(0),
});

export const exercisesRouter = router({
  addMany: coachProcedure
    .input(z.object({ sessionId: z.string(), exercises: z.array(exerciseShape) }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await sessionsRepo.findByIdAndCoachWithBookings(db, input.sessionId, coach.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      await exercisesRepo.createMany(db, input.sessionId, input.exercises);
      const recipientUserIds = Array.from(
        new Set(session.bookings.map((b: { athlete: { userId: string } }) => b.athlete.userId)),
      );
      if (recipientUserIds.length > 0) {
        const count = input.exercises.length;
        await dispatchNotifications(
          recipientUserIds.map((userId) => ({
            userId,
            type: "EXERCISE_ASSIGNED" as const,
            title: "New Exercises Added",
            body: `${count} new exercise${count > 1 ? "s" : ""} added to ${session.title}`,
            data: { sessionId: session.id, exerciseCount: count },
          })),
        );
      }
      return exercisesRepo.listForSession(db, input.sessionId);
    }),

  update: coachProcedure
    .input(exerciseShape.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const exercise = await exercisesRepo.findByIdForCoach(db, input.id, coach.id);
      if (!exercise) throw new TRPCError({ code: "NOT_FOUND", message: "Exercise not found" });
      const { id, ...data } = input;
      return exercisesRepo.update(db, id, data);
    }),

  delete: coachProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const exercise = await exercisesRepo.findByIdForCoach(db, input.id, coach.id);
      if (!exercise) throw new TRPCError({ code: "NOT_FOUND", message: "Exercise not found" });
      await exercisesRepo.delete(db, input.id);
      return { success: true };
    }),
});
