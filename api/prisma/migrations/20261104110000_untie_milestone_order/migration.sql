-- Milestones saved in one batch shared the exact same created_at, so their
-- order was arbitrary and "up next" (created_at > current) never matched.
-- Space ties 1ms apart, in a stable order.
UPDATE "milestones" m
SET "created_at" = m."created_at" + (x.rn - 1) * INTERVAL '1 millisecond'
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "goal_id", "created_at" ORDER BY "id") AS rn
  FROM "milestones"
) x
WHERE m."id" = x."id" AND x.rn > 1;
