export function serializeClientSettings(settings: {
  clientId: string;
  timezone: string;
  defaultCountry: string;
  language: string;
  dateFormat: string;
  currency: string;
  version: number;
  updatedAt: Date;
}) {
  return {
    client_id: settings.clientId,
    timezone: settings.timezone,
    default_country: settings.defaultCountry,
    language: settings.language,
    date_format: settings.dateFormat,
    currency: settings.currency,
    version: settings.version,
    updated_at: settings.updatedAt.toISOString()
  };
}

export function serializeBrandingSettings(settings: {
  clientId: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  launcherIconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  borderRadius: number;
  font: string;
  headerStyle: string;
  version: number;
  updatedAt: Date;
}) {
  return {
    client_id: settings.clientId,
    logo_url: settings.logoUrl,
    avatar_url: settings.avatarUrl,
    launcher_icon_url: settings.launcherIconUrl,
    primary_color: settings.primaryColor,
    secondary_color: settings.secondaryColor,
    border_radius: settings.borderRadius,
    font: settings.font,
    header_style: settings.headerStyle,
    version: settings.version,
    updated_at: settings.updatedAt.toISOString()
  };
}

export function serializeWidgetSettings(settings: {
  clientId: string;
  position: string;
  greeting: string;
  autoOpen: boolean;
  autoOpenDelayMs: number;
  hideForLoggedInUsers: boolean;
  version: number;
  updatedAt: Date;
}) {
  return {
    client_id: settings.clientId,
    position: settings.position,
    greeting: settings.greeting,
    auto_open: settings.autoOpen,
    auto_open_delay_ms: settings.autoOpenDelayMs,
    hide_for_logged_in_users: settings.hideForLoggedInUsers,
    version: settings.version,
    updated_at: settings.updatedAt.toISOString()
  };
}

export function serializeInternalSettings(settings: {
  clientId: string;
  fallbackModel: string | null;
  adminNotes: string | null;
  version: number;
  updatedAt: Date;
}) {
  return {
    client_id: settings.clientId,
    fallback_model: settings.fallbackModel,
    admin_notes: settings.adminNotes,
    version: settings.version,
    updated_at: settings.updatedAt.toISOString()
  };
}

export function serializeAiSettings(settings: {
  clientId: string;
  primaryModel: string;
  systemInstructions: string | null;
  version: number;
  updatedAt: Date;
}) {
  return {
    client_id: settings.clientId,
    primary_model: settings.primaryModel,
    system_instructions: settings.systemInstructions,
    version: settings.version,
    updated_at: settings.updatedAt.toISOString()
  };
}

export function serializeKnowledgeEntry(entry: {
  id: string;
  clientId: string;
  type: string;
  title: string;
  content: unknown;
  sortOrder: number;
  enabled: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: entry.id,
    client_id: entry.clientId,
    type: entry.type,
    title: entry.title,
    content: entry.content,
    sort_order: entry.sortOrder,
    enabled: entry.enabled,
    version: entry.version,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString()
  };
}

export function serializePluginInstallation(installation: {
  id: string;
  clientId: string;
  domain: string;
  pluginVersion: string;
  wordpressVersion: string | null;
  phpVersion: string | null;
  elementorVersion: string | null;
  lastSeen: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  compatibilityStatus?: string;
}) {
  return {
    id: installation.id,
    client_id: installation.clientId,
    domain: installation.domain,
    plugin_version: installation.pluginVersion,
    wordpress_version: installation.wordpressVersion,
    php_version: installation.phpVersion,
    elementor_version: installation.elementorVersion,
    last_seen: installation.lastSeen?.toISOString() ?? null,
    compatibility_status: installation.compatibilityStatus ?? "compatible",
    version: installation.version,
    created_at: installation.createdAt.toISOString(),
    updated_at: installation.updatedAt.toISOString()
  };
}
