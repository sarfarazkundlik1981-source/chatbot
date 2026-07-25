import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { decryptValue, generateOpaqueToken, hashValue } from "../lib/crypto.js";
import { signAccessToken } from "../lib/auth.js";
import { env } from "../config/env.js";
import { getLatestConfigVersion } from "./client-service.js";
import { evaluateCompatibility } from "../lib/compatibility.js";
import { newId } from "../lib/ids.js";

export async function verifyPlugin(input: {
  client_id: string;
  client_secret: string;
  domain: string;
  plugin_version: string;
  wordpress_version?: string;
  php_version?: string;
  elementor_version?: string;
  logo_url?: string;
  config_version?: number;
}) {
  const [credential, license, allowedDomain] = await Promise.all([
    prisma.apiCredential.findFirst({
      where: { clientId: input.client_id, credentialType: "plugin_secret" }
    }),
    prisma.license.findFirst({
      where: { clientId: input.client_id },
      orderBy: { createdAt: "desc" }
    }),
    prisma.allowedDomain.findFirst({
      where: { clientId: input.client_id, domain: input.domain, deletedAt: null }
    })
  ]);

  const compatibility = evaluateCompatibility({
    pluginVersion: input.plugin_version,
    wordpressVersion: input.wordpress_version,
    phpVersion: input.php_version
  });

  if (!credential) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Plugin credentials are invalid.");
  }

  const decryptedSecret = decryptValue(credential.encryptedValue);
  if (decryptedSecret !== input.client_secret) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Plugin credentials are invalid.");
  }

  if (!allowedDomain) {
    throw new AppError(403, "DOMAIN_NOT_ALLOWED", "This domain is not allowed for the client license.");
  }

  if (!license || ["expired", "suspended", "cancelled"].includes(license.status)) {
    throw new AppError(403, "LICENSE_INACTIVE", "The client license is not active.");
  }

  if (compatibility.status === "unsupported_environment") {
    throw new AppError(403, "UNSUPPORTED_ENVIRONMENT", "The connected WordPress environment is not supported.");
  }

  const installation = await prisma.pluginInstallation.upsert({
    where: {
      clientId_domain: {
        clientId: input.client_id,
        domain: input.domain
      }
    },
    update: {
      pluginVersion: input.plugin_version,
      wordpressVersion: input.wordpress_version,
      phpVersion: input.php_version,
      elementorVersion: input.elementor_version,
      lastSeen: new Date(),
      deletedAt: null,
      deletedBy: null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId: input.client_id,
      domain: input.domain,
      pluginVersion: input.plugin_version,
      wordpressVersion: input.wordpress_version,
      phpVersion: input.php_version,
      elementorVersion: input.elementor_version,
      lastSeen: new Date()
    }
  });

  const token = signAccessToken(
    {
      sub: installation.id,
      scope: "plugin",
      clientId: input.client_id,
      domain: input.domain
    },
    `${env.SESSION_TTL_HOURS}h`
  );

  return {
    token,
    config_version: await getLatestConfigVersion(input.client_id),
    cache_ttl_seconds: env.DEFAULT_CONFIG_CACHE_TTL_SECONDS,
    compatibility_status: compatibility.status,
    compatibility_details: compatibility.details
  };
}

export async function recordHeartbeat(input: {
  client_id: string;
  domain: string;
  plugin_version: string;
  wordpress_version?: string;
  php_version?: string;
  elementor_version?: string;
}) {
  const compatibility = evaluateCompatibility({
    pluginVersion: input.plugin_version,
    wordpressVersion: input.wordpress_version,
    phpVersion: input.php_version
  });

  const updated = await prisma.pluginInstallation.updateMany({
    where: {
      clientId: input.client_id,
      domain: input.domain,
      deletedAt: null
    },
    data: {
      pluginVersion: input.plugin_version,
      wordpressVersion: input.wordpress_version,
      phpVersion: input.php_version,
      elementorVersion: input.elementor_version,
      lastSeen: new Date(),
      version: { increment: 1 }
    }
  });

  if (!updated.count) {
    throw new AppError(404, "UNKNOWN_INSTALLATION", "No active plugin installation matches this heartbeat.");
  }

  return compatibility;
}

export async function createPluginSession(clientId: string) {
  const resumeToken = generateOpaqueToken(20);
  const conversation = await prisma.conversation.create({
    data: {
      id: newId(),
      clientId,
      domain: "plugin-session",
      status: "active"
    }
  });

  await prisma.visitorProfile.create({
    data: {
      id: conversation.id,
      clientId,
      resumeTokenHash: hashValue(resumeToken)
    }
  });

  return {
    conversation_id: conversation.id,
    resume_token: resumeToken
  };
}

export async function resumePluginSession(clientId: string, resumeToken: string) {
  const profile = await prisma.visitorProfile.findFirst({
    where: { clientId, resumeTokenHash: hashValue(resumeToken) }
  });

  if (!profile) {
    throw new AppError(404, "RESUME_NOT_FOUND", "No resumable session was found.");
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: profile.id,
      clientId,
      startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });

  if (!conversation) {
    throw new AppError(404, "RESUME_NOT_FOUND", "No resumable session was found.");
  }

  await prisma.$transaction([
    prisma.visitorProfile.updateMany({
      where: { id: profile.id },
      data: {}
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastSeenAt: new Date() }
    })
  ]);

  return {
    resumed: true,
    conversation_id: conversation.id
  };
}
