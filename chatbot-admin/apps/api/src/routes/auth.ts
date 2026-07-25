import { Router } from "express";
import { z } from "zod";

import { sendError, sendSuccess } from "../lib/api-response.js";
import { acceptInvite, inviteUser, login, refreshDashboardSession, requestPasswordReset, resetPassword, revokeDashboardSession } from "../services/auth-service.js";
import { requireAuth, requireClientAccess, requireClientRole } from "../middleware/auth.js";
import { requireIdempotencyHeader, persistIdempotentResponse } from "../lib/idempotency.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const refreshSchema = z.object({
  refresh_token: z.string().min(20)
});

const passwordResetRequestSchema = z.object({
  email: z.string().email()
});

const passwordResetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

const inviteAcceptSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "editor", "viewer", "support"])
});

export const authRouter = Router();

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Login payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 401, "INVALID_CREDENTIALS", error instanceof Error ? error.message : "Invalid credentials.");
  }
});

authRouter.post("/auth/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body ?? {});
  if (parsed.success) {
    await revokeDashboardSession(parsed.data.refresh_token);
  }
  return sendSuccess(res, { logged_out: true });
});

authRouter.post("/auth/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Refresh payload is invalid.", { issues: parsed.error.flatten() });
  }

  try {
    const tokens = await refreshDashboardSession(parsed.data.refresh_token);
    return sendSuccess(res, tokens);
  } catch (error) {
    return sendError(res, 401, "INVALID_REFRESH_TOKEN", error instanceof Error ? error.message : "Refresh failed.");
  }
});

authRouter.get("/auth/me", requireAuth("dashboard"), (_req, res) => {
  return sendSuccess(res, {
    user_id: (res.locals.auth as { sub?: string } | undefined)?.sub ?? null,
    platform_role: (res.locals.auth as { platformRole?: string } | undefined)?.platformRole ?? null,
    client_role: (res.locals.auth as { clientRole?: string } | undefined)?.clientRole ?? null,
    client_id: (res.locals.auth as { clientId?: string } | undefined)?.clientId ?? null
  });
});

authRouter.post("/auth/forgot-password", requireIdempotencyHeader, async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Password reset request is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  const result = await requestPasswordReset(parsed.data.email);
  const payload = {
    success: true,
    data: result,
    meta: {},
    request_id: res.locals.requestId as string
  };
  await persistIdempotentResponse("password_reset_request", req.header("Idempotency-Key") ?? undefined, payload);
  return res.status(200).json(payload);
});

authRouter.post("/auth/reset-password", async (req, res) => {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Password reset payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const result = await resetPassword(parsed.data.token, parsed.data.password);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 422, "RESET_TOKEN_INVALID", error instanceof Error ? error.message : "Reset failed.");
  }
});

authRouter.post("/auth/accept-invite", async (req, res) => {
  const parsed = inviteAcceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 422, "VALIDATION_ERROR", "Accept invite payload is invalid.", {
      issues: parsed.error.flatten()
    });
  }

  try {
    const result = await acceptInvite(parsed.data.token, parsed.data.password);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 422, "INVITE_INVALID", error instanceof Error ? error.message : "Invite accept failed.");
  }
});

authRouter.post(
  "/clients/:clientId/invite-user",
  requireAuth("dashboard"),
  requireClientAccess(),
  requireClientRole(["owner", "admin"]),
  requireIdempotencyHeader,
  async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 422, "VALIDATION_ERROR", "Invite payload is invalid.", {
        issues: parsed.error.flatten()
      });
    }

    const result = await inviteUser(
      String(req.params.clientId),
      parsed.data.email,
      parsed.data.role,
      (res.locals.auth as { sub?: string } | undefined)?.sub
    );

    const payload = {
      success: true,
      data: result,
      meta: {},
      request_id: res.locals.requestId as string
    };
    await persistIdempotentResponse("invite_user", req.header("Idempotency-Key") ?? undefined, payload);
    return res.status(201).json(payload);
  }
);
