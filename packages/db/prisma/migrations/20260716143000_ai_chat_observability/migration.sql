-- CreateEnum
CREATE TYPE "AiChatSessionStatus" AS ENUM ('active', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AiChatMessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateTable
CREATE TABLE "AiChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "brandId" TEXT,
    "title" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'sl',
    "status" "AiChatSessionStatus" NOT NULL DEFAULT 'active',
    "intent" TEXT,
    "summary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "AiChatMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatToolCall" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "toolName" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL DEFAULT '{}',
    "outputJson" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "userId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiChatSession_userId_createdAt_idx" ON "AiChatSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatSession_organizationId_createdAt_idx" ON "AiChatSession"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatSession_brandId_createdAt_idx" ON "AiChatSession"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatSession_status_createdAt_idx" ON "AiChatSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatMessage_sessionId_createdAt_idx" ON "AiChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatMessage_userId_createdAt_idx" ON "AiChatMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatToolCall_sessionId_createdAt_idx" ON "AiChatToolCall"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatToolCall_toolName_createdAt_idx" ON "AiChatToolCall"("toolName", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatFeedback_sessionId_createdAt_idx" ON "AiChatFeedback"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatFeedback_userId_createdAt_idx" ON "AiChatFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatFeedback_rating_createdAt_idx" ON "AiChatFeedback"("rating", "createdAt");

-- AddForeignKey
ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatToolCall" ADD CONSTRAINT "AiChatToolCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatToolCall" ADD CONSTRAINT "AiChatToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatFeedback" ADD CONSTRAINT "AiChatFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatFeedback" ADD CONSTRAINT "AiChatFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatFeedback" ADD CONSTRAINT "AiChatFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
