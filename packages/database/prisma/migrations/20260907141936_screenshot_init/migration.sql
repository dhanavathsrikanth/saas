-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'basic', 'pro', 'scale', 'enterprise');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "rpm" INTEGER NOT NULL DEFAULT 10,
    "dailyCap" INTEGER NOT NULL DEFAULT 1000,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenshotJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "paramsJson" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'png',
    "blobKey" TEXT,
    "cacheKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "webhookUrl" TEXT,
    "externalId" TEXT,
    "billedUnits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ScreenshotJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "billedUnits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "cron" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_clerkId_key" ON "Organization"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Organization_clerkId_idx" ON "Organization"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");

-- CreateIndex
CREATE INDEX "ApiKey_hash_idx" ON "ApiKey"("hash");

-- CreateIndex
CREATE INDEX "ScreenshotJob_orgId_createdAt_idx" ON "ScreenshotJob"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ScreenshotJob_cacheKey_idx" ON "ScreenshotJob"("cacheKey");

-- CreateIndex
CREATE INDEX "ScreenshotJob_status_idx" ON "ScreenshotJob"("status");

-- CreateIndex
CREATE INDEX "UsageEvent_orgId_createdAt_idx" ON "UsageEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_orgId_type_idx" ON "UsageEvent"("orgId", "type");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_orgId_idx" ON "WebhookEndpoint"("orgId");

-- CreateIndex
CREATE INDEX "Schedule_orgId_idx" ON "Schedule"("orgId");

-- CreateIndex
CREATE INDEX "Schedule_nextRunAt_active_idx" ON "Schedule"("nextRunAt", "active");
