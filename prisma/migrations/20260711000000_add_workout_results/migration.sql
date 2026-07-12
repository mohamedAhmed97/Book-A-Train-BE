-- CreateTable
CREATE TABLE "workout_results" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "distanceM" DOUBLE PRECISION,
    "avgSpeedKph" DOUBLE PRECISION,
    "avgPaceSecPerKm" DOUBLE PRECISION,
    "calories" INTEGER,
    "laps" INTEGER,
    "notes" TEXT,
    "rawMetrics" JSONB,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_results_bookingId_key" ON "workout_results"("bookingId");

-- AddForeignKey
ALTER TABLE "workout_results" ADD CONSTRAINT "workout_results_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "session_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
