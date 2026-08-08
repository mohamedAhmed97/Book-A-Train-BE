-- Open up the metric key so any watch record type can be stored without a
-- schema change. See services/metricCatalog.ts for the keys we present richly;
-- everything else is stored and surfaced generically.

-- ── VitalsSample.metric: enum -> text ──────────────────────────────────────
-- Indexes on the column are rebuilt automatically by the type change.
ALTER TABLE "vitals_samples"
  ALTER COLUMN "metric" TYPE TEXT USING "metric"::TEXT;

-- ── Generic per-session, per-metric rollups ────────────────────────────────
CREATE TABLE "session_metric_summaries" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "min" DOUBLE PRECISION NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,
    "avg" DOUBLE PRECISION NOT NULL,
    "sum" DOUBLE PRECISION NOT NULL,
    "last" DOUBLE PRECISION NOT NULL,
    "count" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_metric_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_metric_summaries_bookingId_metric_key"
  ON "session_metric_summaries"("bookingId", "metric");
CREATE INDEX "session_metric_summaries_bookingId_idx"
  ON "session_metric_summaries"("bookingId");

ALTER TABLE "session_metric_summaries"
  ADD CONSTRAINT "session_metric_summaries_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "session_bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── daily_vitals: fixed columns -> open per-metric rows ────────────────────
CREATE TABLE "daily_vitals_metrics" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_vitals_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_vitals_metrics_athleteId_date_metric_key"
  ON "daily_vitals_metrics"("athleteId", "date", "metric");
CREATE INDEX "daily_vitals_metrics_athleteId_date_idx"
  ON "daily_vitals_metrics"("athleteId", "date");

ALTER TABLE "daily_vitals_metrics"
  ADD CONSTRAINT "daily_vitals_metrics_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "athlete_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry across anything already synced. One statement per old column; each
-- skips days where that column was never filled in.
INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'RESTING_HEART_RATE', "restingHeartRate", 'bpm', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "restingHeartRate" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'HRV', "hrvMs", 'ms', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "hrvMs" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'SPO2', "spo2", '%', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "spo2" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'RESPIRATORY_RATE', "respiratoryRate", 'br/min', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "respiratoryRate" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'SKIN_TEMPERATURE', "skinTempC", '°C', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "skinTempC" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'STEPS', "steps", 'steps', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "steps" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'CALORIES', "caloriesKcal", 'kcal', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "caloriesKcal" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'DISTANCE', "distanceM", 'm', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "distanceM" IS NOT NULL;

INSERT INTO "daily_vitals_metrics" ("id", "athleteId", "date", "metric", "value", "unit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::TEXT, "athleteId", "date", 'SLEEP_MINUTES', "sleepMinutes", 'min', "createdAt", "updatedAt"
FROM "daily_vitals" WHERE "sleepMinutes" IS NOT NULL;

DROP TABLE "daily_vitals";

-- Nothing references the enum now that vitals_samples.metric is text.
DROP TYPE "VitalMetric";
