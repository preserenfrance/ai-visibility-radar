-- CreateTable
CREATE TABLE "AiSearchCall" (
    "id" TEXT NOT NULL,
    "aiResponseId" TEXT NOT NULL,
    "provider" "EngineProvider" NOT NULL,
    "actionType" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "sourcesJson" JSONB NOT NULL DEFAULT '[]',
    "exact" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSearchCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiSearchCall_aiResponseId_idx" ON "AiSearchCall"("aiResponseId");

-- CreateIndex
CREATE INDEX "AiSearchCall_provider_createdAt_idx" ON "AiSearchCall"("provider", "createdAt");

-- AddForeignKey
ALTER TABLE "AiSearchCall" ADD CONSTRAINT "AiSearchCall_aiResponseId_fkey" FOREIGN KEY ("aiResponseId") REFERENCES "AiResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
