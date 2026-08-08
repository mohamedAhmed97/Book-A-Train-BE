import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../../lib/db";
import { athletesRepo, coachesRepo, coachAthletesRepo, vitalsRepo } from "../../repos";
import { router, athleteProcedure, coachProcedure, protectedProcedure } from "../init";
import {
  DEFAULT_MAX_HR,
  publishLiveVitals,
  recomputeSessionSummary,
  zoneForHeartRate,
} from "../../services/vitals";
import { metricMeta } from "../../services/metricCatalog";
import { signStreamToken } from "../../services/streamToken";

const providerEnum = z.enum(["HEALTH_CONNECT", "HEALTH_KIT", "WEAR_OS", "BLE", "MANUAL"]);

/**
 * Metric keys are open — whatever record type the athlete's watch exposes is
 * accepted — but the shape is fixed so a client can't write junk keys that make
 * the coach's metric list unreadable.
 */
const metricKey = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[A-Z0-9_]+$/, "Metric keys are SCREAMING_SNAKE_CASE");

/**
 * Plausibility bounds for the metrics we know. A watch with a bad skin seal
 * happily reports a heart rate of 4 or 340 bpm; storing those wrecks the session
 * averages and the coach's live view, so they're dropped at the door.
 *
 * A metric that isn't listed is still accepted — it just gets the generic
 * sanity window below instead of a physiological one. Being un-restrictive
 * about *which* metrics we take doesn't mean taking obvious garbage values.
 */
const METRIC_BOUNDS: Record<string, { min: number; max: number }> = {
  HEART_RATE: { min: 25, max: 240 },
  RESTING_HEART_RATE: { min: 25, max: 150 },
  HRV: { min: 1, max: 400 },
  SPO2: { min: 50, max: 100 },
  RESPIRATORY_RATE: { min: 3, max: 70 },
  SKIN_TEMPERATURE: { min: 20, max: 45 },
  BASAL_BODY_TEMPERATURE: { min: 20, max: 45 },
  BLOOD_PRESSURE_SYSTOLIC: { min: 50, max: 260 },
  BLOOD_PRESSURE_DIASTOLIC: { min: 30, max: 200 },
  CALORIES: { min: 0, max: 5000 },
  ACTIVE_CALORIES: { min: 0, max: 5000 },
  BASAL_CALORIES: { min: 0, max: 5000 },
  WALKING_STEP_LENGTH: { min: 0.1, max: 2 },
  BASAL_METABOLIC_RATE: { min: 500, max: 6000 },
  STEPS: { min: 0, max: 100_000 },
  DISTANCE: { min: 0, max: 300_000 },
  SLEEP_MINUTES: { min: 0, max: 1440 },
  ELEVATION_GAINED: { min: 0, max: 20_000 },
  FLOORS_CLIMBED: { min: 0, max: 500 },
  WHEELCHAIR_PUSHES: { min: 0, max: 100_000 },
  EXERCISE_MINUTES: { min: 0, max: 1440 },
  POWER: { min: 0, max: 2500 },
  SPEED: { min: 0, max: 50 },
  CYCLING_CADENCE: { min: 0, max: 250 },
  STEPS_CADENCE: { min: 0, max: 350 },
  VO2_MAX: { min: 10, max: 100 },
  WEIGHT: { min: 20, max: 400 },
  HEIGHT: { min: 0.5, max: 2.6 },
  BODY_FAT: { min: 1, max: 75 },
  LEAN_BODY_MASS: { min: 10, max: 200 },
  BONE_MASS: { min: 0.5, max: 10 },
  BODY_WATER_MASS: { min: 5, max: 150 },
  HYDRATION: { min: 0, max: 30 },
  BLOOD_GLUCOSE: { min: 1, max: 40 },
  NUTRITION_CALORIES: { min: 0, max: 20_000 },
};

/** Catch-all window for metrics with no entry above. */
const GENERIC_BOUNDS = { min: -1e7, max: 1e7 };

const sampleSchema = z.object({
  metric: metricKey,
  value: z.number().finite(),
  recordedAt: z.coerce.date(),
  unit: z.string().max(16).optional(),
});

// One poll cycle on the phone can surface a large backlog after the athlete
// regains signal, but an unbounded array is a trivial memory-exhaustion vector.
const MAX_BATCH = 500;

/** Reject samples outside plausible range or dated in the future. */
function sanitize(samples: z.infer<typeof sampleSchema>[]) {
  const now = Date.now();
  const kept: typeof samples = [];
  let rejected = 0;
  for (const s of samples) {
    const bounds = METRIC_BOUNDS[s.metric] ?? GENERIC_BOUNDS;
    const t = s.recordedAt.getTime();
    const inRange = s.value >= bounds.min && s.value <= bounds.max;
    // Allow 2 minutes of clock skew between the watch and the server.
    const plausibleTime = t <= now + 120_000;
    if (inRange && plausibleTime) kept.push(s);
    else rejected++;
  }
  return { kept, rejected };
}

/** Metrics charted as a time series by default on the coach and athlete screens. */
const DEFAULT_SERIES_METRICS = ["HEART_RATE", "SPO2", "RESPIRATORY_RATE"];

/** Collapse open per-metric daily rows into one entry per calendar day. */
function groupDailyByDate(
  rows: Array<{ date: Date; metric: string; value: number; unit: string }>,
) {
  const byDate = new Map<string, { date: Date; metrics: Record<string, { value: number; unit: string }> }>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    let day = byDate.get(key);
    if (!day) {
      day = { date: row.date, metrics: {} };
      byDate.set(key, day);
    }
    day.metrics[row.metric] = { value: row.value, unit: row.unit };
  }
  // listDaily already orders date desc; Map preserves that insertion order.
  return [...byDate.values()];
}

async function requireAthlete(userId: string) {
  const athlete = await athletesRepo.findByUserId(db, userId);
  if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
  return athlete;
}

/** Resolve a booking the requesting coach is allowed to see. */
async function requireCoachBooking(userId: string, bookingId: string) {
  const coach = await coachesRepo.findByUserId(db, userId);
  if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
  const booking = await db.sessionBooking.findFirst({
    where: { id: bookingId, session: { coachId: coach.id } },
    include: {
      athlete: { include: { user: { select: { name: true, avatar: true } } } },
      session: { select: { id: true, title: true, sport: true, scheduledAt: true } },
    },
  });
  if (!booking)
    throw new TRPCError({ code: "FORBIDDEN", message: "Session is not on your roster" });
  return booking;
}

export const vitalsRouter = router({
  // ── Athlete: device linking ──────────────────────────────────────────────

  status: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await requireAthlete(ctx.userId);
    const watch = await vitalsRepo.findWatchByAthleteId(db, athlete.id);
    return {
      connected: !!watch?.enabled,
      provider: watch?.provider ?? null,
      deviceName: watch?.deviceName ?? null,
      deviceModel: watch?.deviceModel ?? null,
      grantedTypes: watch?.grantedTypes ?? [],
      lastSyncAt: watch?.lastSyncAt ?? null,
      maxHeartRate: athlete.maxHeartRate ?? DEFAULT_MAX_HR,
      maxHeartRateIsDefault: athlete.maxHeartRate == null,
    };
  }),

  connect: athleteProcedure
    .input(
      z.object({
        provider: providerEnum.default("HEALTH_CONNECT"),
        deviceName: z.string().max(120).optional(),
        deviceModel: z.string().max(120).optional(),
        // No cap on which types: the athlete grants whatever their watch
        // exposes and we record all of it.
        grantedTypes: z.array(z.string().max(64)).max(100).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const athlete = await requireAthlete(ctx.userId);
      return vitalsRepo.upsertWatch(db, {
        athleteId: athlete.id,
        provider: input.provider,
        deviceName: input.deviceName ?? null,
        deviceModel: input.deviceModel ?? null,
        grantedTypes: input.grantedTypes,
      });
    }),

  disconnect: athleteProcedure.mutation(async ({ ctx }) => {
    const athlete = await requireAthlete(ctx.userId);
    await vitalsRepo.deleteWatch(db, athlete.id);
    return { success: true };
  }),

  setMaxHeartRate: athleteProcedure
    .input(z.object({ maxHeartRate: z.number().int().min(120).max(230).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const athlete = await requireAthlete(ctx.userId);
      await db.athleteProfile.update({
        where: { id: athlete.id },
        data: { maxHeartRate: input.maxHeartRate },
      });
      return { maxHeartRate: input.maxHeartRate ?? DEFAULT_MAX_HR };
    }),

  // ── Athlete: ingest ──────────────────────────────────────────────────────

  /**
   * Bulk sample upload from the phone. Called every few seconds while a session
   * is being recorded, and once on session end to flush the tail. Safe to retry:
   * duplicates are skipped on the unique (athlete, metric, instant) index.
   */
  ingest: athleteProcedure
    .input(
      z.object({
        bookingId: z.string().nullable().optional(),
        provider: providerEnum.default("HEALTH_CONNECT"),
        deviceName: z.string().max(120).optional(),
        samples: z.array(sampleSchema).min(1).max(MAX_BATCH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const athlete = await athletesRepo.findByUserIdWithName(db, ctx.userId);
      if (!athlete)
        throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });

      // A null bookingId means an ambient reading (daily sync), which is fine.
      // A non-null one must belong to this athlete.
      if (input.bookingId) {
        const booking = await db.sessionBooking.findFirst({
          where: { id: input.bookingId, athleteId: athlete.id },
          select: { id: true },
        });
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      }

      const { kept, rejected } = sanitize(input.samples);
      if (kept.length === 0) return { accepted: 0, rejected, summary: null };

      await vitalsRepo.createSamples(
        db,
        kept.map((s) => ({
          athleteId: athlete.id,
          bookingId: input.bookingId ?? null,
          metric: s.metric,
          value: s.value,
          unit: s.unit ?? metricMeta(s.metric).unit,
          recordedAt: s.recordedAt,
          source: input.provider,
          deviceName: input.deviceName ?? null,
        })),
      );
      await vitalsRepo.touchWatchSync(db, athlete.id);

      const maxHr = athlete.maxHeartRate ?? DEFAULT_MAX_HR;

      if (!input.bookingId) return { accepted: kept.length, rejected, summary: null };

      const summary = await recomputeSessionSummary(input.bookingId, maxHr);

      // Push to any coach watching this booking's SSE stream.
      const latestHr = kept
        .filter((s) => s.metric === "HEART_RATE")
        .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
      publishLiveVitals({
        bookingId: input.bookingId,
        athleteId: athlete.id,
        athleteName: athlete.user.name,
        samples: kept.map((s) => ({
          metric: s.metric,
          value: s.value,
          unit: s.unit ?? metricMeta(s.metric).unit,
          recordedAt: s.recordedAt.toISOString(),
        })),
        zone: latestHr ? zoneForHeartRate(latestHr.value, maxHr) : null,
        at: new Date().toISOString(),
      });

      return { accepted: kept.length, rejected, summary };
    }),

  // ── Athlete: read back own data ──────────────────────────────────────────

  mySessionVitals: athleteProcedure
    .input(
      z.object({
        bookingId: z.string(),
        seriesMetrics: z.array(metricKey).max(10).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const athlete = await requireAthlete(ctx.userId);
      const booking = await db.sessionBooking.findFirst({
        where: { id: input.bookingId, athleteId: athlete.id },
        select: { id: true },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      const [summary, metricSummaries, samples] = await Promise.all([
        vitalsRepo.findSummary(db, input.bookingId),
        vitalsRepo.listMetricSummaries(db, input.bookingId),
        vitalsRepo.listSamplesForBooking(db, input.bookingId, {
          metrics: input.seriesMetrics ?? DEFAULT_SERIES_METRICS,
        }),
      ]);
      return {
        summary,
        metricSummaries,
        maxHeartRate: athlete.maxHeartRate ?? DEFAULT_MAX_HR,
        samples: samples.map((s) => ({
          metric: s.metric,
          value: s.value,
          recordedAt: s.recordedAt,
        })),
      };
    }),

  myDaily: athleteProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(14) }))
    .query(async ({ ctx, input }) => {
      const athlete = await requireAthlete(ctx.userId);
      const to = new Date();
      const from = new Date(to.getTime() - input.days * 86_400_000);
      return groupDailyByDate(await vitalsRepo.listDaily(db, athlete.id, from, to));
    }),

  /**
   * Daily rollup written by the phone's foreground sync. Separate from `ingest`
   * because these are already-aggregated day values, not a time series.
   *
   * Takes an open metric list rather than fixed fields, so a watch that starts
   * reporting something new needs no server change.
   */
  upsertDaily: athleteProcedure
    .input(
      z.object({
        date: z.coerce.date(),
        metrics: z
          .array(
            z.object({
              metric: metricKey,
              value: z.number().finite(),
              unit: z.string().max(16).optional(),
            }),
          )
          .max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const athlete = await requireAthlete(ctx.userId);
      // Normalise to UTC midnight so the unique (athlete, date, metric) key is
      // stable regardless of the phone's timezone.
      const day = new Date(
        Date.UTC(
          input.date.getUTCFullYear(),
          input.date.getUTCMonth(),
          input.date.getUTCDate(),
        ),
      );

      // Same plausibility gate as ingest — a daily rollup is still watch data.
      const kept = input.metrics.filter((m) => {
        const bounds = METRIC_BOUNDS[m.metric] ?? GENERIC_BOUNDS;
        return m.value >= bounds.min && m.value <= bounds.max;
      });

      await vitalsRepo.touchWatchSync(db, athlete.id);
      const written = await vitalsRepo.upsertDailyMetrics(
        db,
        athlete.id,
        day,
        kept.map((m) => ({
          metric: m.metric,
          value: m.value,
          unit: m.unit ?? metricMeta(m.metric).unit,
        })),
      );
      return { date: day, written, rejected: input.metrics.length - kept.length };
    }),

  // ── Coach: monitoring ────────────────────────────────────────────────────

  /**
   * Everything the coach needs for one athlete's session: the HR headline row,
   * a rollup of every other metric the watch captured, and a chartable series
   * for the metrics worth plotting.
   */
  sessionVitals: coachProcedure
    .input(
      z.object({
        bookingId: z.string(),
        seriesMetrics: z.array(metricKey).max(10).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const booking = await requireCoachBooking(ctx.userId, input.bookingId);
      const [summary, metricSummaries, samples, availableMetrics] = await Promise.all([
        vitalsRepo.findSummary(db, input.bookingId),
        vitalsRepo.listMetricSummaries(db, input.bookingId),
        vitalsRepo.listSamplesForBooking(db, input.bookingId, {
          metrics: input.seriesMetrics ?? DEFAULT_SERIES_METRICS,
        }),
        vitalsRepo.distinctMetricsForBooking(db, input.bookingId),
      ]);
      return {
        athleteName: booking.athlete.user.name,
        sessionTitle: booking.session.title,
        maxHeartRate: booking.athlete.maxHeartRate ?? DEFAULT_MAX_HR,
        summary,
        /** Every metric this session captured, rolled up. */
        metricSummaries,
        /** Keys the coach can request a series for. */
        availableMetrics,
        samples: samples.map((s) => ({
          metric: s.metric,
          value: s.value,
          recordedAt: s.recordedAt,
        })),
      };
    }),

  /**
   * Initial state for the live board — every athlete of this coach with a
   * session today, and their most recent reading per metric. The SSE stream
   * takes over for updates once the dashboard has this.
   */
  liveBoard: coachProcedure.query(async ({ ctx }) => {
    const coach = await coachesRepo.findByUserId(db, ctx.userId);
    if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const bookings = await db.sessionBooking.findMany({
      where: {
        status: "CONFIRMED",
        session: { coachId: coach.id, scheduledAt: { gte: dayStart, lt: dayEnd } },
      },
      include: {
        athlete: { include: { user: { select: { name: true, avatar: true } } } },
        session: { select: { id: true, title: true, sport: true, scheduledAt: true, status: true } },
        workoutResult: { select: { completedAt: true } },
      },
      orderBy: { session: { scheduledAt: "asc" } },
    });

    // Freshness threshold — a watch that hasn't reported within this window is
    // shown as stale rather than pretending the last value is current.
    const staleAfterMs = 3 * 60_000;
    const now = Date.now();

    // One query for the whole board rather than one per booking per metric.
    const latestRows = await vitalsRepo.latestPerMetricForBookings(
      db,
      bookings.map((b) => b.id),
    );
    const latestByBooking = new Map<string, typeof latestRows>();
    for (const row of latestRows) {
      const bucket = latestByBooking.get(row.bookingId);
      if (bucket) bucket.push(row);
      else latestByBooking.set(row.bookingId, [row]);
    }

    return bookings.map((booking) => {
      const latest = latestByBooking.get(booking.id) ?? [];
      const maxHr = booking.athlete.maxHeartRate ?? DEFAULT_MAX_HR;
      const hr = latest.find((s) => s.metric === "HEART_RATE");
      const lastAt = latest.reduce<Date | null>(
        (newest, s) => (!newest || s.recordedAt > newest ? s.recordedAt : newest),
        null,
      );
      return {
        bookingId: booking.id,
        athleteId: booking.athleteId,
        athleteName: booking.athlete.user.name,
        athleteAvatar: booking.athlete.user.avatar,
        sessionId: booking.session.id,
        sessionTitle: booking.session.title,
        sport: booking.session.sport,
        scheduledAt: booking.session.scheduledAt,
        completed: !!booking.workoutResult,
        maxHeartRate: maxHr,
        heartRate: hr?.value ?? null,
        zone: hr ? zoneForHeartRate(hr.value, maxHr) : null,
        lastSampleAt: lastAt,
        stale: !lastAt || now - lastAt.getTime() > staleAfterMs,
        // Every metric the watch is currently reporting, not a fixed five.
        metrics: latest.map((s) => ({
          metric: s.metric,
          value: s.value,
          unit: s.unit,
          recordedAt: s.recordedAt,
        })),
      };
    });
  }),

  athleteDaily: coachProcedure
    .input(
      z.object({
        athleteProfileId: z.string(),
        days: z.number().int().min(1).max(90).default(14),
      }),
    )
    .query(async ({ ctx, input }) => {
      const coach = await coachesRepo.findByUserId(db, ctx.userId);
      if (!coach) throw new TRPCError({ code: "NOT_FOUND", message: "Coach profile not found" });
      const relation = await coachAthletesRepo.findRelation(db, coach.id, input.athleteProfileId);
      if (!relation)
        throw new TRPCError({ code: "FORBIDDEN", message: "Athlete not in your roster" });
      const to = new Date();
      const from = new Date(to.getTime() - input.days * 86_400_000);
      return groupDailyByDate(
        await vitalsRepo.listDaily(db, input.athleteProfileId, from, to),
      );
    }),

  /**
   * Short-lived token for the SSE stream. EventSource can't set an
   * Authorization header, so the coach exchanges their JWT for a token that
   * travels in the query string and is only good for this one booking.
   */
  liveStreamToken: protectedProcedure
    .input(z.object({ bookingId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.role === "COACH") {
        await requireCoachBooking(ctx.userId, input.bookingId);
      } else {
        const athlete = await requireAthlete(ctx.userId);
        const booking = await db.sessionBooking.findFirst({
          where: { id: input.bookingId, athleteId: athlete.id },
          select: { id: true },
        });
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      }
      return { token: signStreamToken(ctx.userId, input.bookingId) };
    }),
});
