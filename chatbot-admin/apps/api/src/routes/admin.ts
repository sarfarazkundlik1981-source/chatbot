import { Router } from "express";
import { z } from "zod";

import { sendError, sendSuccess } from "../lib/api-response.js";
import { requireAuth, requirePlatformRole } from "../middleware/auth.js";
import { createClient, createPlatformUser, createPluginRelease, getCompatibilityRules, getCompatibilitySummary, getSecurityEventsSummary, listClients, listPlatformUsers, listPluginReleases, listSecurityEvents } from "../services/admin-service.js";

const createClientSchema = z
  .object({
    name: z.string().min(1),
    domain: z.string().min(3),
    activation_code: z.string().min(8).optional(),
    plugin_secret: z.string().min(8).optional()
  })
  .refine((value) => Boolean(value.activation_code || value.plugin_secret), {
    message: "Activation code is required.",
    path: ["activation_code"]
  });

const createPlatformUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["platform_owner", "platform_admin"])
});

const createPluginReleaseSchema = z.object({
  version: z.string().min(1),
  download_url: z.string().url(),
  release_notes: z.string().optional()
});

export const adminRouter = Router();

adminRouter.use(requireAuth("dashboard"));
adminRouter.use(requirePlatformRole(["platform_owner", "platform_admin"]));

adminRouter.get("/platform/clients", async (_req, res) => {
  return sendSuccess(res, await listClients());
});

adminRouter.post("/platform/clients", async (req, res) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Client payload is invalid.", { issues: parsed.error.flatten() });
  }

  const client = await createClient({
    name: parsed.data.name,
    domain: parsed.data.domain,
    pluginSecret: parsed.data.activation_code ?? parsed.data.plugin_secret ?? "",
    actorId: (res.locals.auth as { sub?: string } | undefined)?.sub,
    requestId: res.locals.requestId as string
  });
  return sendSuccess(res, client, {}, 201);
});

adminRouter.get("/platform/users", async (_req, res) => {
  return sendSuccess(res, await listPlatformUsers());
});

adminRouter.post("/platform/users", async (req, res) => {
  const parsed = createPlatformUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Platform user payload is invalid.", { issues: parsed.error.flatten() });
  }

  return sendSuccess(
    res,
    await createPlatformUser({
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role,
      actorId: (res.locals.auth as { sub?: string } | undefined)?.sub,
      requestId: res.locals.requestId as string
    }),
    {},
    201
  );
});

adminRouter.get("/platform/plugin-releases", async (_req, res) => {
  return sendSuccess(res, await listPluginReleases());
});

adminRouter.post("/platform/plugin-releases", async (req, res) => {
  const parsed = createPluginReleaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Plugin release payload is invalid.", { issues: parsed.error.flatten() });
  }

  return sendSuccess(
    res,
    await createPluginRelease({
      version: parsed.data.version,
      downloadUrl: parsed.data.download_url,
      releaseNotes: parsed.data.release_notes,
      actorId: (res.locals.auth as { sub?: string } | undefined)?.sub,
      requestId: res.locals.requestId as string
    }),
    {},
    201
  );
});

adminRouter.get("/platform/compatibility-rules", async (_req, res) => {
  return sendSuccess(res, await getCompatibilityRules());
});

adminRouter.get("/platform/compatibility-summary", async (_req, res) => {
  return sendSuccess(res, await getCompatibilitySummary());
});

adminRouter.get("/platform/security-events", async (_req, res) => {
  return sendSuccess(res, await listSecurityEvents());
});

adminRouter.get("/platform/security-events-summary", async (_req, res) => {
  return sendSuccess(res, await getSecurityEventsSummary());
});
