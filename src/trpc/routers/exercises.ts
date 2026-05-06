import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
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
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const session = await db.session.findFirst({ where: { id: input.sessionId, coachId: coach.id } });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      await db.exercise.createMany({
        data: input.exercises.map((ex) => ({ sessionId: input.sessionId, ...ex })),
      });
      return db.exercise.findMany({ where: { sessionId: input.sessionId }, orderBy: { order: "asc" } });
    }),

  update: coachProcedure
    .input(exerciseShape.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const exercise = await db.exercise.findFirst({ where: { id: input.id, session: { coachId: coach.id } } });
      if (!exercise) throw new TRPCError({ code: "NOT_FOUND", message: "Exercise not found" });
      const { id, ...data } = input;
      return db.exercise.update({ where: { id }, data });
    }),

  delete: coachProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await db.coachProfile.findUnique({ where: { userId: ctx.userId } });
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const exercise = await db.exercise.findFirst({ where: { id: input.id, session: { coachId: coach.id } } });
      if (!exercise) throw new TRPCError({ code: "NOT_FOUND", message: "Exercise not found" });
      await db.exercise.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
