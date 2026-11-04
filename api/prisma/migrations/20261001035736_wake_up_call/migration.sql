-- CreateEnum
CREATE TYPE "VoiceCallStatus" AS ENUM ('scheduled', 'ringing', 'active', 'completed', 'declined', 'missed', 'failed');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "utc_offset_minutes" INTEGER,
ADD COLUMN     "wake_up_call_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wake_up_call_last_fired_date" TEXT,
ADD COLUMN     "wake_up_call_time" TEXT;

-- CreateTable
CREATE TABLE "voice_call_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_session_id" TEXT,
    "status" "VoiceCallStatus" NOT NULL DEFAULT 'scheduled',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_call_sessions_chat_session_id_key" ON "voice_call_sessions"("chat_session_id");

-- CreateIndex
CREATE INDEX "voice_call_sessions_user_id_created_at_idx" ON "voice_call_sessions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "voice_call_sessions" ADD CONSTRAINT "voice_call_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_call_sessions" ADD CONSTRAINT "voice_call_sessions_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
