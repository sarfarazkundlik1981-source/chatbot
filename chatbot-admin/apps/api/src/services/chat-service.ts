import { prisma } from "../lib/prisma.js";
import { decryptValue, hashValue } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { eventBus } from "../domain/event-bus.js";
import { newId } from "../lib/ids.js";
import { incrementFaqSuggestion } from "./feature-service.js";
import { buildPrompt } from "./prompt-pipeline.js";
import { retrieveKnowledge } from "./retriever-service.js";
import { getLatestConfigVersion } from "./client-service.js";

type ChatReply = {
  message: string;
  lead_state: "none" | "collecting" | "complete";
  token_usage?: number;
  estimated_cost?: number;
  cta_options?: Array<{ label: string; url: string; kind: string }>;
};

const fallbackUnavailableMessage =
  "The assistant is temporarily unavailable. Please use the contact options on this page.";

async function fetchModelReply(apiKey: string, model: string, systemPrompt: string, messages: Array<{ role: string; content: string }>) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages]
    })
  });

  if (!response.ok) {
    throw new AppError(response.status >= 500 ? 503 : 422, "OPENROUTER_REQUEST_FAILED", "Model request failed.");
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  return {
    content: json.choices?.[0]?.message?.content?.trim() || fallbackUnavailableMessage,
    tokens: json.usage?.total_tokens ?? 0
  };
}

function isWithinBusinessHours(schedule: unknown, timezone?: string | null): boolean {
  if (!schedule || typeof schedule !== "object") {
    return true;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const weekday = parts.find((part) => part.type === "weekday")?.value?.toLowerCase().slice(0, 3);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const daySchedule = weekday ? (schedule as Record<string, any>)[weekday] : null;
  if (!daySchedule || daySchedule.closed || !daySchedule.open || !daySchedule.close) {
    return false;
  }

  const [openHour, openMinute] = String(daySchedule.open).split(":").map(Number);
  const [closeHour, closeMinute] = String(daySchedule.close).split(":").map(Number);
  const currentMinutes = hour * 60 + minute;
  return currentMinutes >= openHour * 60 + openMinute && currentMinutes <= closeHour * 60 + closeMinute;
}

function extractEmergencyKeywords(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((value) => String(value));
  }
  if (input && typeof input === "object" && Array.isArray((input as Record<string, unknown>).terms)) {
    return ((input as Record<string, unknown>).terms as unknown[]).map((value) => String(value));
  }
  return [];
}

type ModelReply = { content: string; tokens: number; trace?: { configurationVersion?: number; knowledgeVersion?: string; aiSettingsVersion?: number; businessConfigVersion?: string } };

export async function fetchOpenRouterReply(clientId: string, content: string): Promise<ModelReply> {
  const [client, internalSettings, aiSettings, businessHours, outOfHours, priceListItems, callbackConfig, appointmentConfig, serviceAreaConfig, leadQualification, emergencyDetection, retrievedKnowledge, configurationVersion] =
    await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.internalSettings.findUnique({ where: { clientId } }),
      prisma.aiSettings.findUnique({ where: { clientId } }),
      prisma.businessHoursConfig.findUnique({ where: { clientId } }),
      prisma.outOfHoursConfig.findUnique({ where: { clientId } }),
      prisma.priceListItem.findMany({ where: { clientId, deletedAt: null, enabled: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.callbackRequestConfig.findUnique({ where: { clientId } }),
      prisma.appointmentRequestConfig.findUnique({ where: { clientId } }),
      prisma.serviceAreaConfig.findUnique({ where: { clientId } }),
      prisma.leadQualificationConfig.findUnique({ where: { clientId } }),
      prisma.emergencyDetectionConfig.findUnique({ where: { clientId } }),
      retrieveKnowledge(clientId, content),
      getLatestConfigVersion(clientId)
    ]);

  if (!internalSettings?.openRouterApiKey || !aiSettings?.primaryModel) {
    return { content: fallbackUnavailableMessage, tokens: 0 };
  }

  const emergencyKeywords = extractEmergencyKeywords(emergencyDetection?.keywords);
  if (emergencyDetection?.enabled && emergencyKeywords.some((keyword) => content.toLowerCase().includes(keyword.toLowerCase()))) {
    return { content: emergencyDetection.responseMessage, tokens: 0 };
  }

  if (/(politics|religion|medical|legal|financial|investment|adult|illegal|hate|harass|violence|weapon)/i.test(content)) {
    return {
      content:
        "I can only help with business-related questions for this website. Please contact the business directly for anything outside that scope.",
      tokens: 0
    };
  }

  const pricingBlock = priceListItems
    .map((item) => `${item.category}: ${item.name}${item.price !== null && item.price !== undefined ? ` - ${item.price} ${item.currency ?? ""}` : ""}${item.description ? ` (${item.description})` : ""}`)
    .join("\n");
  const openNow = businessHours?.enabled ? isWithinBusinessHours(businessHours.schedule, businessHours.timezone) : true;
  const runtimeContext = [
    businessHours?.enabled ? `Business hours enabled. Open now: ${openNow ? "yes" : "no"}. Schedule: ${JSON.stringify(businessHours.schedule)}` : "",
    !openNow && outOfHours?.enabled ? `Out-of-hours mode is active. Visitor message: ${outOfHours.visitorMessage ?? ""}` : "",
    callbackConfig?.enabled ? `Callback requests are enabled with label ${callbackConfig.buttonLabel}.` : "",
    appointmentConfig?.enabled ? `Appointments are enabled with title ${appointmentConfig.title}.` : "",
    serviceAreaConfig?.enabled ? "Service area checker is enabled. Only confirm coverage when you have supporting evidence." : "",
    leadQualification?.enabled ? `Lead qualification enabled. Required fields: ${JSON.stringify(leadQualification.requiredFields)}. Stages: ${JSON.stringify(leadQualification.stages)}` : "",
    pricingBlock ? `Structured prices:\n${pricingBlock}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const apiKey = decryptValue(internalSettings.openRouterApiKey);
  const systemPrompt = buildPrompt({
    systemInstructions: aiSettings.systemInstructions,
    businessContext: client?.name ? `Business name: ${client.name}` : "",
    runtimeContext,
    retrievedKnowledge,
    userMessage: content
  });
  const trace = {
    configurationVersion,
    knowledgeVersion: hashValue(retrievedKnowledge.map((chunk) => `${chunk.document_id}:${chunk.document_version}:${chunk.content}`).join("|")).slice(0, 16),
    aiSettingsVersion: aiSettings.version,
    businessConfigVersion: String(configurationVersion)
  };

  try {
    return { ...(await fetchModelReply(apiKey, aiSettings.primaryModel, systemPrompt, [{ role: "user", content }])), trace };
  } catch {
    if (internalSettings.fallbackModel) {
      try {
        return { ...(await fetchModelReply(apiKey, internalSettings.fallbackModel, systemPrompt, [{ role: "user", content }])), trace };
      } catch {
        return { content: fallbackUnavailableMessage, tokens: 0, trace };
      }
    }
    return { content: fallbackUnavailableMessage, tokens: 0, trace };
  }
}

async function refreshConversationSummary(conversationId: string): Promise<void> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" }
  });

  if (messages.length <= 12) {
    return;
  }

  const summary = messages
    .slice(0, Math.max(1, messages.length - 12))
    .map((message) => `${message.role}: ${message.body}`)
    .join("\n")
    .slice(0, 3000);

  await prisma.conversationSummary.upsert({
    where: { conversationId },
    update: { summary },
    create: { id: newId(), conversationId, summary }
  });
}

export async function sendChatMessage(clientId: string, conversationId: string, message: string): Promise<ChatReply> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clientId }
  });

  if (!conversation) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation was not found.");
  }

  await prisma.message.create({
    data: {
      id: newId(),
      conversationId,
      role: "user",
      body: message
    }
  });

  const [recentMessages, summary, ctas, businessHours, outOfHours, callbackConfig, appointmentConfig, serviceAreaConfig, quoteConfig] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.conversationSummary.findUnique({ where: { conversationId } }),
    prisma.ctaConfig.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    prisma.businessHoursConfig.findUnique({ where: { clientId } }),
    prisma.outOfHoursConfig.findUnique({ where: { clientId } }),
    prisma.callbackRequestConfig.findUnique({ where: { clientId } }),
    prisma.appointmentRequestConfig.findUnique({ where: { clientId } }),
    prisma.serviceAreaConfig.findUnique({ where: { clientId } }),
    prisma.quoteCalculatorConfig.findUnique({ where: { clientId } })
  ]);
  const openNow = businessHours?.enabled ? isWithinBusinessHours(businessHours.schedule, businessHours.timezone) : true;

  const reply = await fetchOpenRouterReply(
    clientId,
    `${summary ? `Conversation summary:\n${summary.summary}\n\n` : ""}Recent messages:\n${recentMessages
      .reverse()
      .map((item) => `${item.role}: ${item.body}`)
      .join("\n")}\n\nVisitor: ${message}`
  );

  await prisma.message.create({
    data: {
      id: newId(),
      conversationId,
      role: "assistant",
      body: reply.content,
      configurationVersion: reply.trace?.configurationVersion,
      knowledgeVersion: reply.trace?.knowledgeVersion,
      aiSettingsVersion: reply.trace?.aiSettingsVersion,
      businessConfigVersion: reply.trace?.businessConfigVersion
    }
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastSeenAt: new Date() }
  });
  await refreshConversationSummary(conversationId);

  await prisma.analyticsEvent.create({
    data: {
      id: newId(),
      clientId,
      eventType: "chat.reply",
      payload: {
        conversation_id: conversationId,
        token_usage: reply.tokens,
        estimated_cost: Number((reply.tokens * 0.000002).toFixed(6)),
        out_of_hours: !openNow,
        trace: reply.trace ?? {}
      }
    }
  });

  const normalizedQuestion = message.trim().toLowerCase().replace(/\s+/g, " ");
  if (reply.content === fallbackUnavailableMessage || /don't know|unavailable|not sure/i.test(reply.content)) {
    await prisma.unansweredQuestion.upsert({
      where: {
        id: `${clientId}:${conversationId}:${normalizedQuestion}`.slice(0, 191)
      },
      update: {
        frequency: { increment: 1 },
        lastAskedAt: new Date()
      },
      create: {
        id: `${clientId}:${conversationId}:${normalizedQuestion}`.slice(0, 191),
        clientId,
        normalizedQuestion,
        frequency: 1,
        status: "open",
        lastAskedAt: new Date()
      }
    }).catch(async () => {
      await prisma.unansweredQuestion.create({
        data: {
          id: newId(),
          clientId,
          normalizedQuestion,
          frequency: 1,
          status: "open",
          lastAskedAt: new Date()
        }
      });
    });
    await incrementFaqSuggestion(clientId, normalizedQuestion);
    await eventBus.emit({ type: "unanswered_question.detected", clientId, conversationId });
  }

  function isFeatureCtaAllowed(kind: string) {
    const normalizedKind = kind.toLowerCase();
    if (normalizedKind === "callback") {
      return Boolean(callbackConfig?.enabled);
    }
    if (normalizedKind === "appointment" || normalizedKind === "booking") {
      return Boolean(appointmentConfig?.enabled);
    }
    if (normalizedKind === "service-area") {
      return Boolean(serviceAreaConfig?.enabled);
    }
    if (normalizedKind === "quote") {
      return Boolean(quoteConfig?.enabled);
    }
    return true;
  }

  const ctaOptions = ctas.filter((cta) => isFeatureCtaAllowed(cta.kind)).map((cta) => ({ label: cta.label, url: cta.url, kind: cta.kind }));
  if (callbackConfig?.enabled) {
    ctaOptions.push({ label: callbackConfig.buttonLabel, url: "#callback-request", kind: "callback" });
  }
  if (appointmentConfig?.enabled) {
    ctaOptions.push({ label: appointmentConfig.title, url: "#appointment-request", kind: "appointment" });
  }
  if (serviceAreaConfig?.enabled) {
    ctaOptions.push({ label: "Check service area", url: "#service-area", kind: "service-area" });
  }
  if (quoteConfig?.enabled) {
    ctaOptions.push({ label: quoteConfig.title, url: "#instant-quote", kind: "quote" });
  }

  return {
    message: !openNow && outOfHours?.enabled && outOfHours.visitorMessage ? `${reply.content}\n\n${outOfHours.visitorMessage}` : reply.content,
    lead_state: /name|phone|email|contact|quote|book|appointment|callback/i.test(`${message} ${reply.content}`) ? "collecting" : "none",
    token_usage: reply.tokens,
    estimated_cost: Number((reply.tokens * 0.000002).toFixed(6)),
    cta_options: /contact|call|book|quote|whatsapp|appointment|callback|service area/i.test(`${message} ${reply.content}`) ? ctaOptions : []
  };
}

export async function submitLead(clientId: string, payload: {
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  data?: Record<string, unknown>;
}) {
  const lead = await prisma.lead.create({
    data: {
      id: newId(),
      clientId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      status: payload.status ?? "new",
      payload: (payload.data ?? {}) as any
    }
  });

  const requestType = String(payload.data?.request_type ?? payload.data?.kind ?? "").toLowerCase();
  if (requestType === "callback") {
    await prisma.callbackRequest.create({
      data: {
        id: newId(),
        clientId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        message: typeof payload.data?.message === "string" ? payload.data.message : null,
        payload: (payload.data ?? {}) as any
      }
    });
  }
  if (requestType === "appointment") {
    await prisma.appointmentRequest.create({
      data: {
        id: newId(),
        clientId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        service: typeof payload.data?.service === "string" ? payload.data.service : null,
        preferredDate: typeof payload.data?.preferred_date === "string" ? payload.data.preferred_date : null,
        preferredTime: typeof payload.data?.preferred_time === "string" ? payload.data.preferred_time : null,
        message: typeof payload.data?.message === "string" ? payload.data.message : null,
        payload: (payload.data ?? {}) as any
      }
    });
  }
  if (requestType === "quote") {
    await prisma.quoteRequest.create({
      data: {
        id: newId(),
        clientId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        amount: typeof payload.data?.amount === "number" ? payload.data.amount : null,
        currency: typeof payload.data?.currency === "string" ? payload.data.currency : null,
        payload: (payload.data ?? {}) as any
      }
    });
  }

  return lead;
}

export async function runPlaygroundMessage(clientId: string, message: string) {
  return fetchOpenRouterReply(clientId, message);
}
