-- CreateTable
CREATE TABLE "yearly_targets" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yearly_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "yearly_targets_goal_id_year_idx" ON "yearly_targets"("goal_id", "year");

-- AddForeignKey
ALTER TABLE "yearly_targets" ADD CONSTRAINT "yearly_targets_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Weekly milestones used to be keyed by local midnight, which stored as the
-- Sunday before in timezones east of UTC. Move them to the real Monday.
UPDATE "weekly_focuses" SET "week_start" = "week_start" + 1 WHERE EXTRACT(DOW FROM "week_start") = 0;
