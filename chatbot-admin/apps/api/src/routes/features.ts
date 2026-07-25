import { Router } from "express";
import { z } from "zod";

import { sendError, sendSuccess } from "../lib/api-response.js";
import { requireAuth, requireClientAccess, requireClientRole } from "../middleware/auth.js";
import {
  calculateInstantQuote,
  convertFaqSuggestionToKnowledge,
  createPriceListItem,
  createQuoteField,
  createServiceAreaRule,
  evaluateServiceArea,
  getFeatureSettings,
  ignoreFaqSuggestion,
  restorePriceListItem,
  restoreQuoteField,
  restoreServiceAreaRule,
  softDeletePriceListItem,
  softDeleteQuoteField,
  softDeleteServiceAreaRule,
  updatePriceListItem,
  updateQuoteField,
  updateServiceAreaRule,
  upsertAppointmentConfig,
  upsertBusinessHours,
  upsertCallbackConfig,
  upsertCaptchaConfig,
  upsertEmergencyDetection,
  upsertLeadQualification,
  upsertMissedAlertConfig,
  upsertOutOfHours,
  upsertQuoteConfig,
  upsertServiceAreaConfig
} from "../services/feature-service.js";

const jsonSchema = z
  .record(z.any())
  .or(z.array(z.any()))
  .or(z.object({}).passthrough());

const versionSchema = z.object({ version: z.number().int().optional() });
const businessHoursSchema = versionSchema.extend({
  enabled: z.boolean(),
  timezone: z.string().optional(),
  schedule: jsonSchema,
  notes: z.string().optional()
});
const outOfHoursSchema = versionSchema.extend({
  enabled: z.boolean(),
  greeting: z.string().optional(),
  limited_ctas: jsonSchema.optional(),
  form_first_mode: z.boolean(),
  visitor_message: z.string().optional()
});
const callbackConfigSchema = versionSchema.extend({
  enabled: z.boolean(),
  button_label: z.string().min(1),
  helper_text: z.string().optional(),
  success_message: z.string().optional(),
  required_fields: jsonSchema.optional()
});
const appointmentConfigSchema = versionSchema.extend({
  enabled: z.boolean(),
  title: z.string().min(1),
  description: z.string().optional(),
  required_fields: jsonSchema.optional(),
  success_message: z.string().optional()
});
const serviceAreaConfigSchema = versionSchema.extend({
  enabled: z.boolean(),
  mode: z.string().min(1),
  input_label: z.string().optional(),
  success_message: z.string().optional(),
  failure_message: z.string().optional()
});
const serviceAreaRuleSchema = versionSchema.extend({
  rule_type: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  enabled: z.boolean()
});
const priceListItemSchema = versionSchema.extend({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number().int()
});
const quoteConfigSchema = versionSchema.extend({
  enabled: z.boolean(),
  title: z.string().min(1),
  description: z.string().optional(),
  success_message: z.string().optional(),
  base_amount: z.number(),
  currency: z.string().optional()
});
const quoteFieldSchema = versionSchema.extend({
  key: z.string().min(1),
  label: z.string().min(1),
  field_type: z.string().min(1),
  required: z.boolean(),
  options: jsonSchema.optional(),
  multiplier: z.number(),
  sort_order: z.number().int()
});
const leadQualificationSchema = versionSchema.extend({
  enabled: z.boolean(),
  stages: jsonSchema,
  required_fields: jsonSchema,
  scoring_rules: jsonSchema.optional(),
  success_message: z.string().optional()
});
const missedAlertSchema = versionSchema.extend({
  enabled: z.boolean(),
  conversation_delay_mins: z.number().int().nonnegative(),
  lead_delay_mins: z.number().int().nonnegative(),
  notify_platform_email: z.boolean(),
  notify_wordpress_email: z.boolean()
});
const emergencySchema = versionSchema.extend({
  enabled: z.boolean(),
  keywords: jsonSchema,
  response_message: z.string().min(1),
  escalate_label: z.string().optional()
});
const captchaSchema = versionSchema.extend({
  provider: z.enum(["disabled", "turnstile", "recaptcha_v3"]),
  site_key: z.string().optional(),
  secret_key: z.string().optional(),
  protect_lead: z.boolean(),
  protect_callback: z.boolean(),
  protect_appointment: z.boolean(),
  protect_quote: z.boolean(),
  protect_chat: z.boolean(),
  min_score: z.number().min(0).max(1).optional()
});
const faqConvertSchema = z.object({ answer: z.string().min(1) });
const serviceAreaCheckSchema = z.object({ query: z.string().min(1) });
const quoteCalculateSchema = z.object({ values: z.record(z.any()) });

export const featuresRouter = Router();

featuresRouter.use(requireAuth("dashboard"));
featuresRouter.use("/clients/:clientId/features", requireClientAccess());

function parseOrError<T>(res: Parameters<typeof sendError>[0], parsed: z.SafeParseReturnType<unknown, T>, message: string) {
  if (!parsed.success) {
    sendError(res, 422, "VALIDATION_ERROR", message, { issues: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

featuresRouter.get("/clients/:clientId/features", async (req, res) => {
  return sendSuccess(res, await getFeatureSettings(String(req.params.clientId)));
});

featuresRouter.put("/clients/:clientId/features/business-hours", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, businessHoursSchema.safeParse(req.body), "Business hours payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertBusinessHours(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Business hours save failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/out-of-hours", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, outOfHoursSchema.safeParse(req.body), "Out-of-hours payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertOutOfHours(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Out-of-hours save failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/callback-config", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, callbackConfigSchema.safeParse(req.body), "Callback config payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertCallbackConfig(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Callback config save failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/appointment-config", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, appointmentConfigSchema.safeParse(req.body), "Appointment config payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertAppointmentConfig(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Appointment config save failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/service-area-config", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, serviceAreaConfigSchema.safeParse(req.body), "Service area config payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertServiceAreaConfig(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Service area config save failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/service-area-rules", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, serviceAreaRuleSchema.safeParse(req.body), "Service area rule payload is invalid.");
  if (!parsed) {
    return;
  }
  return sendSuccess(res, await createServiceAreaRule(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string), {}, 201);
});

featuresRouter.put("/clients/:clientId/features/service-area-rules/:ruleId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, serviceAreaRuleSchema.safeParse(req.body), "Service area rule payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await updateServiceAreaRule(String(req.params.clientId), String(req.params.ruleId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, error instanceof Error && /not found/i.test(error.message) ? 404 : 409, "SERVICE_AREA_RULE_UPDATE_FAILED", error instanceof Error ? error.message : "Service area rule update failed.");
  }
});

featuresRouter.delete("/clients/:clientId/features/service-area-rules/:ruleId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  try {
    await softDeleteServiceAreaRule(String(req.params.clientId), String(req.params.ruleId), (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown", res.locals.requestId as string);
    return sendSuccess(res, { deleted: true });
  } catch (error) {
    return sendError(res, 404, "SERVICE_AREA_RULE_NOT_FOUND", error instanceof Error ? error.message : "Delete failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/service-area-rules/:ruleId/restore", requireClientRole(["owner", "admin"]), async (req, res) => {
  try {
    await restoreServiceAreaRule(String(req.params.clientId), String(req.params.ruleId), (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown", res.locals.requestId as string);
    return sendSuccess(res, { restored: true });
  } catch (error) {
    return sendError(res, 404, "SERVICE_AREA_RULE_NOT_FOUND", error instanceof Error ? error.message : "Restore failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/price-list-items", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, priceListItemSchema.safeParse(req.body), "Price list item payload is invalid.");
  if (!parsed) {
    return;
  }
  return sendSuccess(res, await createPriceListItem(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string), {}, 201);
});

featuresRouter.put("/clients/:clientId/features/price-list-items/:itemId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, priceListItemSchema.safeParse(req.body), "Price list item payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await updatePriceListItem(String(req.params.clientId), String(req.params.itemId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, error instanceof Error && /not found/i.test(error.message) ? 404 : 409, "PRICE_LIST_ITEM_UPDATE_FAILED", error instanceof Error ? error.message : "Price list item update failed.");
  }
});

featuresRouter.delete("/clients/:clientId/features/price-list-items/:itemId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  try {
    await softDeletePriceListItem(String(req.params.clientId), String(req.params.itemId), (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown", res.locals.requestId as string);
    return sendSuccess(res, { deleted: true });
  } catch (error) {
    return sendError(res, 404, "PRICE_LIST_ITEM_NOT_FOUND", error instanceof Error ? error.message : "Delete failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/price-list-items/:itemId/restore", requireClientRole(["owner", "admin"]), async (req, res) => {
  try {
    await restorePriceListItem(String(req.params.clientId), String(req.params.itemId), (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown", res.locals.requestId as string);
    return sendSuccess(res, { restored: true });
  } catch (error) {
    return sendError(res, 404, "PRICE_LIST_ITEM_NOT_FOUND", error instanceof Error ? error.message : "Restore failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/quote-config", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, quoteConfigSchema.safeParse(req.body), "Quote config payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertQuoteConfig(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Quote config save failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/quote-fields", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, quoteFieldSchema.safeParse(req.body), "Quote field payload is invalid.");
  if (!parsed) {
    return;
  }
  return sendSuccess(res, await createQuoteField(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string), {}, 201);
});

featuresRouter.put("/clients/:clientId/features/quote-fields/:fieldId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, quoteFieldSchema.safeParse(req.body), "Quote field payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await updateQuoteField(String(req.params.clientId), String(req.params.fieldId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, error instanceof Error && /not found/i.test(error.message) ? 404 : 409, "QUOTE_FIELD_UPDATE_FAILED", error instanceof Error ? error.message : "Quote field update failed.");
  }
});

featuresRouter.delete("/clients/:clientId/features/quote-fields/:fieldId", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  try {
    await softDeleteQuoteField(String(req.params.clientId), String(req.params.fieldId), (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown", res.locals.requestId as string);
    return sendSuccess(res, { deleted: true });
  } catch (error) {
    return sendError(res, 404, "QUOTE_FIELD_NOT_FOUND", error instanceof Error ? error.message : "Delete failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/quote-fields/:fieldId/restore", requireClientRole(["owner", "admin"]), async (req, res) => {
  try {
    await restoreQuoteField(String(req.params.clientId), String(req.params.fieldId), (res.locals.auth as { sub?: string } | undefined)?.sub ?? "unknown", res.locals.requestId as string);
    return sendSuccess(res, { restored: true });
  } catch (error) {
    return sendError(res, 404, "QUOTE_FIELD_NOT_FOUND", error instanceof Error ? error.message : "Restore failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/lead-qualification", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, leadQualificationSchema.safeParse(req.body), "Lead qualification payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertLeadQualification(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Lead qualification save failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/missed-alert-config", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = parseOrError(res, missedAlertSchema.safeParse(req.body), "Missed customer alert payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertMissedAlertConfig(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Missed alert save failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/emergency-detection", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, emergencySchema.safeParse(req.body), "Emergency detection payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertEmergencyDetection(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "Emergency detection save failed.");
  }
});

featuresRouter.put("/clients/:clientId/features/captcha-config", requireClientRole(["owner", "admin"]), async (req, res) => {
  const parsed = parseOrError(res, captchaSchema.safeParse(req.body), "CAPTCHA configuration payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await upsertCaptchaConfig(String(req.params.clientId), parsed, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 409, "VERSION_CONFLICT", error instanceof Error ? error.message : "CAPTCHA config save failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/faq-suggestions/:suggestionId/convert", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  const parsed = parseOrError(res, faqConvertSchema.safeParse(req.body), "FAQ conversion payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await convertFaqSuggestionToKnowledge(String(req.params.clientId), String(req.params.suggestionId), parsed.answer, (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string));
  } catch (error) {
    return sendError(res, 404, "FAQ_SUGGESTION_NOT_FOUND", error instanceof Error ? error.message : "FAQ suggestion conversion failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/faq-suggestions/:suggestionId/ignore", requireClientRole(["owner", "admin", "editor"]), async (req, res) => {
  try {
    await ignoreFaqSuggestion(String(req.params.clientId), String(req.params.suggestionId), (res.locals.auth as { sub?: string } | undefined)?.sub, res.locals.requestId as string);
    return sendSuccess(res, { ignored: true });
  } catch (error) {
    return sendError(res, 404, "FAQ_SUGGESTION_NOT_FOUND", error instanceof Error ? error.message : "FAQ suggestion ignore failed.");
  }
});

featuresRouter.post("/clients/:clientId/features/service-area-check", async (req, res) => {
  const parsed = parseOrError(res, serviceAreaCheckSchema.safeParse(req.body), "Service area check payload is invalid.");
  if (!parsed) {
    return;
  }
  return sendSuccess(res, await evaluateServiceArea(String(req.params.clientId), parsed.query));
});

featuresRouter.post("/clients/:clientId/features/quote-calculate", async (req, res) => {
  const parsed = parseOrError(res, quoteCalculateSchema.safeParse(req.body), "Quote calculation payload is invalid.");
  if (!parsed) {
    return;
  }
  try {
    return sendSuccess(res, await calculateInstantQuote(String(req.params.clientId), parsed.values));
  } catch (error) {
    return sendError(res, 422, "QUOTE_CALCULATION_FAILED", error instanceof Error ? error.message : "Quote calculation failed.");
  }
});
