ALTER TABLE "Brand"
ADD COLUMN "chatGptCustomerConcernsSummary" TEXT,
ADD COLUMN "chatGptCustomerConcernsSummaryUpdatedAt" TIMESTAMP(3),
ADD COLUMN "chatGptProductSummary" TEXT,
ADD COLUMN "chatGptProductSummaryUpdatedAt" TIMESTAMP(3);
