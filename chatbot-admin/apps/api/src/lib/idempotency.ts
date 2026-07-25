import type { NextFunction, Request, Response } from "express";

import { prisma } from "./prisma.js";
import { hashValue } from "./crypto.js";
import { sendError } from "./api-response.js";

export function requireIdempotency(scope: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey) {
      next();
      return;
    }

    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        scope_keyHash: {
          scope,
          keyHash: hashValue(idempotencyKey)
        }
      }
    });

    if (!existing?.response) {
      res.locals.idempotency = { scope, keyHash: hashValue(idempotencyKey) };
      next();
      return;
    }

    res.status(200).json(existing.response);
  };
}

export async function persistIdempotentResponse(
  scope: string,
  idempotencyKey: string | undefined,
  response: unknown
): Promise<void> {
  if (!idempotencyKey) {
    return;
  }

  await prisma.idempotencyKey.upsert({
    where: {
      scope_keyHash: {
        scope,
        keyHash: hashValue(idempotencyKey)
      }
    },
    update: {
      response: response as object
    },
    create: {
      scope,
      keyHash: hashValue(idempotencyKey),
      response: response as object
    }
  });
}

export function requireIdempotencyHeader(req: Request, res: Response, next: NextFunction): void {
  if (!req.header("Idempotency-Key")) {
    sendError(res, 422, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required for this operation.");
    return;
  }

  next();
}
