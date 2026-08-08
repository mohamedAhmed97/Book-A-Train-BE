import type { VitalsProvider, Prisma } from "@prisma/client";
import type { DBClient } from "./types";

export interface VitalsSampleInput {
  athleteId: string;
  bookingId?: string | null;
  /** Open metric key — see services/metricCatalog.ts. */
  metric: string;
  value: number;
  unit: string;
  recordedAt: Date;
  source?: VitalsProvider;
  deviceName?: string | null;
}

/** One metric's rollup for a session, as written by recomputeSessionSummary. */
export interface MetricAggregateInput {
  metric: string;
  unit: string;
  min: number;
  max: number;
  avg: number;
  sum: number;
  last: number;
  count: number;
}

/** One metric's value for one calendar day, as uploaded by the phone. */
export interface DailyMetricInput {
  metric: string;
  value: number;
  unit: string;
}

export const vitalsRepo = {
  // ── Watch integration ────────────────────────────────────────────────────

  findWatchByAthleteId(db: DBClient, athleteId: string) {
    return db.watchIntegration.findUnique({ where: { athleteId } });
  },

  upsertWatch(
    db: DBClient,
    data: {
      athleteId: string;
      provider: VitalsProvider;
      deviceName?: string | null;
      deviceModel?: string | null;
      grantedTypes: string[];
    },
  ) {
    return db.watchIntegration.upsert({
      where: { athleteId: data.athleteId },
      create: { ...data, enabled: true },
      update: {
        provider: data.provider,
        deviceName: data.deviceName ?? null,
        deviceModel: data.deviceModel ?? null,
        grantedTypes: data.grantedTypes,
        enabled: true,
      },
    });
  },

  touchWatchSync(db: DBClient, athleteId: string) {
    return db.watchIntegration.updateMany({
      where: { athleteId },
      data: { lastSyncAt: new Date() },
    });
  },

  deleteWatch(db: DBClient, athleteId: string) {
    return db.watchIntegration.deleteMany({ where: { athleteId } });
  },

  // ── Samples ──────────────────────────────────────────────────────────────

  /**
   * Idempotent bulk insert. The phone re-sends unacknowledged batches after a
   * dropped connection, so duplicates on (athleteId, metric, recordedAt) are
   * expected and skipped rather than treated as errors.
   */
  createSamples(db: DBClient, samples: VitalsSampleInput[]) {
    return db.vitalsSample.createMany({
      data: samples.map((s) => ({
        athleteId: s.athleteId,
        bookingId: s.bookingId ?? null,
        metric: s.metric,
        value: s.value,
        unit: s.unit,
        recordedAt: s.recordedAt,
        source: s.source ?? "HEALTH_CONNECT",
        deviceName: s.deviceName ?? null,
      })),
      skipDuplicates: true,
    });
  },

  listSamplesForBooking(
    db: DBClient,
    bookingId: string,
    opts?: { metrics?: string[]; since?: Date; limit?: number },
  ) {
    const where: Prisma.VitalsSampleWhereInput = { bookingId };
    if (opts?.metrics?.length) where.metric = { in: opts.metrics };
    if (opts?.since) where.recordedAt = { gt: opts.since };
    return db.vitalsSample.findMany({
      where,
      orderBy: { recordedAt: "asc" },
      ...(opts?.limit ? { take: opts.limit } : {}),
    });
  },

  /**
   * Latest sample of every metric, for many bookings, in one round trip.
   *
   * The metric set is open, so the live board can't enumerate a fixed list of
   * columns to fetch — and a query per (booking, metric) would be dozens of
   * round trips per board refresh. `DISTINCT ON` collapses it to one; it's
   * Postgres-specific, which this schema already is.
   */
  async latestPerMetricForBookings(db: DBClient, bookingIds: string[]) {
    if (bookingIds.length === 0) return [];
    return db.$queryRaw<
      Array<{
        bookingId: string;
        metric: string;
        value: number;
        unit: string;
        recordedAt: Date;
      }>
    >`
      SELECT DISTINCT ON ("bookingId", "metric")
        "bookingId", "metric", "value", "unit", "recordedAt"
      FROM "vitals_samples"
      WHERE "bookingId" = ANY(${bookingIds})
      ORDER BY "bookingId", "metric", "recordedAt" DESC
    `;
  },

  /**
   * Which metric keys a booking actually captured. Needed because the set is
   * open — the reader can't ask for a fixed list of columns any more.
   */
  async distinctMetricsForBooking(db: DBClient, bookingId: string): Promise<string[]> {
    const rows = await db.vitalsSample.findMany({
      where: { bookingId },
      distinct: ["metric"],
      select: { metric: true },
    });
    return rows.map((r) => r.metric);
  },

  listSamplesInRange(
    db: DBClient,
    athleteId: string,
    metric: string,
    from: Date,
    to: Date,
  ) {
    return db.vitalsSample.findMany({
      where: { athleteId, metric, recordedAt: { gte: from, lte: to } },
      orderBy: { recordedAt: "asc" },
    });
  },

  // ── Session summary ──────────────────────────────────────────────────────

  findSummary(db: DBClient, bookingId: string) {
    return db.sessionVitalsSummary.findUnique({ where: { bookingId } });
  },

  upsertSummary(
    db: DBClient,
    bookingId: string,
    data: Omit<Prisma.SessionVitalsSummaryCreateInput, "booking" | "id">,
  ) {
    return db.sessionVitalsSummary.upsert({
      where: { bookingId },
      create: { ...data, booking: { connect: { id: bookingId } } },
      update: data,
    });
  },

  // ── Generic per-metric session rollups ───────────────────────────────────

  /**
   * Replace a booking's metric rollups wholesale. Delete-then-insert rather than
   * upsert-per-row because a recompute is authoritative: a metric that no longer
   * appears in the samples shouldn't linger from an earlier run.
   */
  async replaceMetricSummaries(
    db: DBClient,
    bookingId: string,
    aggregates: MetricAggregateInput[],
  ) {
    await db.sessionMetricSummary.deleteMany({ where: { bookingId } });
    if (aggregates.length === 0) return [];
    await db.sessionMetricSummary.createMany({
      data: aggregates.map((a) => ({ ...a, bookingId })),
    });
    return aggregates;
  },

  listMetricSummaries(db: DBClient, bookingId: string) {
    return db.sessionMetricSummary.findMany({
      where: { bookingId },
      orderBy: { metric: "asc" },
    });
  },

  // ── Daily vitals ─────────────────────────────────────────────────────────

  /**
   * Write one day's metrics. Upserted per metric so a later sync that picks up
   * an extra record type adds to the day rather than replacing it — vendor apps
   * backfill throughout the day.
   */
  async upsertDailyMetrics(
    db: DBClient,
    athleteId: string,
    date: Date,
    metrics: DailyMetricInput[],
  ) {
    if (metrics.length === 0) return 0;
    // One statement rather than an upsert per metric: a sync can carry thirty
    // of these and DBClient may already be inside a caller's transaction, so
    // opening another here isn't available to us.
    await db.$executeRaw`
      INSERT INTO "daily_vitals_metrics"
        ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
      SELECT gen_random_uuid()::TEXT, ${athleteId}, ${date}::DATE, m.metric, m.value, m.unit, NOW(), NOW()
      FROM unnest(
        ${metrics.map((m) => m.metric)}::TEXT[],
        ${metrics.map((m) => m.value)}::DOUBLE PRECISION[],
        ${metrics.map((m) => m.unit)}::TEXT[]
      ) AS m(metric, value, unit)
      ON CONFLICT ("athleteId", "date", "metric") DO UPDATE
        SET "value" = EXCLUDED."value",
            "unit" = EXCLUDED."unit",
            "updatedAt" = NOW()
    `;
    return metrics.length;
  },

  listDaily(db: DBClient, athleteId: string, from: Date, to: Date) {
    return db.dailyVitalsMetric.findMany({
      where: { athleteId, date: { gte: from, lte: to } },
      orderBy: [{ date: "desc" }, { metric: "asc" }],
    });
  },

  findDaily(db: DBClient, athleteId: string, date: Date) {
    return db.dailyVitalsMetric.findMany({ where: { athleteId, date } });
  },
};
