-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION app_uuid_v7()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  unix_ms BIGINT;
  rand_bytes BYTEA;
  hex TEXT;
BEGIN
  unix_ms := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000);
  rand_bytes := gen_random_bytes(10);

  hex :=
    LPAD(to_hex(unix_ms), 12, '0') ||
    '7' || substr(encode(rand_bytes, 'hex'), 2, 3) ||
    to_hex((get_byte(rand_bytes, 2) & 63) | 128) ||
    substr(encode(rand_bytes, 'hex'), 7, 9) ||
    substr(encode(rand_bytes, 'hex'), 16, 12);

  RETURN lower(
    substr(hex, 1, 8) || '-' ||
    substr(hex, 9, 4) || '-' ||
    substr(hex, 13, 4) || '-' ||
    substr(hex, 17, 4) || '-' ||
    substr(hex, 21, 12)
  );
END;
$$;

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('trial', 'active', 'expired', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "KnowledgeEntryType" AS ENUM ('company', 'services', 'pricing', 'faq', 'team', 'hours', 'locations', 'contact', 'policies');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('API', 'ERROR', 'AUDIT', 'EMAIL', 'SECURITY');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_owner', 'platform_admin');

-- CreateEnum
CREATE TYPE "ClientRole" AS ENUM ('owner', 'admin', 'editor', 'viewer', 'support');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSettings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "defaultCountry" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "dateFormat" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientUser" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClientRole" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedDomain" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllowedDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginInstallation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pluginVersion" TEXT NOT NULL,
    "wordpressVersion" TEXT,
    "phpVersion" TEXT,
    "elementorVersion" TEXT,
    "lastSeen" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandingSettings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "avatarUrl" TEXT,
    "launcherIconUrl" TEXT,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "borderRadius" INTEGER NOT NULL,
    "font" TEXT NOT NULL,
    "headerStyle" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetSettings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "greeting" TEXT NOT NULL,
    "autoOpen" BOOLEAN NOT NULL DEFAULT false,
    "autoOpenDelayMs" INTEGER NOT NULL DEFAULT 0,
    "hideForLoggedInUsers" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalSettings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "openRouterApiKey" TEXT,
    "fallbackModel" TEXT,
    "adminNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL,
    "systemInstructions" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientEntitlement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCapability" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CtaConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CtaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "KnowledgeEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSummary" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "resumeTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAnalytics" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnansweredQuestion" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "normalizedQuestion" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "lastAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnansweredQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "type" "LogType" NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "requestId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "provider" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptionKey" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncryptionKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSettings_clientId_key" ON "ClientSettings"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_userId_key" ON "PlatformUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUser_clientId_userId_key" ON "ClientUser"("clientId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedDomain_clientId_domain_key" ON "AllowedDomain"("clientId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "PluginInstallation_clientId_domain_key" ON "PluginInstallation"("clientId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "BrandingSettings_clientId_key" ON "BrandingSettings"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetSettings_clientId_key" ON "WidgetSettings"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalSettings_clientId_key" ON "InternalSettings"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AiSettings_clientId_key" ON "AiSettings"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_clientId_key_key" ON "FeatureFlag"("clientId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ClientEntitlement_clientId_key_key" ON "ClientEntitlement"("clientId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCapability_key_key" ON "PlatformCapability"("key");

-- CreateIndex
CREATE INDEX "CtaConfig_clientId_idx" ON "CtaConfig"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_clientId_versionNumber_key" ON "ConfigVersion"("clientId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationSummary_conversationId_key" ON "ConversationSummary"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionToken_tokenHash_key" ON "SessionToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorProfile_resumeTokenHash_key" ON "VisitorProfile"("resumeTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAnalytics_clientId_day_key" ON "DailyAnalytics"("clientId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PluginRelease_version_key" ON "PluginRelease"("version");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_keyHash_key" ON "IdempotencyKey"("scope", "keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptionKey_keyId_key" ON "EncryptionKey"("keyId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "ClientSettings" ADD CONSTRAINT "ClientSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUser" ADD CONSTRAINT "PlatformUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllowedDomain" ADD CONSTRAINT "AllowedDomain_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginInstallation" ADD CONSTRAINT "PluginInstallation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandingSettings" ADD CONSTRAINT "BrandingSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetSettings" ADD CONSTRAINT "WidgetSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalSettings" ADD CONSTRAINT "InternalSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEntitlement" ADD CONSTRAINT "ClientEntitlement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaConfig" ADD CONSTRAINT "CtaConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigVersion" ADD CONSTRAINT "ConfigVersion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionToken" ADD CONSTRAINT "SessionToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorProfile" ADD CONSTRAINT "VisitorProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAnalytics" ADD CONSTRAINT "DailyAnalytics_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnansweredQuestion" ADD CONSTRAINT "UnansweredQuestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BusinessHoursConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "schedule" JSONB NOT NULL,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessHoursConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutOfHoursConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "greeting" TEXT,
    "limitedCtas" JSONB,
    "formFirstMode" BOOLEAN NOT NULL DEFAULT false,
    "visitorMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutOfHoursConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallbackRequestConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "buttonLabel" TEXT NOT NULL,
    "helperText" TEXT,
    "successMessage" TEXT,
    "requiredFields" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CallbackRequestConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentRequestConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requiredFields" JSONB,
    "successMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppointmentRequestConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAreaConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL,
    "inputLabel" TEXT,
    "successMessage" TEXT,
    "failureMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceAreaConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAreaRule" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceAreaRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteCalculatorConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "successMessage" TEXT,
    "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteCalculatorConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteCalculatorField" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteCalculatorField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadQualificationConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "stages" JSONB NOT NULL,
    "requiredFields" JSONB NOT NULL,
    "scoringRules" JSONB,
    "successMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadQualificationConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissedCustomerAlertConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "conversationDelayMins" INTEGER NOT NULL DEFAULT 30,
    "leadDelayMins" INTEGER NOT NULL DEFAULT 60,
    "notifyPlatformEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyWordPressEmail" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MissedCustomerAlertConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyDetectionConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "keywords" JSONB NOT NULL,
    "responseMessage" TEXT NOT NULL,
    "escalateLabel" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmergencyDetectionConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaptchaConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'disabled',
    "siteKey" TEXT,
    "secretKeyEncrypted" TEXT,
    "protectLead" BOOLEAN NOT NULL DEFAULT false,
    "protectCallback" BOOLEAN NOT NULL DEFAULT false,
    "protectAppointment" BOOLEAN NOT NULL DEFAULT false,
    "protectQuote" BOOLEAN NOT NULL DEFAULT false,
    "protectChat" BOOLEAN NOT NULL DEFAULT false,
    "minScore" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CaptchaConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaqSuggestion" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "normalizedQuestion" TEXT NOT NULL,
    "suggestedAnswer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FaqSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallbackRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conversationId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CallbackRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conversationId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "service" TEXT,
    "preferredDate" TEXT,
    "preferredTime" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAreaCheck" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "matchedRuleId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceAreaCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conversationId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissedCustomerAlert" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conversationId" TEXT,
    "leadId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "payload" JSONB,
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MissedCustomerAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessHoursConfig_clientId_key" ON "BusinessHoursConfig"("clientId");
CREATE UNIQUE INDEX "OutOfHoursConfig_clientId_key" ON "OutOfHoursConfig"("clientId");
CREATE UNIQUE INDEX "CallbackRequestConfig_clientId_key" ON "CallbackRequestConfig"("clientId");
CREATE UNIQUE INDEX "AppointmentRequestConfig_clientId_key" ON "AppointmentRequestConfig"("clientId");
CREATE UNIQUE INDEX "ServiceAreaConfig_clientId_key" ON "ServiceAreaConfig"("clientId");
CREATE INDEX "ServiceAreaRule_clientId_ruleType_idx" ON "ServiceAreaRule"("clientId", "ruleType");
CREATE INDEX "PriceListItem_clientId_category_idx" ON "PriceListItem"("clientId", "category");
CREATE UNIQUE INDEX "QuoteCalculatorConfig_clientId_key" ON "QuoteCalculatorConfig"("clientId");
CREATE UNIQUE INDEX "QuoteCalculatorField_clientId_key_key" ON "QuoteCalculatorField"("clientId", "key");
CREATE UNIQUE INDEX "LeadQualificationConfig_clientId_key" ON "LeadQualificationConfig"("clientId");
CREATE UNIQUE INDEX "MissedCustomerAlertConfig_clientId_key" ON "MissedCustomerAlertConfig"("clientId");
CREATE UNIQUE INDEX "EmergencyDetectionConfig_clientId_key" ON "EmergencyDetectionConfig"("clientId");
CREATE UNIQUE INDEX "CaptchaConfig_clientId_key" ON "CaptchaConfig"("clientId");
CREATE INDEX "FaqSuggestion_clientId_status_idx" ON "FaqSuggestion"("clientId", "status");
CREATE INDEX "CallbackRequest_clientId_status_idx" ON "CallbackRequest"("clientId", "status");
CREATE INDEX "AppointmentRequest_clientId_status_idx" ON "AppointmentRequest"("clientId", "status");
CREATE INDEX "ServiceAreaCheck_clientId_result_idx" ON "ServiceAreaCheck"("clientId", "result");
CREATE INDEX "QuoteRequest_clientId_status_idx" ON "QuoteRequest"("clientId", "status");
CREATE INDEX "MissedCustomerAlert_clientId_status_idx" ON "MissedCustomerAlert"("clientId", "status");

ALTER TABLE "BusinessHoursConfig" ADD CONSTRAINT "BusinessHoursConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutOfHoursConfig" ADD CONSTRAINT "OutOfHoursConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CallbackRequestConfig" ADD CONSTRAINT "CallbackRequestConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentRequestConfig" ADD CONSTRAINT "AppointmentRequestConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceAreaConfig" ADD CONSTRAINT "ServiceAreaConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceAreaRule" ADD CONSTRAINT "ServiceAreaRule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteCalculatorConfig" ADD CONSTRAINT "QuoteCalculatorConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteCalculatorField" ADD CONSTRAINT "QuoteCalculatorField_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadQualificationConfig" ADD CONSTRAINT "LeadQualificationConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissedCustomerAlertConfig" ADD CONSTRAINT "MissedCustomerAlertConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyDetectionConfig" ADD CONSTRAINT "EmergencyDetectionConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaptchaConfig" ADD CONSTRAINT "CaptchaConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FaqSuggestion" ADD CONSTRAINT "FaqSuggestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CallbackRequest" ADD CONSTRAINT "CallbackRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceAreaCheck" ADD CONSTRAINT "ServiceAreaCheck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissedCustomerAlert" ADD CONSTRAINT "MissedCustomerAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Client" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ClientSettings" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "PlatformUser" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ClientUser" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "License" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "AllowedDomain" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ApiCredential" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "PluginInstallation" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "BrandingSettings" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "WidgetSettings" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "InternalSettings" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "AiSettings" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "FeatureFlag" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ClientEntitlement" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "PlatformCapability" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "CtaConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "KnowledgeEntry" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ConfigVersion" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "Conversation" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "Message" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ConversationSummary" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "SessionToken" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "VisitorProfile" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "Lead" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "AnalyticsEvent" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "DailyAnalytics" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "UnansweredQuestion" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "Log" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "PluginRelease" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "EmailEvent" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "IdempotencyKey" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "EncryptionKey" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "InviteToken" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "PasswordResetToken" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "BusinessHoursConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "OutOfHoursConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "CallbackRequestConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "AppointmentRequestConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ServiceAreaConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ServiceAreaRule" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "PriceListItem" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "QuoteCalculatorConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "QuoteCalculatorField" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "LeadQualificationConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "MissedCustomerAlertConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "EmergencyDetectionConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "CaptchaConfig" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "FaqSuggestion" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "CallbackRequest" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "AppointmentRequest" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "ServiceAreaCheck" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "QuoteRequest" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
ALTER TABLE "MissedCustomerAlert" ALTER COLUMN "id" SET DEFAULT app_uuid_v7();
