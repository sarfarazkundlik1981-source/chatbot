import { encryptValue } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../lib/audit.js";
import { hashPassword } from "../lib/crypto.js";
import { env } from "../config/env.js";
import { evaluateCompatibility } from "../lib/compatibility.js";
import { newId } from "../lib/ids.js";

export async function listClients() {
  return prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      licenses: true,
      allowedDomains: { where: { deletedAt: null } }
    }
  });
}

export async function createClient(input: {
  name: string;
  domain: string;
  pluginSecret: string;
  actorId?: string;
  requestId?: string;
}) {
  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        id: newId(),
        name: input.name
      }
    });

    await tx.clientSettings.create({
      data: {
        id: newId(),
        clientId: created.id,
        timezone: "UTC",
        defaultCountry: "US",
        language: "en",
        dateFormat: "YYYY-MM-DD",
        currency: "USD"
      }
    });

    await tx.allowedDomain.create({
      data: {
        id: newId(),
        clientId: created.id,
        domain: input.domain
      }
    });

    await tx.license.create({
      data: {
        id: newId(),
        clientId: created.id,
        status: "trial"
      }
    });

    await tx.apiCredential.create({
      data: {
        id: newId(),
        clientId: created.id,
        credentialType: "plugin_secret",
        encryptedValue: encryptValue(input.pluginSecret),
        keyVersion: "v1"
      }
    });

    return created;
  });

  await writeAuditLog({
    clientId: client.id,
    actorId: input.actorId,
    action: "client.created",
    target: client.id,
    requestId: input.requestId,
    metadata: { domain: input.domain }
  });

  return client;
}

export async function listPlatformUsers() {
  return prisma.platformUser.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true }
  });
}

export async function createPlatformUser(input: {
  email: string;
  password: string;
  role: "platform_owner" | "platform_admin";
  actorId?: string;
  requestId?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const user =
      (await tx.user.findUnique({ where: { email: input.email } })) ??
      (await tx.user.create({
        data: {
          id: newId(),
          email: input.email,
          passwordHash: hashPassword(input.password)
        }
      }));

    return tx.platformUser.upsert({
      where: { userId: user.id },
      update: { role: input.role },
      create: { id: newId(), userId: user.id, role: input.role },
      include: { user: true }
    });
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "platform_user.upserted",
    target: result.id,
    requestId: input.requestId,
    metadata: { email: input.email, role: input.role }
  });

  return result;
}

export async function listPluginReleases() {
  return prisma.pluginRelease.findMany({
    orderBy: { releasedAt: "desc" }
  });
}

export async function createPluginRelease(input: {
  version: string;
  downloadUrl: string;
  releaseNotes?: string;
  actorId?: string;
  requestId?: string;
}) {
  const release = await prisma.pluginRelease.create({
    data: {
      id: newId(),
      version: input.version,
      downloadUrl: input.downloadUrl,
      releaseNotes: input.releaseNotes
    }
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "plugin_release.created",
    target: release.id,
    requestId: input.requestId,
    metadata: { version: input.version }
  });

  return release;
}

export async function getCompatibilityRules() {
  return {
    minimum_supported_plugin_version: env.MINIMUM_SUPPORTED_PLUGIN_VERSION,
    recommended_plugin_version: env.RECOMMENDED_PLUGIN_VERSION,
    minimum_wordpress_version: env.MINIMUM_WORDPRESS_VERSION,
    minimum_php_version: env.MINIMUM_PHP_VERSION
  };
}

export async function getCompatibilitySummary() {
  const [installations, latestRelease] = await Promise.all([
    prisma.pluginInstallation.findMany({ where: { deletedAt: null }, include: { client: true } }),
    prisma.pluginRelease.findFirst({ orderBy: { releasedAt: "desc" } })
  ]);

  return installations.map((installation) => {
    const status = evaluateCompatibility({
      pluginVersion: installation.pluginVersion,
      wordpressVersion: installation.wordpressVersion ?? undefined,
      phpVersion: installation.phpVersion ?? undefined
    }).status;

    return {
      id: installation.id,
      client_id: installation.clientId,
      client_name: installation.client.name,
      domain: installation.domain,
      plugin_version: installation.pluginVersion,
      wordpress_version: installation.wordpressVersion,
      php_version: installation.phpVersion,
      elementor_version: installation.elementorVersion,
      compatibility_status: status,
      latest_release_version: latestRelease?.version ?? null,
      last_seen: installation.lastSeen
    };
  });
}

export async function listSecurityEvents() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.log.findMany({
    where: {
      type: "SECURITY",
      createdAt: { gte: since }
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      client: {
        select: { name: true }
      }
    }
  });
}

export async function getSecurityEventsSummary() {
  const events = await listSecurityEvents();
  const bySource = new Map<string, number>();
  const byTenant = new Map<string, { client_id: string | null; client_name: string; count: number }>();

  for (const event of events) {
    bySource.set(event.source, (bySource.get(event.source) ?? 0) + 1);
    const tenantKey = event.clientId ?? "platform";
    const tenantName = event.client?.name ?? "Platform";
    byTenant.set(tenantKey, {
      client_id: event.clientId ?? null,
      client_name: tenantName,
      count: (byTenant.get(tenantKey)?.count ?? 0) + 1
    });
  }

  return {
    window_hours: 24,
    total_events: events.length,
    event_counts: {
      plugin_verification_failures: events.filter((event) => event.source === "plugin.verify_failed").length,
      captcha_failures: events.filter((event) => event.source === "captcha.verification_failed").length,
      rate_limit_events: events.filter((event) => event.source === "rate_limit.threshold_exceeded").length,
      heartbeat_anomalies: events.filter((event) => event.source.startsWith("plugin.heartbeat")).length
    },
    top_event_sources: Array.from(bySource.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    top_affected_tenants: Array.from(byTenant.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 10)
  };
}
