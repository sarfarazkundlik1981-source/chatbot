import { Router } from "express";
import { z } from "zod";

import { eventBus } from "../domain/event-bus.js";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { anonymizeIp, writeSecurityLog } from "../lib/audit.js";
import { verifyCaptchaForInteraction } from "../lib/captcha.js";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { protectWidgetPublicEndpoint } from "../middleware/rate-limit.js";
import { sendChatMessage, submitLead } from "../services/chat-service.js";
import { calculateInstantQuote, evaluateServiceArea } from "../services/feature-service.js";
import { activatePlugin, createPluginSession, recordHeartbeat, resumePluginSession, verifyInstallationPlugin, verifyPlugin } from "../services/plugin-service.js";
import { getWidgetConfig } from "../services/widget-service.js";
import { requireIdempotency, requireIdempotencyHeader, persistIdempotentResponse } from "../lib/idempotency.js";

const verifySchema = z.object({
  client_id: z.string().uuid().or(z.string().min(8)),
  client_secret: z.string().min(8),
  domain: z.string().min(3),
  plugin_version: z.string().min(1),
  wordpress_version: z.string().optional(),
  php_version: z.string().optional(),
  elementor_version: z.string().optional(),
  logo_url: z.string().url().optional(),
  config_version: z.number().int().nonnegative().optional()
});

const activateSchema = verifySchema.omit({
  client_id: true,
  client_secret: true
}).extend({
  activation_code: z.string().min(8)
});

const installationVerifySchema = activateSchema.omit({
  activation_code: true
}).extend({
  installation_id: z.string().min(8),
  installation_secret: z.string().min(20)
});

const heartbeatSchema = verifySchema.pick({
  client_id: true,
  domain: true,
  plugin_version: true,
  wordpress_version: true,
  php_version: true,
  elementor_version: true,
  logo_url: true
}).partial({ client_id: true });

const chatProtection = protectWidgetPublicEndpoint("chat", {
  ipBurst: { limit: 15, windowMs: 10_000 },
  ipSustained: { limit: 120, windowMs: 10 * 60 * 1000 },
  tenantBurst: { limit: 60, windowMs: 10_000 },
  tenantSustained: { limit: 1000, windowMs: 10 * 60 * 1000 },
  tokenBurst: { limit: 20, windowMs: 10_000 },
  tokenSustained: { limit: 180, windowMs: 10 * 60 * 1000 }
});

const leadProtection = protectWidgetPublicEndpoint("lead", {
  ipBurst: { limit: 5, windowMs: 30_000 },
  ipSustained: { limit: 25, windowMs: 60 * 60 * 1000 },
  tenantBurst: { limit: 30, windowMs: 30_000 },
  tenantSustained: { limit: 200, windowMs: 60 * 60 * 1000 },
  tokenBurst: { limit: 6, windowMs: 30_000 },
  tokenSustained: { limit: 30, windowMs: 60 * 60 * 1000 }
});

const quoteProtection = protectWidgetPublicEndpoint("quote", {
  ipBurst: { limit: 5, windowMs: 30_000 },
  ipSustained: { limit: 40, windowMs: 60 * 60 * 1000 },
  tenantBurst: { limit: 30, windowMs: 30_000 },
  tenantSustained: { limit: 300, windowMs: 60 * 60 * 1000 },
  tokenBurst: { limit: 8, windowMs: 30_000 },
  tokenSustained: { limit: 60, windowMs: 60 * 60 * 1000 }
});

const serviceAreaProtection = protectWidgetPublicEndpoint("service_area", {
  ipBurst: { limit: 10, windowMs: 30_000 },
  ipSustained: { limit: 100, windowMs: 60 * 60 * 1000 },
  tenantBurst: { limit: 50, windowMs: 30_000 },
  tenantSustained: { limit: 500, windowMs: 60 * 60 * 1000 },
  tokenBurst: { limit: 12, windowMs: 30_000 },
  tokenSustained: { limit: 120, windowMs: 60 * 60 * 1000 }
});

function sendPluginRouteError(res: Parameters<typeof sendError>[0], error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.code, error.message, error.details);
  }

  return sendError(res, 500, fallbackCode, error instanceof Error ? error.message : fallbackMessage);
}

function fallbackCodeFromUnknown(error: unknown): string {
  if (error instanceof AppError) {
    return error.code;
  }

  return "UNKNOWN_ERROR";
}

async function logPluginSecurityEvent(input: {
  clientId?: string;
  requestId?: string;
  source: string;
  severity?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await writeSecurityLog({
      clientId: input.clientId,
      requestId: input.requestId,
      source: input.source,
      severity: input.severity,
      payload: input.payload
    });
  } catch {
    return;
  }
}

export const pluginRouter = Router();

pluginRouter.post("/activate", requireIdempotency("plugin_activate"), requireIdempotencyHeader, async (req, res) => {
  const parsed = activateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Plugin activation payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const activation = await activatePlugin(parsed.data);
    const result = activation.data;
    await eventBus.emit({ type: "plugin.verified", clientId: activation.clientId, domain: parsed.data.domain });
    await logPluginSecurityEvent({
      clientId: activation.clientId,
      requestId: res.locals.requestId as string,
      source: "plugin.activate_succeeded",
      severity: "info",
      payload: {
        domain: parsed.data.domain,
        plugin_version: parsed.data.plugin_version,
        ip_hash: anonymizeIp(req.ip)
      }
    });
    const payload = {
      success: true,
      data: result,
      meta: { compatibility_status: result.compatibility_status, compatibility_details: result.compatibility_details },
      request_id: res.locals.requestId as string
    };
    await persistIdempotentResponse("plugin_activate", req.header("Idempotency-Key") ?? undefined, payload);
    return res.status(200).json(payload);
  } catch (error) {
    await logPluginSecurityEvent({
      requestId: res.locals.requestId as string,
      source: "plugin.activate_failed",
      severity: "warning",
      payload: {
        domain: parsed.data.domain,
        plugin_version: parsed.data.plugin_version,
        ip_hash: anonymizeIp(req.ip),
        reason_code: error instanceof AppError ? error.code : fallbackCodeFromUnknown(error),
        reason_message: error instanceof Error ? error.message : "Plugin activation failed."
      }
    });
    const statusCode = error instanceof AppError ? error.statusCode : 403;
    const code = error instanceof AppError ? error.code : "PLUGIN_ACTIVATION_FAILED";
    return sendError(res, statusCode, code, error instanceof Error ? error.message : "Plugin activation failed.");
  }
});

pluginRouter.post("/verify-installation", requireIdempotency("plugin_installation_verify"), requireIdempotencyHeader, async (req, res) => {
  const parsed = installationVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Plugin installation verification payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const verification = await verifyInstallationPlugin(parsed.data);
    const result = verification.data;
    await eventBus.emit({ type: "plugin.verified", clientId: verification.clientId, domain: parsed.data.domain });
    await logPluginSecurityEvent({
      clientId: verification.clientId,
      requestId: res.locals.requestId as string,
      source: "plugin.installation_verify_succeeded",
      severity: "info",
      payload: {
        domain: parsed.data.domain,
        plugin_version: parsed.data.plugin_version,
        ip_hash: anonymizeIp(req.ip)
      }
    });
    const payload = {
      success: true,
      data: result,
      meta: { compatibility_status: result.compatibility_status, compatibility_details: result.compatibility_details },
      request_id: res.locals.requestId as string
    };
    await persistIdempotentResponse("plugin_installation_verify", req.header("Idempotency-Key") ?? undefined, payload);
    return res.status(200).json(payload);
  } catch (error) {
    await logPluginSecurityEvent({
      requestId: res.locals.requestId as string,
      source: "plugin.installation_verify_failed",
      severity: "warning",
      payload: {
        domain: parsed.data.domain,
        plugin_version: parsed.data.plugin_version,
        ip_hash: anonymizeIp(req.ip),
        reason_code: error instanceof AppError ? error.code : fallbackCodeFromUnknown(error),
        reason_message: error instanceof Error ? error.message : "Plugin installation verification failed."
      }
    });
    const statusCode = error instanceof AppError ? error.statusCode : 403;
    const code = error instanceof AppError ? error.code : "PLUGIN_INSTALLATION_VERIFY_FAILED";
    return sendError(res, statusCode, code, error instanceof Error ? error.message : "Plugin installation verification failed.");
  }
});

pluginRouter.post("/verify", requireIdempotency("plugin_verify"), requireIdempotencyHeader, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Plugin verification payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const result = await verifyPlugin(parsed.data);
    await eventBus.emit({ type: "plugin.verified", clientId: parsed.data.client_id, domain: parsed.data.domain });
    await logPluginSecurityEvent({
      clientId: parsed.data.client_id,
      requestId: res.locals.requestId as string,
      source: "plugin.verify_succeeded",
      severity: "info",
      payload: {
        domain: parsed.data.domain,
        plugin_version: parsed.data.plugin_version,
        ip_hash: anonymizeIp(req.ip)
      }
    });
    const payload = {
      success: true,
      data: result,
      meta: { compatibility_status: result.compatibility_status, compatibility_details: result.compatibility_details },
      request_id: res.locals.requestId as string
    };
    await persistIdempotentResponse("plugin_verify", req.header("Idempotency-Key") ?? undefined, payload);
    return res.status(200).json(payload);
  } catch (error) {
    await logPluginSecurityEvent({
      clientId: parsed.data.client_id,
      requestId: res.locals.requestId as string,
      source: "plugin.verify_failed",
      severity: "warning",
      payload: {
        domain: parsed.data.domain,
        plugin_version: parsed.data.plugin_version,
        ip_hash: anonymizeIp(req.ip),
        reason_code: error instanceof AppError ? error.code : fallbackCodeFromUnknown(error),
        reason_message: error instanceof Error ? error.message : "Plugin verification failed."
      }
    });
    const statusCode = error instanceof AppError ? error.statusCode : 403;
    const code = error instanceof AppError ? error.code : "PLUGIN_VERIFY_FAILED";
    return sendError(res, statusCode, code, error instanceof Error ? error.message : "Plugin verification failed.");
  }
});

pluginRouter.post("/heartbeat", requireAuth("plugin"), async (req, res) => {
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    await logPluginSecurityEvent({
      requestId: res.locals.requestId as string,
      source: "plugin.heartbeat_invalid_payload",
      severity: "warning",
      payload: {
        ip_hash: anonymizeIp(req.ip)
      }
    });
    return sendError(res, 422, "VALIDATION_ERROR", "Plugin heartbeat payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  const auth = res.locals.auth as { clientId?: string; domain?: string } | undefined;
  const heartbeatClientId = parsed.data.client_id ?? auth?.clientId;
  if (!auth?.clientId || auth.clientId !== heartbeatClientId || auth?.domain !== parsed.data.domain) {
    await logPluginSecurityEvent({
      clientId: auth?.clientId ?? parsed.data.client_id,
      requestId: res.locals.requestId as string,
      source: "plugin.heartbeat_installation_mismatch",
      severity: "warning",
      payload: {
        expected_domain: auth?.domain ?? null,
        received_domain: parsed.data.domain,
        ip_hash: anonymizeIp(req.ip)
      }
    });
    return sendError(res, 403, "FORBIDDEN", "Heartbeat payload does not match the authenticated plugin installation.");
  }

  try {
    const compatibility = await recordHeartbeat({
      ...parsed.data,
      client_id: auth.clientId
    });
    await eventBus.emit({ type: "plugin.heartbeat_received", clientId: auth.clientId, domain: parsed.data.domain });
    return sendSuccess(res, { accepted: true }, { compatibility_status: compatibility.status, compatibility_details: compatibility.details });
  } catch (error) {
    await logPluginSecurityEvent({
      clientId: auth.clientId,
      requestId: res.locals.requestId as string,
      source: "plugin.heartbeat_failed",
      severity: "warning",
      payload: {
        domain: parsed.data.domain,
        plugin_version: parsed.data.plugin_version,
        ip_hash: anonymizeIp(req.ip),
        reason_code: error instanceof AppError ? error.code : fallbackCodeFromUnknown(error),
        reason_message: error instanceof Error ? error.message : "Heartbeat failed."
      }
    });
    return sendPluginRouteError(res, error, "PLUGIN_HEARTBEAT_FAILED", "Heartbeat failed.");
  }
});

pluginRouter.get("/widget-config", requireAuth("plugin"), async (_req, res) => {
  const auth = res.locals.auth as { clientId: string };
  return sendSuccess(res, await getWidgetConfig(auth.clientId));
});

pluginRouter.post("/session", requireAuth("plugin"), async (_req, res) => {
  const auth = res.locals.auth as { clientId: string };
  return sendSuccess(res, await createPluginSession(auth.clientId), {}, 201);
});

pluginRouter.post("/resume", requireAuth("plugin"), async (req, res) => {
  const body = z.object({ resume_token: z.string().min(20) }).safeParse(req.body);
  if (!body.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Resume payload is invalid.", { issues: body.error.flatten() });
  }
  const auth = res.locals.auth as { clientId: string };
  try {
    return sendSuccess(res, await resumePluginSession(auth.clientId, body.data.resume_token));
  } catch (error) {
    return sendError(res, 404, "RESUME_NOT_FOUND", error instanceof Error ? error.message : "Resume failed.");
  }
});

pluginRouter.post("/chat", requireAuth("plugin"), chatProtection, async (req, res) => {
  const body = z.object({
    conversation_id: z.string().min(1).max(100),
    message: z.string().trim().min(1).max(2000),
    captcha_token: z.string().min(10).max(4000).optional()
  }).safeParse(req.body);

  if (!body.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Chat payload is invalid.", { issues: body.error.flatten() });
  }

  const auth = res.locals.auth as { clientId: string };
  try {
    await verifyCaptchaForInteraction({
      clientId: auth.clientId,
      interaction: "chat",
      token: body.data.captcha_token,
      ip: req.ip
    });
    const reply = await sendChatMessage(auth.clientId, body.data.conversation_id, body.data.message);
    return sendSuccess(res, reply);
  } catch (error) {
    return sendPluginRouteError(res, error, "CHAT_FAILED", "Chat request failed.");
  }
});

pluginRouter.post("/chat/stream", requireAuth("plugin"), chatProtection, async (req, res) => {
  const body = z.object({
    conversation_id: z.string().min(1).max(100),
    message: z.string().trim().min(1).max(2000),
    captcha_token: z.string().min(10).max(4000).optional()
  }).safeParse(req.body);

  if (!body.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Streaming chat payload is invalid.", { issues: body.error.flatten() });
  }

  const auth = res.locals.auth as { clientId: string };
  let reply;
  try {
    await verifyCaptchaForInteraction({
      clientId: auth.clientId,
      interaction: "chat",
      token: body.data.captcha_token,
      ip: req.ip
    });
    reply = await sendChatMessage(auth.clientId, body.data.conversation_id, body.data.message);
  } catch (error) {
    return sendPluginRouteError(res, error, "CHAT_STREAM_FAILED", "Streaming chat failed.");
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  res.write(`event: message_start\ndata: ${JSON.stringify({ conversation_id: body.data.conversation_id })}\n\n`);
  for (const chunk of reply.message.split(" ")) {
    res.write(`event: token\ndata: ${JSON.stringify({ token: `${chunk} ` })}\n\n`);
  }
  res.write(`event: lead_state\ndata: ${JSON.stringify({ lead_state: reply.lead_state })}\n\n`);
  res.write(`event: cta_options\ndata: ${JSON.stringify({ ctas: reply.cta_options ?? [] })}\n\n`);
  res.write(`event: message_complete\ndata: ${JSON.stringify(reply)}\n\n`);
  res.end();
});

pluginRouter.post("/lead", requireAuth("plugin"), leadProtection, requireIdempotency("plugin_lead_submit"), requireIdempotencyHeader, async (req, res) => {
  const body = z.object({
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().max(50).optional(),
    status: z.string().trim().max(50).optional(),
    message: z.string().trim().max(4000).optional(),
    data: z.record(z.any()).optional(),
    captcha_token: z.string().min(10).max(4000).optional()
  }).safeParse(req.body);

  if (!body.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Lead payload is invalid.", { issues: body.error.flatten() });
  }

  const auth = res.locals.auth as { clientId: string };
  try {
    const requestType = String(body.data.data?.request_type ?? body.data.data?.kind ?? "").toLowerCase();
    const interaction =
      requestType === "callback" ? "callback" : requestType === "appointment" ? "appointment" : requestType === "quote" ? "quote" : "lead";
    await verifyCaptchaForInteraction({
      clientId: auth.clientId,
      interaction,
      token: body.data.captcha_token,
      ip: req.ip
    });
    const lead = await submitLead(auth.clientId, body.data);
    await eventBus.emit({ type: "lead.created", clientId: auth.clientId, leadId: lead.id });
    const payload = {
      success: true,
      data: { id: lead.id, status: lead.status },
      meta: {},
      request_id: res.locals.requestId as string
    };
    await persistIdempotentResponse("plugin_lead_submit", req.header("Idempotency-Key") ?? undefined, payload);
    return res.status(201).json(payload);
  } catch (error) {
    return sendPluginRouteError(res, error, "LEAD_SUBMIT_FAILED", "Lead submission failed.");
  }
});

pluginRouter.post("/event", requireAuth("plugin"), (_req, res) => sendSuccess(res, { accepted: true }, {}, 202));

pluginRouter.post("/service-area-check", requireAuth("plugin"), serviceAreaProtection, async (req, res) => {
  const body = z.object({ query: z.string().trim().min(1).max(200) }).safeParse(req.body);
  if (!body.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Service area check payload is invalid.", { issues: body.error.flatten() });
  }
  const auth = res.locals.auth as { clientId: string };
  return sendSuccess(res, await evaluateServiceArea(auth.clientId, body.data.query));
});

pluginRouter.post("/quote-calculate", requireAuth("plugin"), quoteProtection, async (req, res) => {
  const body = z.object({
    values: z.record(z.any()),
    captcha_token: z.string().min(10).max(4000).optional()
  }).safeParse(req.body);
  if (!body.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Quote calculation payload is invalid.", { issues: body.error.flatten() });
  }
  const auth = res.locals.auth as { clientId: string };
  try {
    await verifyCaptchaForInteraction({
      clientId: auth.clientId,
      interaction: "quote",
      token: body.data.captcha_token,
      ip: req.ip
    });
    return sendSuccess(res, await calculateInstantQuote(auth.clientId, body.data.values));
  } catch (error) {
    return sendPluginRouteError(res, error, "QUOTE_CALCULATION_FAILED", "Quote calculation failed.");
  }
});
