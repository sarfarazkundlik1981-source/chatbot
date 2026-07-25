import { Router } from "express";
import { z } from "zod";

import { sendError, sendSuccess } from "../lib/api-response.js";
import { requireAuth, requireClientAccess, requireClientRole } from "../middleware/auth.js";
import { createConfigVersion, getConfigVersion, listConfigVersions, rollbackConfigVersion } from "../services/client-service.js";
import { createCta, createLicense, listCtas, listDomains, listEntitlements, listFeatureFlags, listLicenses, updateCta, updateLicenseStatus, upsertEntitlement, upsertFeatureFlag, addDomain } from "../services/ops-service.js";

const domainSchema = z.object({ domain: z.string().min(3) });
const licenseSchema = z.object({ status: z.enum(["trial", "active", "expired", "suspended", "cancelled"]) });
const toggleSchema = z.object({ key: z.string().min(1), enabled: z.boolean().optional(), allowed: z.boolean().optional() });
const ctaCreateSchema = z.object({ label: z.string().min(1), kind: z.string().min(1), url: z.string().url() });
const ctaUpdateSchema = ctaCreateSchema.extend({ version: z.number().int() });

export const opsRouter = Router();

opsRouter.use(requireAuth("dashboard"));
opsRouter.use("/clients/:clientId", requireClientAccess());

opsRouter.get("/clients/:clientId/config-versions", async (req, res) => {
  return sendSuccess(res, await listConfigVersions(String(req.params.clientId)));
});

opsRouter.get("/clients/:clientId/config-versions/:versionNumber", async (req, res) => {
  try {
    return sendSuccess(res, await getConfigVersion(String(req.params.clientId), Number(req.params.versionNumber)));
  } catch (error) {
    return sendError(res, 404, "CONFIG_VERSION_NOT_FOUND", error instanceof Error ? error.message : "Not found.");
  }
});

opsRouter.post("/clients/:clientId/config-versions/snapshot", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  return sendSuccess(res, await createConfigVersion(String(req.params.clientId)), {}, 201);
});

opsRouter.post("/clients/:clientId/config-versions/:versionNumber/rollback", requireClientRole(["owner", "admin"]), async (req, res) => {
  try {
    return sendSuccess(
      res,
      await rollbackConfigVersion(
        String(req.params.clientId),
        Number(req.params.versionNumber),
        (res.locals.auth as { sub?: string } | undefined)?.sub,
        res.locals.requestId as string
      )
    );
  } catch (error) {
    return sendError(res, 404, "CONFIG_ROLLBACK_FAILED", error instanceof Error ? error.message : "Rollback failed.");
  }
});

opsRouter.get("/clients/:clientId/domains", async (req, res) => sendSuccess(res, await listDomains(String(req.params.clientId))));
opsRouter.post("/clients/:clientId/domains", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = domainSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Domain payload is invalid.", { issues: parsed.error.flatten() });
  }
  return sendSuccess(res, await addDomain(String(req.params.clientId), parsed.data.domain, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string), {}, 201);
});

opsRouter.get("/clients/:clientId/licenses", async (req, res) => sendSuccess(res, await listLicenses(String(req.params.clientId))));
opsRouter.post("/clients/:clientId/licenses", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = licenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "License payload is invalid.", { issues: parsed.error.flatten() });
  }
  return sendSuccess(res, await createLicense(String(req.params.clientId), parsed.data.status, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string), {}, 201);
});
opsRouter.put("/clients/:clientId/licenses/:licenseId", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = licenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "License update payload is invalid.", { issues: parsed.error.flatten() });
  }
  return sendSuccess(res, await updateLicenseStatus(String(req.params.clientId), String(req.params.licenseId), parsed.data.status, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
});

opsRouter.get("/clients/:clientId/feature-flags", async (req, res) => sendSuccess(res, await listFeatureFlags(String(req.params.clientId))));
opsRouter.put("/clients/:clientId/feature-flags", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.enabled === undefined) {
    return sendError(res, 422, "VALIDATION_ERROR", "Feature flag payload is invalid.", { issues: parsed.success ? {} : parsed.error.flatten() });
  }
  return sendSuccess(res, await upsertFeatureFlag(String(req.params.clientId), parsed.data.key, parsed.data.enabled, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
});

opsRouter.get("/clients/:clientId/entitlements", async (req, res) => sendSuccess(res, await listEntitlements(String(req.params.clientId))));
opsRouter.put("/clients/:clientId/entitlements", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.allowed === undefined) {
    return sendError(res, 422, "VALIDATION_ERROR", "Entitlement payload is invalid.", { issues: parsed.success ? {} : parsed.error.flatten() });
  }
  return sendSuccess(res, await upsertEntitlement(String(req.params.clientId), parsed.data.key, parsed.data.allowed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
});

opsRouter.get("/clients/:clientId/ctas", async (req, res) => sendSuccess(res, await listCtas(String(req.params.clientId))));
opsRouter.post("/clients/:clientId/ctas", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = ctaCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "CTA payload is invalid.", { issues: parsed.error.flatten() });
  }
  return sendSuccess(res, await createCta(String(req.params.clientId), parsed.data, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string), {}, 201);
});
opsRouter.put("/clients/:clientId/ctas/:ctaId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = ctaUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "CTA update payload is invalid.", { issues: parsed.error.flatten() });
  }
  try {
    return sendSuccess(res, await updateCta(String(req.params.clientId), String(req.params.ctaId), parsed.data, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, error instanceof Error && error.message.includes("changed") ? 409 : 404, "CTA_UPDATE_FAILED", error instanceof Error ? error.message : "CTA update failed.");
  }
});
