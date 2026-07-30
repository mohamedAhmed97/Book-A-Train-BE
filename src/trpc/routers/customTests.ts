import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { athletesRepo, coachesRepo, notificationsRepo, customTestsRepo } from "../../repos";
import { router, coachProcedure, athleteProcedure } from "../init";

const movementSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  distanceMeters: z.number().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  notes: z.string().optional(),
  order: z.number().int().default(0),
});

export const customTestsRouter = router({
  // ── Coach ──────────────────────────────────────────────────────────────────

  list: coachProcedure.query(async ({ ctx }) => {
    const coach = await coachesRepo.findByUserId(db, ctx.userId);
    if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
    return customTestsRepo.listForCoach(db, coach.id);
  }),

  create: coachProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      sport: z.string().optional(),
      unit: z.string().min(1),
      movements: z.array(movementSchema).min(1, "At least one movement is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return customTestsRepo.create(db, { coachId: coach.id, ...input });
    }),

  assign: coachProcedure
    .input(z.object({
      customTestId: z.string(),
      athleteProfileId: z.string(),
      scheduledAt: z.coerce.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const customTest = await customTestsRepo.findByIdForCoach(db, input.customTestId, coach.id);
      if (!customTest) throw new TRPCError({ code: "NOT_FOUND", message: "Custom test not found" });
      const assignment = await customTestsRepo.assign(db, {
        customTestId: input.customTestId,
        athleteId: input.athleteProfileId,
        coachId: coach.id,
        scheduledAt: input.scheduledAt,
        notes: input.notes,
      });
      await notificationsRepo.createOne(db, {
        userId: assignment.athlete.userId,
        type: "TEST_ASSIGNED" as const,
        title: "New Custom Test Assigned",
        body: `Your coach assigned you a ${customTest.name} test`,
        data: { customTestAssignmentId: assignment.id },
      });
      return assignment;
    }),

  addResult: coachProcedure
    .input(z.object({
      assignmentId: z.string(),
      value: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const assignment = await customTestsRepo.findAssignmentByIdForCoach(db, input.assignmentId, coach.id);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      if (assignment.result) throw new TRPCError({ code: "CONFLICT", message: "Result already recorded" });
      const [result] = await Promise.all([
        customTestsRepo.addResult(db, input.assignmentId, input.value, assignment.customTest.unit, input.notes),
        customTestsRepo.markCompleted(db, input.assignmentId),
        notificationsRepo.createOne(db, {
          userId: assignment.athlete.userId,
          type: "TEST_RESULT_ADDED" as const,
          title: "Test Result Recorded",
          body: `Your ${assignment.customTest.name} result: ${input.value} ${assignment.customTest.unit}`,
          data: { customTestAssignmentId: assignment.id },
        }),
      ]);
      return result;
    }),

  athleteAssignments: coachProcedure
    .input(z.object({ athleteProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return customTestsRepo.listAssignmentsForAthlete(db, input.athleteProfileId, coach.id);
    }),

  setMovementResult: coachProcedure
    .input(z.object({
      assignmentId: z.string(),
      movementId: z.string(),
      value: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const assignment = await customTestsRepo.findAssignmentByIdForCoach(db, input.assignmentId, coach.id);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });

      await customTestsRepo.upsertMovementResult(db, input.assignmentId, input.movementId, input.value, input.notes);

      const updated = await customTestsRepo.findAssignmentWithResults(db, input.assignmentId);
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const movementsWithTargets = updated.customTest.movements.filter(
        (m: any) => m.durationSeconds != null || m.reps != null || m.distanceMeters != null || m.sets != null,
      );
      const allDone = movementsWithTargets.length > 0 &&
        movementsWithTargets.every((m: any) => updated.movementResults.some((r: any) => r.movementId === m.id));

      if (allDone && !updated.result) {
        const percentages = movementsWithTargets
          .map((m: any) => {
            const r = updated.movementResults.find((r: any) => r.movementId === m.id);
            if (!r) return null;
            if (m.durationSeconds != null && m.durationSeconds > 0 && r.value > 0)
              return (m.durationSeconds / r.value) * 100;
            const target = (m.reps != null && m.sets != null) ? m.reps * m.sets : (m.reps ?? m.distanceMeters ?? m.sets);
            return (target != null && target > 0) ? (r.value / target) * 100 : null;
          })
          .filter((p): p is number => p !== null && !isNaN(p) && isFinite(p));

        if (percentages.length === 0) return updated.movementResults;

        const overallPct = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length * 10) / 10;

        await Promise.all([
          db.customTestResult.create({
            data: { assignmentId: input.assignmentId, value: overallPct, unit: "%" },
          }),
          db.customTestAssignment.update({ where: { id: input.assignmentId }, data: { status: "COMPLETED" } }),
          db.notification.create({
            data: {
              userId: updated.athlete.userId,
              type: "TEST_RESULT_ADDED",
              title: "Test Completed! 🎉",
              body: `Your ${updated.customTest.name} score: ${overallPct}%`,
              data: { customTestAssignmentId: input.assignmentId },
            },
          }),
        ]);
      }

      return updated.movementResults;
    }),

  updateAssignment: coachProcedure
    .input(z.object({
      assignmentId: z.string(),
      scheduledAt: z.coerce.date().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const assignment = await customTestsRepo.findAssignmentByIdForCoach(db, input.assignmentId, coach.id);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      return customTestsRepo.updateAssignment(db, input.assignmentId, { scheduledAt: input.scheduledAt, notes: input.notes });
    }),

  deleteAssignment: coachProcedure
    .input(z.object({ assignmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const assignment = await customTestsRepo.findAssignmentByIdForCoach(db, input.assignmentId, coach.id);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      return customTestsRepo.deleteAssignment(db, input.assignmentId);
    }),

  // ── Athlete ────────────────────────────────────────────────────────────────

  myAssignments: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    return customTestsRepo.listMyAssignments(db, athlete.id);
  }),
});
