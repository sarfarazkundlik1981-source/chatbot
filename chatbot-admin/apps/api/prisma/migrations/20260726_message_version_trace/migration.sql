ALTER TABLE "Message"
ADD COLUMN "configurationVersion" INTEGER,
ADD COLUMN "knowledgeVersion" TEXT,
ADD COLUMN "aiSettingsVersion" INTEGER,
ADD COLUMN "businessConfigVersion" TEXT;
