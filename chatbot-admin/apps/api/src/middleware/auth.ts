import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../lib/auth.js";
import { sendError } from "../lib/api-response.js";

export function requireAuth(scope: "dashboard" | "plugin") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      sendError(res, 401, "UNAUTHENTICATED", "Missing bearer token.");
      return;
    }

    try {
      const payload = verifyAccessToken(authHeader.replace("Bearer ", ""));
      if (payload.scope !== scope) {
        sendError(res, 403, "FORBIDDEN", "Token scope is not allowed for this route.");
        return;
      }

      res.locals.auth = payload;
      next();
    } catch {
      sendError(res, 401, "INVALID_TOKEN", "Token is invalid or expired.");
    }
  };
}

export function requireClientRole(roles: string[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const auth = res.locals.auth as { clientRole?: string } | undefined;
    if (!auth?.clientRole || !roles.includes(auth.clientRole)) {
      sendError(res, 403, "FORBIDDEN", "You do not have permission to perform this action.");
      return;
    }

    next();
  };
}

export function requirePlatformRole(roles: string[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const auth = res.locals.auth as { platformRole?: string } | undefined;
    if (!auth?.platformRole || !roles.includes(auth.platformRole)) {
      sendError(res, 403, "FORBIDDEN", "You do not have permission to perform this action.");
      return;
    }

    next();
  };
}

export function requireClientAccess() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = res.locals.auth as { clientId?: string; platformRole?: string } | undefined;
    if (auth?.platformRole) {
      next();
      return;
    }

    if (!auth?.clientId || auth.clientId !== req.params.clientId) {
      sendError(res, 403, "FORBIDDEN", "Cross-tenant access is not allowed.");
      return;
    }

    next();
  };
}
