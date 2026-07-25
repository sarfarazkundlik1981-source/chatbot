import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function listConversations(
  clientId: string,
  filters: { search?: string; domain?: string; from?: string; to?: string; conversationId?: string } = {}
) {
  return prisma.conversation.findMany({
    where: {
      clientId,
      id: filters.conversationId ?? undefined,
      domain: filters.domain ? { contains: filters.domain, mode: "insensitive" } : undefined,
      startedAt:
        filters.from || filters.to
          ? {
              gte: filters.from ? new Date(filters.from) : undefined,
              lte: filters.to ? new Date(filters.to) : undefined
            }
          : undefined,
      OR: filters.search
        ? [
            { domain: { contains: filters.search, mode: "insensitive" } },
            { messages: { some: { body: { contains: filters.search, mode: "insensitive" } } } }
          ]
        : undefined
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 3
      }
    },
    orderBy: { lastSeenAt: "desc" }
  });
}

export async function getConversation(clientId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clientId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      summary: true
    }
  });
  if (!conversation) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation was not found.");
  }
  return conversation;
}

export async function exportConversationTranscript(clientId: string, conversationId: string) {
  const conversation = await getConversation(clientId, conversationId);
  return conversation.messages
    .map((message) => `${message.createdAt.toISOString()} [${message.role}] ${message.body.replace(/\r?\n/g, " ")}`)
    .join("\n");
}
