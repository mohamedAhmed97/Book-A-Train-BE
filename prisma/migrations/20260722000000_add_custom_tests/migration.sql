-- CreateTable
CREATE TABLE "custom_tests" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sport" TEXT,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_test_movements" (
    "id" TEXT NOT NULL,
    "customTestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "distanceMeters" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "custom_test_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_test_assignments" (
    "id" TEXT NOT NULL,
    "customTestId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "TestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_test_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_test_results" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_test_results_assignmentId_key" ON "custom_test_results"("assignmentId");

-- AddForeignKey
ALTER TABLE "custom_tests" ADD CONSTRAINT "custom_tests_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_test_movements" ADD CONSTRAINT "custom_test_movements_customTestId_fkey" FOREIGN KEY ("customTestId") REFERENCES "custom_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_test_assignments" ADD CONSTRAINT "custom_test_assignments_customTestId_fkey" FOREIGN KEY ("customTestId") REFERENCES "custom_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_test_assignments" ADD CONSTRAINT "custom_test_assignments_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_test_assignments" ADD CONSTRAINT "custom_test_assignments_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_test_results" ADD CONSTRAINT "custom_test_results_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "custom_test_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
