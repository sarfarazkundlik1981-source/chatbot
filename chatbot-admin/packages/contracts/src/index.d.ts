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
export declare const healthStatuses: readonly ["healthy", "warning", "critical"];
export type HealthStatus = (typeof healthStatuses)[number];
export declare const clientRoles: readonly ["owner", "admin", "editor", "viewer", "support"];
export type ClientRole = (typeof clientRoles)[number];
export declare const platformRoles: readonly ["platform_owner", "platform_admin"];
export type PlatformRole = (typeof platformRoles)[number];
export declare const licenseStatuses: readonly ["trial", "active", "expired", "suspended", "cancelled"];
export type LicenseStatus = (typeof licenseStatuses)[number];
export declare const knowledgeEntryTypes: readonly ["company", "services", "pricing", "faq", "team", "hours", "locations", "contact", "policies"];
export type KnowledgeEntryType = (typeof knowledgeEntryTypes)[number];
export declare const logTypes: readonly ["API", "ERROR", "AUDIT", "EMAIL", "SECURITY"];
export type LogType = (typeof logTypes)[number];
export declare const pluginCompatibilityStatuses: readonly ["compatible", "update_recommended", "update_required", "unsupported_environment"];
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
