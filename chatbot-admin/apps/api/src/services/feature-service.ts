import { AppError } from "../lib/errors.js";
import { writeAuditLog } from "../lib/audit.js";
import { encryptValue } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";
import { newId } from "../lib/ids.js";
import { createConfigVersion, createKnowledgeEntry } from "./client-service.js";

type VersionedInput = { version?: number };

type BusinessHoursInput = VersionedInput & {
  enabled: boolean;
  timezone?: string;
  schedule: unknown;
  notes?: string;
};

type OutOfHoursInput = VersionedInput & {
  enabled: boolean;
  greeting?: string;
  limited_ctas?: unknown;
  form_first_mode: boolean;
  visitor_message?: string;
};

type CallbackConfigInput = VersionedInput & {
  enabled: boolean;
  button_label: string;
  helper_text?: string;
  success_message?: string;
  required_fields?: unknown;
};

type AppointmentConfigInput = VersionedInput & {
  enabled: boolean;
  title: string;
  description?: string;
  required_fields?: unknown;
  success_message?: string;
};

type ServiceAreaConfigInput = VersionedInput & {
  enabled: boolean;
  mode: string;
  input_label?: string;
  success_message?: string;
  failure_message?: string;
};

type ServiceAreaRuleInput = VersionedInput & {
  rule_type: string;
  label: string;
  value: string;
  enabled: boolean;
};

type PriceListItemInput = VersionedInput & {
  category: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  enabled: boolean;
  sort_order: number;
};

type QuoteConfigInput = VersionedInput & {
  enabled: boolean;
  title: string;
  description?: string;
  success_message?: string;
  base_amount: number;
  currency?: string;
};

type QuoteFieldInput = VersionedInput & {
  key: string;
  label: string;
  field_type: string;
  required: boolean;
  options?: unknown;
  multiplier: number;
  sort_order: number;
};

type LeadQualificationInput = VersionedInput & {
  enabled: boolean;
  stages: unknown;
  required_fields: unknown;
  scoring_rules?: unknown;
  success_message?: string;
};

type MissedAlertInput = VersionedInput & {
  enabled: boolean;
  conversation_delay_mins: number;
  lead_delay_mins: number;
  notify_platform_email: boolean;
  notify_wordpress_email: boolean;
};

type EmergencyDetectionInput = VersionedInput & {
  enabled: boolean;
  keywords: unknown;
  response_message: string;
  escalate_label?: string;
};

type CaptchaConfigInput = VersionedInput & {
  provider: "disabled" | "turnstile" | "recaptcha_v3";
  site_key?: string;
  secret_key?: string;
  protect_lead: boolean;
  protect_callback: boolean;
  protect_appointment: boolean;
  protect_quote: boolean;
  protect_chat: boolean;
  min_score?: number;
};

function ensureVersion(currentVersion: number | undefined, inputVersion: number | undefined, message: string) {
  if (currentVersion !== undefined && inputVersion !== undefined && currentVersion !== inputVersion) {
    throw new AppError(409, "VERSION_CONFLICT", message);
  }
}

export async function getFeatureSettings(clientId: string) {
  const [
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
    emergencyDetection,
    captchaConfig,
    faqSuggestions,
    callbackRequests,
    appointmentRequests,
    serviceAreaChecks,
    quoteRequests,
    missedAlerts
  ] = await Promise.all([
    prisma.businessHoursConfig.findUnique({ where: { clientId } }),
    prisma.outOfHoursConfig.findUnique({ where: { clientId } }),
    prisma.callbackRequestConfig.findUnique({ where: { clientId } }),
    prisma.appointmentRequestConfig.findUnique({ where: { clientId } }),
    prisma.serviceAreaConfig.findUnique({ where: { clientId } }),
    prisma.serviceAreaRule.findMany({ where: { clientId, deletedAt: null }, orderBy: [{ ruleType: "asc" }, { label: "asc" }] }),
    prisma.priceListItem.findMany({ where: { clientId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.quoteCalculatorConfig.findUnique({ where: { clientId } }),
    prisma.quoteCalculatorField.findMany({ where: { clientId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.leadQualificationConfig.findUnique({ where: { clientId } }),
    prisma.missedCustomerAlertConfig.findUnique({ where: { clientId } }),
    prisma.emergencyDetectionConfig.findUnique({ where: { clientId } }),
    prisma.captchaConfig.findUnique({ where: { clientId } }),
    prisma.faqSuggestion.findMany({ where: { clientId }, orderBy: [{ frequency: "desc" }, { updatedAt: "desc" }] }),
    prisma.callbackRequest.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.appointmentRequest.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.serviceAreaCheck.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.quoteRequest.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.missedCustomerAlert.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);

  return {
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
    emergencyDetection,
    captchaConfig: captchaConfig
      ? {
          id: captchaConfig.id,
          clientId: captchaConfig.clientId,
          provider: captchaConfig.provider,
          siteKey: captchaConfig.siteKey,
          secretConfigured: Boolean(captchaConfig.secretKeyEncrypted),
          protectLead: captchaConfig.protectLead,
          protectCallback: captchaConfig.protectCallback,
          protectAppointment: captchaConfig.protectAppointment,
          protectQuote: captchaConfig.protectQuote,
          protectChat: captchaConfig.protectChat,
          minScore: captchaConfig.minScore,
          version: captchaConfig.version,
          createdAt: captchaConfig.createdAt,
          updatedAt: captchaConfig.updatedAt
        }
      : null,
    faqSuggestions,
    callbackRequests,
    appointmentRequests,
    serviceAreaChecks,
    quoteRequests,
    missedAlerts
  };
}

export async function upsertBusinessHours(clientId: string, input: BusinessHoursInput, actorId?: string, requestId?: string) {
  const existing = await prisma.businessHoursConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Business hours changed since you last loaded them.");
  const record = await prisma.businessHoursConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      timezone: input.timezone ?? null,
      schedule: input.schedule as object,
      notes: input.notes ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      timezone: input.timezone ?? null,
      schedule: input.schedule as object,
      notes: input.notes ?? null
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "business_hours.changed", target: record.id, requestId });
  return record;
}

export async function upsertOutOfHours(clientId: string, input: OutOfHoursInput, actorId?: string, requestId?: string) {
  const existing = await prisma.outOfHoursConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Out-of-hours settings changed since you last loaded them.");
  const record = await prisma.outOfHoursConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      greeting: input.greeting ?? null,
      limitedCtas: ((input.limited_ctas as object | null | undefined) ?? null) as any,
      formFirstMode: input.form_first_mode,
      visitorMessage: input.visitor_message ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      greeting: input.greeting ?? null,
      limitedCtas: ((input.limited_ctas as object | null | undefined) ?? null) as any,
      formFirstMode: input.form_first_mode,
      visitorMessage: input.visitor_message ?? null
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "out_of_hours.changed", target: record.id, requestId });
  return record;
}

export async function upsertCallbackConfig(clientId: string, input: CallbackConfigInput, actorId?: string, requestId?: string) {
  const existing = await prisma.callbackRequestConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Callback settings changed since you last loaded them.");
  const record = await prisma.callbackRequestConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      buttonLabel: input.button_label,
      helperText: input.helper_text ?? null,
      successMessage: input.success_message ?? null,
      requiredFields: ((input.required_fields as object | null | undefined) ?? null) as any,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      buttonLabel: input.button_label,
      helperText: input.helper_text ?? null,
      successMessage: input.success_message ?? null,
      requiredFields: ((input.required_fields as object | null | undefined) ?? null) as any
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "callback_request.changed", target: record.id, requestId });
  return record;
}

export async function upsertAppointmentConfig(clientId: string, input: AppointmentConfigInput, actorId?: string, requestId?: string) {
  const existing = await prisma.appointmentRequestConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Appointment settings changed since you last loaded them.");
  const record = await prisma.appointmentRequestConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      title: input.title,
      description: input.description ?? null,
      requiredFields: ((input.required_fields as object | null | undefined) ?? null) as any,
      successMessage: input.success_message ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      title: input.title,
      description: input.description ?? null,
      requiredFields: ((input.required_fields as object | null | undefined) ?? null) as any,
      successMessage: input.success_message ?? null
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "appointment_request.changed", target: record.id, requestId });
  return record;
}

export async function upsertServiceAreaConfig(clientId: string, input: ServiceAreaConfigInput, actorId?: string, requestId?: string) {
  const existing = await prisma.serviceAreaConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Service area settings changed since you last loaded them.");
  const record = await prisma.serviceAreaConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      mode: input.mode,
      inputLabel: input.input_label ?? null,
      successMessage: input.success_message ?? null,
      failureMessage: input.failure_message ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      mode: input.mode,
      inputLabel: input.input_label ?? null,
      successMessage: input.success_message ?? null,
      failureMessage: input.failure_message ?? null
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "service_area.changed", target: record.id, requestId });
  return record;
}

export async function createServiceAreaRule(clientId: string, input: ServiceAreaRuleInput, actorId?: string, requestId?: string) {
  const record = await prisma.serviceAreaRule.create({
    data: {
      id: newId(),
      clientId,
      ruleType: input.rule_type,
      label: input.label,
      value: input.value,
      enabled: input.enabled
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "service_area_rule.created", target: record.id, requestId });
  return record;
}

export async function updateServiceAreaRule(clientId: string, ruleId: string, input: ServiceAreaRuleInput, actorId?: string, requestId?: string) {
  const existing = await prisma.serviceAreaRule.findFirst({ where: { id: ruleId, clientId, deletedAt: null } });
  if (!existing) {
    throw new AppError(404, "SERVICE_AREA_RULE_NOT_FOUND", "Service area rule was not found.");
  }
  ensureVersion(existing.version, input.version, "Service area rule changed since you last loaded it.");
  const record = await prisma.serviceAreaRule.update({
    where: { id: ruleId },
    data: {
      ruleType: input.rule_type,
      label: input.label,
      value: input.value,
      enabled: input.enabled,
      version: { increment: 1 }
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "service_area_rule.updated", target: ruleId, requestId });
  return record;
}

export async function softDeleteServiceAreaRule(clientId: string, ruleId: string, actorId: string, requestId?: string) {
  const result = await prisma.serviceAreaRule.updateMany({
    where: { id: ruleId, clientId, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy: actorId, version: { increment: 1 } }
  });
  if (!result.count) {
    throw new AppError(404, "SERVICE_AREA_RULE_NOT_FOUND", "Service area rule was not found.");
  }
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "service_area_rule.soft_deleted", target: ruleId, requestId });
}

export async function restoreServiceAreaRule(clientId: string, ruleId: string, actorId: string, requestId?: string) {
  const result = await prisma.serviceAreaRule.updateMany({
    where: { id: ruleId, clientId, deletedAt: { not: null } },
    data: { deletedAt: null, deletedBy: null, version: { increment: 1 } }
  });
  if (!result.count) {
    throw new AppError(404, "SERVICE_AREA_RULE_NOT_FOUND", "Service area rule was not found.");
  }
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "service_area_rule.restored", target: ruleId, requestId });
}

export async function createPriceListItem(clientId: string, input: PriceListItemInput, actorId?: string, requestId?: string) {
  const record = await prisma.priceListItem.create({
    data: {
      id: newId(),
      clientId,
      category: input.category,
      name: input.name,
      description: input.description ?? null,
      price: input.price ?? null,
      currency: input.currency ?? null,
      enabled: input.enabled,
      sortOrder: input.sort_order
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "price_list_item.created", target: record.id, requestId });
  return record;
}

export async function updatePriceListItem(clientId: string, itemId: string, input: PriceListItemInput, actorId?: string, requestId?: string) {
  const existing = await prisma.priceListItem.findFirst({ where: { id: itemId, clientId, deletedAt: null } });
  if (!existing) {
    throw new AppError(404, "PRICE_LIST_ITEM_NOT_FOUND", "Price list item was not found.");
  }
  ensureVersion(existing.version, input.version, "Price list item changed since you last loaded it.");
  const record = await prisma.priceListItem.update({
    where: { id: itemId },
    data: {
      category: input.category,
      name: input.name,
      description: input.description ?? null,
      price: input.price ?? null,
      currency: input.currency ?? null,
      enabled: input.enabled,
      sortOrder: input.sort_order,
      version: { increment: 1 }
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "price_list_item.updated", target: itemId, requestId });
  return record;
}

export async function softDeletePriceListItem(clientId: string, itemId: string, actorId: string, requestId?: string) {
  const result = await prisma.priceListItem.updateMany({
    where: { id: itemId, clientId, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy: actorId, version: { increment: 1 } }
  });
  if (!result.count) {
    throw new AppError(404, "PRICE_LIST_ITEM_NOT_FOUND", "Price list item was not found.");
  }
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "price_list_item.soft_deleted", target: itemId, requestId });
}

export async function restorePriceListItem(clientId: string, itemId: string, actorId: string, requestId?: string) {
  const result = await prisma.priceListItem.updateMany({
    where: { id: itemId, clientId, deletedAt: { not: null } },
    data: { deletedAt: null, deletedBy: null, version: { increment: 1 } }
  });
  if (!result.count) {
    throw new AppError(404, "PRICE_LIST_ITEM_NOT_FOUND", "Price list item was not found.");
  }
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "price_list_item.restored", target: itemId, requestId });
}

export async function upsertQuoteConfig(clientId: string, input: QuoteConfigInput, actorId?: string, requestId?: string) {
  const existing = await prisma.quoteCalculatorConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Quote calculator changed since you last loaded it.");
  const record = await prisma.quoteCalculatorConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      title: input.title,
      description: input.description ?? null,
      successMessage: input.success_message ?? null,
      baseAmount: input.base_amount,
      currency: input.currency ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      title: input.title,
      description: input.description ?? null,
      successMessage: input.success_message ?? null,
      baseAmount: input.base_amount,
      currency: input.currency ?? null
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "quote_calculator.changed", target: record.id, requestId });
  return record;
}

export async function createQuoteField(clientId: string, input: QuoteFieldInput, actorId?: string, requestId?: string) {
  const record = await prisma.quoteCalculatorField.create({
    data: {
      id: newId(),
      clientId,
      key: input.key,
      label: input.label,
      fieldType: input.field_type,
      required: input.required,
      options: ((input.options as object | null | undefined) ?? null) as any,
      multiplier: input.multiplier,
      sortOrder: input.sort_order
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "quote_field.created", target: record.id, requestId });
  return record;
}

export async function updateQuoteField(clientId: string, fieldId: string, input: QuoteFieldInput, actorId?: string, requestId?: string) {
  const existing = await prisma.quoteCalculatorField.findFirst({ where: { id: fieldId, clientId, deletedAt: null } });
  if (!existing) {
    throw new AppError(404, "QUOTE_FIELD_NOT_FOUND", "Quote field was not found.");
  }
  ensureVersion(existing.version, input.version, "Quote field changed since you last loaded it.");
  const record = await prisma.quoteCalculatorField.update({
    where: { id: fieldId },
    data: {
      key: input.key,
      label: input.label,
      fieldType: input.field_type,
      required: input.required,
      options: ((input.options as object | null | undefined) ?? null) as any,
      multiplier: input.multiplier,
      sortOrder: input.sort_order,
      version: { increment: 1 }
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "quote_field.updated", target: fieldId, requestId });
  return record;
}

export async function softDeleteQuoteField(clientId: string, fieldId: string, actorId: string, requestId?: string) {
  const result = await prisma.quoteCalculatorField.updateMany({
    where: { id: fieldId, clientId, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy: actorId, version: { increment: 1 } }
  });
  if (!result.count) {
    throw new AppError(404, "QUOTE_FIELD_NOT_FOUND", "Quote field was not found.");
  }
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "quote_field.soft_deleted", target: fieldId, requestId });
}

export async function restoreQuoteField(clientId: string, fieldId: string, actorId: string, requestId?: string) {
  const result = await prisma.quoteCalculatorField.updateMany({
    where: { id: fieldId, clientId, deletedAt: { not: null } },
    data: { deletedAt: null, deletedBy: null, version: { increment: 1 } }
  });
  if (!result.count) {
    throw new AppError(404, "QUOTE_FIELD_NOT_FOUND", "Quote field was not found.");
  }
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "quote_field.restored", target: fieldId, requestId });
}

export async function upsertLeadQualification(clientId: string, input: LeadQualificationInput, actorId?: string, requestId?: string) {
  const existing = await prisma.leadQualificationConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Lead qualification changed since you last loaded it.");
  const record = await prisma.leadQualificationConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      stages: input.stages as any,
      requiredFields: input.required_fields as any,
      scoringRules: ((input.scoring_rules as object | null | undefined) ?? null) as any,
      successMessage: input.success_message ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      stages: input.stages as any,
      requiredFields: input.required_fields as any,
      scoringRules: ((input.scoring_rules as object | null | undefined) ?? null) as any,
      successMessage: input.success_message ?? null
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "lead_qualification.changed", target: record.id, requestId });
  return record;
}

export async function upsertMissedAlertConfig(clientId: string, input: MissedAlertInput, actorId?: string, requestId?: string) {
  const existing = await prisma.missedCustomerAlertConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Missed customer alert settings changed since you last loaded them.");
  const record = await prisma.missedCustomerAlertConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      conversationDelayMins: input.conversation_delay_mins,
      leadDelayMins: input.lead_delay_mins,
      notifyPlatformEmail: input.notify_platform_email,
      notifyWordPressEmail: input.notify_wordpress_email,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      conversationDelayMins: input.conversation_delay_mins,
      leadDelayMins: input.lead_delay_mins,
      notifyPlatformEmail: input.notify_platform_email,
      notifyWordPressEmail: input.notify_wordpress_email
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "missed_customer_alert.changed", target: record.id, requestId });
  return record;
}

export async function upsertEmergencyDetection(clientId: string, input: EmergencyDetectionInput, actorId?: string, requestId?: string) {
  const existing = await prisma.emergencyDetectionConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "Emergency detection settings changed since you last loaded them.");
  const record = await prisma.emergencyDetectionConfig.upsert({
    where: { clientId },
    update: {
      enabled: input.enabled,
      keywords: input.keywords as any,
      responseMessage: input.response_message,
      escalateLabel: input.escalate_label ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      enabled: input.enabled,
      keywords: input.keywords as any,
      responseMessage: input.response_message,
      escalateLabel: input.escalate_label ?? null
    }
  });
  await createConfigVersion(clientId);
  await writeAuditLog({ clientId, actorId, action: "emergency_detection.changed", target: record.id, requestId });
  return record;
}

export async function upsertCaptchaConfig(clientId: string, input: CaptchaConfigInput, actorId?: string, requestId?: string) {
  const existing = await prisma.captchaConfig.findUnique({ where: { clientId } });
  ensureVersion(existing?.version, input.version, "CAPTCHA settings changed since you last loaded them.");

  const nextSecret =
    input.provider !== "disabled"
      ? input.secret_key
        ? encryptValue(input.secret_key)
        : existing?.secretKeyEncrypted ?? null
      : null;

  const record = await prisma.captchaConfig.upsert({
    where: { clientId },
    update: {
      provider: input.provider,
      siteKey: input.site_key ?? null,
      secretKeyEncrypted: nextSecret,
      protectLead: input.protect_lead,
      protectCallback: input.protect_callback,
      protectAppointment: input.protect_appointment,
      protectQuote: input.protect_quote,
      protectChat: input.protect_chat,
      minScore: input.min_score ?? null,
      version: { increment: 1 }
    },
    create: {
      id: newId(),
      clientId,
      provider: input.provider,
      siteKey: input.site_key ?? null,
      secretKeyEncrypted: nextSecret,
      protectLead: input.protect_lead,
      protectCallback: input.protect_callback,
      protectAppointment: input.protect_appointment,
      protectQuote: input.protect_quote,
      protectChat: input.protect_chat,
      minScore: input.min_score ?? null
    }
  });

  await createConfigVersion(clientId);
  await writeAuditLog({
    clientId,
    actorId,
    action: "captcha_config.changed",
    target: record.id,
    requestId,
    metadata: {
      provider: record.provider,
      protected_forms: {
        lead: record.protectLead,
        callback: record.protectCallback,
        appointment: record.protectAppointment,
        quote: record.protectQuote,
        chat: record.protectChat
      }
    }
  });

  return {
    id: record.id,
    clientId: record.clientId,
    provider: record.provider,
    siteKey: record.siteKey,
    secretConfigured: Boolean(record.secretKeyEncrypted),
    protectLead: record.protectLead,
    protectCallback: record.protectCallback,
    protectAppointment: record.protectAppointment,
    protectQuote: record.protectQuote,
    protectChat: record.protectChat,
    minScore: record.minScore,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export async function incrementFaqSuggestion(clientId: string, normalizedQuestion: string) {
  const existing = await prisma.faqSuggestion.findFirst({
    where: { clientId, normalizedQuestion }
  });

  if (existing) {
    return prisma.faqSuggestion.update({
      where: { id: existing.id },
      data: {
        frequency: { increment: 1 },
        version: { increment: 1 }
      }
    });
  }

  return prisma.faqSuggestion.create({
    data: {
      id: newId(),
      clientId,
      normalizedQuestion,
      status: "open",
      frequency: 1
    }
  });
}

export async function convertFaqSuggestionToKnowledge(clientId: string, suggestionId: string, answer: string, actorId?: string, requestId?: string) {
  const suggestion = await prisma.faqSuggestion.findFirst({ where: { id: suggestionId, clientId } });
  if (!suggestion) {
    throw new AppError(404, "FAQ_SUGGESTION_NOT_FOUND", "FAQ suggestion was not found.");
  }
  const entry = await createKnowledgeEntry(
    clientId,
    {
      type: "faq",
      title: suggestion.normalizedQuestion,
      content: { question: suggestion.normalizedQuestion, answer },
      enabled: true
    },
    actorId,
    requestId
  );
  await prisma.faqSuggestion.update({
    where: { id: suggestionId },
    data: { status: "converted", suggestedAnswer: answer, version: { increment: 1 } }
  });
  await writeAuditLog({ clientId, actorId, action: "faq_suggestion.converted", target: suggestionId, requestId, metadata: { knowledge_entry_id: entry.id } });
  return entry;
}

export async function ignoreFaqSuggestion(clientId: string, suggestionId: string, actorId?: string, requestId?: string) {
  const updated = await prisma.faqSuggestion.updateMany({
    where: { id: suggestionId, clientId },
    data: { status: "ignored", version: { increment: 1 } }
  });
  if (!updated.count) {
    throw new AppError(404, "FAQ_SUGGESTION_NOT_FOUND", "FAQ suggestion was not found.");
  }
  await writeAuditLog({ clientId, actorId, action: "faq_suggestion.ignored", target: suggestionId, requestId });
}

export async function evaluateServiceArea(clientId: string, query: string) {
  const [config, rules] = await Promise.all([
    prisma.serviceAreaConfig.findUnique({ where: { clientId } }),
    prisma.serviceAreaRule.findMany({ where: { clientId, deletedAt: null, enabled: true } })
  ]);

  const normalizedQuery = query.trim().toLowerCase();
  const matched = rules.find((rule) => normalizedQuery.includes(rule.value.toLowerCase()) || normalizedQuery.includes(rule.label.toLowerCase()));
  const allowed = config?.enabled ? (config.mode === "allowlist" ? Boolean(matched) : !matched) : true;
  const result = await prisma.serviceAreaCheck.create({
    data: {
      id: newId(),
      clientId,
      query,
      result: allowed ? "supported" : "unsupported",
      matchedRuleId: matched?.id ?? null,
      payload: { matched_rule_label: matched?.label ?? null }
    }
  });
  return {
    allowed,
    message: allowed ? config?.successMessage ?? "This area appears to be supported." : config?.failureMessage ?? "This area is currently outside our service area.",
    check: result
  };
}

export async function calculateInstantQuote(clientId: string, values: Record<string, unknown>) {
  const [config, fields] = await Promise.all([
    prisma.quoteCalculatorConfig.findUnique({ where: { clientId } }),
    prisma.quoteCalculatorField.findMany({ where: { clientId, deletedAt: null }, orderBy: { sortOrder: "asc" } })
  ]);

  if (!config?.enabled) {
    throw new AppError(422, "QUOTE_DISABLED", "Quote calculator is disabled.");
  }

  let amount = config.baseAmount;
  for (const field of fields) {
    const rawValue = values[field.key];
    if (field.required && (rawValue === undefined || rawValue === null || rawValue === "")) {
      throw new AppError(422, "QUOTE_VALIDATION_ERROR", `${field.label} is required.`);
    }
    if (typeof rawValue === "number") {
      amount += rawValue * field.multiplier;
    } else if (typeof rawValue === "string" && rawValue.trim()) {
      amount += field.multiplier;
    } else if (rawValue === true) {
      amount += field.multiplier;
    }
  }

  return {
    amount: Number(amount.toFixed(2)),
    currency: config.currency ?? "USD",
    title: config.title,
    success_message: config.successMessage ?? "Estimated quote generated."
  };
}
