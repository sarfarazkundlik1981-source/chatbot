export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: Record<string, unknown>;
  request_id: string;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  request_id: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const healthStatuses = ["healthy", "warning", "critical"] as const;
export type HealthStatus = (typeof healthStatuses)[number];

export const clientRoles = ["owner", "admin", "editor", "viewer", "support"] as const;
export type ClientRole = (typeof clientRoles)[number];

export const platformRoles = ["platform_owner", "platform_admin"] as const;
export type PlatformRole = (typeof platformRoles)[number];

export const licenseStatuses = ["trial", "active", "expired", "suspended", "cancelled"] as const;
export type LicenseStatus = (typeof licenseStatuses)[number];

export const knowledgeEntryTypes = [
  "company",
  "services",
  "pricing",
  "faq",
  "team",
  "hours",
  "locations",
  "contact",
  "policies"
] as const;
export type KnowledgeEntryType = (typeof knowledgeEntryTypes)[number];

export const logTypes = ["API", "ERROR", "AUDIT", "EMAIL", "SECURITY"] as const;
export type LogType = (typeof logTypes)[number];

export const pluginCompatibilityStatuses = [
  "compatible",
  "update_recommended",
  "update_required",
  "unsupported_environment"
] as const;
export type PluginCompatibilityStatus = (typeof pluginCompatibilityStatuses)[number];

export type HealthComponentDto = {
  name: string;
  status: HealthStatus;
  message: string;
  checked_at: string;
};

export type WidgetConfigDto = {
  config_version: number;
  cache_ttl_seconds: number;
  branding: {
    logo_url?: string;
    avatar_url?: string;
    launcher_icon_url?: string;
    primary_color: string;
    secondary_color: string;
    border_radius: number;
    font: string;
    header_style: string;
  };
  widget: {
    position: string;
    greeting: string;
    auto_open: boolean;
    auto_open_delay_ms: number;
    hide_for_logged_in_users: boolean;
  };
  feature_flags: Record<string, boolean>;
  ctas: Array<{
    label: string;
    url: string;
    kind: "contact" | "whatsapp" | "call" | "booking" | "custom";
  }>;
};
