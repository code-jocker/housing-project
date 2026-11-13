CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "UserVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentLast4" TEXT NOT NULL,
  "evidenceObjectKey" TEXT NOT NULL,
  "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "UserVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyVerification" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "evidenceObjectKey" TEXT NOT NULL,
  "authorizationConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "PropertyVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserVerification_userId_key" ON "UserVerification"("userId");
CREATE INDEX "UserVerification_status_submittedAt_idx" ON "UserVerification"("status", "submittedAt");
CREATE UNIQUE INDEX "PropertyVerification_propertyId_key" ON "PropertyVerification"("propertyId");
CREATE INDEX "PropertyVerification_status_submittedAt_idx" ON "PropertyVerification"("status", "submittedAt");

ALTER TABLE "UserVerification" ADD CONSTRAINT "UserVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyVerification" ADD CONSTRAINT "PropertyVerification_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyVerification" ADD CONSTRAINT "PropertyVerification_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
