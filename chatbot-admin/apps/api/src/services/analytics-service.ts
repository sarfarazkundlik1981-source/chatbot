import { prisma } from "../lib/prisma.js";
import { createKnowledgeDocument } from "./knowledge-service.js";
import { writeAuditLog } from "../lib/audit.js";

const TOKEN_COST_PER_MESSAGE = 0.0002;

export async function getAnalyticsOverview(clientId: string) {
  const [conversations, leads, unanswered, pluginInstallations, costEvents] = await Promise.all([
    prisma.conversation.count({ where: { clientId } }),
    prisma.lead.count({ where: { clientId, deletedAt: null } }),
    prisma.unansweredQuestion.findMany({
      where: { clientId },
      orderBy: { frequency: "desc" },
      take: 10
    }),
    prisma.pluginInstallation.count({ where: { clientId, deletedAt: null } }),
    prisma.analyticsEvent.findMany({
      where: { clientId, eventType: "chat.reply" },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const messageCount = await prisma.message.count({
    where: { conversation: { clientId } }
  });

  const now = Date.now();
  const costToday = costEvents
    .filter((event) => event.createdAt.getTime() >= now - 24 * 60 * 60 * 1000)
    .reduce((total, event) => total + Number((event.payload as { estimated_cost?: number } | null)?.estimated_cost ?? 0), 0);
  const costWeek = costEvents
    .filter((event) => event.createdAt.getTime() >= now - 7 * 24 * 60 * 60 * 1000)
    .reduce((total, event) => total + Number((event.payload as { estimated_cost?: number } | null)?.estimated_cost ?? 0), 0);
  const costMonth = costEvents
    .filter((event) => event.createdAt.getTime() >= now - 30 * 24 * 60 * 60 * 1000)
    .reduce((total, event) => total + Number((event.payload as { estimated_cost?: number } | null)?.estimated_cost ?? 0), 0);
  const averagePerChat = conversations > 0 ? costMonth / conversations : 0;
  const mostExpensiveConversation = costEvents.reduce<{ conversationId: string | null; cost: number }>(
    (current, event) => {
      const payload = (event.payload as { estimated_cost?: number; conversation_id?: string } | null) ?? {};
      const eventCost = Number(payload.estimated_cost ?? 0);
      return eventCost > current.cost ? { conversationId: payload.conversation_id ?? null, cost: eventCost } : current;
    },
    { conversationId: null, cost: 0 }
  );

  return {
    conversations,
    leads,
    plugin_installations: pluginInstallations,
    messages: messageCount,
    estimated_cost_today: Number(costToday.toFixed(6)),
    estimated_cost_week: Number(costWeek.toFixed(6)),
    estimated_cost_month: Number(costMonth.toFixed(6)),
    average_cost_per_chat: Number(averagePerChat.toFixed(6)),
    most_expensive_conversation: mostExpensiveConversation,
    unanswered_questions: unanswered.map((item) => ({
      question: item.normalizedQuestion,
      frequency: item.frequency,
      status: item.status
    }))
  };
}

export async function listAuditLogs(clientId?: string) {
  return prisma.log.findMany({
    where: {
      type: "AUDIT",
      clientId: clientId ?? undefined
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function listLeads(clientId: string, filters: {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  return prisma.lead.findMany({
    where: {
      clientId,
      deletedAt: null,
      status: filters.status ?? undefined,
      createdAt:
        filters.from || filters.to
          ? {
              gte: filters.from ? new Date(filters.from) : undefined,
              lte: filters.to ? new Date(filters.to) : undefined
            }
          : undefined,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } }
          ]
        : undefined
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function listUnansweredQuestions(clientId: string) {
  return prisma.unansweredQuestion.findMany({
    where: { clientId },
    orderBy: [{ frequency: "desc" }, { lastAskedAt: "desc" }]
  });
}

export async function resolveUnansweredQuestion(input: {
  clientId: string;
  questionId: string;
  actorId?: string;
  requestId?: string;
  title?: string;
  answer: string;
  markIgnored?: boolean;
}) {
  const question = await prisma.unansweredQuestion.findFirst({
    where: { id: input.questionId, clientId: input.clientId }
  });

  if (!question) {
    throw new Error("Unanswered question was not found.");
  }

  if (input.markIgnored) {
    await prisma.unansweredQuestion.update({
      where: { id: question.id },
      data: { status: "ignored" }
    });
    await writeAuditLog({
      clientId: input.clientId,
      actorId: input.actorId,
      action: "unanswered_question.ignored",
      target: question.id,
      requestId: input.requestId
    });
    return { ignored: true };
  }

  const entry = await createKnowledgeDocument(
    input.clientId,
    {
      title: input.title ?? question.normalizedQuestion,
      content: `Question: ${question.normalizedQuestion}\n\nAnswer: ${input.answer}`,
      tags: ["faq"]
    },
    input.actorId,
    input.requestId
  );

  await prisma.unansweredQuestion.update({
    where: { id: question.id },
    data: { status: "resolved" }
  });

  await writeAuditLog({
    clientId: input.clientId,
    actorId: input.actorId,
    action: "unanswered_question.resolved",
    target: question.id,
    requestId: input.requestId,
    metadata: { knowledge_entry_id: entry.id }
  });

  return { resolved: true, knowledge_entry_id: entry.id };
}

export async function restoreLead(clientId: string, leadId: string, restoredBy: string, requestId?: string) {
  const lead = await prisma.lead.updateMany({
    where: { id: leadId, clientId, deletedAt: { not: null } },
    data: {
      deletedAt: null,
      deletedBy: null
    }
  });

  if (!lead.count) {
    throw new Error("Lead was not found.");
  }

  await prisma.log.create({
    data: {
      clientId,
      type: "AUDIT",
      severity: "info",
      source: "lead.restore",
      requestId,
      payload: { actor_id: restoredBy, lead_id: leadId }
    }
  });
}

export async function exportRowsAsCsv(rows: Array<Record<string, unknown>>): Promise<string> {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const normalized = value === null || value === undefined ? "" : String(value).replace(/"/g, "\"\"");
          return `"${normalized}"`;
        })
        .join(",")
    )
  ];

  return lines.join("\n");
}
