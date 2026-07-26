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
  panelWidth: number;
  panelHeight: number;
  fontSize: number;
  headerBgColor: string;
  widgetBgColor: string;
  composerBgColor: string;
  inputBgColor: string;
  customerBubbleBgColor: string;
  customerTextColor: string;
  assistantBubbleBgColor: string;
  assistantTextColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  footerTextColor: string;
  customCss: string | null;
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
    panel_width: settings.panelWidth,
    panel_height: settings.panelHeight,
    font_size: settings.fontSize,
    header_bg_color: settings.headerBgColor,
    widget_bg_color: settings.widgetBgColor,
    composer_bg_color: settings.composerBgColor,
    input_bg_color: settings.inputBgColor,
    customer_bubble_bg_color: settings.customerBubbleBgColor,
    customer_text_color: settings.customerTextColor,
    assistant_bubble_bg_color: settings.assistantBubbleBgColor,
    assistant_text_color: settings.assistantTextColor,
    button_bg_color: settings.buttonBgColor,
    button_text_color: settings.buttonTextColor,
    footer_text_color: settings.footerTextColor,
    custom_css: settings.customCss,
    version: settings.version,
    updated_at: settings.updatedAt.toISOString()
  };
}

export function serializeWidgetSettings(settings: {
  clientId: string;
  position: string;
  greeting: string;
  headerTitle: string | null;
  headerDescription: string | null;
  footerText: string | null;
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
    header_title: settings.headerTitle,
    header_description: settings.headerDescription,
    footer_text: settings.footerText,
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

export function serializeKnowledgeDocument(document: {
  id: string;
  clientId: string;
  documentKey: string;
  documentState: string;
  processingState: string;
  latestVersion: number;
  processingVersion: number | null;
  publishedVersion: number | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  latest?: {
    title: string;
    content: string;
    tags: unknown;
    version: number;
    createdAt: Date;
  } | null;
  published?: {
    title: string;
    content: string;
    tags: unknown;
    version: number;
    createdAt: Date;
  } | null;
}) {
  return {
    id: document.id,
    client_id: document.clientId,
    document_key: document.documentKey,
    document_state: document.documentState,
    processing_state: document.processingState,
    latest_version: document.latestVersion,
    processing_version: document.processingVersion,
    published_version: document.publishedVersion,
    latest_title: document.latest?.title ?? "",
    latest_content: document.latest?.content ?? "",
    latest_tags: Array.isArray(document.latest?.tags) ? document.latest?.tags : [],
    published_title: document.published?.title ?? null,
    archived: Boolean(document.deletedAt),
    created_at: document.createdAt.toISOString(),
    updated_at: document.updatedAt.toISOString()
  };
}

export function serializeKnowledgeDocumentVersion(version: {
  id: string;
  documentId: string;
  clientId: string;
  version: number;
  title: string;
  content: string;
  tags: unknown;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: version.id,
    document_id: version.documentId,
    client_id: version.clientId,
    version: version.version,
    title: version.title,
    content: version.content,
    tags: Array.isArray(version.tags) ? version.tags : [],
    created_by: version.createdBy,
    created_at: version.createdAt.toISOString()
  };
}

export function serializePluginInstallation(installation: {
  id: string;
  clientId: string;
  label: string | null;
  domain: string;
  status: string;
  pluginVersion: string;
  wordpressVersion: string | null;
  phpVersion: string | null;
  elementorVersion: string | null;
  lastSeen: Date | null;
  lastHeartbeatAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  compatibilityStatus?: string;
}) {
  return {
    id: installation.id,
    client_id: installation.clientId,
    label: installation.label,
    domain: installation.domain,
    status: installation.status,
    plugin_version: installation.pluginVersion,
    wordpress_version: installation.wordpressVersion,
    php_version: installation.phpVersion,
    elementor_version: installation.elementorVersion,
    last_seen: installation.lastSeen?.toISOString() ?? null,
    last_heartbeat_at: installation.lastHeartbeatAt?.toISOString() ?? null,
    revoked_at: installation.revokedAt?.toISOString() ?? null,
    revoke_reason: installation.revokeReason,
    compatibility_status: installation.compatibilityStatus ?? "compatible",
    version: installation.version,
    created_at: installation.createdAt.toISOString(),
    updated_at: installation.updatedAt.toISOString()
  };
}
