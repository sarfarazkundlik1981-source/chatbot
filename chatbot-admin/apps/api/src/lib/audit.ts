import type { LogType } from "@prisma/client";

import { prisma } from "./prisma.js";
import { newId } from "./ids.js";
import { hashValue } from "./crypto.js";

type AuditInput = {
  clientId?: string;
  actorId?: string;
  action: string;
  target: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeLog(input: {
  clientId?: string;
  type: LogType;
  severity: string;
  source: string;
  requestId?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    return await prisma.log.create({
      data: {
        id: newId(),
        clientId: input.clientId,
        type: input.type,
        severity: input.severity,
        source: input.source,
        requestId: input.requestId,
        payload: (input.payload ?? {}) as object
      }
    });
  } catch {
    return null;
  }
}

export async function writeAuditLog(input: AuditInput) {
  return writeLog({
    clientId: input.clientId,
    type: "AUDIT",
    severity: "info",
    source: input.action,
    requestId: input.requestId,
    payload: {
      actor_id: input.actorId ?? null,
      action: input.action,
      target: input.target,
      metadata: input.metadata ?? {}
    }
  });
}

export function anonymizeIp(ip?: string | null): string | null {
  if (!ip) {
    return null;
  }

  return hashValue(ip.trim().toLowerCase());
}

export async function writeSecurityLog(input: {
  clientId?: string;
  requestId?: string;
  source: string;
  severity?: string;
  payload?: Record<string, unknown>;
}) {
  return writeLog({
    clientId: input.clientId,
    type: "SECURITY",
    severity: input.severity ?? "warning",
    source: input.source,
    requestId: input.requestId,
    payload: input.payload
  });
}
