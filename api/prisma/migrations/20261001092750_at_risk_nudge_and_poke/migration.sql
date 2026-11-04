-- AlterTable
ALTER TABLE "accountability_partners" ADD COLUMN     "partner_last_poked_at" TIMESTAMP(3),
ADD COLUMN     "user_last_poked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "at_risk_nudge_last_fired_date" TEXT;
