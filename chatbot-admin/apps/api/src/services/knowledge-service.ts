import type { KnowledgeDocument, KnowledgeDocumentVersion, Prisma } from "@prisma/client";
import { KnowledgeDocumentState, KnowledgeProcessingJobStatus, KnowledgeProcessingState, KnowledgeProcessingStage } from "@prisma/client";

import { writeAuditLog } from "../lib/audit.js";
import { hashValue } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { prisma } from "../lib/prisma.js";
import { createConfigVersion } from "./client-service.js";

const processingStates: KnowledgeProcessingState[] = [KnowledgeProcessingState.QUEUED, KnowledgeProcessingState.RUNNING];
let workerStarted = false;
let processingTickActive = false;

export function knowledgeDocumentContentToText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const lines: string[] = [];
  const visit = (input: unknown, label?: string) => {
    if (input === null || input === undefined || input === "") {
      return;
    }
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      lines.push(label ? `${label}: ${String(input)}` : String(input));
      return;
    }
    if (Array.isArray(input)) {
      input.forEach((item) => visit(item, label));
      return;
    }
    Object.entries(input as Record<string, unknown>).forEach(([key, nested]) => visit(nested, key.replace(/_/g, " ")));
  };

  visit(value);
  return lines.join("\n");
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "knowledge-section";
}

async function uniqueDocumentKey(clientId: string, title: string) {
  const base = slugify(title);
  let key = base;
  let suffix = 2;
  while (await prisma.knowledgeDocument.findFirst({ where: { clientId, documentKey: key } })) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
}

function normalizeTags(tags?: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  return Array.from(new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))).slice(0, 20);
}

function cleanText(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function chunkText(input: string) {
  const text = cleanText(input);
  if (!text) {
    return [];
  }

  const maxChars = 1200;
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    if ((current + "\n\n" + paragraph).trim().length <= maxChars) {
      current = (current ? `${current}\n\n` : "") + paragraph;
      return;
    }
    if (current) {
      chunks.push(current);
      current = "";
    }
    for (let index = 0; index < paragraph.length; index += maxChars) {
      chunks.push(paragraph.slice(index, index + maxChars).trim());
    }
  });

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

async function queueProcessing(documentId: string, clientId: string, targetVersion: number) {
  const job = await prisma.knowledgeProcessingJob.create({
    data: {
      id: newId(),
      documentId,
      clientId,
      targetVersion,
      status: KnowledgeProcessingJobStatus.QUEUED,
      stage: KnowledgeProcessingStage.CLEANING
    }
  });

  setTimeout(() => {
    void processKnowledgeJob(job.id);
  }, 0);
  return job;
}

async function findLatestVersion(document: KnowledgeDocument) {
  const version = await prisma.knowledgeDocumentVersion.findFirst({
    where: { documentId: document.id, clientId: document.clientId, version: document.latestVersion }
  });
  if (!version) {
    throw new AppError(404, "KNOWLEDGE_VERSION_NOT_FOUND", "Knowledge document version was not found.");
  }
  return version;
}

export async function listKnowledgeDocuments(clientId: string) {
  const documents = await prisma.knowledgeDocument.findMany({
    where: { clientId },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 20
      }
    }
  });

  return documents.map((document) => {
    const latest = document.versions.find((version) => version.version === document.latestVersion) ?? document.versions[0] ?? null;
    const published = document.publishedVersion ? document.versions.find((version) => version.version === document.publishedVersion) ?? null : null;
    return { ...document, latest, published };
  });
}

export async function createKnowledgeDocument(clientId: string, input: { title: string; content: string; tags?: unknown }, actorId?: string, requestId?: string) {
  const tags = normalizeTags(input.tags);
  const documentKey = await uniqueDocumentKey(clientId, input.title);
  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.knowledgeDocument.create({
      data: {
        id: newId(),
        clientId,
        documentKey,
        documentState: KnowledgeDocumentState.DRAFT,
        processingState: KnowledgeProcessingState.QUEUED,
        latestVersion: 1,
        processingVersion: 1,
        createdBy: actorId,
        updatedBy: actorId
      }
    });
    await tx.knowledgeDocumentVersion.create({
      data: {
        id: newId(),
        documentId: created.id,
        clientId,
        version: 1,
        title: input.title,
        content: input.content,
        tags: tags as Prisma.InputJsonValue,
        createdBy: actorId
      }
    });
    return created;
  });

  await writeAuditLog({ clientId, actorId, action: "knowledge_document.created", target: document.id, requestId, metadata: { version: 1 } });
  await queueProcessing(document.id, clientId, 1);
  return (await listKnowledgeDocuments(clientId)).find((item) => item.id === document.id) ?? { ...document, latest: null, published: null };
}

export async function updateKnowledgeDocument(clientId: string, documentId: string, input: { title: string; content: string; tags?: unknown; latestVersion: number }, actorId?: string, requestId?: string) {
  const tags = normalizeTags(input.tags);
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, clientId, deletedAt: null } });
  if (!document) {
    throw new AppError(404, "KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document was not found.");
  }
  if (processingStates.includes(document.processingState)) {
    throw new AppError(409, "KNOWLEDGE_PROCESSING_ACTIVE", "Knowledge document is currently processing.");
  }
  if (document.latestVersion !== input.latestVersion) {
    throw new AppError(409, "VERSION_CONFLICT", "Knowledge document has changed since you last loaded it.");
  }

  const nextVersion = document.latestVersion + 1;
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocumentVersion.create({
      data: {
        id: newId(),
        documentId,
        clientId,
        version: nextVersion,
        title: input.title,
        content: input.content,
        tags: tags as Prisma.InputJsonValue,
        createdBy: actorId
      }
    });
    await tx.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        latestVersion: nextVersion,
        processingVersion: nextVersion,
        processingState: KnowledgeProcessingState.QUEUED,
        updatedBy: actorId
      }
    });
  });

  await writeAuditLog({ clientId, actorId, action: "knowledge_document.updated", target: documentId, requestId, metadata: { version: nextVersion } });
  await queueProcessing(documentId, clientId, nextVersion);
  return (await listKnowledgeDocuments(clientId)).find((item) => item.id === documentId);
}

export async function archiveKnowledgeDocument(clientId: string, documentId: string, actorId?: string, requestId?: string) {
  await prisma.knowledgeDocument.updateMany({
    where: { id: documentId, clientId, deletedAt: null },
    data: { documentState: KnowledgeDocumentState.ARCHIVED, deletedAt: new Date(), deletedBy: actorId ?? null, updatedBy: actorId ?? null }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "knowledge_document.archived", target: documentId, requestId });
}

export async function restoreKnowledgeDocument(clientId: string, documentId: string, actorId?: string, requestId?: string) {
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, clientId } });
  if (!document) {
    throw new AppError(404, "KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document was not found.");
  }
  if (processingStates.includes(document.processingState)) {
    throw new AppError(409, "KNOWLEDGE_PROCESSING_ACTIVE", "Knowledge document is currently processing.");
  }
  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: {
      documentState: KnowledgeDocumentState.DRAFT,
      processingState: KnowledgeProcessingState.QUEUED,
      processingVersion: document.latestVersion,
      deletedAt: null,
      deletedBy: null,
      updatedBy: actorId ?? null
    }
  });
  await writeAuditLog({ clientId, actorId, action: "knowledge_document.restored", target: documentId, requestId });
  await queueProcessing(documentId, clientId, document.latestVersion);
}

export async function listKnowledgeDocumentHistory(clientId: string, documentId: string) {
  return prisma.knowledgeDocumentVersion.findMany({
    where: { clientId, documentId },
    orderBy: { version: "desc" }
  });
}

export async function rollbackKnowledgeDocument(clientId: string, documentId: string, version: number, actorId?: string, requestId?: string) {
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, clientId, deletedAt: null } });
  if (!document) {
    throw new AppError(404, "KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document was not found.");
  }
  if (processingStates.includes(document.processingState)) {
    throw new AppError(409, "KNOWLEDGE_PROCESSING_ACTIVE", "Knowledge document is currently processing.");
  }
  const target = await prisma.knowledgeDocumentVersion.findFirst({ where: { clientId, documentId, version } });
  if (!target) {
    throw new AppError(404, "KNOWLEDGE_VERSION_NOT_FOUND", "Knowledge document version was not found.");
  }

  const nextVersion = document.latestVersion + 1;
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocumentVersion.create({
      data: {
        id: newId(),
        documentId,
        clientId,
        version: nextVersion,
        title: target.title,
        content: target.content,
        tags: (target.tags ?? []) as Prisma.InputJsonValue,
        createdBy: actorId
      }
    });
    await tx.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        latestVersion: nextVersion,
        processingVersion: nextVersion,
        processingState: KnowledgeProcessingState.QUEUED,
        updatedBy: actorId
      }
    });
  });

  await writeAuditLog({ clientId, actorId, action: "knowledge_document.rolled_back", target: documentId, requestId, metadata: { from_version: version, new_version: nextVersion } });
  await queueProcessing(documentId, clientId, nextVersion);
}

export async function reprocessKnowledgeDocument(clientId: string, documentId: string, actorId?: string, requestId?: string) {
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, clientId, deletedAt: null } });
  if (!document) {
    throw new AppError(404, "KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document was not found.");
  }
  if (processingStates.includes(document.processingState)) {
    throw new AppError(409, "KNOWLEDGE_PROCESSING_ACTIVE", "Knowledge document is currently processing.");
  }
  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: {
      processingVersion: document.latestVersion,
      processingState: KnowledgeProcessingState.QUEUED,
      updatedBy: actorId ?? null
    }
  });
  await writeAuditLog({ clientId, actorId, action: "knowledge_document.reprocessed", target: documentId, requestId, metadata: { target_version: document.latestVersion } });
  await queueProcessing(documentId, clientId, document.latestVersion);
}

export async function processKnowledgeJob(jobId: string) {
  const job = await prisma.knowledgeProcessingJob.findFirst({ where: { id: jobId } });
  if (!job || job.status === KnowledgeProcessingJobStatus.SUCCEEDED) {
    return;
  }

  try {
    await prisma.knowledgeProcessingJob.update({
      where: { id: job.id },
      data: { status: KnowledgeProcessingJobStatus.RUNNING, stage: KnowledgeProcessingStage.CLEANING, startedAt: new Date(), error: null }
    });

    const document = await prisma.knowledgeDocument.findFirst({ where: { id: job.documentId, clientId: job.clientId } });
    if (!document || document.processingVersion !== job.targetVersion) {
      await prisma.knowledgeProcessingJob.update({
        where: { id: job.id },
        data: { status: KnowledgeProcessingJobStatus.SUCCEEDED, completedAt: new Date() }
      });
      return;
    }

    const version = await prisma.knowledgeDocumentVersion.findFirst({
      where: { documentId: document.id, clientId: document.clientId, version: job.targetVersion }
    });
    if (!version) {
      throw new AppError(404, "KNOWLEDGE_VERSION_NOT_FOUND", "Knowledge document version was not found.");
    }

    await prisma.knowledgeProcessingJob.update({ where: { id: job.id }, data: { stage: KnowledgeProcessingStage.CHUNKING } });
    const chunks = chunkText(`${version.title}\n\n${version.content}`);
    if (!chunks.length) {
      throw new AppError(422, "EMPTY_KNOWLEDGE_DOCUMENT", "Knowledge section content is empty.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: { clientId: job.clientId, documentId: job.documentId, documentVersion: job.targetVersion }
      });
      await tx.knowledgeChunk.createMany({
        data: chunks.map((content, index) => ({
          id: newId(),
          clientId: job.clientId,
          documentId: job.documentId,
          documentVersion: job.targetVersion,
          chunkIndex: index,
          content
        }))
      });
    });

    await prisma.knowledgeProcessingJob.update({ where: { id: job.id }, data: { stage: KnowledgeProcessingStage.INDEXING } });

    await prisma.$transaction(async (tx) => {
      const chunkCount = await tx.knowledgeChunk.count({
        where: { clientId: job.clientId, documentId: job.documentId, documentVersion: job.targetVersion }
      });
      if (!chunkCount) {
        throw new AppError(500, "KNOWLEDGE_CHUNKS_MISSING", "Knowledge chunks were not created.");
      }
      await tx.knowledgeDocument.update({
        where: { id: job.documentId },
        data: {
          documentState: KnowledgeDocumentState.PUBLISHED,
          processingState: KnowledgeProcessingState.IDLE,
          processingVersion: null,
          publishedVersion: job.targetVersion
        }
      });
      await tx.knowledgeProcessingJob.update({
        where: { id: job.id },
        data: { status: KnowledgeProcessingJobStatus.SUCCEEDED, completedAt: new Date(), error: null }
      });
      await createConfigVersion(job.clientId, tx);
    });
    await writeAuditLog({ clientId: job.clientId, action: "knowledge_document.published", target: job.documentId, metadata: { version: job.targetVersion, job_id: job.id } });
  } catch (error) {
    await prisma.knowledgeDocument.updateMany({
      where: { id: job.documentId, clientId: job.clientId },
      data: { processingState: KnowledgeProcessingState.FAILED }
    });
    await prisma.knowledgeProcessingJob.updateMany({
      where: { id: job.id },
      data: { status: KnowledgeProcessingJobStatus.FAILED, completedAt: new Date(), error: error instanceof Error ? error.message : "Knowledge processing failed." }
    });
    await writeAuditLog({ clientId: job.clientId, action: "knowledge_document.processing_failed", target: job.documentId, metadata: { version: job.targetVersion, error: error instanceof Error ? error.message : "Knowledge processing failed." } });
  }
}

export async function processNextKnowledgeJob() {
  if (processingTickActive) {
    return;
  }
  processingTickActive = true;
  try {
    const job = await prisma.knowledgeProcessingJob.findFirst({
      where: { status: KnowledgeProcessingJobStatus.QUEUED },
      orderBy: { createdAt: "asc" }
    });
    if (job) {
      await processKnowledgeJob(job.id);
    }
  } finally {
    processingTickActive = false;
  }
}

export function startKnowledgeProcessingWorker() {
  if (workerStarted) {
    return;
  }
  workerStarted = true;
  setInterval(() => {
    void processNextKnowledgeJob();
  }, 10_000).unref();
}

export function serializeDocumentVersionText(version: KnowledgeDocumentVersion | null) {
  return version
    ? {
        title: version.title,
        content: version.content,
        tags: Array.isArray(version.tags) ? version.tags : [],
        version: version.version,
        created_at: version.createdAt.toISOString()
      }
    : null;
}

export function knowledgeVersionTrace(documents: Array<KnowledgeDocument & { published?: KnowledgeDocumentVersion | null }>) {
  return hashValue(
    documents
      .map((document) => `${document.id}:${document.publishedVersion ?? 0}`)
      .sort()
      .join("|")
  ).slice(0, 16);
}
