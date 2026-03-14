-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT,
ALTER COLUMN "opaqueRecord" DROP NOT NULL;
