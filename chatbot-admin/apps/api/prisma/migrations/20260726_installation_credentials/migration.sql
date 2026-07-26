ALTER TABLE "PluginInstallation"
ADD COLUMN "installationSecretHash" TEXT,
ADD COLUMN "installationSecretIssuedAt" TIMESTAMP(3),
ADD COLUMN "label" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "revokedBy" TEXT,
ADD COLUMN "revokeReason" TEXT;

CREATE UNIQUE INDEX "PluginInstallation_installationSecretHash_key"
ON "PluginInstallation"("installationSecretHash");
