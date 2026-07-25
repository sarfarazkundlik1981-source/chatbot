import type { NextFunction, Request, Response } from "express";

import { sendError } from "../lib/api-response.js";
import { anonymizeIp, writeSecurityLog } from "../lib/audit.js";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitLayer = {
  name: string;
  limit: number;
  windowMs: number;
  key: (req: Request, res: Response) => string | null;
};

const buckets = new Map<string, Bucket>();
const notifiedViolations = new Map<string, number>();

function getOrCreateBucket(key: string, windowMs: number): Bucket {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 0, resetAt: now + windowMs };
    buckets.set(key, next);
    return next;
  }

  return current;
}

function rateLimitHit(res: Response, layer: RateLimitLayer, bucket: Bucket): void {
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
  res.setHeader("Retry-After", String(retryAfterSeconds));
  sendError(res, 429, "RATE_LIMITED", "Too many requests.", {
    scope: layer.name,
    limit: layer.limit,
    window_ms: layer.windowMs,
    retry_after_seconds: retryAfterSeconds
  });
}

function logRateLimitAnomaly(req: Request, res: Response, layer: RateLimitLayer, bucket: Bucket): void {
  const notifyKey = `${layer.name}:${layer.limit}:${bucket.resetAt}:${req.ip}:${(res.locals.auth as { clientId?: string } | undefined)?.clientId ?? "none"}`;
  if (notifiedViolations.get(notifyKey) === bucket.resetAt) {
    return;
  }

  notifiedViolations.set(notifyKey, bucket.resetAt);
  const auth = res.locals.auth as { clientId?: string } | undefined;
  void writeSecurityLog({
    clientId: auth?.clientId,
    requestId: res.locals.requestId as string | undefined,
    source: "rate_limit.threshold_exceeded",
    severity: "warning",
    payload: {
      layer: layer.name,
      route: req.path,
      method: req.method,
      limit: layer.limit,
      window_ms: layer.windowMs,
      ip_hash: anonymizeIp(req.ip),
      client_id: auth?.clientId ?? null
    }
  });
}

export function layeredRateLimit(layers: RateLimitLayer[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const layer of layers) {
      const key = layer.key(req, res);
      if (!key) {
        continue;
      }

      const bucketKey = `${layer.name}:${key}`;
      const bucket = getOrCreateBucket(bucketKey, layer.windowMs);
      if (bucket.count >= layer.limit) {
        logRateLimitAnomaly(req, res, layer, bucket);
        rateLimitHit(res, layer, bucket);
        return;
      }

      bucket.count += 1;
      buckets.set(bucketKey, bucket);
    }

    next();
  };
}

export function rateLimit(limit: number, windowMs: number, keyResolver?: (req: Request) => string) {
  return layeredRateLimit([
    {
      name: "generic",
      limit,
      windowMs,
      key: (req) => (keyResolver ? keyResolver(req) : `${req.ip}:${req.path}`)
    }
  ]);
}

function getWidgetToken(req: Request): string | null {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim() || null;
}

export function protectWidgetPublicEndpoint(routeName: string, config: {
  ipBurst: { limit: number; windowMs: number };
  ipSustained: { limit: number; windowMs: number };
  tenantBurst: { limit: number; windowMs: number };
  tenantSustained: { limit: number; windowMs: number };
  tokenBurst: { limit: number; windowMs: number };
  tokenSustained: { limit: number; windowMs: number };
}) {
  return layeredRateLimit([
    {
      name: `${routeName}:ip_burst`,
      limit: config.ipBurst.limit,
      windowMs: config.ipBurst.windowMs,
      key: (req) => req.ip || "unknown"
    },
    {
      name: `${routeName}:ip_sustained`,
      limit: config.ipSustained.limit,
      windowMs: config.ipSustained.windowMs,
      key: (req) => req.ip || "unknown"
    },
    {
      name: `${routeName}:tenant_burst`,
      limit: config.tenantBurst.limit,
      windowMs: config.tenantBurst.windowMs,
      key: (_req, res) => {
        const auth = res.locals.auth as { clientId?: string } | undefined;
        return auth?.clientId ?? null;
      }
    },
    {
      name: `${routeName}:tenant_sustained`,
      limit: config.tenantSustained.limit,
      windowMs: config.tenantSustained.windowMs,
      key: (_req, res) => {
        const auth = res.locals.auth as { clientId?: string } | undefined;
        return auth?.clientId ?? null;
      }
    },
    {
      name: `${routeName}:token_burst`,
      limit: config.tokenBurst.limit,
      windowMs: config.tokenBurst.windowMs,
      key: (req) => getWidgetToken(req)
    },
    {
      name: `${routeName}:token_sustained`,
      limit: config.tokenSustained.limit,
      windowMs: config.tokenSustained.windowMs,
      key: (req) => getWidgetToken(req)
    }
  ]);
}
