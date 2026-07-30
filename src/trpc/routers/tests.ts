import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { athletesRepo, coachesRepo, notificationsRepo, testsRepo } from "../../repos";
import { router, coachProcedure, athleteProcedure } from "../init";

export const testsRouter = router({
  // ── Coach ──────────────────────────────────────────────────────────────────

  catalog: coachProcedure.query(async ({ ctx }) => {
    const coach = await coachesRepo.findByUserId(db, ctx.userId);
    if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
    return testsRepo.listCatalog(db, coach.id);
  }),

  createTest: coachProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      sport: z.string().optional(),
      unit: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return testsRepo.createTest(db, { ...input, coachId: coach.id });
    }),

  assign: coachProcedure
    .input(z.object({
      testId: z.string(),
      athleteProfileId: z.string(),
      scheduledAt: z.coerce.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const test = await testsRepo.findById(db, input.testId);
      if (!test) throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
      const athleteTest = await testsRepo.assign(db, {
        testId: input.testId,
        athleteId: input.athleteProfileId,
        coachId: coach.id,
        scheduledAt: input.scheduledAt,
        notes: input.notes,
      });
      await notificationsRepo.createOne(db, {
        userId: athleteTest.athlete.userId,
        type: "TEST_ASSIGNED" as const,
        title: "New Test Assigned",
        body: `Your coach assigned you a ${test.name}`,
        data: { athleteTestId: athleteTest.id },
      });
      return athleteTest;
    }),

  addResult: coachProcedure
    .input(z.object({
      athleteTestId: z.string(),
      value: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const athleteTest = await testsRepo.findAthleteTestByIdForCoach(db, input.athleteTestId, coach.id);
      if (!athleteTest) throw new TRPCError({ code: "NOT_FOUND", message: "Test assignment not found" });
      if (athleteTest.result) throw new TRPCError({ code: "CONFLICT", message: "Result already recorded" });
      const [result] = await Promise.all([
        testsRepo.addResult(db, input.athleteTestId, input.value, athleteTest.test.unit, input.notes),
        testsRepo.markCompleted(db, input.athleteTestId),
        notificationsRepo.createOne(db, {
          userId: athleteTest.athlete.userId,
          type: "TEST_RESULT_ADDED" as const,
          title: "Test Result Recorded",
          body: `Your ${athleteTest.test.name} result: ${input.value} ${athleteTest.test.unit}`,
          data: { athleteTestId: athleteTest.id },
        }),
      ]);
      return result;
    }),

  athleteTests: coachProcedure
    .input(z.object({ athleteProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return testsRepo.listForAthlete(db, input.athleteProfileId, coach.id);
    }),

  updateAssignment: coachProcedure
    .input(z.object({
      athleteTestId: z.string(),
      scheduledAt: z.coerce.date().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const assignment = await testsRepo.findAthleteTestByIdForCoach(db, input.athleteTestId, coach.id);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      return testsRepo.updateAssignment(db, input.athleteTestId, { scheduledAt: input.scheduledAt, notes: input.notes });
    }),

  deleteAssignment: coachProcedure
    .input(z.object({ athleteTestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const assignment = await testsRepo.findAthleteTestByIdForCoach(db, input.athleteTestId, coach.id);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      return testsRepo.deleteAssignment(db, input.athleteTestId);
    }),

  // ── Athlete ────────────────────────────────────────────────────────────────

  myTests: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    return testsRepo.listMyTests(db, athlete.id);
  }),
});
