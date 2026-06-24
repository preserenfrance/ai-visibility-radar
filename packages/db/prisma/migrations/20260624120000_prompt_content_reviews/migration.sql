CREATE TABLE "PromptContentReview" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "promptText" TEXT NOT NULL,
  "searchQuery" TEXT NOT NULL,
  "resultUrl" TEXT,
  "resultTitle" TEXT,
  "foundOwnedResult" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER,
  "summary" TEXT,
  "rankingReadiness" TEXT,
  "issuesJson" JSONB NOT NULL DEFAULT '[]',
  "recommendationsJson" JSONB NOT NULL DEFAULT '[]',
  "rawText" TEXT,
  "rawJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PromptContentReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromptContentReview_brandId_createdAt_idx" ON "PromptContentReview"("brandId", "createdAt");
CREATE INDEX "PromptContentReview_promptId_createdAt_idx" ON "PromptContentReview"("promptId", "createdAt");

ALTER TABLE "PromptContentReview"
  ADD CONSTRAINT "PromptContentReview_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromptContentReview"
  ADD CONSTRAINT "PromptContentReview_promptId_fkey"
  FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
