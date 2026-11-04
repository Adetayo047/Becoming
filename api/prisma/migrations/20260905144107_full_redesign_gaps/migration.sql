-- CreateEnum
CREATE TYPE "AiPersonality" AS ENUM ('encouraging', 'stoic', 'visionary', 'direct', 'analytical');

-- CreateEnum
CREATE TYPE "ProgressVisibility" AS ENUM ('only_me', 'trusted', 'community');

-- AlterTable
ALTER TABLE "daily_tasks" ADD COLUMN     "ai_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "block_type" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduled_end" TEXT,
ADD COLUMN     "scheduled_start" TEXT;

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "reflection" TEXT,
ADD COLUMN     "reflection_updated_at" TIMESTAMP(3),
ADD COLUMN     "time_invested_minutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ai_personality" "AiPersonality" NOT NULL DEFAULT 'encouraging',
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "focus_hours_end" TEXT,
ADD COLUMN     "focus_hours_start" TEXT,
ADD COLUMN     "progress_visibility" "ProgressVisibility" NOT NULL DEFAULT 'trusted',
ADD COLUMN     "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "verification_code" TEXT,
ADD COLUMN     "verification_code_expiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "milestone_subtasks" (
    "id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_resources" (
    "id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestone_subtasks_milestone_id_order_idx" ON "milestone_subtasks"("milestone_id", "order");

-- AddForeignKey
ALTER TABLE "milestone_subtasks" ADD CONSTRAINT "milestone_subtasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_resources" ADD CONSTRAINT "milestone_resources_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
