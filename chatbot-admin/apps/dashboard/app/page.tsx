"use client";

import { useEffect, useState } from "react";
import { clearFieldError, parseJsonInput } from "./feature-form-utils";

type Session = {
  token: string;
  refreshToken?: string;
  clientId: string;
  platformRole?: string | null;
  clientRole?: string | null;
};

type ClientOption = {
  id: string;
  name: string;
};

type Section =
  | "overview"
  | "settings"
  | "knowledge"
  | "features"
  | "domains"
  | "licenses"
  | "ctas"
  | "flags"
  | "plugin"
  | "conversations"
  | "leads"
  | "audit"
  | "health"
  | "playground"
  | "versions"
  | "unanswered"
  | "platform";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
const sections: Section[] = ["overview", "settings", "knowledge", "features", "domains", "licenses", "ctas", "flags", "plugin", "conversations", "leads", "audit", "health", "playground", "versions", "unanswered", "platform"];
const sectionMeta: Record<Section, { label: string; description: string }> = {
  overview: { label: "Overview", description: "Usage, cost, and installation summary for the selected client." },
  settings: { label: "Settings", description: "Branding, widget behavior, AI instructions, and internal keys." },
  knowledge: { label: "Knowledge", description: "Manage structured business information that grounds the assistant." },
  features: { label: "Features", description: "Configure runtime product features, lead flows, and protection layers." },
  domains: { label: "Domains", description: "Allowed website domains connected to this client." },
  licenses: { label: "Licenses", description: "Trial and active license states for the current client." },
  ctas: { label: "CTAs", description: "Call-to-action entries the widget can show to visitors." },
  flags: { label: "Flags", description: "Feature flags and entitlements for this client." },
  plugin: { label: "Plugin", description: "WordPress installation metadata and compatibility details." },
  conversations: { label: "Conversations", description: "Transcript history and export access for visitor sessions." },
  leads: { label: "Leads", description: "Lead capture output and related qualification data." },
  audit: { label: "Audit Log", description: "Operational and configuration changes recorded for this client." },
  health: { label: "Health", description: "Platform subsystem status, scheduler state, and integration health." },
  playground: { label: "AI Playground", description: "Test the assistant with current saved configuration." },
  versions: { label: "Config Versions", description: "Review configuration snapshots and rollback points." },
  unanswered: { label: "Unanswered", description: "Questions the assistant could not resolve from current knowledge." },
  platform: { label: "Platform Admin", description: "Global client management, releases, compatibility, and security events." }
};

const clientOptionalSections = new Set<Section>(["platform", "health"]);

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : payload.error?.message ?? `Request failed: ${response.status}`);
  }

  return payload;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isClientOptionalSection(section: Section) {
  return clientOptionalSections.has(section);
}

function normalizeDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
  }
}

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [playgroundMessage, setPlaygroundMessage] = useState("What services do you provide?");
  const [playgroundReply, setPlaygroundReply] = useState("");
  const [domainDraft, setDomainDraft] = useState({ domain: "" });
  const [licenseDraft, setLicenseDraft] = useState({ status: "trial" });
  const [ctaDraft, setCtaDraft] = useState({ label: "", kind: "contact", url: "" });
  const [flagDraft, setFlagDraft] = useState({ key: "", enabled: true });
  const [entitlementDraft, setEntitlementDraft] = useState({ key: "", allowed: true });
  const [unansweredAnswerDrafts, setUnansweredAnswerDrafts] = useState<Record<string, string>>({});
  const [platformClientDraft, setPlatformClientDraft] = useState({ name: "", domain: "", plugin_secret: "" });
  const [platformUserDraft, setPlatformUserDraft] = useState({ email: "", password: "", role: "platform_admin" });
  const [pluginReleaseDraft, setPluginReleaseDraft] = useState({ version: "", download_url: "", release_notes: "" });
  const [settingsForm, setSettingsForm] = useState({
    timezone: "UTC",
    default_country: "US",
    language: "en",
    date_format: "YYYY-MM-DD",
    currency: "USD",
    version: 1
  });
  const [brandingForm, setBrandingForm] = useState({
    logo_url: "",
    avatar_url: "",
    launcher_icon_url: "",
    primary_color: "#0ea5e9",
    secondary_color: "#111827",
    border_radius: 12,
    font: "Segoe UI",
    header_style: "dark",
    version: 1
  });
  const [widgetForm, setWidgetForm] = useState({
    position: "bottom-right",
    greeting: "Hi, how can I help you today?",
    auto_open: false,
    auto_open_delay_ms: 0,
    hide_for_logged_in_users: false,
    version: 1
  });
  const [aiForm, setAiForm] = useState({
    primary_model: "openai/gpt-4o-mini",
    system_instructions: "",
    version: 1
  });
  const [internalForm, setInternalForm] = useState({
    open_router_api_key: "",
    fallback_model: "",
    admin_notes: "",
    version: 1
  });
  const [knowledgeDraft, setKnowledgeDraft] = useState({
    type: "faq",
    title: "",
    content: "{\n  \"answer\": \"\"\n}",
    sort_order: 0,
    enabled: true
  });
  const [featureForms, setFeatureForms] = useState<Record<string, any>>({
    business_hours: { enabled: false, timezone: "UTC", schedule: "{\n  \"mon\": { \"open\": \"09:00\", \"close\": \"17:00\" }\n}", notes: "", version: 1 },
    out_of_hours: { enabled: false, greeting: "", limited_ctas: "[]", form_first_mode: false, visitor_message: "", version: 1 },
    callback_config: { enabled: false, button_label: "Request a call", helper_text: "", success_message: "", required_fields: "[\"name\",\"phone\"]", version: 1 },
    appointment_config: { enabled: false, title: "Request appointment", description: "", required_fields: "[\"name\",\"email\"]", success_message: "", version: 1 },
    service_area_config: { enabled: false, mode: "allowlist", input_label: "Enter your city or ZIP", success_message: "", failure_message: "", version: 1 },
    service_area_rule: { rule_type: "city", label: "", value: "", enabled: true, version: 1 },
    price_list_item: { category: "general", name: "", description: "", price: 0, currency: "USD", enabled: true, sort_order: 0, version: 1 },
    quote_config: { enabled: false, title: "Instant Quote", description: "", success_message: "", base_amount: 0, currency: "USD", version: 1 },
    quote_field: { key: "", label: "", field_type: "text", required: false, options: "[]", multiplier: 1, sort_order: 0, version: 1 },
    lead_qualification: { enabled: false, stages: "[\"new\",\"qualified\"]", required_fields: "[\"name\",\"email\"]", scoring_rules: "{}", success_message: "", version: 1 },
    missed_alert_config: { enabled: false, conversation_delay_mins: 30, lead_delay_mins: 60, notify_platform_email: true, notify_wordpress_email: false, version: 1 },
    emergency_detection: { enabled: false, keywords: "[\"emergency\",\"urgent\"]", response_message: "If this is an emergency, call emergency services or the business directly immediately.", escalate_label: "Emergency help", version: 1 },
    captcha_config: { provider: "disabled", site_key: "", secret_key: "", protect_lead: false, protect_callback: false, protect_appointment: false, protect_quote: false, protect_chat: false, min_score: 0.5, version: 1, secret_configured: false },
    faq_convert_answer: ""
  });

  useEffect(() => {
    const stored = window.localStorage.getItem("chatbot_dashboard_session");
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored) as Session;
    setSession(parsed);
    setClientId(parsed.clientId);
  }, []);

  useEffect(() => {
    if (!clientId) {
      window.localStorage.removeItem("chatbot_dashboard_client_id");
      return;
    }

    window.localStorage.setItem("chatbot_dashboard_client_id", clientId);
  }, [clientId]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    void loadClientOptions(session.token);
  }, [session?.token]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (!clientId && !isClientOptionalSection(activeSection)) {
      return;
    }

    void loadSection(activeSection);
  }, [activeSection, session, clientId]);

  async function login() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch("/auth/login", "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const nextSession = {
        token: payload.data.access_token as string,
        refreshToken: payload.data.refresh_token as string,
        clientId: (payload.data.user.client_id as string | null) ?? clientId,
        platformRole: (payload.data.user.platform_role as string | null) ?? null,
        clientRole: (payload.data.user.client_role as string | null) ?? null
      };
      setSession(nextSession);
      setClientId(nextSession.clientId);
      if (!nextSession.clientId) {
        setActiveSection("platform");
      }
      window.localStorage.setItem("chatbot_dashboard_session", JSON.stringify(nextSession));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadClientOptions(token: string) {
    try {
      const clientsPayload = await apiFetch("/platform/clients", token);
      const options = ((clientsPayload?.data ?? []) as Array<{ id: string; name: string }>).filter((row) => row.name !== "__platform_internal__");
      setClientOptions(options.map((row) => ({ id: row.id, name: row.name })));

      const storedClientId = window.localStorage.getItem("chatbot_dashboard_client_id") ?? "";
      const preferredClientId = clientId || storedClientId;
      const preferredClient = options.find((row) => row.id === preferredClientId);
      if (preferredClient) {
        setClientId(preferredClient.id);
        return;
      }

      if (!clientId && options.length > 0) {
        setClientId(options[0].id);
      }
    } catch {
      setClientOptions([]);
    }
  }

  async function loadSection(section: Section) {
    if (!session) {
      return;
    }

    if (!clientId && !isClientOptionalSection(section)) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (section === "settings") {
        const [settings, branding, widget, ai, internal] = await Promise.all([
          apiFetch(`/clients/${clientId}/settings`, session.token),
          apiFetch(`/clients/${clientId}/branding`, session.token).catch(() => null),
          apiFetch(`/clients/${clientId}/widget-settings`, session.token).catch(() => null),
          apiFetch(`/clients/${clientId}/ai-settings`, session.token).catch(() => null),
          apiFetch(`/clients/${clientId}/internal-settings`, session.token).catch(() => null)
        ]);

        setData((current) => ({ ...current, settings, branding, widget, ai, internal }));
        if (settings?.data) {
          setSettingsForm(settings.data);
        }
        if (branding?.data) {
          setBrandingForm(branding.data);
        }
        if (widget?.data) {
          setWidgetForm(widget.data);
        }
        if (ai?.data) {
          setAiForm(ai.data);
        }
        if (internal?.data) {
          setInternalForm((current) => ({
            ...current,
            fallback_model: internal.data.fallback_model ?? "",
            admin_notes: internal.data.admin_notes ?? "",
            version: internal.data.version ?? 1
          }));
        }
        return;
      }

      if (section === "features") {
        const features = await apiFetch(`/clients/${clientId}/features`, session.token);
        setData((current) => ({ ...current, features }));
        if (features?.data) {
          setFeatureForms((current) => ({
            ...current,
            business_hours: {
              enabled: features.data.businessHours?.enabled ?? false,
              timezone: features.data.businessHours?.timezone ?? "UTC",
              schedule: JSON.stringify(features.data.businessHours?.schedule ?? { mon: { open: "09:00", close: "17:00" } }, null, 2),
              notes: features.data.businessHours?.notes ?? "",
              version: features.data.businessHours?.version ?? 1
            },
            out_of_hours: {
              enabled: features.data.outOfHours?.enabled ?? false,
              greeting: features.data.outOfHours?.greeting ?? "",
              limited_ctas: JSON.stringify(features.data.outOfHours?.limitedCtas ?? [], null, 2),
              form_first_mode: features.data.outOfHours?.formFirstMode ?? false,
              visitor_message: features.data.outOfHours?.visitorMessage ?? "",
              version: features.data.outOfHours?.version ?? 1
            },
            callback_config: {
              enabled: features.data.callbackConfig?.enabled ?? false,
              button_label: features.data.callbackConfig?.buttonLabel ?? "Request a call",
              helper_text: features.data.callbackConfig?.helperText ?? "",
              success_message: features.data.callbackConfig?.successMessage ?? "",
              required_fields: JSON.stringify(features.data.callbackConfig?.requiredFields ?? ["name", "phone"], null, 2),
              version: features.data.callbackConfig?.version ?? 1
            },
            appointment_config: {
              enabled: features.data.appointmentConfig?.enabled ?? false,
              title: features.data.appointmentConfig?.title ?? "Request appointment",
              description: features.data.appointmentConfig?.description ?? "",
              required_fields: JSON.stringify(features.data.appointmentConfig?.requiredFields ?? ["name", "email"], null, 2),
              success_message: features.data.appointmentConfig?.successMessage ?? "",
              version: features.data.appointmentConfig?.version ?? 1
            },
            service_area_config: {
              enabled: features.data.serviceAreaConfig?.enabled ?? false,
              mode: features.data.serviceAreaConfig?.mode ?? "allowlist",
              input_label: features.data.serviceAreaConfig?.inputLabel ?? "Enter your city or ZIP",
              success_message: features.data.serviceAreaConfig?.successMessage ?? "",
              failure_message: features.data.serviceAreaConfig?.failureMessage ?? "",
              version: features.data.serviceAreaConfig?.version ?? 1
            },
            quote_config: {
              enabled: features.data.quoteConfig?.enabled ?? false,
              title: features.data.quoteConfig?.title ?? "Instant Quote",
              description: features.data.quoteConfig?.description ?? "",
              success_message: features.data.quoteConfig?.successMessage ?? "",
              base_amount: features.data.quoteConfig?.baseAmount ?? 0,
              currency: features.data.quoteConfig?.currency ?? "USD",
              version: features.data.quoteConfig?.version ?? 1
            },
            lead_qualification: {
              enabled: features.data.leadQualification?.enabled ?? false,
              stages: JSON.stringify(features.data.leadQualification?.stages ?? ["new", "qualified"], null, 2),
              required_fields: JSON.stringify(features.data.leadQualification?.requiredFields ?? ["name", "email"], null, 2),
              scoring_rules: JSON.stringify(features.data.leadQualification?.scoringRules ?? {}, null, 2),
              success_message: features.data.leadQualification?.successMessage ?? "",
              version: features.data.leadQualification?.version ?? 1
            },
            missed_alert_config: {
              enabled: features.data.missedAlertConfig?.enabled ?? false,
              conversation_delay_mins: features.data.missedAlertConfig?.conversationDelayMins ?? 30,
              lead_delay_mins: features.data.missedAlertConfig?.leadDelayMins ?? 60,
              notify_platform_email: features.data.missedAlertConfig?.notifyPlatformEmail ?? true,
              notify_wordpress_email: features.data.missedAlertConfig?.notifyWordPressEmail ?? false,
              version: features.data.missedAlertConfig?.version ?? 1
            },
            emergency_detection: {
              enabled: features.data.emergencyDetection?.enabled ?? false,
              keywords: JSON.stringify(features.data.emergencyDetection?.keywords ?? ["emergency", "urgent"], null, 2),
              response_message: features.data.emergencyDetection?.responseMessage ?? "If this is an emergency, call emergency services or the business directly immediately.",
              escalate_label: features.data.emergencyDetection?.escalateLabel ?? "Emergency help",
              version: features.data.emergencyDetection?.version ?? 1
            },
            captcha_config: {
              provider: features.data.captchaConfig?.provider ?? "disabled",
              site_key: features.data.captchaConfig?.siteKey ?? "",
              secret_key: "",
              protect_lead: features.data.captchaConfig?.protectLead ?? false,
              protect_callback: features.data.captchaConfig?.protectCallback ?? false,
              protect_appointment: features.data.captchaConfig?.protectAppointment ?? false,
              protect_quote: features.data.captchaConfig?.protectQuote ?? false,
              protect_chat: features.data.captchaConfig?.protectChat ?? false,
              min_score: features.data.captchaConfig?.minScore ?? 0.5,
              version: features.data.captchaConfig?.version ?? 1,
              secret_configured: features.data.captchaConfig?.secretConfigured ?? false
            }
          }));
        }
        return;
      }

      const mapping: Record<Section, string> = {
        overview: `/clients/${clientId}/analytics`,
        settings: `/clients/${clientId}/settings`,
        knowledge: `/clients/${clientId}/knowledge`,
        features: `/clients/${clientId}/features`,
        domains: `/clients/${clientId}/domains`,
        licenses: `/clients/${clientId}/licenses`,
        ctas: `/clients/${clientId}/ctas`,
        flags: `/clients/${clientId}/feature-flags`,
        plugin: `/clients/${clientId}/plugin-installations`,
        conversations: `/clients/${clientId}/conversations`,
        leads: `/clients/${clientId}/leads`,
        audit: `/clients/${clientId}/audit-logs`,
        health: `/health`,
        playground: `/clients/${clientId}/analytics`,
        versions: `/clients/${clientId}/config-versions`,
        unanswered: `/clients/${clientId}/unanswered-questions`,
        platform: `/platform/clients`
      };

      if (section === "platform") {
        const [clients, users, releases, compatibility, securityEvents, securitySummary] = await Promise.all([
          apiFetch("/platform/clients", session.token),
          apiFetch("/platform/users", session.token).catch(() => null),
          apiFetch("/platform/plugin-releases", session.token).catch(() => null),
          apiFetch("/platform/compatibility-summary", session.token).catch(() => null),
          apiFetch("/platform/security-events", session.token).catch(() => null),
          apiFetch("/platform/security-events-summary", session.token).catch(() => null)
        ]);
        setData((current) => ({ ...current, platform: { clients, users, releases, compatibility, securityEvents, securitySummary } }));
        return;
      }

      const payload = await apiFetch(mapping[section], session.token);
      setData((current) => ({ ...current, [section]: payload }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function save(path: string, body: unknown) {
    if (!session || !clientId) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(path, session.token, { method: "PUT", body: JSON.stringify(body) });
      setNotice("Saved successfully.");
      await loadSection(activeSection);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function createKnowledge() {
    if (!session || !clientId) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const parsedContent = parseJsonInput<Record<string, unknown>>(knowledgeDraft.content, "Knowledge content");
      if (!parsedContent.success) {
        setFormErrors((current) => ({ ...current, knowledge_content: parsedContent.error }));
        return;
      }

      await apiFetch(`/clients/${clientId}/knowledge`, session.token, {
        method: "POST",
        body: JSON.stringify({
          ...knowledgeDraft,
          content: parsedContent.value
        })
      });
      setKnowledgeDraft({
        type: "faq",
        title: "",
        content: "{\n  \"answer\": \"\"\n}",
        sort_order: 0,
        enabled: true
      });
      setFormErrors((current) => clearFieldError(current, "knowledge_content"));
      setNotice("Knowledge entry created.");
      await loadSection("knowledge");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Knowledge create failed");
    } finally {
      setLoading(false);
    }
  }

  async function createPlatformClient() {
    if (!session) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const normalizedDomain = normalizeDomain(platformClientDraft.domain);
      const created = await apiFetch("/platform/clients", session.token, {
        method: "POST",
        body: JSON.stringify({
          ...platformClientDraft,
          domain: normalizedDomain
        })
      });
      setNotice("Platform client created.");
      setPlatformClientDraft({ name: "", domain: "", plugin_secret: "" });
      if (created?.data?.id) {
        setClientId(created.data.id as string);
        setActiveSection("overview");
      }
      await loadClientOptions(session.token);
      await loadSection("platform");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Platform client create failed");
    } finally {
      setLoading(false);
    }
  }

  async function createPlatformUserHandler() {
    if (!session) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("/platform/users", session.token, {
        method: "POST",
        body: JSON.stringify(platformUserDraft)
      });
      setNotice("Platform user created.");
      setPlatformUserDraft({ email: "", password: "", role: "platform_admin" });
      await loadSection("platform");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Platform user create failed");
    } finally {
      setLoading(false);
    }
  }

  async function createPluginReleaseHandler() {
    if (!session) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("/platform/plugin-releases", session.token, {
        method: "POST",
        body: JSON.stringify(pluginReleaseDraft)
      });
      setNotice("Plugin release created.");
      setPluginReleaseDraft({ version: "", download_url: "", release_notes: "" });
      await loadSection("platform");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Plugin release create failed");
    } finally {
      setLoading(false);
    }
  }

  async function rollbackConfigVersion(versionNumber: number) {
    if (!session || !clientId) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/clients/${clientId}/config-versions/${versionNumber}/rollback`, session.token, { method: "POST" });
      setNotice(`Rolled back to version ${versionNumber}.`);
      await loadSection("versions");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Rollback failed");
    } finally {
      setLoading(false);
    }
  }

  async function resolveUnanswered(questionId: string, answer: string) {
    if (!session || !clientId || !answer.trim()) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/clients/${clientId}/unanswered-questions/${questionId}/resolve`, session.token, {
        method: "POST",
        body: JSON.stringify({ answer })
      });
      setNotice("Unanswered question converted into a knowledge entry.");
      setUnansweredAnswerDrafts((current) => ({ ...current, [questionId]: "" }));
      await Promise.all([loadSection("unanswered"), loadSection("knowledge")]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Resolve unanswered failed");
    } finally {
      setLoading(false);
    }
  }

  async function runPlayground() {
    if (!session || !clientId) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch(`/clients/${clientId}/playground`, session.token, {
        method: "POST",
        body: JSON.stringify({ message: playgroundMessage })
      });
      setPlaygroundReply(JSON.stringify(payload.data, null, 2));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Playground failed");
    } finally {
      setLoading(false);
    }
  }

  async function createSimple(path: string, body: unknown, section: Section, successText: string) {
    if (!session || !clientId) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(path, session.token, { method: "POST", body: JSON.stringify(body) });
      setNotice(successText);
      await loadSection(section);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function upsertSimple(path: string, body: unknown, section: Section, successText: string) {
    if (!session || !clientId) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(path, session.token, { method: "PUT", body: JSON.stringify(body) });
      setNotice(successText);
      await loadSection(section);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveFeature(path: string, body: unknown, successText: string) {
    if (!session || !clientId) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(path, session.token, { method: "PUT", body: JSON.stringify(body) });
      setNotice(successText);
      await loadSection("features");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Feature save failed");
    } finally {
      setLoading(false);
    }
  }

  function updateKnowledgeDraft(field: string, value: unknown) {
    setKnowledgeDraft((current) => ({ ...current, [field]: value }));
    if (field === "content") {
      setFormErrors((current) => clearFieldError(current, "knowledge_content"));
    }
  }

  function updateFeatureForm(sectionKey: string, field: string, value: unknown) {
    setFeatureForms((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [field]: value
      }
    }));
    setFormErrors((current) => clearFieldError(current, `${sectionKey}_${field}`));
  }

  async function saveFeatureWithJson(
    path: string,
    sectionKey: string,
    successText: string,
    jsonFields: Array<{ key: string; label: string }>
  ) {
    const form = featureForms[sectionKey];
    const payload = { ...form };
    const nextErrors: Record<string, string> = {};

    for (const field of jsonFields) {
      const parsed = parseJsonInput(payload[field.key], field.label);
      if (!parsed.success) {
        nextErrors[`${sectionKey}_${field.key}`] = parsed.error;
        continue;
      }
      payload[field.key] = parsed.value;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors((current) => ({ ...current, ...nextErrors }));
      return;
    }

    setFormErrors((current) => {
      let next = current;
      for (const field of jsonFields) {
        next = clearFieldError(next, `${sectionKey}_${field.key}`);
      }
      return next;
    });

    await saveFeature(path, payload, successText);
  }

  async function createFeatureWithJson(
    path: string,
    sectionKey: string,
    successText: string,
    jsonFields: Array<{ key: string; label: string }>
  ) {
    const form = featureForms[sectionKey];
    const payload = { ...form };
    const nextErrors: Record<string, string> = {};

    for (const field of jsonFields) {
      const parsed = parseJsonInput(payload[field.key], field.label);
      if (!parsed.success) {
        nextErrors[`${sectionKey}_${field.key}`] = parsed.error;
        continue;
      }
      payload[field.key] = parsed.value;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors((current) => ({ ...current, ...nextErrors }));
      return;
    }

    setFormErrors((current) => {
      let next = current;
      for (const field of jsonFields) {
        next = clearFieldError(next, `${sectionKey}_${field.key}`);
      }
      return next;
    });

    await createFeature(path, payload, successText);
  }

  function renderFieldError(key: string) {
    if (!formErrors[key]) {
      return null;
    }

    return <div className="error-text">{formErrors[key]}</div>;
  }

  async function createFeature(path: string, body: unknown, successText: string) {
    if (!session || !clientId) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(path, session.token, { method: "POST", body: JSON.stringify(body) });
      setNotice(successText);
      await loadSection("features");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Feature create failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeFeature(path: string, successText: string) {
    if (!session || !clientId) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(path, session.token, { method: "DELETE" });
      setNotice(successText);
      await loadSection("features");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Feature delete failed");
    } finally {
      setLoading(false);
    }
  }

  function renderOverview() {
    const overview = data.overview?.data;
    if (!overview) {
      return (
        <div className="empty-state panel">
          <h3>No overview loaded</h3>
          <p className="muted">Select a client and refresh to load analytics, usage, and cost summary data.</p>
        </div>
      );
    }

    const cards = [
      ["Conversations", overview.conversations],
      ["Leads", overview.leads],
      ["Messages", overview.messages],
      ["Plugin Installations", overview.plugin_installations],
      ["Cost Today", overview.estimated_cost_today],
      ["Cost This Week", overview.estimated_cost_week]
    ];

    return (
      <div className="grid cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="panel compact-panel">
            <div className="muted">{label}</div>
            <div className="stat">{String(value)}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="grid">
        <div className="panel">
          <h2>Client Settings</h2>
          <div className="form-grid">
            <input className="field" value={settingsForm.timezone} onChange={(event) => setSettingsForm({ ...settingsForm, timezone: event.target.value })} placeholder="Timezone" />
            <input className="field" value={settingsForm.default_country} onChange={(event) => setSettingsForm({ ...settingsForm, default_country: event.target.value })} placeholder="Default country" />
            <input className="field" value={settingsForm.language} onChange={(event) => setSettingsForm({ ...settingsForm, language: event.target.value })} placeholder="Language" />
            <input className="field" value={settingsForm.date_format} onChange={(event) => setSettingsForm({ ...settingsForm, date_format: event.target.value })} placeholder="Date format" />
            <input className="field" value={settingsForm.currency} onChange={(event) => setSettingsForm({ ...settingsForm, currency: event.target.value })} placeholder="Currency" />
          </div>
          <button className="primary" onClick={() => void save(`/clients/${clientId}/settings`, settingsForm)}>
            Save Client Settings
          </button>
        </div>

        <div className="panel">
          <h2>Branding</h2>
          <div className="form-grid">
            <input className="field" value={brandingForm.logo_url} onChange={(event) => setBrandingForm({ ...brandingForm, logo_url: event.target.value })} placeholder="Logo URL" />
            <input className="field" value={brandingForm.avatar_url} onChange={(event) => setBrandingForm({ ...brandingForm, avatar_url: event.target.value })} placeholder="Avatar URL" />
            <input className="field" value={brandingForm.launcher_icon_url} onChange={(event) => setBrandingForm({ ...brandingForm, launcher_icon_url: event.target.value })} placeholder="Launcher icon URL" />
            <input className="field" value={brandingForm.primary_color} onChange={(event) => setBrandingForm({ ...brandingForm, primary_color: event.target.value })} placeholder="Primary color" />
            <input className="field" value={brandingForm.secondary_color} onChange={(event) => setBrandingForm({ ...brandingForm, secondary_color: event.target.value })} placeholder="Secondary color" />
            <input className="field" type="number" value={brandingForm.border_radius} onChange={(event) => setBrandingForm({ ...brandingForm, border_radius: Number(event.target.value) })} placeholder="Border radius" />
            <input className="field" value={brandingForm.font} onChange={(event) => setBrandingForm({ ...brandingForm, font: event.target.value })} placeholder="Font" />
            <input className="field" value={brandingForm.header_style} onChange={(event) => setBrandingForm({ ...brandingForm, header_style: event.target.value })} placeholder="Header style" />
          </div>
          <button className="primary" onClick={() => void save(`/clients/${clientId}/branding`, brandingForm)}>
            Save Branding
          </button>
        </div>

        <div className="panel">
          <h2>Widget Settings</h2>
          <div className="form-grid">
            <input className="field" value={widgetForm.position} onChange={(event) => setWidgetForm({ ...widgetForm, position: event.target.value })} placeholder="Position" />
            <input className="field" value={widgetForm.greeting} onChange={(event) => setWidgetForm({ ...widgetForm, greeting: event.target.value })} placeholder="Greeting" />
            <input className="field" type="number" value={widgetForm.auto_open_delay_ms} onChange={(event) => setWidgetForm({ ...widgetForm, auto_open_delay_ms: Number(event.target.value) })} placeholder="Auto open delay" />
            <label className="checkbox"><input type="checkbox" checked={widgetForm.auto_open} onChange={(event) => setWidgetForm({ ...widgetForm, auto_open: event.target.checked })} />Auto open</label>
            <label className="checkbox"><input type="checkbox" checked={widgetForm.hide_for_logged_in_users} onChange={(event) => setWidgetForm({ ...widgetForm, hide_for_logged_in_users: event.target.checked })} />Hide for logged-in users</label>
          </div>
          <button className="primary" onClick={() => void save(`/clients/${clientId}/widget-settings`, widgetForm)}>
            Save Widget Settings
          </button>
        </div>

        <div className="panel">
          <h2>AI Settings</h2>
          <div className="form-grid">
            <input className="field" value={aiForm.primary_model} onChange={(event) => setAiForm({ ...aiForm, primary_model: event.target.value })} placeholder="Primary model" />
            <textarea className="field" rows={5} value={aiForm.system_instructions} onChange={(event) => setAiForm({ ...aiForm, system_instructions: event.target.value })} placeholder="System instructions" />
          </div>
          <button className="primary" onClick={() => void save(`/clients/${clientId}/ai-settings`, aiForm)}>
            Save AI Settings
          </button>
        </div>

        <div className="panel">
          <h2>Internal Settings</h2>
          <div className="form-grid">
            <input className="field" type="password" value={internalForm.open_router_api_key} onChange={(event) => setInternalForm({ ...internalForm, open_router_api_key: event.target.value })} placeholder="OpenRouter API key" />
            <input className="field" value={internalForm.fallback_model} onChange={(event) => setInternalForm({ ...internalForm, fallback_model: event.target.value })} placeholder="Fallback model" />
            <textarea className="field" rows={4} value={internalForm.admin_notes} onChange={(event) => setInternalForm({ ...internalForm, admin_notes: event.target.value })} placeholder="Admin notes" />
          </div>
          <button className="primary" onClick={() => void save(`/clients/${clientId}/internal-settings`, internalForm)}>
            Save Internal Settings
          </button>
        </div>
      </div>
    );
  }

  function renderKnowledge() {
    const entries = data.knowledge?.data ?? [];

    return (
      <div className="grid">
        <div className="panel">
          <h2>Create Knowledge Entry</h2>
          <div className="form-grid">
            <input className="field" value={knowledgeDraft.type} onChange={(event) => updateKnowledgeDraft("type", event.target.value)} placeholder="Type" />
            <input className="field" value={knowledgeDraft.title} onChange={(event) => updateKnowledgeDraft("title", event.target.value)} placeholder="Title" />
            <input className="field" type="number" value={knowledgeDraft.sort_order} onChange={(event) => updateKnowledgeDraft("sort_order", Number(event.target.value))} placeholder="Sort order" />
            <label className="checkbox"><input type="checkbox" checked={knowledgeDraft.enabled} onChange={(event) => updateKnowledgeDraft("enabled", event.target.checked)} />Enabled</label>
            <textarea className="field full-width" rows={8} value={knowledgeDraft.content} onChange={(event) => updateKnowledgeDraft("content", event.target.value)} placeholder="JSON content" />
            {renderFieldError("knowledge_content")}
          </div>
          <button className="primary" onClick={() => void createKnowledge()}>
            Create Entry
          </button>
        </div>
        <div className="panel">
          <h2>Knowledge Entries</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Enabled</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any) => (
                  <tr key={entry.id}>
                    <td>{entry.type}</td>
                    <td>{entry.title}</td>
                    <td>{String(entry.enabled)}</td>
                    <td>{entry.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderFeatures() {
    const featureData = data.features?.data ?? {};
    const businessHours = featureForms.business_hours;
    const outOfHours = featureForms.out_of_hours;
    const callbackConfig = featureForms.callback_config;
    const appointmentConfig = featureForms.appointment_config;
    const serviceAreaConfig = featureForms.service_area_config;
    const serviceAreaRule = featureForms.service_area_rule;
    const priceListItem = featureForms.price_list_item;
    const quoteConfig = featureForms.quote_config;
    const quoteField = featureForms.quote_field;
    const leadQualification = featureForms.lead_qualification;
    const missedAlertConfig = featureForms.missed_alert_config;
    const emergencyDetection = featureForms.emergency_detection;
    const captchaConfig = featureForms.captcha_config;

    return (
      <div className="grid">
        <div className="panel">
          <h2>Business Hours</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={businessHours.enabled} onChange={(event) => updateFeatureForm("business_hours", "enabled", event.target.checked)} />Enabled</label>
            <input className="field" value={businessHours.timezone} onChange={(event) => updateFeatureForm("business_hours", "timezone", event.target.value)} placeholder="Timezone" />
            <input className="field full-width" value={businessHours.notes} onChange={(event) => updateFeatureForm("business_hours", "notes", event.target.value)} placeholder="Notes" />
            <textarea className="field full-width" rows={8} value={businessHours.schedule} onChange={(event) => updateFeatureForm("business_hours", "schedule", event.target.value)} placeholder="Schedule JSON" />
            {renderFieldError("business_hours_schedule")}
          </div>
          <button className="primary" onClick={() => void saveFeatureWithJson(`/clients/${clientId}/features/business-hours`, "business_hours", "Business hours saved.", [{ key: "schedule", label: "Business hours schedule" }])}>Save Business Hours</button>
        </div>

        <div className="panel">
          <h2>Out Of Hours</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={outOfHours.enabled} onChange={(event) => updateFeatureForm("out_of_hours", "enabled", event.target.checked)} />Enabled</label>
            <label className="checkbox"><input type="checkbox" checked={outOfHours.form_first_mode} onChange={(event) => updateFeatureForm("out_of_hours", "form_first_mode", event.target.checked)} />Form first mode</label>
            <input className="field" value={outOfHours.greeting} onChange={(event) => updateFeatureForm("out_of_hours", "greeting", event.target.value)} placeholder="Greeting" />
            <input className="field full-width" value={outOfHours.visitor_message} onChange={(event) => updateFeatureForm("out_of_hours", "visitor_message", event.target.value)} placeholder="Visitor message" />
            <textarea className="field full-width" rows={4} value={outOfHours.limited_ctas} onChange={(event) => updateFeatureForm("out_of_hours", "limited_ctas", event.target.value)} placeholder="Limited CTAs JSON" />
            {renderFieldError("out_of_hours_limited_ctas")}
          </div>
          <button className="primary" onClick={() => void saveFeatureWithJson(`/clients/${clientId}/features/out-of-hours`, "out_of_hours", "Out-of-hours saved.", [{ key: "limited_ctas", label: "Out-of-hours CTAs" }])}>Save Out Of Hours</button>
        </div>

        <div className="panel">
          <h2>Call Request</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={callbackConfig.enabled} onChange={(event) => updateFeatureForm("callback_config", "enabled", event.target.checked)} />Enabled</label>
            <input className="field" value={callbackConfig.button_label} onChange={(event) => updateFeatureForm("callback_config", "button_label", event.target.value)} placeholder="Button label" />
            <input className="field" value={callbackConfig.helper_text} onChange={(event) => updateFeatureForm("callback_config", "helper_text", event.target.value)} placeholder="Helper text" />
            <input className="field full-width" value={callbackConfig.success_message} onChange={(event) => updateFeatureForm("callback_config", "success_message", event.target.value)} placeholder="Success message" />
            <textarea className="field full-width" rows={4} value={callbackConfig.required_fields} onChange={(event) => updateFeatureForm("callback_config", "required_fields", event.target.value)} placeholder="Required fields JSON" />
            {renderFieldError("callback_config_required_fields")}
          </div>
          <button className="primary" onClick={() => void saveFeatureWithJson(`/clients/${clientId}/features/callback-config`, "callback_config", "Callback config saved.", [{ key: "required_fields", label: "Callback required fields" }])}>Save Call Request</button>
        </div>

        <div className="panel">
          <h2>Appointment Request</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={appointmentConfig.enabled} onChange={(event) => updateFeatureForm("appointment_config", "enabled", event.target.checked)} />Enabled</label>
            <input className="field" value={appointmentConfig.title} onChange={(event) => updateFeatureForm("appointment_config", "title", event.target.value)} placeholder="Title" />
            <input className="field full-width" value={appointmentConfig.description} onChange={(event) => updateFeatureForm("appointment_config", "description", event.target.value)} placeholder="Description" />
            <input className="field full-width" value={appointmentConfig.success_message} onChange={(event) => updateFeatureForm("appointment_config", "success_message", event.target.value)} placeholder="Success message" />
            <textarea className="field full-width" rows={4} value={appointmentConfig.required_fields} onChange={(event) => updateFeatureForm("appointment_config", "required_fields", event.target.value)} placeholder="Required fields JSON" />
            {renderFieldError("appointment_config_required_fields")}
          </div>
          <button className="primary" onClick={() => void saveFeatureWithJson(`/clients/${clientId}/features/appointment-config`, "appointment_config", "Appointment config saved.", [{ key: "required_fields", label: "Appointment required fields" }])}>Save Appointment Request</button>
        </div>

        <div className="panel">
          <h2>Service Area</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={serviceAreaConfig.enabled} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_config: { ...current.service_area_config, enabled: event.target.checked } }))} />Enabled</label>
            <input className="field" value={serviceAreaConfig.mode} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_config: { ...current.service_area_config, mode: event.target.value } }))} placeholder="allowlist" />
            <input className="field" value={serviceAreaConfig.input_label} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_config: { ...current.service_area_config, input_label: event.target.value } }))} placeholder="Input label" />
            <input className="field full-width" value={serviceAreaConfig.success_message} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_config: { ...current.service_area_config, success_message: event.target.value } }))} placeholder="Success message" />
            <input className="field full-width" value={serviceAreaConfig.failure_message} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_config: { ...current.service_area_config, failure_message: event.target.value } }))} placeholder="Failure message" />
          </div>
          <button className="primary" onClick={() => void saveFeature(`/clients/${clientId}/features/service-area-config`, serviceAreaConfig, "Service area config saved.")}>Save Service Area Config</button>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <input className="field" value={serviceAreaRule.rule_type} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_rule: { ...current.service_area_rule, rule_type: event.target.value } }))} placeholder="Rule type" />
            <input className="field" value={serviceAreaRule.label} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_rule: { ...current.service_area_rule, label: event.target.value } }))} placeholder="Label" />
            <input className="field" value={serviceAreaRule.value} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_rule: { ...current.service_area_rule, value: event.target.value } }))} placeholder="Value" />
            <label className="checkbox"><input type="checkbox" checked={serviceAreaRule.enabled} onChange={(event) => setFeatureForms((current) => ({ ...current, service_area_rule: { ...current.service_area_rule, enabled: event.target.checked } }))} />Enabled</label>
          </div>
          <button className="secondary" onClick={() => void createFeature(`/clients/${clientId}/features/service-area-rules`, serviceAreaRule, "Service area rule added.")}>Add Service Area Rule</button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Label</th>
                  <th>Value</th>
                  <th>Enabled</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(featureData.serviceAreaRules ?? []).map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.ruleType}</td>
                    <td>{row.label}</td>
                    <td>{row.value}</td>
                    <td>{String(row.enabled)}</td>
                    <td>
                      <button className="secondary" onClick={() => void removeFeature(`/clients/${clientId}/features/service-area-rules/${row.id}`, "Service area rule deleted.")}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Price List Manager</h2>
          <div className="form-grid">
            <input className="field" value={priceListItem.category} onChange={(event) => setFeatureForms((current) => ({ ...current, price_list_item: { ...current.price_list_item, category: event.target.value } }))} placeholder="Category" />
            <input className="field" value={priceListItem.name} onChange={(event) => setFeatureForms((current) => ({ ...current, price_list_item: { ...current.price_list_item, name: event.target.value } }))} placeholder="Name" />
            <input className="field full-width" value={priceListItem.description} onChange={(event) => setFeatureForms((current) => ({ ...current, price_list_item: { ...current.price_list_item, description: event.target.value } }))} placeholder="Description" />
            <input className="field" type="number" value={priceListItem.price} onChange={(event) => setFeatureForms((current) => ({ ...current, price_list_item: { ...current.price_list_item, price: Number(event.target.value) } }))} placeholder="Price" />
            <input className="field" value={priceListItem.currency} onChange={(event) => setFeatureForms((current) => ({ ...current, price_list_item: { ...current.price_list_item, currency: event.target.value } }))} placeholder="Currency" />
            <input className="field" type="number" value={priceListItem.sort_order} onChange={(event) => setFeatureForms((current) => ({ ...current, price_list_item: { ...current.price_list_item, sort_order: Number(event.target.value) } }))} placeholder="Sort order" />
            <label className="checkbox"><input type="checkbox" checked={priceListItem.enabled} onChange={(event) => setFeatureForms((current) => ({ ...current, price_list_item: { ...current.price_list_item, enabled: event.target.checked } }))} />Enabled</label>
          </div>
          <button className="secondary" onClick={() => void createFeature(`/clients/${clientId}/features/price-list-items`, priceListItem, "Price item added.")}>Add Price Item</button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Enabled</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(featureData.priceListItems ?? []).map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.category}</td>
                    <td>{row.name}</td>
                    <td>{row.price ?? "-"} {row.currency ?? ""}</td>
                    <td>{String(row.enabled)}</td>
                    <td>
                      <button className="secondary" onClick={() => void removeFeature(`/clients/${clientId}/features/price-list-items/${row.id}`, "Price item deleted.")}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Instant Quote Calculator</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={quoteConfig.enabled} onChange={(event) => setFeatureForms((current) => ({ ...current, quote_config: { ...current.quote_config, enabled: event.target.checked } }))} />Enabled</label>
            <input className="field" value={quoteConfig.title} onChange={(event) => setFeatureForms((current) => ({ ...current, quote_config: { ...current.quote_config, title: event.target.value } }))} placeholder="Title" />
            <input className="field" type="number" value={quoteConfig.base_amount} onChange={(event) => setFeatureForms((current) => ({ ...current, quote_config: { ...current.quote_config, base_amount: Number(event.target.value) } }))} placeholder="Base amount" />
            <input className="field" value={quoteConfig.currency} onChange={(event) => setFeatureForms((current) => ({ ...current, quote_config: { ...current.quote_config, currency: event.target.value } }))} placeholder="Currency" />
            <input className="field full-width" value={quoteConfig.description} onChange={(event) => setFeatureForms((current) => ({ ...current, quote_config: { ...current.quote_config, description: event.target.value } }))} placeholder="Description" />
            <input className="field full-width" value={quoteConfig.success_message} onChange={(event) => setFeatureForms((current) => ({ ...current, quote_config: { ...current.quote_config, success_message: event.target.value } }))} placeholder="Success message" />
          </div>
          <button className="primary" onClick={() => void saveFeature(`/clients/${clientId}/features/quote-config`, quoteConfig, "Quote config saved.")}>Save Quote Config</button>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <input className="field" value={quoteField.key} onChange={(event) => updateFeatureForm("quote_field", "key", event.target.value)} placeholder="Key" />
            <input className="field" value={quoteField.label} onChange={(event) => updateFeatureForm("quote_field", "label", event.target.value)} placeholder="Label" />
            <input className="field" value={quoteField.field_type} onChange={(event) => updateFeatureForm("quote_field", "field_type", event.target.value)} placeholder="Field type" />
            <input className="field" type="number" value={quoteField.multiplier} onChange={(event) => updateFeatureForm("quote_field", "multiplier", Number(event.target.value))} placeholder="Multiplier" />
            <input className="field" type="number" value={quoteField.sort_order} onChange={(event) => updateFeatureForm("quote_field", "sort_order", Number(event.target.value))} placeholder="Sort order" />
            <label className="checkbox"><input type="checkbox" checked={quoteField.required} onChange={(event) => updateFeatureForm("quote_field", "required", event.target.checked)} />Required</label>
            <textarea className="field full-width" rows={3} value={quoteField.options} onChange={(event) => updateFeatureForm("quote_field", "options", event.target.value)} placeholder="Options JSON" />
            {renderFieldError("quote_field_options")}
          </div>
          <button className="secondary" onClick={() => void createFeatureWithJson(`/clients/${clientId}/features/quote-fields`, "quote_field", "Quote field added.", [{ key: "options", label: "Quote field options" }])}>Add Quote Field</button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Multiplier</th>
                  <th>Required</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(featureData.quoteFields ?? []).map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.key}</td>
                    <td>{row.label}</td>
                    <td>{row.fieldType}</td>
                    <td>{row.multiplier}</td>
                    <td>{String(row.required)}</td>
                    <td>
                      <button className="secondary" onClick={() => void removeFeature(`/clients/${clientId}/features/quote-fields/${row.id}`, "Quote field deleted.")}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Lead Qualification</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={leadQualification.enabled} onChange={(event) => updateFeatureForm("lead_qualification", "enabled", event.target.checked)} />Enabled</label>
            <input className="field full-width" value={leadQualification.success_message} onChange={(event) => updateFeatureForm("lead_qualification", "success_message", event.target.value)} placeholder="Success message" />
            <textarea className="field full-width" rows={4} value={leadQualification.stages} onChange={(event) => updateFeatureForm("lead_qualification", "stages", event.target.value)} placeholder="Stages JSON" />
            {renderFieldError("lead_qualification_stages")}
            <textarea className="field full-width" rows={4} value={leadQualification.required_fields} onChange={(event) => updateFeatureForm("lead_qualification", "required_fields", event.target.value)} placeholder="Required fields JSON" />
            {renderFieldError("lead_qualification_required_fields")}
            <textarea className="field full-width" rows={4} value={leadQualification.scoring_rules} onChange={(event) => updateFeatureForm("lead_qualification", "scoring_rules", event.target.value)} placeholder="Scoring rules JSON" />
            {renderFieldError("lead_qualification_scoring_rules")}
          </div>
          <button className="primary" onClick={() => void saveFeatureWithJson(`/clients/${clientId}/features/lead-qualification`, "lead_qualification", "Lead qualification saved.", [
            { key: "stages", label: "Lead qualification stages" },
            { key: "required_fields", label: "Lead qualification required fields" },
            { key: "scoring_rules", label: "Lead qualification scoring rules" }
          ])}>Save Lead Qualification</button>
        </div>

        <div className="panel">
          <h2>Missed Customer Alert</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={missedAlertConfig.enabled} onChange={(event) => setFeatureForms((current) => ({ ...current, missed_alert_config: { ...current.missed_alert_config, enabled: event.target.checked } }))} />Enabled</label>
            <input className="field" type="number" value={missedAlertConfig.conversation_delay_mins} onChange={(event) => setFeatureForms((current) => ({ ...current, missed_alert_config: { ...current.missed_alert_config, conversation_delay_mins: Number(event.target.value) } }))} placeholder="Conversation delay" />
            <input className="field" type="number" value={missedAlertConfig.lead_delay_mins} onChange={(event) => setFeatureForms((current) => ({ ...current, missed_alert_config: { ...current.missed_alert_config, lead_delay_mins: Number(event.target.value) } }))} placeholder="Lead delay" />
            <label className="checkbox"><input type="checkbox" checked={missedAlertConfig.notify_platform_email} onChange={(event) => setFeatureForms((current) => ({ ...current, missed_alert_config: { ...current.missed_alert_config, notify_platform_email: event.target.checked } }))} />Platform email</label>
            <label className="checkbox"><input type="checkbox" checked={missedAlertConfig.notify_wordpress_email} onChange={(event) => setFeatureForms((current) => ({ ...current, missed_alert_config: { ...current.missed_alert_config, notify_wordpress_email: event.target.checked } }))} />WordPress email</label>
          </div>
          <button className="primary" onClick={() => void saveFeature(`/clients/${clientId}/features/missed-alert-config`, missedAlertConfig, "Missed alert config saved.")}>Save Missed Alert Config</button>
          <pre className="output">{JSON.stringify(featureData.missedAlerts ?? [], null, 2)}</pre>
        </div>

        <div className="panel">
          <h2>Emergency Detection</h2>
          <div className="form-grid">
            <label className="checkbox"><input type="checkbox" checked={emergencyDetection.enabled} onChange={(event) => updateFeatureForm("emergency_detection", "enabled", event.target.checked)} />Enabled</label>
            <input className="field full-width" value={emergencyDetection.response_message} onChange={(event) => updateFeatureForm("emergency_detection", "response_message", event.target.value)} placeholder="Response message" />
            <input className="field" value={emergencyDetection.escalate_label} onChange={(event) => updateFeatureForm("emergency_detection", "escalate_label", event.target.value)} placeholder="Escalate label" />
            <textarea className="field full-width" rows={4} value={emergencyDetection.keywords} onChange={(event) => updateFeatureForm("emergency_detection", "keywords", event.target.value)} placeholder="Keywords JSON" />
            {renderFieldError("emergency_detection_keywords")}
          </div>
          <button className="primary" onClick={() => void saveFeatureWithJson(`/clients/${clientId}/features/emergency-detection`, "emergency_detection", "Emergency detection saved.", [{ key: "keywords", label: "Emergency keywords" }])}>Save Emergency Detection</button>
        </div>

        <div className="panel">
          <h2>CAPTCHA Protection</h2>
          <p className="muted">Protect public forms with per-tenant verification. Disabled keeps the widget friction-free by default.</p>
          <div className="form-grid">
            <select className="field" value={captchaConfig.provider} onChange={(event) => updateFeatureForm("captcha_config", "provider", event.target.value)}>
              <option value="disabled">Disabled</option>
              <option value="turnstile">Cloudflare Turnstile</option>
              <option value="recaptcha_v3">Google reCAPTCHA v3</option>
            </select>
            <input className="field" value={captchaConfig.site_key} onChange={(event) => updateFeatureForm("captcha_config", "site_key", event.target.value)} placeholder="Site key" />
            <input className="field full-width" type="password" value={captchaConfig.secret_key} onChange={(event) => updateFeatureForm("captcha_config", "secret_key", event.target.value)} placeholder={captchaConfig.secret_configured ? "Secret configured. Enter a new value only to rotate it." : "Secret key"} />
            <input className="field" type="number" min="0" max="1" step="0.1" value={captchaConfig.min_score} onChange={(event) => updateFeatureForm("captcha_config", "min_score", Number(event.target.value))} placeholder="Minimum score" />
            <label className="checkbox"><input type="checkbox" checked={captchaConfig.protect_lead} onChange={(event) => updateFeatureForm("captcha_config", "protect_lead", event.target.checked)} />Lead forms</label>
            <label className="checkbox"><input type="checkbox" checked={captchaConfig.protect_callback} onChange={(event) => updateFeatureForm("captcha_config", "protect_callback", event.target.checked)} />Callback requests</label>
            <label className="checkbox"><input type="checkbox" checked={captchaConfig.protect_appointment} onChange={(event) => updateFeatureForm("captcha_config", "protect_appointment", event.target.checked)} />Appointment requests</label>
            <label className="checkbox"><input type="checkbox" checked={captchaConfig.protect_quote} onChange={(event) => updateFeatureForm("captcha_config", "protect_quote", event.target.checked)} />Quote requests</label>
            <label className="checkbox"><input type="checkbox" checked={captchaConfig.protect_chat} onChange={(event) => updateFeatureForm("captcha_config", "protect_chat", event.target.checked)} />Normal chat</label>
          </div>
          <button className="primary" onClick={() => void saveFeature(`/clients/${clientId}/features/captcha-config`, captchaConfig, "CAPTCHA protection saved.")}>Save CAPTCHA Protection</button>
        </div>

        <div className="panel">
          <h2>FAQ Suggestions</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(featureData.faqSuggestions ?? []).map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.normalizedQuestion}</td>
                    <td>{row.frequency}</td>
                    <td>{row.status}</td>
                    <td>
                      <textarea className="field" rows={2} value={featureForms[`faq_${row.id}`] ?? ""} onChange={(event) => setFeatureForms((current) => ({ ...current, [`faq_${row.id}`]: event.target.value }))} placeholder="Answer" />
                      <button className="secondary" onClick={() => void createFeature(`/clients/${clientId}/features/faq-suggestions/${row.id}/convert`, { answer: featureForms[`faq_${row.id}`] ?? "" }, "FAQ suggestion converted.")}>Convert</button>
                      <button className="secondary" onClick={() => void createFeature(`/clients/${clientId}/features/faq-suggestions/${row.id}/ignore`, {}, "FAQ suggestion ignored.")}>Ignore</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Feature Activity</h2>
          <div className="grid cols-3">
            <div className="compact-panel panel">
              <div className="muted">Callback Requests</div>
              <div className="stat">{(featureData.callbackRequests ?? []).length}</div>
            </div>
            <div className="compact-panel panel">
              <div className="muted">Appointments</div>
              <div className="stat">{(featureData.appointmentRequests ?? []).length}</div>
            </div>
            <div className="compact-panel panel">
              <div className="muted">Quote Requests</div>
              <div className="stat">{(featureData.quoteRequests ?? []).length}</div>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Summary</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {[...(featureData.callbackRequests ?? []).map((row: any) => ({ type: "callback", summary: row.phone || row.email || row.name || row.id, createdAt: row.createdAt })), ...(featureData.appointmentRequests ?? []).map((row: any) => ({ type: "appointment", summary: row.service || row.email || row.name || row.id, createdAt: row.createdAt })), ...(featureData.serviceAreaChecks ?? []).map((row: any) => ({ type: "service-area", summary: `${row.query} -> ${row.result}`, createdAt: row.createdAt })), ...(featureData.quoteRequests ?? []).map((row: any) => ({ type: "quote", summary: `${row.amount ?? "-"} ${row.currency ?? ""}`.trim(), createdAt: row.createdAt }))].map((row: any, index: number) => (
                  <tr key={`${row.type}-${index}`}>
                    <td>{row.type}</td>
                    <td>{row.summary}</td>
                    <td>{row.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderTableSection(section: Section, title: string) {
    if (!clientId && !isClientOptionalSection(section)) {
      return (
        <div className="empty-state panel">
          <h3>No client selected</h3>
          <p className="muted">Paste a client ID in the header to load {title.toLowerCase()} for a tenant.</p>
        </div>
      );
    }

    return (
      <div className="panel">
        <h2>{title}</h2>
        <pre className="output">{JSON.stringify(data[section], null, 2)}</pre>
      </div>
    );
  }

  function renderDomains() {
    const rows = data.domains?.data ?? [];
    return (
      <div className="grid">
        <div className="panel">
          <h2>Add Domain</h2>
          <div className="toolbar">
            <input className="field compact" value={domainDraft.domain} onChange={(event) => setDomainDraft({ domain: event.target.value })} placeholder="example.com" />
            <button className="primary" onClick={() => void createSimple(`/clients/${clientId}/domains`, domainDraft, "domains", "Domain added.")}>
              Add Domain
            </button>
          </div>
        </div>
        <div className="panel">
          <h2>Domains</h2>
          <pre className="output">{JSON.stringify(rows, null, 2)}</pre>
        </div>
      </div>
    );
  }

  function renderLicenses() {
    const rows = data.licenses?.data ?? [];
    return (
      <div className="grid">
        <div className="panel">
          <h2>Create License</h2>
          <div className="toolbar">
            <input className="field compact" value={licenseDraft.status} onChange={(event) => setLicenseDraft({ status: event.target.value })} placeholder="trial" />
            <button className="primary" onClick={() => void createSimple(`/clients/${clientId}/licenses`, licenseDraft, "licenses", "License created.")}>
              Create License
            </button>
          </div>
        </div>
        <div className="panel">
          <h2>Licenses</h2>
          <pre className="output">{JSON.stringify(rows, null, 2)}</pre>
        </div>
      </div>
    );
  }

  function renderCtas() {
    const rows = data.ctas?.data ?? [];
    return (
      <div className="grid">
        <div className="panel">
          <h2>Create CTA</h2>
          <div className="form-grid">
            <input className="field" value={ctaDraft.label} onChange={(event) => setCtaDraft({ ...ctaDraft, label: event.target.value })} placeholder="Label" />
            <input className="field" value={ctaDraft.kind} onChange={(event) => setCtaDraft({ ...ctaDraft, kind: event.target.value })} placeholder="Kind" />
            <input className="field full-width" value={ctaDraft.url} onChange={(event) => setCtaDraft({ ...ctaDraft, url: event.target.value })} placeholder="https://..." />
          </div>
          <button className="primary" onClick={() => void createSimple(`/clients/${clientId}/ctas`, ctaDraft, "ctas", "CTA created.")}>
            Create CTA
          </button>
        </div>
        <div className="panel">
          <h2>CTAs</h2>
          <pre className="output">{JSON.stringify(rows, null, 2)}</pre>
        </div>
      </div>
    );
  }

  function renderFlags() {
    const flags = data.flags?.data ?? [];
    return (
      <div className="grid">
        <div className="panel">
          <h2>Feature Flags</h2>
          <div className="form-grid">
            <input className="field" value={flagDraft.key} onChange={(event) => setFlagDraft({ ...flagDraft, key: event.target.value })} placeholder="streaming" />
            <label className="checkbox"><input type="checkbox" checked={flagDraft.enabled} onChange={(event) => setFlagDraft({ ...flagDraft, enabled: event.target.checked })} />Enabled</label>
          </div>
          <button className="primary" onClick={() => void upsertSimple(`/clients/${clientId}/feature-flags`, flagDraft, "flags", "Feature flag saved.")}>
            Save Feature Flag
          </button>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <input className="field" value={entitlementDraft.key} onChange={(event) => setEntitlementDraft({ ...entitlementDraft, key: event.target.value })} placeholder="analytics" />
            <label className="checkbox"><input type="checkbox" checked={entitlementDraft.allowed} onChange={(event) => setEntitlementDraft({ ...entitlementDraft, allowed: event.target.checked })} />Allowed</label>
          </div>
          <button className="primary" onClick={() => void upsertSimple(`/clients/${clientId}/entitlements`, entitlementDraft, "flags", "Entitlement saved.")}>
            Save Entitlement
          </button>
        </div>
        <div className="panel">
          <h2>Feature Flags</h2>
          <pre className="output">{JSON.stringify(flags, null, 2)}</pre>
        </div>
      </div>
    );
  }

  function renderPlugin() {
    const rows = data.plugin?.data ?? [];
    return (
      <div className="panel">
        <h2>Plugin Installations</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Plugin</th>
                <th>WordPress</th>
                <th>PHP</th>
                <th>Elementor</th>
                <th>Compatibility</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.domain}</td>
                  <td>{row.plugin_version}</td>
                  <td>{row.wordpress_version ?? "-"}</td>
                  <td>{row.php_version ?? "-"}</td>
                  <td>{row.elementor_version ?? "-"}</td>
                  <td>{row.compatibility_status}</td>
                  <td>{row.last_seen ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderConversations() {
    const rows = data.conversations?.data ?? [];
    return (
      <div className="panel">
        <h2>Conversations</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Export</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.domain}</td>
                  <td>{row.status}</td>
                  <td>{row.lastSeenAt}</td>
                  <td>
                    <a href={`${apiBase}/clients/${clientId}/conversations/${row.id}/export.txt`} target="_blank" rel="noreferrer">
                      Transcript
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderVersions() {
    const rows = data.versions?.data ?? [];
    return (
      <div className="panel">
        <h2>Config Versions</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.versionNumber}</td>
                  <td>{row.createdAt}</td>
                  <td>
                    <button className="secondary" onClick={() => void rollbackConfigVersion(row.versionNumber)}>
                      Rollback
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderUnanswered() {
    const rows = data.unanswered?.data ?? [];
    return (
      <div className="panel">
        <h2>Unanswered Questions</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Frequency</th>
                <th>Status</th>
                <th>Last Asked</th>
                <th>Answer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.normalizedQuestion}</td>
                  <td>{row.frequency}</td>
                  <td>{row.status}</td>
                  <td>{row.lastAskedAt}</td>
                  <td>
                    <textarea
                      className="field"
                      rows={3}
                      value={unansweredAnswerDrafts[row.id] ?? ""}
                      onChange={(event) => setUnansweredAnswerDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
                      placeholder="Add answer and convert to FAQ"
                    />
                    <button className="primary" onClick={() => void resolveUnanswered(row.id, unansweredAnswerDrafts[row.id] ?? "")}>
                      Convert
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderPlatform() {
    const clients = (data.platform?.clients?.data ?? []).filter((row: any) => row.name !== "__platform_internal__");
    const users = data.platform?.users?.data ?? [];
    const releases = data.platform?.releases?.data ?? [];
    const compatibility = data.platform?.compatibility?.data ?? [];
    const securityEvents = data.platform?.securityEvents?.data ?? [];
    const securitySummary = data.platform?.securitySummary?.data;

    return (
      <div className="grid">
        <div className="panel">
          <h2>Create Client</h2>
          <div className="form-grid">
            <input className="field" value={platformClientDraft.name} onChange={(event) => setPlatformClientDraft({ ...platformClientDraft, name: event.target.value })} placeholder="Client name" />
            <input className="field" value={platformClientDraft.domain} onChange={(event) => setPlatformClientDraft({ ...platformClientDraft, domain: event.target.value })} placeholder="Primary domain" />
            <input className="field full-width" value={platformClientDraft.plugin_secret} onChange={(event) => setPlatformClientDraft({ ...platformClientDraft, plugin_secret: event.target.value })} placeholder="Plugin secret" />
          </div>
          <button className="primary" onClick={() => void createPlatformClient()}>
            Create Client
          </button>
        </div>

        <div className="panel">
          <h2>Create Platform User</h2>
          <div className="form-grid">
            <input className="field" value={platformUserDraft.email} onChange={(event) => setPlatformUserDraft({ ...platformUserDraft, email: event.target.value })} placeholder="Email" />
            <input className="field" type="password" value={platformUserDraft.password} onChange={(event) => setPlatformUserDraft({ ...platformUserDraft, password: event.target.value })} placeholder="Password" />
            <input className="field full-width" value={platformUserDraft.role} onChange={(event) => setPlatformUserDraft({ ...platformUserDraft, role: event.target.value })} placeholder="Role" />
          </div>
          <button className="primary" onClick={() => void createPlatformUserHandler()}>
            Create Platform User
          </button>
        </div>

        <div className="panel">
          <h2>Create Plugin Release</h2>
          <div className="form-grid">
            <input className="field" value={pluginReleaseDraft.version} onChange={(event) => setPluginReleaseDraft({ ...pluginReleaseDraft, version: event.target.value })} placeholder="Version" />
            <input className="field" value={pluginReleaseDraft.download_url} onChange={(event) => setPluginReleaseDraft({ ...pluginReleaseDraft, download_url: event.target.value })} placeholder="Download URL" />
            <textarea className="field full-width" rows={4} value={pluginReleaseDraft.release_notes} onChange={(event) => setPluginReleaseDraft({ ...pluginReleaseDraft, release_notes: event.target.value })} placeholder="Release notes" />
          </div>
          <button className="primary" onClick={() => void createPluginReleaseHandler()}>
            Create Plugin Release
          </button>
        </div>

        <div className="panel full-width">
          <h2>Platform Clients</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Client ID</th>
                  <th>Primary Domain</th>
                  <th>License</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.length ? (
                  clients.map((row: any) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td><code>{row.id}</code></td>
                      <td>{row.allowedDomains?.[0]?.domain ?? "-"}</td>
                      <td>{row.licenses?.[0]?.status ?? "-"}</td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => {
                            setClientId(row.id);
                            setActiveSection("overview");
                            void loadSection("overview");
                          }}
                        >
                          Open Client
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="muted">No client accounts created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Platform Users</h2>
          <pre className="output">{JSON.stringify(users, null, 2)}</pre>
        </div>

        <div className="panel">
          <h2>Plugin Releases</h2>
          <pre className="output">{JSON.stringify(releases, null, 2)}</pre>
        </div>

        <div className="panel">
          <h2>Compatibility Summary</h2>
          <pre className="output">{JSON.stringify(compatibility, null, 2)}</pre>
        </div>

        <div className="panel">
          <h2>Security Events Summary</h2>
          {securitySummary ? (
            <div className="grid cols-2">
              <div className="compact-panel panel">
                <div className="muted">Last 24h Total</div>
                <div className="stat">{securitySummary.total_events}</div>
              </div>
              <div className="compact-panel panel">
                <div className="muted">Plugin Verify Failures</div>
                <div className="stat">{securitySummary.event_counts?.plugin_verification_failures ?? 0}</div>
              </div>
              <div className="compact-panel panel">
                <div className="muted">CAPTCHA Failures</div>
                <div className="stat">{securitySummary.event_counts?.captcha_failures ?? 0}</div>
              </div>
              <div className="compact-panel panel">
                <div className="muted">Rate Limit Events</div>
                <div className="stat">{securitySummary.event_counts?.rate_limit_events ?? 0}</div>
              </div>
              <div className="compact-panel panel">
                <div className="muted">Heartbeat Anomalies</div>
                <div className="stat">{securitySummary.event_counts?.heartbeat_anomalies ?? 0}</div>
              </div>
            </div>
          ) : (
            <div className="muted">No recent security summary loaded.</div>
          )}
          <pre className="output">{JSON.stringify(securitySummary, null, 2)}</pre>
        </div>

        <div className="panel">
          <h2>Recent Security Events</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Client</th>
                  <th>Request ID</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.createdAt}</td>
                    <td>{row.source}</td>
                    <td>{row.severity}</td>
                    <td>{row.client?.name ?? row.clientId ?? "Platform"}</td>
                    <td>{row.requestId ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <pre className="output">{JSON.stringify(securityEvents, null, 2)}</pre>
        </div>
      </div>
    );
  }

  function renderHealth() {
    const health = data.health?.data;
    if (!health) {
      return <div className="muted">No health data loaded.</div>;
    }

    return (
      <div className="grid">
        {health.components.map((component: any) => (
          <div key={component.name} className="panel compact-panel">
            <div className={`badge ${component.status}`}>{component.status}</div>
            <h3>{component.name}</h3>
            <p className="muted">{component.message}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderPlayground() {
    return (
      <div className="panel">
        <h2>AI Playground</h2>
        <textarea value={playgroundMessage} onChange={(event) => setPlaygroundMessage(event.target.value)} className="field" rows={6} />
        <button className="primary" onClick={() => void runPlayground()}>
          Run Test
        </button>
        <pre className="output">{playgroundReply || "No response yet."}</pre>
      </div>
    );
  }

  function renderSection() {
    switch (activeSection) {
      case "overview":
        return renderOverview();
      case "settings":
        return renderSettings();
      case "knowledge":
        return renderKnowledge();
      case "features":
        return renderFeatures();
      case "plugin":
        return renderPlugin();
      case "conversations":
        return renderConversations();
      case "health":
        return renderHealth();
      case "playground":
        return renderPlayground();
      case "versions":
        return renderVersions();
      case "unanswered":
        return renderUnanswered();
      case "platform":
        return renderPlatform();
      case "domains":
        return renderDomains();
      case "licenses":
        return renderLicenses();
      case "ctas":
        return renderCtas();
      case "flags":
        return renderFlags();
      case "leads":
        return renderTableSection("leads", "Leads");
      case "audit":
        return renderTableSection("audit", "Audit Logs");
      default:
        return null;
    }
  }

  if (!session) {
    return (
      <main className="login-shell">
        <div className="panel auth-panel">
          <div className="auth-kicker">Centralized Control</div>
          <h1>Chatbot Platform</h1>
          <p className="muted">Sign in with your platform owner or platform admin account. Client ID is optional and can be selected after login.</p>
          <input className="field" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Platform email" />
          <input className="field" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          <input className="field" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Optional client ID" />
          <button className="primary" disabled={loading} onClick={() => void login()}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
          {error ? <div className="error-text">{error}</div> : null}
        </div>
      </main>
    );
  }

  const selectedClient = clientOptions.find((option) => option.id === clientId) ?? null;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-kicker">Admin Console</div>
          <h1>Chatbot Platform</h1>
          <p className="muted">Operate tenants, plugin installations, AI behavior, and lead flows from one place.</p>
        </div>
        <div className="sidebar-client-card">
          <div className="sidebar-client-label">Active client</div>
          <div className="sidebar-client-value">{selectedClient?.name ?? (clientId || "Platform-wide view")}</div>
        </div>
        <div className="nav-group-title">Workspace</div>
        <div className="grid nav-grid">
          {sections.map((section) => (
            <button key={section} type="button" className={`nav-link ${activeSection === section ? "nav-active" : ""}`} onClick={() => setActiveSection(section)}>
              <span>{sectionMeta[section].label}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="content">
        <div className="page-header panel">
          <div className="page-header-copy">
            <div className="section-badge">{sectionMeta[activeSection].label}</div>
            <h2>{sectionMeta[activeSection].label}</h2>
            <p className="muted">{sectionMeta[activeSection].description}</p>
          </div>
          <div className="toolbar page-toolbar">
            {clientOptions.length ? (
              <select className="field compact" value={clientId} onChange={(event) => setClientId(event.target.value)} aria-label="Select client">
                <option value="">Platform-wide view</option>
                {clientOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : (
              <input className="field compact" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Paste client ID to load tenant data" />
            )}
            <button className="secondary" onClick={() => void loadSection(activeSection)}>
              Refresh
            </button>
            <button
              className="secondary"
              onClick={() => {
                window.localStorage.removeItem("chatbot_dashboard_session");
                if (session.refreshToken) {
                  void fetch(`${apiBase}/auth/logout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: session.refreshToken })
                  });
                }
                setSession(null);
              }}
            >
              Log Out
            </button>
          </div>
        </div>
        {!clientId && !isClientOptionalSection(activeSection) ? (
          <div className="panel notice-panel">
            <div>
              <strong>Select a client to continue.</strong>
              <p className="muted">Platform-wide sections such as Health and Platform Admin work without a client ID. Tenant-specific sections need a selected client.</p>
            </div>
          </div>
        ) : null}
        {error ? <div className="panel status-panel error-text">{error}</div> : null}
        {notice ? <div className="panel status-panel success-text">{notice}</div> : null}
        {loading ? <div className="panel status-panel muted">Loading latest data...</div> : null}
        {renderSection()}
      </section>
    </main>
  );
}
