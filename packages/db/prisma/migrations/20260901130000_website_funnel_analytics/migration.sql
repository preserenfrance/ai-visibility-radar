CREATE TABLE "WebsiteEvent" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT,
  "eventName" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "normalizedPath" TEXT NOT NULL,
  "search" TEXT,
  "referrer" TEXT,
  "locale" TEXT,
  "properties" JSONB NOT NULL DEFAULT '{}',
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebsiteEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteEvent_eventName_createdAt_idx" ON "WebsiteEvent"("eventName", "createdAt");
CREATE INDEX "WebsiteEvent_normalizedPath_createdAt_idx" ON "WebsiteEvent"("normalizedPath", "createdAt");
CREATE INDEX "WebsiteEvent_visitorId_createdAt_idx" ON "WebsiteEvent"("visitorId", "createdAt");
CREATE INDEX "WebsiteEvent_sessionId_createdAt_idx" ON "WebsiteEvent"("sessionId", "createdAt");
CREATE INDEX "WebsiteEvent_userId_createdAt_idx" ON "WebsiteEvent"("userId", "createdAt");

ALTER TABLE "WebsiteEvent"
  ADD CONSTRAINT "WebsiteEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
