CREATE TYPE "KnowledgeDocumentState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "KnowledgeProcessingState" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'FAILED');
CREATE TYPE "KnowledgeProcessingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "KnowledgeProcessingStage" AS ENUM ('CLEANING', 'CHUNKING', 'INDEXING');

CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL DEFAULT app_uuid_v7(),
  "clientId" TEXT NOT NULL,
  "documentKey" TEXT NOT NULL,
  "documentState" "KnowledgeDocumentState" NOT NULL DEFAULT 'DRAFT',
  "processingState" "KnowledgeProcessingState" NOT NULL DEFAULT 'IDLE',
  "latestVersion" INTEGER NOT NULL DEFAULT 1,
  "processingVersion" INTEGER,
  "publishedVersion" INTEGER,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeDocumentVersion" (
  "id" TEXT NOT NULL DEFAULT app_uuid_v7(),
  "documentId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tags" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
  "id" TEXT NOT NULL DEFAULT app_uuid_v7(),
  "documentId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "documentVersion" INTEGER NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("content", ''))) STORED,
  "embedding" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeProcessingJob" (
  "id" TEXT NOT NULL DEFAULT app_uuid_v7(),
  "documentId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "targetVersion" INTEGER NOT NULL,
  "status" "KnowledgeProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
  "stage" "KnowledgeProcessingStage" NOT NULL DEFAULT 'CLEANING',
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeDocument_clientId_documentKey_key" ON "KnowledgeDocument"("clientId", "documentKey");
CREATE INDEX "KnowledgeDocument_clientId_documentState_idx" ON "KnowledgeDocument"("clientId", "documentState");
CREATE INDEX "KnowledgeDocument_clientId_processingState_idx" ON "KnowledgeDocument"("clientId", "processingState");
CREATE UNIQUE INDEX "KnowledgeDocumentVersion_documentId_version_key" ON "KnowledgeDocumentVersion"("documentId", "version");
CREATE INDEX "KnowledgeDocumentVersion_clientId_idx" ON "KnowledgeDocumentVersion"("clientId");
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_documentVersion_chunkIndex_key" ON "KnowledgeChunk"("documentId", "documentVersion", "chunkIndex");
CREATE INDEX "KnowledgeChunk_clientId_documentId_documentVersion_idx" ON "KnowledgeChunk"("clientId", "documentId", "documentVersion");
CREATE INDEX "KnowledgeChunk_searchVector_idx" ON "KnowledgeChunk" USING GIN ("searchVector");
CREATE INDEX "KnowledgeProcessingJob_clientId_status_idx" ON "KnowledgeProcessingJob"("clientId", "status");
CREATE INDEX "KnowledgeProcessingJob_documentId_targetVersion_idx" ON "KnowledgeProcessingJob"("documentId", "targetVersion");

ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeProcessingJob" ADD CONSTRAINT "KnowledgeProcessingJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeProcessingJob" ADD CONSTRAINT "KnowledgeProcessingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH migrated AS (
  INSERT INTO "KnowledgeDocument" (
    "id",
    "clientId",
    "documentKey",
    "documentState",
    "processingState",
    "latestVersion",
    "processingVersion",
    "publishedVersion",
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt"
  )
  SELECT
    app_uuid_v7(),
    "clientId",
    lower(regexp_replace(trim("title"), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left("id", 8),
    CASE WHEN "deletedAt" IS NOT NULL OR "enabled" = false THEN 'ARCHIVED'::"KnowledgeDocumentState" ELSE 'DRAFT'::"KnowledgeDocumentState" END,
    CASE WHEN "deletedAt" IS NOT NULL OR "enabled" = false THEN 'IDLE'::"KnowledgeProcessingState" ELSE 'QUEUED'::"KnowledgeProcessingState" END,
    1,
    CASE WHEN "deletedAt" IS NOT NULL OR "enabled" = false THEN NULL ELSE 1 END,
    NULL,
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt"
  FROM "KnowledgeEntry"
  RETURNING "id", "clientId", "documentKey", "documentState", "processingState"
)
INSERT INTO "KnowledgeDocumentVersion" ("id", "documentId", "clientId", "version", "title", "content", "tags", "createdAt")
SELECT
  app_uuid_v7(),
  d."id",
  e."clientId",
  1,
  e."title",
  e."type"::text || E'\n\n' || e."content"::text,
  jsonb_build_array(e."type"::text),
  e."createdAt"
FROM "KnowledgeEntry" e
JOIN migrated d ON d."clientId" = e."clientId" AND d."documentKey" = lower(regexp_replace(trim(e."title"), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(e."id", 8);

INSERT INTO "KnowledgeProcessingJob" ("id", "documentId", "clientId", "targetVersion", "status", "stage", "createdAt")
SELECT app_uuid_v7(), "id", "clientId", 1, 'QUEUED', 'CLEANING', CURRENT_TIMESTAMP
FROM "KnowledgeDocument"
WHERE "processingState" = 'QUEUED';
