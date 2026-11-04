-- CreateTable
CREATE TABLE "partner_messages" (
    "id" TEXT NOT NULL,
    "partnership_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_messages_partnership_id_created_at_idx" ON "partner_messages"("partnership_id", "created_at");

-- AddForeignKey
ALTER TABLE "partner_messages" ADD CONSTRAINT "partner_messages_partnership_id_fkey" FOREIGN KEY ("partnership_id") REFERENCES "accountability_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_messages" ADD CONSTRAINT "partner_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
