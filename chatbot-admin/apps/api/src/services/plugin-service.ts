import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { decryptValue, generateOpaqueToken, hashValue } from "../lib/crypto.js";
import { signAccessToken } from "../lib/auth.js";
import { env } from "../config/env.js";
import { getLatestConfigVersion } from "./client-service.js";
import { evaluateCompatibility } from "../lib/compatibility.js";
import { newId } from "../lib/ids.js";

type PluginEnvironmentInput = {
  domain: string;
  plugin_version: string;
  wordpress_version?: string;
  php_version?: string;
  elementor_version?: string;
  logo_url?: string;
  config_version?: number;
};

type ClientPluginInput = PluginEnvironmentInput & {
  client_id: string;
  client_secret: string;
};

type InstallationPluginInput = PluginEnvironmentInput & {
  installation_id: string;
  installation_secret: string;
};

type Compatibility = ReturnType<typeof evaluateCompatibility>;

async function buildPluginResponse(input: {
  clientId: string;
  domain: string;
  installationId: string;
  compatibility: Compatibility;
}) {
  const token = signAccessToken(
    {
      sub: input.installationId,
      scope: "plugin",
      clientId: input.clientId,
      domain: input.domain
    },
    `${env.SESSION_TTL_HOURS}h`
  );

  return {
    token,
    config_version: await getLatestConfigVersion(input.clientId),
    cache_ttl_seconds: env.DEFAULT_CONFIG_CACHE_TTL_SECONDS,
    compatibility_status: input.compatibility.status,
    compatibility_details: input.compatibility.details
  };
}

async function verifyClientPluginInstallation(input: ClientPluginInput) {
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
      status: "active",
      pluginVersion: input.plugin_version,
      wordpressVersion: input.wordpress_version,
      phpVersion: input.php_version,
      elementorVersion: input.elementor_version,
      lastSeen: new Date(),
      deletedAt: null,
      deletedBy: null,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId: input.client_id,
      domain: input.domain,
      status: "active",
      pluginVersion: input.plugin_version,
      wordpressVersion: input.wordpress_version,
      phpVersion: input.php_version,
      elementorVersion: input.elementor_version,
      lastSeen: new Date()
    }
  });

  return {
    clientId: input.client_id,
    installation,
    compatibility
  };
}

export async function verifyPlugin(input: ClientPluginInput) {
  const verification = await verifyClientPluginInstallation(input);
  return buildPluginResponse({
    clientId: verification.clientId,
    domain: input.domain,
    installationId: verification.installation.id,
    compatibility: verification.compatibility
  });
}

export async function verifyInstallationPlugin(input: InstallationPluginInput) {
  const installation = await prisma.pluginInstallation.findFirst({
    where: { id: input.installation_id, deletedAt: null }
  });

  if (!installation || !installation.installationSecretHash || hashValue(input.installation_secret) !== installation.installationSecretHash) {
    throw new AppError(401, "INVALID_INSTALLATION_CREDENTIALS", "Plugin installation credentials are invalid.");
  }

  if (installation.status !== "active") {
    throw new AppError(403, "INSTALLATION_INACTIVE", "Plugin installation is not active.");
  }

  if (installation.domain !== input.domain) {
    throw new AppError(403, "DOMAIN_MISMATCH", "Plugin installation credentials do not match this domain.");
  }

  const [license, allowedDomain] = await Promise.all([
    prisma.license.findFirst({
      where: { clientId: installation.clientId },
      orderBy: { createdAt: "desc" }
    }),
    prisma.allowedDomain.findFirst({
      where: { clientId: installation.clientId, domain: input.domain, deletedAt: null }
    })
  ]);

  const compatibility = evaluateCompatibility({
    pluginVersion: input.plugin_version,
    wordpressVersion: input.wordpress_version,
    phpVersion: input.php_version
  });

  if (!allowedDomain) {
    throw new AppError(403, "DOMAIN_NOT_ALLOWED", "This domain is not allowed for the client license.");
  }

  if (!license || ["expired", "suspended", "cancelled"].includes(license.status)) {
    throw new AppError(403, "LICENSE_INACTIVE", "The client license is not active.");
  }

  if (compatibility.status === "unsupported_environment") {
    throw new AppError(403, "UNSUPPORTED_ENVIRONMENT", "The connected WordPress environment is not supported.");
  }

  const updatedInstallation = await prisma.pluginInstallation.update({
    where: { id: installation.id },
    data: {
      pluginVersion: input.plugin_version,
      wordpressVersion: input.wordpress_version,
      phpVersion: input.php_version,
      elementorVersion: input.elementor_version,
      lastSeen: new Date(),
      version: { increment: 1 }
    }
  });

  return {
    clientId: updatedInstallation.clientId,
    data: await buildPluginResponse({
      clientId: updatedInstallation.clientId,
      domain: input.domain,
      installationId: updatedInstallation.id,
      compatibility
    })
  };
}

export async function activatePlugin(input: PluginEnvironmentInput & {
  activation_code: string;
}) {
  const credentials = await prisma.apiCredential.findMany({
    where: { credentialType: "plugin_secret" },
    select: { clientId: true, encryptedValue: true }
  });

  let clientId = "";
  for (const credential of credentials) {
    try {
      if (decryptValue(credential.encryptedValue) === input.activation_code) {
        clientId = credential.clientId;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!clientId) {
    throw new AppError(401, "INVALID_ACTIVATION_CODE", "Activation code is invalid.");
  }

  const verification = await verifyClientPluginInstallation({
    client_id: clientId,
    client_secret: input.activation_code,
    domain: input.domain,
    plugin_version: input.plugin_version,
    wordpress_version: input.wordpress_version,
    php_version: input.php_version,
    elementor_version: input.elementor_version,
    logo_url: input.logo_url,
    config_version: input.config_version
  });

  const installationSecret = generateOpaqueToken(32);
  const installation = await prisma.pluginInstallation.update({
    where: { id: verification.installation.id },
    data: {
      installationSecretHash: hashValue(installationSecret),
      installationSecretIssuedAt: new Date()
    }
  });

  return {
    clientId,
    data: {
      ...(await buildPluginResponse({
        clientId,
        domain: input.domain,
        installationId: installation.id,
        compatibility: verification.compatibility
      })),
      installation_id: installation.id,
      installation_secret: installationSecret
    }
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
      status: "active",
      deletedAt: null
    },
    data: {
      pluginVersion: input.plugin_version,
      wordpressVersion: input.wordpress_version,
      phpVersion: input.php_version,
      elementorVersion: input.elementor_version,
      lastSeen: new Date(),
      lastHeartbeatAt: new Date(),
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
