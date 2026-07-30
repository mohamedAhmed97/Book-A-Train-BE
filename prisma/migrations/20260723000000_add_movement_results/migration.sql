-- CreateTable
CREATE TABLE "custom_test_movement_results" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_test_movement_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_test_movement_results_assignmentId_movementId_key" ON "custom_test_movement_results"("assignmentId", "movementId");

-- AddForeignKey
ALTER TABLE "custom_test_movement_results" ADD CONSTRAINT "custom_test_movement_results_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "custom_test_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_test_movement_results" ADD CONSTRAINT "custom_test_movement_results_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "custom_test_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
