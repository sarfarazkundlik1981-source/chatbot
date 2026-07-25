import { Router } from "express";
import { z } from "zod";

import { sendError, sendSuccess } from "../lib/api-response.js";
import { requireAuth, requireClientAccess, requireClientRole } from "../middleware/auth.js";
import {
  createKnowledgeEntry,
  getAiSettings,
  getBranding,
  getClientSettings,
  getInternalSettings,
  getWidgetSettings,
  listKnowledgeEntries,
  listPluginInstallations,
  restoreKnowledgeEntry,
  restorePluginInstallation,
  softDeleteKnowledgeEntry,
  upsertAiSettings,
  upsertBranding,
  upsertClientSettings,
  upsertInternalSettings,
  upsertWidgetSettings,
  updateKnowledgeEntry
} from "../services/client-service.js";
import { serializeAiSettings, serializeBrandingSettings, serializeClientSettings, serializeInternalSettings, serializeKnowledgeEntry, serializePluginInstallation, serializeWidgetSettings } from "../lib/serializers.js";

const clientSettingsSchema = z.object({
  timezone: z.string().min(1),
  default_country: z.string().min(2),
  language: z.string().min(2),
  date_format: z.string().min(2),
  currency: z.string().min(2),
  version: z.number().int().optional()
});

const brandingSchema = z.object({
  logo_url: z.string().url().optional(),
  avatar_url: z.string().url().optional(),
  launcher_icon_url: z.string().url().optional(),
  primary_color: z.string().min(4),
  secondary_color: z.string().min(4),
  border_radius: z.number().int().nonnegative(),
  font: z.string().min(1),
  header_style: z.string().min(1),
  version: z.number().int().optional()
});

const widgetSettingsSchema = z.object({
  position: z.string().min(1),
  greeting: z.string().min(1),
  auto_open: z.boolean(),
  auto_open_delay_ms: z.number().int().nonnegative(),
  hide_for_logged_in_users: z.boolean(),
  version: z.number().int().optional()
});

const internalSettingsSchema = z.object({
  open_router_api_key: z.string().min(8).optional(),
  fallback_model: z.string().min(1).optional(),
  admin_notes: z.string().optional(),
  version: z.number().int().optional()
});

const aiSettingsSchema = z.object({
  primary_model: z.string().min(1),
  system_instructions: z.string().optional(),
  version: z.number().int().optional()
});

const knowledgeCreateSchema = z.object({
  type: z.enum(["company", "services", "pricing", "faq", "team", "hours", "locations", "contact", "policies"]),
  title: z.string().min(1),
  content: z.record(z.any()).or(z.array(z.any())).or(z.object({}).passthrough()),
  sort_order: z.number().int().optional(),
  enabled: z.boolean().optional()
});

const knowledgeUpdateSchema = z.object({
  title: z.string().min(1),
  content: z.record(z.any()).or(z.array(z.any())).or(z.object({}).passthrough()),
  sort_order: z.number().int(),
  enabled: z.boolean(),
  version: z.number().int()
});

export const clientRouter = Router();

clientRouter.use(requireAuth("dashboard"));
clientRouter.use("/clients/:clientId", requireClientAccess());

clientRouter.get("/clients/:clientId/settings", async (req, res) => {
  try {
    const settings = await getClientSettings(String(req.params.clientId));
    return sendSuccess(res, serializeClientSettings(settings));
  } catch (error) {
    return sendError(res, 404, "SETTINGS_NOT_FOUND", error instanceof Error ? error.message : "Settings not found.");
  }
});

clientRouter.put("/clients/:clientId/settings", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = clientSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Client settings payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const settings = await upsertClientSettings(String(req.params.clientId), parsed.data);
    return sendSuccess(res, serializeClientSettings(settings));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Settings conflict.");
  }
});

clientRouter.get("/clients/:clientId/branding", async (req, res) => {
  try {
    const branding = await getBranding(String(req.params.clientId));
    return sendSuccess(res, serializeBrandingSettings(branding));
  } catch (error) {
    return sendError(res, 404, "BRANDING_NOT_FOUND", error instanceof Error ? error.message : "Branding not found.");
  }
});

clientRouter.put("/clients/:clientId/branding", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = brandingSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Branding payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const branding = await upsertBranding(String(req.params.clientId), parsed.data);
    return sendSuccess(res, serializeBrandingSettings(branding));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Branding conflict.");
  }
});

clientRouter.get("/clients/:clientId/widget-settings", async (req, res) => {
  try {
    const widgetSettings = await getWidgetSettings(String(req.params.clientId));
    return sendSuccess(res, serializeWidgetSettings(widgetSettings));
  } catch (error) {
    return sendError(res, 404, "WIDGET_SETTINGS_NOT_FOUND", error instanceof Error ? error.message : "Widget settings not found.");
  }
});

clientRouter.put("/clients/:clientId/widget-settings", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = widgetSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Widget settings payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const widgetSettings = await upsertWidgetSettings(String(req.params.clientId), parsed.data);
    return sendSuccess(res, widgetSettings);
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Widget settings conflict.");
  }
});

clientRouter.get("/clients/:clientId/internal-settings", requireClientRole(["owner", "admin"]), async (req, res) => {
  try {
    const internalSettings = await getInternalSettings(String(req.params.clientId));
    return sendSuccess(res, serializeInternalSettings(internalSettings));
  } catch (error) {
    return sendError(res, 404, "INTERNAL_SETTINGS_NOT_FOUND", error instanceof Error ? error.message : "Internal settings not found.");
  }
});

clientRouter.put("/clients/:clientId/internal-settings", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = internalSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Internal settings payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const internalSettings = await upsertInternalSettings(String(req.params.clientId), parsed.data, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string);
    return sendSuccess(res, serializeInternalSettings(internalSettings));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Internal settings conflict.");
  }
});

clientRouter.get("/clients/:clientId/ai-settings", async (req, res) => {
  try {
    const aiSettings = await getAiSettings(String(req.params.clientId));
    return sendSuccess(res, serializeAiSettings(aiSettings));
  } catch (error) {
    return sendError(res, 404, "AI_SETTINGS_NOT_FOUND", error instanceof Error ? error.message : "AI settings not found.");
  }
});

clientRouter.put("/clients/:clientId/ai-settings", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = aiSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "AI settings payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const aiSettings = await upsertAiSettings(String(req.params.clientId), parsed.data, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string);
    return sendSuccess(res, serializeAiSettings(aiSettings));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "AI settings conflict.");
  }
});

clientRouter.get("/clients/:clientId/knowledge", async (req, res) => {
  const entries = await listKnowledgeEntries(String(req.params.clientId));
  return sendSuccess(res, entries.map(serializeKnowledgeEntry));
});

clientRouter.post("/clients/:clientId/knowledge", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = knowledgeCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Knowledge entry payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  const entry = await createKnowledgeEntry(String(req.params.clientId), parsed.data as never);
  return sendSuccess(res, serializeKnowledgeEntry(entry), {}, 201);
});

clientRouter.put("/clients/:clientId/knowledge/:entryId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = knowledgeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Knowledge update payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const entry = await updateKnowledgeEntry(String(req.params.clientId), String(req.params.entryId), parsed.data as never);
    return sendSuccess(res, serializeKnowledgeEntry(entry));
  } catch (error) {
    const code = error instanceof Error && error.message.includes("not found") ? "KNOWLEDGE_ENTRY_NOT_FOUND" : "VERSION_CONFLICT";
    const status = code === "KNOWLEDGE_ENTRY_NOT_FOUND" ? 404 : 409;
    return sendError(res, status, code, error instanceof Error ? error.message : "Knowledge entry update failed.");
  }
});

clientRouter.delete("/clients/:clientId/knowledge/:entryId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  try {
    await softDeleteKnowledgeEntry(
      String(req.params.clientId),
      String(req.params.entryId),
      (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown",
      res.locals.requestId as string
    );
    return sendSuccess(res, { deleted: true });
  } catch (error) {
    return sendError(res, 404, "KNOWLEDGE_ENTRY_NOT_FOUND", error instanceof Error ? error.message : "Knowledge entry delete failed.");
  }
});

clientRouter.post("/clients/:clientId/knowledge/:entryId/restore", requireClientRole(["owner", "admin"]), async (req, res) => {
  try {
    await restoreKnowledgeEntry(
      String(req.params.clientId),
      String(req.params.entryId),
      (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown",
      res.locals.requestId as string
    );
    return sendSuccess(res, { restored: true });
  } catch (error) {
    return sendError(res, 404, "KNOWLEDGE_ENTRY_NOT_FOUND", error instanceof Error ? error.message : "Knowledge entry restore failed.");
  }
});

clientRouter.get("/clients/:clientId/plugin-installations", async (req, res) => {
  const installations = await listPluginInstallations(String(req.params.clientId));
  return sendSuccess(res, installations.map(serializePluginInstallation));
});

clientRouter.post("/clients/:clientId/plugin-installations/:installationId/restore", requireClientRole(["owner", "admin"]), async (req, res) => {
  try {
    await restorePluginInstallation(
      String(req.params.clientId),
      String(req.params.installationId),
      (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown",
      res.locals.requestId as string
    );
    return sendSuccess(res, { restored: true });
  } catch (error) {
    return sendError(res, 404, "PLUGIN_INSTALLATION_NOT_FOUND", error instanceof Error ? error.message : "Plugin installation restore failed.");
  }
});
