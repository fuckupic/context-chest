-- CreateTable
CREATE TABLE "agent_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "agent_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_connections_user_id_last_seen_at_idx" ON "agent_connections"("user_id", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_connections_user_id_agent_name_key" ON "agent_connections"("user_id", "agent_name");

-- AddForeignKey
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
