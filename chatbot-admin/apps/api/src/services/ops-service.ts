import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { writeAuditLog } from "../lib/audit.js";
import { createConfigVersion } from "./client-service.js";
import { newId } from "../lib/ids.js";

export async function listDomains(clientId: string) {
  return prisma.allowedDomain.findMany({
    where: { clientId, deletedAt: null },
    orderBy: { createdAt: "asc" }
  });
}

export async function addDomain(clientId: string, domain: string, actorId?: string, requestId?: string) {
  const created = await prisma.allowedDomain.create({
    data: { id: newId(), clientId, domain }
  });
  await writeAuditLog({ clientId, actorId, action: "domain.added", target: domain, requestId });
  return created;
}

export async function listLicenses(clientId: string) {
  return prisma.license.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createLicense(clientId: string, status: "trial" | "active" | "expired" | "suspended" | "cancelled", actorId?: string, requestId?: string) {
  const license = await prisma.license.create({
    data: { id: newId(), clientId, status }
  });
  await writeAuditLog({ clientId, actorId, action: "license.created", target: license.id, requestId, metadata: { status } });
  return license;
}

export async function updateLicenseStatus(clientId: string, licenseId: string, status: "trial" | "active" | "expired" | "suspended" | "cancelled", actorId?: string, requestId?: string) {
  const license = await prisma.license.update({
    where: { id: licenseId },
    data: { status }
  });
  await writeAuditLog({ clientId, actorId, action: "license.status_changed", target: licenseId, requestId, metadata: { status } });
  return license;
}

export async function listFeatureFlags(clientId: string) {
  return prisma.featureFlag.findMany({ where: { clientId }, orderBy: { key: "asc" } });
}

export async function upsertFeatureFlag(clientId: string, key: string, enabled: boolean, actorId?: string, requestId?: string) {
  const flag = await prisma.featureFlag.upsert({
    where: { clientId_key: { clientId, key } },
    update: { enabled, version: { increment: 1 } },
    create: { id: newId(), clientId, key, enabled }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "feature_flag.changed", target: key, requestId, metadata: { enabled } });
  return flag;
}

export async function listEntitlements(clientId: string) {
  return prisma.clientEntitlement.findMany({ where: { clientId }, orderBy: { key: "asc" } });
}

export async function upsertEntitlement(clientId: string, key: string, allowed: boolean, actorId?: string, requestId?: string) {
  const entitlement = await prisma.clientEntitlement.upsert({
    where: { clientId_key: { clientId, key } },
    update: { allowed },
    create: { id: newId(), clientId, key, allowed }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "entitlement.changed", target: key, requestId, metadata: { allowed } });
  return entitlement;
}

export async function listCtas(clientId: string) {
  return prisma.ctaConfig.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });
}

export async function createCta(clientId: string, input: { label: string; kind: string; url: string }, actorId?: string, requestId?: string) {
  const cta = await prisma.ctaConfig.create({ data: { id: newId(), clientId, ...input } });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "cta.created", target: cta.id, requestId });
  return cta;
}

export async function updateCta(clientId: string, ctaId: string, input: { label: string; kind: string; url: string; version: number }, actorId?: string, requestId?: string) {
  const current = await prisma.ctaConfig.findFirst({ where: { id: ctaId, clientId } });
  if (!current) {
    throw new AppError(404, "CTA_NOT_FOUND", "CTA configuration was not found.");
  }
  if (current.version !== input.version) {
    throw new AppError(409, "VERSION_CONFLICT", "CTA configuration has changed since you last loaded it.");
  }
  const cta = await prisma.ctaConfig.update({
    where: { id: ctaId },
    data: {
      label: input.label,
      kind: input.kind,
      url: input.url,
      version: { increment: 1 }
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "cta.updated", target: cta.id, requestId });
  return cta;
}
