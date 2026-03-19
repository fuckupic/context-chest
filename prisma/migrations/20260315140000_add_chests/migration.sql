-- AlterTable: add chestId and encryptionVersion to memory_entries
ALTER TABLE "memory_entries" ADD COLUMN "chest_id" TEXT,
    ADD COLUMN "encryption_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: add chestId to sessions
ALTER TABLE "sessions" ADD COLUMN "chest_id" TEXT;

-- CreateTable: chests
CREATE TABLE "chests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chest_permissions
CREATE TABLE "chest_permissions" (
    "id" TEXT NOT NULL,
    "chest_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT true,
    "can_write" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "chest_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique (user_id, name) on chests
CREATE UNIQUE INDEX "chests_user_id_name_key" ON "chests"("user_id", "name");

-- CreateIndex: new composite unique on memory_entries
CREATE UNIQUE INDEX "memory_entries_user_chest_uri" ON "memory_entries"("user_id", "chest_id", "uri");

-- CreateIndex: unique (chest_id, agent_name) on chest_permissions
CREATE UNIQUE INDEX "chest_permissions_chest_id_agent_name_key" ON "chest_permissions"("chest_id", "agent_name");

-- AddForeignKey: chests.user_id -> users.id
ALTER TABLE "chests" ADD CONSTRAINT "chests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: memory_entries.chest_id -> chests.id
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_chest_id_fkey" FOREIGN KEY ("chest_id") REFERENCES "chests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: sessions.chest_id -> chests.id
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_chest_id_fkey" FOREIGN KEY ("chest_id") REFERENCES "chests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: chest_permissions.chest_id -> chests.id (cascade delete)
ALTER TABLE "chest_permissions" ADD CONSTRAINT "chest_permissions_chest_id_fkey" FOREIGN KEY ("chest_id") REFERENCES "chests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
