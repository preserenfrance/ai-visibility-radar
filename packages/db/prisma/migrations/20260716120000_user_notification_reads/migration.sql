-- CreateTable
CREATE TABLE "UserNotificationRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationRead_userId_notificationId_key" ON "UserNotificationRead"("userId", "notificationId");

-- CreateIndex
CREATE INDEX "UserNotificationRead_userId_readAt_idx" ON "UserNotificationRead"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "UserNotificationRead" ADD CONSTRAINT "UserNotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
