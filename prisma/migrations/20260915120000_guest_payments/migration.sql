-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ACCOUNT', 'GUEST_PURCHASE', 'GUEST_RENEWAL');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- AlterTable
ALTER TABLE "Payment"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "type" "PaymentType" NOT NULL DEFAULT 'ACCOUNT',
  ADD COLUMN "remnawaveUuid" TEXT,
  ADD COLUMN "orderTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderTokenHash_key" ON "Payment"("orderTokenHash");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
