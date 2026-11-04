/*
  Warnings:

  - You are about to drop the column `at_risk_nudge_last_fired_date` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "at_risk_nudge_last_fired_date",
ADD COLUMN     "at_risk_nudge_last_fired_key" TEXT;
