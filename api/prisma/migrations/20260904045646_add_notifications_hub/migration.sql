-- CreateEnum
CREATE TYPE "NudgeFrequency" AS ENUM ('sparse', 'balanced', 'high_intensity');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ai_architect', 'accountability', 'system');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nudge_frequency" "NudgeFrequency" NOT NULL DEFAULT 'balanced',
ADD COLUMN     "stoic_mode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action_url" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
