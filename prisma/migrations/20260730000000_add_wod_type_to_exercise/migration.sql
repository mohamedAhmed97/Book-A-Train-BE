-- Add WOD timer type to exercises
-- Null means no WOD timer; non-null values: AMRAP | FOR_TIME | EMOM | TABATA | MIX
ALTER TABLE "exercises" ADD COLUMN "wodType" TEXT;
