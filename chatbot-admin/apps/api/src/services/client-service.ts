import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { writeAuditLog } from "../lib/audit.js";
import { encryptValue, generateOpaqueToken, hashValue } from "../lib/crypto.js";
import type { Prisma } from "@prisma/client";
import { evaluateCompatibility } from "../lib/compatibility.js";
import { newId } from "../lib/ids.js";

type SettingsInput = {
  timezone: string;
  default_country: string;
  language: string;
  date_format: string;
  currency: string;
  version?: number;
};

type BrandingInput = {
  logo_url?: string;
  avatar_url?: string;
  launcher_icon_url?: string;
  primary_color: string;
  secondary_color: string;
  border_radius: number;
  font: string;
  header_style: string;
  panel_width: number;
  panel_height: number;
  font_size: number;
  header_bg_color: string;
  widget_bg_color: string;
  composer_bg_color: string;
  input_bg_color: string;
  customer_bubble_bg_color: string;
  customer_text_color: string;
  assistant_bubble_bg_color: string;
  assistant_text_color: string;
  button_bg_color: string;
  button_text_color: string;
  footer_text_color: string;
  custom_css?: string;
  version?: number;
};

type WidgetSettingsInput = {
  position: string;
  greeting: string;
  auto_open: boolean;
  auto_open_delay_ms: number;
  hide_for_logged_in_users: boolean;
  version?: number;
};

type InternalSettingsInput = {
  open_router_api_key?: string;
  fallback_model?: string;
  admin_notes?: string;
  version?: number;
};

type AiSettingsInput = {
  primary_model: string;
  system_instructions?: string;
  version?: number;
};

export async function createConfigVersion(clientId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const [
    settings,
    branding,
    widgetSettings,
    internalSettings,
    aiSettings,
    featureFlags,
    entitlements,
    knowledgeEntries,
    knowledgeDocuments,
    ctas,
    businessHours,
    outOfHours,
    callbackConfig,
    appointmentConfig,
    serviceAreaConfig,
    serviceAreaRules,
    priceListItems,
    quoteConfig,
    quoteFields,
    leadQualification,
    missedAlertConfig,
    emergencyDetection
  ] = await Promise.all([
    tx.clientSettings.findUnique({ where: { clientId } }),
    tx.brandingSettings.findUnique({ where: { clientId } }),
    tx.widgetSettings.findUnique({ where: { clientId } }),
    tx.internalSettings.findUnique({ where: { clientId } }),
    tx.aiSettings.findUnique({ where: { clientId } }),
    tx.featureFlag.findMany({ where: { clientId } }),
    tx.clientEntitlement.findMany({ where: { clientId } }),
    tx.knowledgeEntry.findMany({ where: { clientId, deletedAt: null }, orderBy: { sortOrder: "asc" } }),
    tx.knowledgeDocument.findMany({ where: { clientId, deletedAt: null }, orderBy: { updatedAt: "desc" } }),
    tx.ctaConfig.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    tx.businessHoursConfig.findUnique({ where: { clientId } }),
    tx.outOfHoursConfig.findUnique({ where: { clientId } }),
    tx.callbackRequestConfig.findUnique({ where: { clientId } }),
    tx.appointmentRequestConfig.findUnique({ where: { clientId } }),
    tx.serviceAreaConfig.findUnique({ where: { clientId } }),
    tx.serviceAreaRule.findMany({ where: { clientId, deletedAt: null }, orderBy: { label: "asc" } }),
    tx.priceListItem.findMany({ where: { clientId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    tx.quoteCalculatorConfig.findUnique({ where: { clientId } }),
    tx.quoteCalculatorField.findMany({ where: { clientId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    tx.leadQualificationConfig.findUnique({ where: { clientId } }),
    tx.missedCustomerAlertConfig.findUnique({ where: { clientId } }),
    tx.emergencyDetectionConfig.findUnique({ where: { clientId } })
  ]);

  const latest = await tx.configVersion.findFirst({
    where: { clientId },
    orderBy: { versionNumber: "desc" }
  });

  return tx.configVersion.create({
    data: {
      id: newId(),
      clientId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      snapshot: {
        settings,
        branding,
        widgetSettings,
        internalSettings,
        aiSettings,
        featureFlags,
        entitlements,
        knowledgeEntries,
        knowledgeDocuments,
        ctas,
        businessHours,
        outOfHours,
        callbackConfig,
        appointmentConfig,
        serviceAreaConfig,
        serviceAreaRules,
        priceListItems,
        quoteConfig,
        quoteFields,
        leadQualification,
        missedAlertConfig,
        emergencyDetection
      }
    }
  });
}

export async function getClientSettings(clientId: string) {
  const settings = await prisma.clientSettings.findUnique({ where: { clientId } });
  if (!settings) {
    throw new AppError(404, "SETTINGS_NOT_FOUND", "Client settings were not found.");
  }
  return settings;
}

export async function getBranding(clientId: string) {
  const branding = await prisma.brandingSettings.findUnique({ where: { clientId } });
  if (!branding) {
    throw new AppError(404, "BRANDING_NOT_FOUND", "Branding settings were not found.");
  }
  return branding;
}

export async function getWidgetSettings(clientId: string) {
  const settings = await prisma.widgetSettings.findUnique({ where: { clientId } });
  if (!settings) {
    throw new AppError(404, "WIDGET_SETTINGS_NOT_FOUND", "Widget settings were not found.");
  }
  return settings;
}

export async function getInternalSettings(clientId: string) {
  const settings = await prisma.internalSettings.findUnique({ where: { clientId } });
  if (!settings) {
    throw new AppError(404, "INTERNAL_SETTINGS_NOT_FOUND", "Internal settings were not found.");
  }
  return settings;
}

export async function getAiSettings(clientId: string) {
  const settings = await prisma.aiSettings.findUnique({ where: { clientId } });
  if (!settings) {
    throw new AppError(404, "AI_SETTINGS_NOT_FOUND", "AI settings were not found.");
  }
  return settings;
}

export async function upsertClientSettings(clientId: string, input: SettingsInput, actorId?: string, requestId?: string) {
  const existing = await prisma.clientSettings.findUnique({ where: { clientId } });
  if (existing && input.version !== undefined && input.version !== existing.version) {
    throw new AppError(409, "VERSION_CONFLICT", "Client settings have changed since you last loaded them.");
  }

  const settings = await prisma.clientSettings.upsert({
    where: { clientId },
    update: {
      timezone: input.timezone,
      defaultCountry: input.default_country,
      language: input.language,
      dateFormat: input.date_format,
      currency: input.currency,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      timezone: input.timezone,
      defaultCountry: input.default_country,
      language: input.language,
      dateFormat: input.date_format,
      currency: input.currency
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "client_settings.changed", target: clientId, requestId });
  return settings;
}

export async function upsertBranding(clientId: string, input: BrandingInput, actorId?: string, requestId?: string) {
  const existing = await prisma.brandingSettings.findUnique({ where: { clientId } });
  if (existing && input.version !== undefined && input.version !== existing.version) {
    throw new AppError(409, "VERSION_CONFLICT", "Branding settings have changed since you last loaded them.");
  }

  const branding = await prisma.brandingSettings.upsert({
    where: { clientId },
    update: {
      logoUrl: input.logo_url,
      avatarUrl: input.avatar_url,
      launcherIconUrl: input.launcher_icon_url,
      primaryColor: input.primary_color,
      secondaryColor: input.secondary_color,
      borderRadius: input.border_radius,
      font: input.font,
      headerStyle: input.header_style,
      panelWidth: input.panel_width,
      panelHeight: input.panel_height,
      fontSize: input.font_size,
      headerBgColor: input.header_bg_color,
      widgetBgColor: input.widget_bg_color,
      composerBgColor: input.composer_bg_color,
      inputBgColor: input.input_bg_color,
      customerBubbleBgColor: input.customer_bubble_bg_color,
      customerTextColor: input.customer_text_color,
      assistantBubbleBgColor: input.assistant_bubble_bg_color,
      assistantTextColor: input.assistant_text_color,
      buttonBgColor: input.button_bg_color,
      buttonTextColor: input.button_text_color,
      footerTextColor: input.footer_text_color,
      customCss: input.custom_css,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      logoUrl: input.logo_url,
      avatarUrl: input.avatar_url,
      launcherIconUrl: input.launcher_icon_url,
      primaryColor: input.primary_color,
      secondaryColor: input.secondary_color,
      borderRadius: input.border_radius,
      font: input.font,
      headerStyle: input.header_style,
      panelWidth: input.panel_width,
      panelHeight: input.panel_height,
      fontSize: input.font_size,
      headerBgColor: input.header_bg_color,
      widgetBgColor: input.widget_bg_color,
      composerBgColor: input.composer_bg_color,
      inputBgColor: input.input_bg_color,
      customerBubbleBgColor: input.customer_bubble_bg_color,
      customerTextColor: input.customer_text_color,
      assistantBubbleBgColor: input.assistant_bubble_bg_color,
      assistantTextColor: input.assistant_text_color,
      buttonBgColor: input.button_bg_color,
      buttonTextColor: input.button_text_color,
      footerTextColor: input.footer_text_color,
      customCss: input.custom_css
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "branding.changed", target: clientId, requestId });
  return branding;
}

export async function upsertWidgetSettings(clientId: string, input: WidgetSettingsInput, actorId?: string, requestId?: string) {
  const existing = await prisma.widgetSettings.findUnique({ where: { clientId } });
  if (existing && input.version !== undefined && input.version !== existing.version) {
    throw new AppError(409, "VERSION_CONFLICT", "Widget settings have changed since you last loaded them.");
  }

  const settings = await prisma.widgetSettings.upsert({
    where: { clientId },
    update: {
      position: input.position,
      greeting: input.greeting,
      autoOpen: input.auto_open,
      autoOpenDelayMs: input.auto_open_delay_ms,
      hideForLoggedInUsers: input.hide_for_logged_in_users,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      position: input.position,
      greeting: input.greeting,
      autoOpen: input.auto_open,
      autoOpenDelayMs: input.auto_open_delay_ms,
      hideForLoggedInUsers: input.hide_for_logged_in_users
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "widget_settings.changed", target: clientId, requestId });
  return settings;
}

export async function upsertInternalSettings(clientId: string, input: InternalSettingsInput, actorId?: string, requestId?: string) {
  const existing = await prisma.internalSettings.findUnique({ where: { clientId } });
  if (existing && input.version !== undefined && input.version !== existing.version) {
    throw new AppError(409, "VERSION_CONFLICT", "Internal settings have changed since you last loaded them.");
  }

  const settings = await prisma.internalSettings.upsert({
    where: { clientId },
    update: {
      openRouterApiKey: input.open_router_api_key ? encryptValue(input.open_router_api_key) : existing?.openRouterApiKey,
      fallbackModel: input.fallback_model ?? null,
      adminNotes: input.admin_notes ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      openRouterApiKey: input.open_router_api_key ? encryptValue(input.open_router_api_key) : null,
      fallbackModel: input.fallback_model ?? null,
      adminNotes: input.admin_notes ?? null
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "internal_settings.changed", target: clientId, requestId });
  return settings;
}

export async function upsertAiSettings(clientId: string, input: AiSettingsInput, actorId?: string, requestId?: string) {
  const existing = await prisma.aiSettings.findUnique({ where: { clientId } });
  if (existing && input.version !== undefined && input.version !== existing.version) {
    throw new AppError(409, "VERSION_CONFLICT", "AI settings have changed since you last loaded them.");
  }

  const settings = await prisma.aiSettings.upsert({
    where: { clientId },
    update: {
      primaryModel: input.primary_model,
      systemInstructions: input.system_instructions ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      primaryModel: input.primary_model,
      systemInstructions: input.system_instructions ?? null
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "ai_settings.changed", target: clientId, requestId });
  return settings;
}

export async function listKnowledgeEntries(clientId: string) {
  return prisma.knowledgeEntry.findMany({
    where: { clientId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export async function createKnowledgeEntry(clientId: string, input: {
  type: "company" | "services" | "pricing" | "faq" | "team" | "hours" | "locations" | "contact" | "policies";
  title: string;
  content: object;
  sort_order?: number;
  enabled?: boolean;
}, actorId?: string, requestId?: string) {
  const entry = await prisma.knowledgeEntry.create({
    data: {
      id: newId(),
      clientId,
      type: input.type,
      title: input.title,
      content: input.content,
      sortOrder: input.sort_order ?? 0,
      enabled: input.enabled ?? true
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "knowledge_entry.created", target: entry.id, requestId });
  return entry;
}

export async function updateKnowledgeEntry(clientId: string, entryId: string, input: {
  title: string;
  content: object;
  sort_order: number;
  enabled: boolean;
  version: number;
}, actorId?: string, requestId?: string) {
  const existing = await prisma.knowledgeEntry.findFirst({
    where: { id: entryId, clientId, deletedAt: null }
  });

  if (!existing) {
    throw new AppError(404, "KNOWLEDGE_ENTRY_NOT_FOUND", "Knowledge entry was not found.");
  }

  if (existing.version !== input.version) {
    throw new AppError(409, "VERSION_CONFLICT", "Knowledge entry has changed since you last loaded it.");
  }

  const entry = await prisma.knowledgeEntry.update({
    where: { id: entryId },
    data: {
      title: input.title,
      content: input.content,
      sortOrder: input.sort_order,
      enabled: input.enabled,
      version: { increment: 1 }
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "knowledge_entry.updated", target: entry.id, requestId });
  return entry;
}

export async function softDeleteKnowledgeEntry(clientId: string, entryId: string, deletedBy: string, requestId?: string) {
  await prisma.knowledgeEntry.updateMany({
    where: { id: entryId, clientId, deletedAt: null },
    data: {
      deletedAt: new Date(),
      deletedBy,
      version: { increment: 1 }
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId: deletedBy, action: "knowledge_entry.soft_deleted", target: entryId, requestId });
}

export async function restoreKnowledgeEntry(clientId: string, entryId: string, restoredBy: string, requestId?: string) {
  const result = await prisma.knowledgeEntry.updateMany({
    where: { id: entryId, clientId, deletedAt: { not: null } },
    data: {
      deletedAt: null,
      deletedBy: null,
      version: { increment: 1 }
    }
  });

  if (!result.count) {
    throw new AppError(404, "KNOWLEDGE_ENTRY_NOT_FOUND", "Knowledge entry was not found.");
  }

  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId: restoredBy, action: "knowledge_entry.restored", target: entryId, requestId });
}

export async function listPluginInstallations(clientId: string) {
  const installations = await prisma.pluginInstallation.findMany({
    where: { clientId, deletedAt: null },
    orderBy: { updatedAt: "desc" }
  });

  return installations.map((installation) => ({
    ...installation,
    compatibilityStatus: evaluateCompatibility({
      pluginVersion: installation.pluginVersion,
      wordpressVersion: installation.wordpressVersion ?? undefined,
      phpVersion: installation.phpVersion ?? undefined
    }).status
  }));
}

export async function revokePluginInstallation(clientId: string, installationId: string, revokedBy: string, reason?: string, requestId?: string) {
  const result = await prisma.pluginInstallation.updateMany({
    where: { id: installationId, clientId, deletedAt: null },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedBy,
      revokeReason: reason || null,
      version: { increment: 1 }
    }
  });

  if (!result.count) {
    throw new AppError(404, "PLUGIN_INSTALLATION_NOT_FOUND", "Plugin installation was not found.");
  }

  await writeAuditLog({ clientId, actorId: revokedBy, action: "plugin_installation.revoked", target: installationId, requestId });
}

export async function rotatePluginInstallationSecret(clientId: string, installationId: string, rotatedBy: string, requestId?: string) {
  const installationSecret = generateOpaqueToken(32);
  const installation = await prisma.pluginInstallation.updateMany({
    where: { id: installationId, clientId, deletedAt: null },
    data: {
      status: "active",
      installationSecretHash: hashValue(installationSecret),
      installationSecretIssuedAt: new Date(),
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
      version: { increment: 1 }
    }
  });

  if (!installation.count) {
    throw new AppError(404, "PLUGIN_INSTALLATION_NOT_FOUND", "Plugin installation was not found.");
  }

  await writeAuditLog({ clientId, actorId: rotatedBy, action: "plugin_installation.secret_rotated", target: installationId, requestId });

  return { installation_secret: installationSecret };
}

export async function renamePluginInstallation(clientId: string, installationId: string, label: string, renamedBy: string, requestId?: string) {
  const result = await prisma.pluginInstallation.updateMany({
    where: { id: installationId, clientId, deletedAt: null },
    data: {
      label: label.trim() || null,
      version: { increment: 1 }
    }
  });

  if (!result.count) {
    throw new AppError(404, "PLUGIN_INSTALLATION_NOT_FOUND", "Plugin installation was not found.");
  }

  await writeAuditLog({ clientId, actorId: renamedBy, action: "plugin_installation.renamed", target: installationId, requestId });
}

export async function restorePluginInstallation(clientId: string, installationId: string, restoredBy: string, requestId?: string) {
  const result = await prisma.pluginInstallation.updateMany({
    where: {
      id: installationId,
      clientId,
      OR: [{ deletedAt: { not: null } }, { status: { not: "active" } }]
    },
    data: {
      status: "active",
      deletedAt: null,
      deletedBy: null,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
      version: { increment: 1 }
    }
  });

  if (!result.count) {
    throw new AppError(404, "PLUGIN_INSTALLATION_NOT_FOUND", "Plugin installation was not found.");
  }

  await writeAuditLog({ clientId, actorId: restoredBy, action: "plugin_installation.restored", target: installationId, requestId });
}

export async function getLatestConfigVersion(clientId: string): Promise<number> {
  const latest = await prisma.configVersion.findFirst({
    where: { clientId },
    orderBy: { versionNumber: "desc" }
  });
  return latest?.versionNumber ?? 1;
}

export async function listConfigVersions(clientId: string) {
  return prisma.configVersion.findMany({
    where: { clientId },
    orderBy: { versionNumber: "desc" },
    take: 50
  });
}

export async function getConfigVersion(clientId: string, versionNumber: number) {
  const version = await prisma.configVersion.findFirst({
    where: { clientId, versionNumber }
  });
  if (!version) {
    throw new AppError(404, "CONFIG_VERSION_NOT_FOUND", "Configuration version was not found.");
  }
  return version;
}

export async function rollbackConfigVersion(clientId: string, versionNumber: number, actorId?: string, requestId?: string) {
  const version = await getConfigVersion(clientId, versionNumber);
  const snapshot = version.snapshot as Record<string, any>;
  await prisma.$transaction(async (tx) => {
    if (snapshot.settings) {
      await tx.clientSettings.upsert({
        where: { clientId },
        update: {
          timezone: snapshot.settings.timezone,
          defaultCountry: snapshot.settings.defaultCountry,
          language: snapshot.settings.language,
          dateFormat: snapshot.settings.dateFormat,
          currency: snapshot.settings.currency,
          version: { increment: 1 }
        },
        create: {
          clientId,
          timezone: snapshot.settings.timezone,
          defaultCountry: snapshot.settings.defaultCountry,
          language: snapshot.settings.language,
          dateFormat: snapshot.settings.dateFormat,
          currency: snapshot.settings.currency
        }
      });
    }

    if (snapshot.branding) {
      await tx.brandingSettings.upsert({
        where: { clientId },
        update: {
          logoUrl: snapshot.branding.logoUrl ?? null,
          avatarUrl: snapshot.branding.avatarUrl ?? null,
          launcherIconUrl: snapshot.branding.launcherIconUrl ?? null,
          primaryColor: snapshot.branding.primaryColor,
          secondaryColor: snapshot.branding.secondaryColor,
          borderRadius: snapshot.branding.borderRadius,
          font: snapshot.branding.font,
          headerStyle: snapshot.branding.headerStyle,
          panelWidth: snapshot.branding.panelWidth ?? 430,
          panelHeight: snapshot.branding.panelHeight ?? 560,
          fontSize: snapshot.branding.fontSize ?? 15,
          headerBgColor: snapshot.branding.headerBgColor ?? "#050505",
          widgetBgColor: snapshot.branding.widgetBgColor ?? "#f6f7f9",
          composerBgColor: snapshot.branding.composerBgColor ?? "#ffffff",
          inputBgColor: snapshot.branding.inputBgColor ?? "#f9fafb",
          customerBubbleBgColor: snapshot.branding.customerBubbleBgColor ?? "#111827",
          customerTextColor: snapshot.branding.customerTextColor ?? "#ffffff",
          assistantBubbleBgColor: snapshot.branding.assistantBubbleBgColor ?? "#ffffff",
          assistantTextColor: snapshot.branding.assistantTextColor ?? "#1f2937",
          buttonBgColor: snapshot.branding.buttonBgColor ?? "#8f8f8f",
          buttonTextColor: snapshot.branding.buttonTextColor ?? "#ffffff",
          footerTextColor: snapshot.branding.footerTextColor ?? "#99a2b2",
          customCss: snapshot.branding.customCss ?? null,
          version: { increment: 1 }
        },
        create: {
          clientId,
          logoUrl: snapshot.branding.logoUrl ?? null,
          avatarUrl: snapshot.branding.avatarUrl ?? null,
          launcherIconUrl: snapshot.branding.launcherIconUrl ?? null,
          primaryColor: snapshot.branding.primaryColor,
          secondaryColor: snapshot.branding.secondaryColor,
          borderRadius: snapshot.branding.borderRadius,
          font: snapshot.branding.font,
          headerStyle: snapshot.branding.headerStyle,
          panelWidth: snapshot.branding.panelWidth ?? 430,
          panelHeight: snapshot.branding.panelHeight ?? 560,
          fontSize: snapshot.branding.fontSize ?? 15,
          headerBgColor: snapshot.branding.headerBgColor ?? "#050505",
          widgetBgColor: snapshot.branding.widgetBgColor ?? "#f6f7f9",
          composerBgColor: snapshot.branding.composerBgColor ?? "#ffffff",
          inputBgColor: snapshot.branding.inputBgColor ?? "#f9fafb",
          customerBubbleBgColor: snapshot.branding.customerBubbleBgColor ?? "#111827",
          customerTextColor: snapshot.branding.customerTextColor ?? "#ffffff",
          assistantBubbleBgColor: snapshot.branding.assistantBubbleBgColor ?? "#ffffff",
          assistantTextColor: snapshot.branding.assistantTextColor ?? "#1f2937",
          buttonBgColor: snapshot.branding.buttonBgColor ?? "#8f8f8f",
          buttonTextColor: snapshot.branding.buttonTextColor ?? "#ffffff",
          footerTextColor: snapshot.branding.footerTextColor ?? "#99a2b2",
          customCss: snapshot.branding.customCss ?? null
        }
      });
    }

    if (snapshot.widgetSettings) {
      await tx.widgetSettings.upsert({
        where: { clientId },
        update: {
          position: snapshot.widgetSettings.position,
          greeting: snapshot.widgetSettings.greeting,
          autoOpen: snapshot.widgetSettings.autoOpen,
          autoOpenDelayMs: snapshot.widgetSettings.autoOpenDelayMs,
          hideForLoggedInUsers: snapshot.widgetSettings.hideForLoggedInUsers,
          version: { increment: 1 }
        },
        create: {
          clientId,
          position: snapshot.widgetSettings.position,
          greeting: snapshot.widgetSettings.greeting,
          autoOpen: snapshot.widgetSettings.autoOpen,
          autoOpenDelayMs: snapshot.widgetSettings.autoOpenDelayMs,
          hideForLoggedInUsers: snapshot.widgetSettings.hideForLoggedInUsers
        }
      });
    }

    if (snapshot.internalSettings) {
      await tx.internalSettings.upsert({
        where: { clientId },
        update: {
          openRouterApiKey: snapshot.internalSettings.openRouterApiKey ?? null,
          fallbackModel: snapshot.internalSettings.fallbackModel ?? null,
          adminNotes: snapshot.internalSettings.adminNotes ?? null,
          version: { increment: 1 }
        },
        create: {
          clientId,
          openRouterApiKey: snapshot.internalSettings.openRouterApiKey ?? null,
          fallbackModel: snapshot.internalSettings.fallbackModel ?? null,
          adminNotes: snapshot.internalSettings.adminNotes ?? null
        }
      });
    }

    if (snapshot.aiSettings) {
      await tx.aiSettings.upsert({
        where: { clientId },
        update: {
          primaryModel: snapshot.aiSettings.primaryModel,
          systemInstructions: snapshot.aiSettings.systemInstructions ?? null,
          version: { increment: 1 }
        },
        create: {
          clientId,
          primaryModel: snapshot.aiSettings.primaryModel,
          systemInstructions: snapshot.aiSettings.systemInstructions ?? null
        }
      });
    }

    if (Array.isArray(snapshot.featureFlags)) {
      await tx.featureFlag.deleteMany({ where: { clientId } });
      if (snapshot.featureFlags.length) {
        await tx.featureFlag.createMany({
          data: snapshot.featureFlags.map((flag: Record<string, any>) => ({
            id: newId(),
            clientId,
            key: flag.key,
            enabled: Boolean(flag.enabled),
            version: Number(flag.version ?? 1)
          }))
        });
      }
    }

    if (Array.isArray(snapshot.entitlements)) {
      await tx.clientEntitlement.deleteMany({ where: { clientId } });
      if (snapshot.entitlements.length) {
        await tx.clientEntitlement.createMany({
          data: snapshot.entitlements.map((entitlement: Record<string, any>) => ({
            id: newId(),
            clientId,
            key: entitlement.key,
            allowed: Boolean(entitlement.allowed)
          }))
        });
      }
    }

    if (Array.isArray(snapshot.ctas)) {
      await tx.ctaConfig.deleteMany({ where: { clientId } });
      if (snapshot.ctas.length) {
        await tx.ctaConfig.createMany({
          data: snapshot.ctas.map((cta: Record<string, any>) => ({
            id: newId(),
            clientId,
            label: cta.label,
            kind: cta.kind,
            url: cta.url,
            version: Number(cta.version ?? 1)
          }))
        });
      }
    }

    if (Array.isArray(snapshot.knowledgeEntries)) {
      await tx.knowledgeEntry.deleteMany({ where: { clientId } });
      if (snapshot.knowledgeEntries.length) {
        await tx.knowledgeEntry.createMany({
          data: snapshot.knowledgeEntries.map((entry: Record<string, any>) => ({
            id: newId(),
            clientId,
            type: entry.type,
            title: entry.title,
            content: entry.content,
            sortOrder: Number(entry.sortOrder ?? 0),
            enabled: Boolean(entry.enabled),
            version: Number(entry.version ?? 1),
            deletedAt: null,
            deletedBy: null
          }))
        });
      }
    }

    if (snapshot.businessHours) {
      await tx.businessHoursConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.businessHours.enabled),
          timezone: snapshot.businessHours.timezone ?? null,
          schedule: snapshot.businessHours.schedule,
          notes: snapshot.businessHours.notes ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.businessHours.enabled),
          timezone: snapshot.businessHours.timezone ?? null,
          schedule: snapshot.businessHours.schedule,
          notes: snapshot.businessHours.notes ?? null
        }
      });
    }

    if (snapshot.outOfHours) {
      await tx.outOfHoursConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.outOfHours.enabled),
          greeting: snapshot.outOfHours.greeting ?? null,
          limitedCtas: snapshot.outOfHours.limitedCtas ?? null,
          formFirstMode: Boolean(snapshot.outOfHours.formFirstMode),
          visitorMessage: snapshot.outOfHours.visitorMessage ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.outOfHours.enabled),
          greeting: snapshot.outOfHours.greeting ?? null,
          limitedCtas: snapshot.outOfHours.limitedCtas ?? null,
          formFirstMode: Boolean(snapshot.outOfHours.formFirstMode),
          visitorMessage: snapshot.outOfHours.visitorMessage ?? null
        }
      });
    }

    if (snapshot.callbackConfig) {
      await tx.callbackRequestConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.callbackConfig.enabled),
          buttonLabel: snapshot.callbackConfig.buttonLabel,
          helperText: snapshot.callbackConfig.helperText ?? null,
          successMessage: snapshot.callbackConfig.successMessage ?? null,
          requiredFields: snapshot.callbackConfig.requiredFields ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.callbackConfig.enabled),
          buttonLabel: snapshot.callbackConfig.buttonLabel,
          helperText: snapshot.callbackConfig.helperText ?? null,
          successMessage: snapshot.callbackConfig.successMessage ?? null,
          requiredFields: snapshot.callbackConfig.requiredFields ?? null
        }
      });
    }

    if (snapshot.appointmentConfig) {
      await tx.appointmentRequestConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.appointmentConfig.enabled),
          title: snapshot.appointmentConfig.title,
          description: snapshot.appointmentConfig.description ?? null,
          requiredFields: snapshot.appointmentConfig.requiredFields ?? null,
          successMessage: snapshot.appointmentConfig.successMessage ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.appointmentConfig.enabled),
          title: snapshot.appointmentConfig.title,
          description: snapshot.appointmentConfig.description ?? null,
          requiredFields: snapshot.appointmentConfig.requiredFields ?? null,
          successMessage: snapshot.appointmentConfig.successMessage ?? null
        }
      });
    }

    if (snapshot.serviceAreaConfig) {
      await tx.serviceAreaConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.serviceAreaConfig.enabled),
          mode: snapshot.serviceAreaConfig.mode,
          inputLabel: snapshot.serviceAreaConfig.inputLabel ?? null,
          successMessage: snapshot.serviceAreaConfig.successMessage ?? null,
          failureMessage: snapshot.serviceAreaConfig.failureMessage ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.serviceAreaConfig.enabled),
          mode: snapshot.serviceAreaConfig.mode,
          inputLabel: snapshot.serviceAreaConfig.inputLabel ?? null,
          successMessage: snapshot.serviceAreaConfig.successMessage ?? null,
          failureMessage: snapshot.serviceAreaConfig.failureMessage ?? null
        }
      });
    }

    if (Array.isArray(snapshot.serviceAreaRules)) {
      await tx.serviceAreaRule.deleteMany({ where: { clientId } });
      if (snapshot.serviceAreaRules.length) {
        await tx.serviceAreaRule.createMany({
          data: snapshot.serviceAreaRules.map((rule: Record<string, any>) => ({
            id: newId(),
            clientId,
            ruleType: rule.ruleType,
            label: rule.label,
            value: rule.value,
            enabled: Boolean(rule.enabled),
            version: Number(rule.version ?? 1)
          }))
        });
      }
    }

    if (Array.isArray(snapshot.priceListItems)) {
      await tx.priceListItem.deleteMany({ where: { clientId } });
      if (snapshot.priceListItems.length) {
        await tx.priceListItem.createMany({
          data: snapshot.priceListItems.map((item: Record<string, any>) => ({
            id: newId(),
            clientId,
            category: item.category,
            name: item.name,
            description: item.description ?? null,
            price: item.price ?? null,
            currency: item.currency ?? null,
            enabled: Boolean(item.enabled),
            sortOrder: Number(item.sortOrder ?? 0),
            version: Number(item.version ?? 1)
          }))
        });
      }
    }

    if (snapshot.quoteConfig) {
      await tx.quoteCalculatorConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.quoteConfig.enabled),
          title: snapshot.quoteConfig.title,
          description: snapshot.quoteConfig.description ?? null,
          successMessage: snapshot.quoteConfig.successMessage ?? null,
          baseAmount: Number(snapshot.quoteConfig.baseAmount ?? 0),
          currency: snapshot.quoteConfig.currency ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.quoteConfig.enabled),
          title: snapshot.quoteConfig.title,
          description: snapshot.quoteConfig.description ?? null,
          successMessage: snapshot.quoteConfig.successMessage ?? null,
          baseAmount: Number(snapshot.quoteConfig.baseAmount ?? 0),
          currency: snapshot.quoteConfig.currency ?? null
        }
      });
    }

    if (Array.isArray(snapshot.quoteFields)) {
      await tx.quoteCalculatorField.deleteMany({ where: { clientId } });
      if (snapshot.quoteFields.length) {
        await tx.quoteCalculatorField.createMany({
          data: snapshot.quoteFields.map((field: Record<string, any>) => ({
            id: newId(),
            clientId,
            key: field.key,
            label: field.label,
            fieldType: field.fieldType,
            required: Boolean(field.required),
            options: field.options ?? null,
            multiplier: Number(field.multiplier ?? 1),
            sortOrder: Number(field.sortOrder ?? 0),
            version: Number(field.version ?? 1)
          }))
        });
      }
    }

    if (snapshot.leadQualification) {
      await tx.leadQualificationConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.leadQualification.enabled),
          stages: snapshot.leadQualification.stages,
          requiredFields: snapshot.leadQualification.requiredFields,
          scoringRules: snapshot.leadQualification.scoringRules ?? null,
          successMessage: snapshot.leadQualification.successMessage ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.leadQualification.enabled),
          stages: snapshot.leadQualification.stages,
          requiredFields: snapshot.leadQualification.requiredFields,
          scoringRules: snapshot.leadQualification.scoringRules ?? null,
          successMessage: snapshot.leadQualification.successMessage ?? null
        }
      });
    }

    if (snapshot.missedAlertConfig) {
      await tx.missedCustomerAlertConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.missedAlertConfig.enabled),
          conversationDelayMins: Number(snapshot.missedAlertConfig.conversationDelayMins ?? 30),
          leadDelayMins: Number(snapshot.missedAlertConfig.leadDelayMins ?? 60),
          notifyPlatformEmail: Boolean(snapshot.missedAlertConfig.notifyPlatformEmail),
          notifyWordPressEmail: Boolean(snapshot.missedAlertConfig.notifyWordPressEmail),
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.missedAlertConfig.enabled),
          conversationDelayMins: Number(snapshot.missedAlertConfig.conversationDelayMins ?? 30),
          leadDelayMins: Number(snapshot.missedAlertConfig.leadDelayMins ?? 60),
          notifyPlatformEmail: Boolean(snapshot.missedAlertConfig.notifyPlatformEmail),
          notifyWordPressEmail: Boolean(snapshot.missedAlertConfig.notifyWordPressEmail)
        }
      });
    }

    if (snapshot.emergencyDetection) {
      await tx.emergencyDetectionConfig.upsert({
        where: { clientId },
        update: {
          enabled: Boolean(snapshot.emergencyDetection.enabled),
          keywords: snapshot.emergencyDetection.keywords,
          responseMessage: snapshot.emergencyDetection.responseMessage,
          escalateLabel: snapshot.emergencyDetection.escalateLabel ?? null,
          version: { increment: 1 }
        },
        create: {
          id: newId(),
          clientId,
          enabled: Boolean(snapshot.emergencyDetection.enabled),
          keywords: snapshot.emergencyDetection.keywords,
          responseMessage: snapshot.emergencyDetection.responseMessage,
          escalateLabel: snapshot.emergencyDetection.escalateLabel ?? null
        }
      });
    }

    await createConfigVersion(clientId, tx);
  });

  await writeAuditLog({
    clientId,
    actorId,
    action: "config.rollback",
    target: `${versionNumber}`,
    requestId
  });

  return { rolled_back_to: versionNumber };
}
