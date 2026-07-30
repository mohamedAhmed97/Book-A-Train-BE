-- Add sports array column, migrate existing single-sport data, then drop old column
ALTER TABLE "coach_profiles" ADD COLUMN "sports" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "coach_profiles" SET "sports" = ARRAY[sport] WHERE sport IS NOT NULL;
ALTER TABLE "coach_profiles" DROP COLUMN "sport";
