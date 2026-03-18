-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('free', 'pro');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_plan" "PlanTier" NOT NULL DEFAULT 'free',
ADD COLUMN     "plan_activated_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
