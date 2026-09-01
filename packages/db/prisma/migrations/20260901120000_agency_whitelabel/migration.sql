CREATE TYPE "AgencyMembershipRole" AS ENUM ('owner', 'admin', 'member');

CREATE TABLE "Agency" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "productName" TEXT NOT NULL DEFAULT 'AI Visibility Radar',
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
  "accentColor" TEXT NOT NULL DEFAULT '#0f766e',
  "customDomain" TEXT,
  "supportEmail" TEXT,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "reportFooter" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "role" "AgencyMembershipRole" NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgencyMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Organization"
  ADD COLUMN "agencyId" TEXT,
  ADD COLUMN "agencyClientCode" TEXT;

CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");
CREATE UNIQUE INDEX "Agency_customDomain_key" ON "Agency"("customDomain");
CREATE INDEX "Agency_createdAt_idx" ON "Agency"("createdAt");
CREATE UNIQUE INDEX "AgencyMembership_userId_agencyId_key" ON "AgencyMembership"("userId", "agencyId");
CREATE INDEX "AgencyMembership_agencyId_idx" ON "AgencyMembership"("agencyId");
CREATE INDEX "AgencyMembership_userId_idx" ON "AgencyMembership"("userId");
CREATE INDEX "Organization_agencyId_idx" ON "Organization"("agencyId");

ALTER TABLE "AgencyMembership"
  ADD CONSTRAINT "AgencyMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgencyMembership"
  ADD CONSTRAINT "AgencyMembership_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
