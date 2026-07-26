import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { getLatestConfigVersion } from "./client-service.js";
import { compareVersions } from "../lib/versioning.js";

export async function getWidgetConfig(clientId: string) {
  const [client, branding, widgetSettings, featureFlags, entitlements, capabilities, ctas, latestRelease, businessHours, outOfHours, callbackConfig, appointmentConfig, serviceAreaConfig, serviceAreaRules, priceListItems, quoteConfig, quoteFields, leadQualification, emergencyDetection, captchaConfig] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.brandingSettings.findUnique({ where: { clientId } }),
    prisma.widgetSettings.findUnique({ where: { clientId } }),
    prisma.featureFlag.findMany({ where: { clientId } }),
    prisma.clientEntitlement.findMany({ where: { clientId } }),
    prisma.platformCapability.findMany({ where: { enabled: true } }),
    prisma.ctaConfig.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    prisma.pluginRelease.findFirst({ orderBy: { releasedAt: "desc" } }),
    prisma.businessHoursConfig.findUnique({ where: { clientId } }),
    prisma.outOfHoursConfig.findUnique({ where: { clientId } }),
    prisma.callbackRequestConfig.findUnique({ where: { clientId } }),
    prisma.appointmentRequestConfig.findUnique({ where: { clientId } }),
    prisma.serviceAreaConfig.findUnique({ where: { clientId } }),
    prisma.serviceAreaRule.findMany({ where: { clientId, deletedAt: null, enabled: true }, orderBy: { label: "asc" } }),
    prisma.priceListItem.findMany({ where: { clientId, deletedAt: null, enabled: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.quoteCalculatorConfig.findUnique({ where: { clientId } }),
    prisma.quoteCalculatorField.findMany({ where: { clientId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.leadQualificationConfig.findUnique({ where: { clientId } }),
    prisma.emergencyDetectionConfig.findUnique({ where: { clientId } }),
    prisma.captchaConfig.findUnique({ where: { clientId } })
  ]);

  const capabilitySet = new Set<string>(capabilities.map((item: { key: string }) => item.key));
  const entitlementMap = new Map<string, boolean>(entitlements.map((item: { key: string; allowed: boolean }) => [item.key, item.allowed]));
  const flagMap = new Map<string, boolean>(featureFlags.map((flag: { key: string; enabled: boolean }) => [flag.key, flag.enabled]));
  const effectiveFeatureKeys = Array.from(new Set<string>([...capabilitySet, ...entitlementMap.keys(), ...flagMap.keys()]));
  const effectiveFeatures = effectiveFeatureKeys.reduce<Record<string, boolean>>((result, key) => {
    result[key] = capabilitySet.has(key) && entitlementMap.get(key) !== false && flagMap.get(key) !== false;
    return result;
  }, {});

  return {
    config_version: await getLatestConfigVersion(clientId),
    cache_ttl_seconds: env.DEFAULT_CONFIG_CACHE_TTL_SECONDS,
    business: {
      name: client?.name ?? ""
    },
    branding: {
      logo_url: branding?.logoUrl,
      avatar_url: branding?.avatarUrl,
      launcher_icon_url: branding?.launcherIconUrl,
      primary_color: branding?.primaryColor ?? "#6D28D9",
      secondary_color: branding?.secondaryColor ?? "#8B5CF6",
      border_radius: branding?.borderRadius ?? 12,
      font: branding?.font ?? "Inter",
      header_style: branding?.headerStyle ?? "dark",
      panel_width: branding?.panelWidth ?? 430,
      panel_height: branding?.panelHeight ?? 560,
      font_size: branding?.fontSize ?? 15,
      header_bg_color: branding?.headerBgColor ?? "#050505",
      widget_bg_color: branding?.widgetBgColor ?? "#f6f7f9",
      composer_bg_color: branding?.composerBgColor ?? "#ffffff",
      input_bg_color: branding?.inputBgColor ?? "#f9fafb",
      customer_bubble_bg_color: branding?.customerBubbleBgColor ?? "#111827",
      customer_text_color: branding?.customerTextColor ?? "#ffffff",
      assistant_bubble_bg_color: branding?.assistantBubbleBgColor ?? "#ffffff",
      assistant_text_color: branding?.assistantTextColor ?? "#1f2937",
      button_bg_color: branding?.buttonBgColor ?? "#8f8f8f",
      button_text_color: branding?.buttonTextColor ?? "#ffffff",
      footer_text_color: branding?.footerTextColor ?? "#99a2b2",
      custom_css: branding?.customCss ?? ""
    },
    widget: {
      position: widgetSettings?.position ?? "bottom-right",
      greeting: widgetSettings?.greeting ?? "Hi, how can I help you today?",
      auto_open: widgetSettings?.autoOpen ?? false,
      auto_open_delay_ms: widgetSettings?.autoOpenDelayMs ?? 0,
      hide_for_logged_in_users: widgetSettings?.hideForLoggedInUsers ?? false
    },
    feature_flags: Object.fromEntries(featureFlags.map((flag: { key: string; enabled: boolean }) => [flag.key, flag.enabled])),
    effective_features: effectiveFeatures,
    ctas: ctas.map((cta: { label: string; url: string; kind: string }) => ({
      label: cta.label,
      url: cta.url,
      kind: cta.kind as "contact" | "whatsapp" | "call" | "booking" | "custom"
    })),
    business_hours: businessHours
      ? {
          enabled: businessHours.enabled,
          timezone: businessHours.timezone,
          schedule: businessHours.schedule,
          notes: businessHours.notes
        }
      : null,
    out_of_hours: outOfHours
      ? {
          enabled: outOfHours.enabled,
          greeting: outOfHours.greeting,
          limited_ctas: outOfHours.limitedCtas,
          form_first_mode: outOfHours.formFirstMode,
          visitor_message: outOfHours.visitorMessage
        }
      : null,
    callback_request: callbackConfig
      ? {
          enabled: callbackConfig.enabled,
          button_label: callbackConfig.buttonLabel,
          helper_text: callbackConfig.helperText,
          success_message: callbackConfig.successMessage,
          required_fields: callbackConfig.requiredFields
        }
      : null,
    appointment_request: appointmentConfig
      ? {
          enabled: appointmentConfig.enabled,
          title: appointmentConfig.title,
          description: appointmentConfig.description,
          required_fields: appointmentConfig.requiredFields,
          success_message: appointmentConfig.successMessage
        }
      : null,
    service_area: serviceAreaConfig
      ? {
          enabled: serviceAreaConfig.enabled,
          mode: serviceAreaConfig.mode,
          input_label: serviceAreaConfig.inputLabel,
          success_message: serviceAreaConfig.successMessage,
          failure_message: serviceAreaConfig.failureMessage,
          rules: serviceAreaRules.map((rule: { id: string; ruleType: string; label: string; value: string }) => ({
            id: rule.id,
            rule_type: rule.ruleType,
            label: rule.label,
            value: rule.value
          }))
        }
      : null,
    price_list: priceListItems.map((item: { id: string; category: string; name: string; description: string | null; price: number | null; currency: string | null }) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      description: item.description,
      price: item.price,
      currency: item.currency
    })),
    quote_calculator: quoteConfig
      ? {
          enabled: quoteConfig.enabled,
          title: quoteConfig.title,
          description: quoteConfig.description,
          success_message: quoteConfig.successMessage,
          base_amount: quoteConfig.baseAmount,
          currency: quoteConfig.currency,
          fields: quoteFields.map((field: { key: string; label: string; fieldType: string; required: boolean; options: unknown; multiplier: number }) => ({
            key: field.key,
            label: field.label,
            field_type: field.fieldType,
            required: field.required,
            options: field.options,
            multiplier: field.multiplier
          }))
        }
      : null,
    lead_qualification: leadQualification
      ? {
          enabled: leadQualification.enabled,
          stages: leadQualification.stages,
          required_fields: leadQualification.requiredFields,
          success_message: leadQualification.successMessage
        }
      : null,
    emergency_detection: emergencyDetection
      ? {
          enabled: emergencyDetection.enabled,
          response_message: emergencyDetection.responseMessage,
          escalate_label: emergencyDetection.escalateLabel
        }
      : null,
    captcha: captchaConfig && captchaConfig.provider !== "disabled"
      ? {
          provider: captchaConfig.provider,
          site_key: captchaConfig.siteKey,
          min_score: captchaConfig.minScore ?? 0.5,
          protected_forms: {
            lead: captchaConfig.protectLead,
            callback: captchaConfig.protectCallback,
            appointment: captchaConfig.protectAppointment,
            quote: captchaConfig.protectQuote,
            chat: captchaConfig.protectChat
          }
        }
      : null,
    compatibility: latestRelease
      ? {
          latest_plugin_version: latestRelease.version,
          update_available: compareVersions(latestRelease.version, env.RECOMMENDED_PLUGIN_VERSION) >= 0
        }
      : null
  };
}
