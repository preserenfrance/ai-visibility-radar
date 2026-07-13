-- CreateTable
CREATE TABLE "McpApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpApiToken_tokenHash_key" ON "McpApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "McpApiToken_userId_revokedAt_idx" ON "McpApiToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "McpApiToken_tokenPrefix_idx" ON "McpApiToken"("tokenPrefix");

-- AddForeignKey
ALTER TABLE "McpApiToken" ADD CONSTRAINT "McpApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
