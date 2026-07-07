ALTER TABLE "User"
  ADD COLUMN "marketingEmailConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketingEmailConsentAt" TIMESTAMP(3),
  ADD COLUMN "scanEmailConsent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "scanEmailConsentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "emailPreferencesToken" TEXT;

CREATE UNIQUE INDEX "User_emailPreferencesToken_key" ON "User"("emailPreferencesToken");

ALTER TABLE "EmailEvent"
  ADD COLUMN "userId" TEXT;

CREATE INDEX "EmailEvent_userId_idx" ON "EmailEvent"("userId");

ALTER TABLE "EmailEvent"
  ADD CONSTRAINT "EmailEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
