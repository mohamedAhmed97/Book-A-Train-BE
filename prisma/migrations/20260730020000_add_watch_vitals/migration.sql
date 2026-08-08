-- CreateEnum
CREATE TYPE "VitalsProvider" AS ENUM ('HEALTH_CONNECT', 'WEAR_OS', 'MANUAL');

-- CreateEnum
CREATE TYPE "VitalMetric" AS ENUM ('HEART_RATE', 'RESTING_HEART_RATE', 'HRV', 'SPO2', 'RESPIRATORY_RATE', 'SKIN_TEMPERATURE', 'CALORIES', 'STEPS', 'DISTANCE', 'SLEEP_MINUTES');

-- AlterTable
ALTER TABLE "athlete_profiles" ADD COLUMN "weightKg" DOUBLE PRECISION,
                                ADD COLUMN "maxHeartRate" INTEGER;

-- CreateTable
CREATE TABLE "watch_integrations" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "provider" "VitalsProvider" NOT NULL DEFAULT 'HEALTH_CONNECT',
    "deviceName" TEXT,
    "deviceModel" TEXT,
    "grantedTypes" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals_samples" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "bookingId" TEXT,
    "metric" "VitalMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "source" "VitalsProvider" NOT NULL DEFAULT 'HEALTH_CONNECT',
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vitals_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_vitals_summaries" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "minHeartRate" INTEGER,
    "zone1Sec" INTEGER NOT NULL DEFAULT 0,
    "zone2Sec" INTEGER NOT NULL DEFAULT 0,
    "zone3Sec" INTEGER NOT NULL DEFAULT 0,
    "zone4Sec" INTEGER NOT NULL DEFAULT 0,
    "zone5Sec" INTEGER NOT NULL DEFAULT 0,
    "avgHrvMs" DOUBLE PRECISION,
    "avgSpo2" DOUBLE PRECISION,
    "minSpo2" DOUBLE PRECISION,
    "avgRespiratoryRate" DOUBLE PRECISION,
    "avgSkinTempC" DOUBLE PRECISION,
    "totalCalories" INTEGER,
    "totalSteps" INTEGER,
    "totalDistanceM" DOUBLE PRECISION,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_vitals_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_vitals" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "restingHeartRate" INTEGER,
    "hrvMs" DOUBLE PRECISION,
    "spo2" DOUBLE PRECISION,
    "respiratoryRate" DOUBLE PRECISION,
    "skinTempC" DOUBLE PRECISION,
    "steps" INTEGER,
    "caloriesKcal" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "sleepMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_vitals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "watch_integrations_athleteId_key" ON "watch_integrations"("athleteId");

-- CreateIndex
CREATE INDEX "vitals_samples_bookingId_metric_recordedAt_idx" ON "vitals_samples"("bookingId", "metric", "recordedAt");

-- CreateIndex
CREATE INDEX "vitals_samples_athleteId_metric_recordedAt_idx" ON "vitals_samples"("athleteId", "metric", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vitals_samples_athleteId_metric_recordedAt_key" ON "vitals_samples"("athleteId", "metric", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_vitals_summaries_bookingId_key" ON "session_vitals_summaries"("bookingId");

-- CreateIndex
CREATE INDEX "daily_vitals_athleteId_date_idx" ON "daily_vitals"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_vitals_athleteId_date_key" ON "daily_vitals"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "watch_integrations" ADD CONSTRAINT "watch_integrations_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals_samples" ADD CONSTRAINT "vitals_samples_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals_samples" ADD CONSTRAINT "vitals_samples_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "session_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_vitals_summaries" ADD CONSTRAINT "session_vitals_summaries_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "session_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_vitals" ADD CONSTRAINT "daily_vitals_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
