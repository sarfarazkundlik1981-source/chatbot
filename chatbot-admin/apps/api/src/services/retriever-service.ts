import { prisma } from "../lib/prisma.js";

export const RETRIEVAL_MAX_DOCUMENTS = 3;
export const RETRIEVAL_MAX_CHUNKS = 5;
export const RETRIEVAL_MAX_CHARACTERS = 6000;

export type RetrievedKnowledgeChunk = {
  document_id: string;
  document_key: string;
  document_version: number;
  title: string;
  content: string;
  rank: number;
};

export async function retrieveKnowledge(clientId: string, query: string): Promise<RetrievedKnowledgeChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const rows = await prisma.$queryRaw<RetrievedKnowledgeChunk[]>`
    SELECT
      kc."documentId" AS "document_id",
      kd."documentKey" AS "document_key",
      kc."documentVersion" AS "document_version",
      kdv."title" AS "title",
      kc."content" AS "content",
      ts_rank(kc."searchVector", plainto_tsquery('english', ${trimmed}))::float AS "rank"
    FROM "KnowledgeChunk" kc
    INNER JOIN "KnowledgeDocument" kd
      ON kd."id" = kc."documentId"
      AND kd."clientId" = ${clientId}
      AND kd."documentState" = 'PUBLISHED'
      AND kd."publishedVersion" = kc."documentVersion"
    INNER JOIN "KnowledgeDocumentVersion" kdv
      ON kdv."documentId" = kd."id"
      AND kdv."clientId" = ${clientId}
      AND kdv."version" = kd."publishedVersion"
    WHERE kc."clientId" = ${clientId}
      AND kc."searchVector" @@ plainto_tsquery('english', ${trimmed})
    ORDER BY "rank" DESC, kc."updatedAt" DESC
    LIMIT ${RETRIEVAL_MAX_CHUNKS * 3}
  `;

  const selected: RetrievedKnowledgeChunk[] = [];
  const documentIds = new Set<string>();
  let characterCount = 0;

  for (const row of rows) {
    if (!documentIds.has(row.document_id) && documentIds.size >= RETRIEVAL_MAX_DOCUMENTS) {
      continue;
    }
    if (selected.length >= RETRIEVAL_MAX_CHUNKS) {
      break;
    }
    const nextLength = characterCount + row.content.length;
    if (nextLength > RETRIEVAL_MAX_CHARACTERS && selected.length > 0) {
      break;
    }
    selected.push(row);
    documentIds.add(row.document_id);
    characterCount = nextLength;
  }

  if (selected.length) {
    return selected;
  }

  const fallback = await prisma.$queryRaw<RetrievedKnowledgeChunk[]>`
    SELECT
      kc."documentId" AS "document_id",
      kd."documentKey" AS "document_key",
      kc."documentVersion" AS "document_version",
      kdv."title" AS "title",
      kc."content" AS "content",
      0::float AS "rank"
    FROM "KnowledgeChunk" kc
    INNER JOIN "KnowledgeDocument" kd
      ON kd."id" = kc."documentId"
      AND kd."clientId" = ${clientId}
      AND kd."documentState" = 'PUBLISHED'
      AND kd."publishedVersion" = kc."documentVersion"
    INNER JOIN "KnowledgeDocumentVersion" kdv
      ON kdv."documentId" = kd."id"
      AND kdv."clientId" = ${clientId}
      AND kdv."version" = kd."publishedVersion"
    WHERE kc."clientId" = ${clientId}
    ORDER BY kd."updatedAt" DESC, kc."chunkIndex" ASC
    LIMIT ${RETRIEVAL_MAX_CHUNKS}
  `;

  if (fallback.length) {
    return fallback.slice(0, RETRIEVAL_MAX_CHUNKS);
  }

  const legacyEntries = await prisma.knowledgeEntry.findMany({
    where: { clientId, deletedAt: null, enabled: true },
    orderBy: { sortOrder: "asc" },
    take: RETRIEVAL_MAX_CHUNKS
  });

  return legacyEntries.map((entry) => ({
    document_id: entry.id,
    document_key: `legacy-${entry.id}`,
    document_version: entry.version,
    title: entry.title,
    content: `${entry.type}: ${entry.title}\n${JSON.stringify(entry.content)}`,
    rank: 0
  }));
}
