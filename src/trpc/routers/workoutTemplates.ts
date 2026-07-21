import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { coachesRepo } from "../../repos";
import { router, coachProcedure } from "../init";

// ── Default templates per sport ───────────────────────────────────────────────

type TemplateSeed = {
  name: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
};

const SPORT_DEFAULTS: Record<string, TemplateSeed[]> = {
  CrossFit: [
    { name: "CF Warm-Up",             sets: 1, durationSeconds: 600,  notes: "3 rounds: 10 air squats, 10 push-ups, 10 sit-ups, 200m jog" },
    { name: "Pull-Ups",               sets: 5, reps: 5,   restSeconds: 90,  notes: "Strict; scale to ring rows" },
    { name: "Kipping Pull-Ups",       sets: 4, reps: 10,  restSeconds: 60 },
    { name: "Muscle-Ups",             sets: 3, reps: 3,   restSeconds: 120, notes: "Scale to jumping muscle-ups" },
    { name: "Handstand Push-Ups",     sets: 4, reps: 8,   restSeconds: 60,  notes: "Head to abmat" },
    { name: "Toes-to-Bar",            sets: 4, reps: 10,  restSeconds: 45 },
    { name: "Box Jumps",              sets: 5, reps: 10,  restSeconds: 45,  notes: "Step down, don't jump down" },
    { name: "Double-Unders",          sets: 3, reps: 50,  restSeconds: 60,  notes: "Scale to 100 single-unders" },
    { name: "Back Squat",             sets: 5, reps: 5,   restSeconds: 180, notes: "Build to heavy 5" },
    { name: "Deadlift",               sets: 5, reps: 3,   restSeconds: 180, notes: "Conventional, full hip extension" },
    { name: "Strict Press",           sets: 4, reps: 5,   restSeconds: 120, notes: "No leg drive" },
    { name: "Power Clean",            sets: 5, reps: 3,   restSeconds: 120 },
    { name: "Clean & Jerk",           sets: 4, reps: 1,   restSeconds: 180, notes: "Build to heavy single" },
    { name: "Power Snatch",           sets: 5, reps: 3,   restSeconds: 120 },
    { name: "Thrusters",              sets: 4, reps: 10,  restSeconds: 90,  notes: "Front squat + push press in one motion" },
    { name: "KB Swing Intervals",     sets: 6, reps: 20,  restSeconds: 30,  notes: "32kg/24kg kettlebell, American swing" },
    { name: "Wall Ball Shots",        sets: 4, reps: 25,  restSeconds: 60,  notes: "9kg/6kg to 10ft/9ft target" },
    { name: "Fran (21-15-9)",         sets: 1, notes: "Thrusters 43kg/30kg + Pull-Ups, for time" },
    { name: "Cindy (20 min AMRAP)",   sets: 1, durationSeconds: 1200, notes: "5 Pull-Ups, 10 Push-Ups, 15 Air Squats" },
    { name: "EMOM Barbell Complex",   sets: 10, durationSeconds: 60, notes: "3 power cleans + 3 front squats + 3 push jerks" },
    { name: "Tabata Squats",          sets: 8, durationSeconds: 20, restSeconds: 10, notes: "Max air squats per interval" },
    { name: "Row for Calories",       sets: 4, durationSeconds: 60, restSeconds: 60, notes: "Max calories on rower" },
    { name: "Assault Bike Intervals", sets: 6, durationSeconds: 30, restSeconds: 90, notes: "Max effort on Assault Bike" },
    { name: "CF Cool Down",           sets: 1, durationSeconds: 300, notes: "PVC pipe mobility, foam rolling, pigeon stretch" },
  ],
  Swimming: [
    { name: "Warm-Up Swim", sets: 2, durationSeconds: 300, restSeconds: 30, notes: "Easy freestyle" },
    { name: "Freestyle Sprint", sets: 4, durationSeconds: 60, restSeconds: 60 },
    { name: "Butterfly Drill", sets: 3, durationSeconds: 120, restSeconds: 45 },
    { name: "Kick Board", sets: 3, durationSeconds: 90, restSeconds: 30 },
    { name: "Pull Buoy", sets: 3, durationSeconds: 120, restSeconds: 45 },
    { name: "Cool Down", sets: 1, durationSeconds: 180 },
  ],
  Running: [
    { name: "Dynamic Warm-Up", sets: 1, durationSeconds: 600 },
    { name: "Easy Jog", sets: 1, durationSeconds: 600, notes: "Zone 2 pace" },
    { name: "Interval Sprint", sets: 8, durationSeconds: 60, restSeconds: 90 },
    { name: "Tempo Run", sets: 1, durationSeconds: 1200 },
    { name: "Hill Repeats", sets: 6, durationSeconds: 60, restSeconds: 120 },
    { name: "Cool Down Stretch", sets: 1, durationSeconds: 300 },
  ],
  Cycling: [
    { name: "Warm-Up Spin", sets: 1, durationSeconds: 600 },
    { name: "Climbing Intervals", sets: 5, durationSeconds: 180, restSeconds: 60 },
    { name: "Sprint Efforts", sets: 6, durationSeconds: 30, restSeconds: 90 },
    { name: "Endurance Ride", sets: 1, durationSeconds: 3600 },
    { name: "Cool Down", sets: 1, durationSeconds: 300 },
  ],
  Football: [
    { name: "Passing Drills", sets: 3, reps: 20, restSeconds: 30 },
    { name: "Dribbling Course", sets: 4, durationSeconds: 60, restSeconds: 30 },
    { name: "Shooting Practice", sets: 3, reps: 10, restSeconds: 45 },
    { name: "Small-Sided Game", sets: 2, durationSeconds: 600, restSeconds: 120 },
    { name: "Heading Practice", sets: 3, reps: 15, restSeconds: 30 },
  ],
  Basketball: [
    { name: "Free Throws", sets: 5, reps: 10, restSeconds: 30 },
    { name: "Dribbling Drills", sets: 3, durationSeconds: 120, restSeconds: 30 },
    { name: "Jump Shots", sets: 4, reps: 12, restSeconds: 45 },
    { name: "Defense Slides", sets: 3, durationSeconds: 60, restSeconds: 30 },
    { name: "3-Point Practice", sets: 3, reps: 15, restSeconds: 45 },
  ],
  Tennis: [
    { name: "Forehand Groundstrokes", sets: 4, reps: 20, restSeconds: 30 },
    { name: "Backhand Drills", sets: 4, reps: 20, restSeconds: 30 },
    { name: "Serve Practice", sets: 3, reps: 15, restSeconds: 45 },
    { name: "Footwork Ladder", sets: 3, durationSeconds: 60, restSeconds: 30 },
    { name: "Rally Consistency", sets: 3, durationSeconds: 120, restSeconds: 45 },
  ],
  General: [
    { name: "Warm-Up", sets: 1, durationSeconds: 300 },
    { name: "Strength Circuit", sets: 3, reps: 12, restSeconds: 60 },
    { name: "Core Workout", sets: 3, reps: 15, restSeconds: 45 },
    { name: "Cardio Intervals", sets: 5, durationSeconds: 60, restSeconds: 60 },
    { name: "Cool Down Stretch", sets: 1, durationSeconds: 300 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeSport(sport: string): string {
  const lower = sport.toLowerCase();
  for (const key of Object.keys(SPORT_DEFAULTS)) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return "General";
}

// ── Router ────────────────────────────────────────────────────────────────────

const templateShape = z.object({
  name: z.string().min(1),
  sport: z.string().optional(),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  restSeconds: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export const workoutTemplatesRouter = router({
  list: coachProcedure
    .input(z.object({ sport: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const where: { coachId: string; sport?: string } = { coachId: coach.id };
      if (input?.sport) where.sport = input.sport;
      return db.workoutTemplate.findMany({ where, orderBy: { createdAt: "asc" } });
    }),

  create: coachProcedure
    .input(templateShape)
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      return db.workoutTemplate.create({ data: { coachId: coach.id, ...input } });
    }),

  update: coachProcedure
    .input(templateShape.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const existing = await db.workoutTemplate.findFirst({ where: { id: input.id, coachId: coach.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      const { id, ...data } = input;
      return db.workoutTemplate.update({ where: { id }, data });
    }),

  delete: coachProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const existing = await db.workoutTemplate.findFirst({ where: { id: input.id, coachId: coach.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      await db.workoutTemplate.delete({ where: { id: input.id } });
      return { success: true };
    }),

  seedDefaults: coachProcedure
    .input(z.object({ sport: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });

      const sportKey = normalizeSport(input.sport);
      const defaults = SPORT_DEFAULTS[sportKey] ?? SPORT_DEFAULTS["General"] ?? [];

      // Skip templates with the same name already in this coach's library for this sport
      const existing = await db.workoutTemplate.findMany({
        where: { coachId: coach.id, sport: sportKey },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((e) => e.name));
      const toCreate = defaults.filter((d) => !existingNames.has(d.name));

      if (toCreate.length === 0) return { created: 0, sport: sportKey };

      await db.workoutTemplate.createMany({
        data: toCreate.map((d) => ({ coachId: coach.id, sport: sportKey, ...d })),
      });

      return { created: toCreate.length, sport: sportKey };
    }),

  availableSports: coachProcedure.query(() => Object.keys(SPORT_DEFAULTS)),
});
