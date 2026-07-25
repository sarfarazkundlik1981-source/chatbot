import { decryptValue } from "./crypto.js";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";
import { anonymizeIp, writeSecurityLog } from "./audit.js";

export type CaptchaProvider = "disabled" | "turnstile" | "recaptcha_v3";
export type CaptchaInteraction = "lead" | "callback" | "appointment" | "quote" | "chat";

type CaptchaVerificationInput = {
  clientId: string;
  interaction: CaptchaInteraction;
  token?: string;
  ip?: string;
};

type CaptchaConfigRecord = Awaited<ReturnType<typeof prisma.captchaConfig.findUnique>>;

function isProtected(config: NonNullable<CaptchaConfigRecord>, interaction: CaptchaInteraction): boolean {
  if (interaction === "lead") {
    return config.protectLead;
  }
  if (interaction === "callback") {
    return config.protectCallback;
  }
  if (interaction === "appointment") {
    return config.protectAppointment;
  }
  if (interaction === "quote") {
    return config.protectQuote;
  }
  return config.protectChat;
}

async function verifyTurnstile(secret: string, token: string, ip?: string): Promise<{ ok: boolean; score?: number; raw: unknown }> {
  const body = new URLSearchParams({
    secret,
    response: token
  });
  if (ip) {
    body.set("remoteip", ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = (await response.json()) as {
    success?: boolean;
    score?: number;
  };

  return {
    ok: Boolean(payload.success),
    score: typeof payload.score === "number" ? payload.score : undefined,
    raw: payload
  };
}

async function verifyRecaptchaV3(secret: string, token: string, ip?: string): Promise<{ ok: boolean; score?: number; raw: unknown }> {
  const body = new URLSearchParams({
    secret,
    response: token
  });
  if (ip) {
    body.set("remoteip", ip);
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = (await response.json()) as {
    success?: boolean;
    score?: number;
  };

  return {
    ok: Boolean(payload.success),
    score: typeof payload.score === "number" ? payload.score : undefined,
    raw: payload
  };
}

export async function verifyCaptchaForInteraction(input: CaptchaVerificationInput): Promise<void> {
  const config = await prisma.captchaConfig.findUnique({
    where: { clientId: input.clientId }
  });

  if (!config || config.provider === "disabled" || !isProtected(config, input.interaction)) {
    return;
  }

  if (!input.token) {
    throw new AppError(422, "CAPTCHA_REQUIRED", "Verification is required before submitting this form.");
  }

  if (!config.siteKey || !config.secretKeyEncrypted) {
    throw new AppError(503, "CAPTCHA_MISCONFIGURED", "This form is temporarily unavailable.");
  }

  const secret = decryptValue(config.secretKeyEncrypted);
  const result =
    config.provider === "turnstile"
      ? await verifyTurnstile(secret, input.token, input.ip)
      : await verifyRecaptchaV3(secret, input.token, input.ip);

  const minScore = config.minScore ?? 0.5;
  const passedScore = result.score === undefined || result.score >= minScore;

  await prisma.analyticsEvent.create({
    data: {
      clientId: input.clientId,
      eventType: result.ok && passedScore ? "captcha.verified" : "captcha.failed",
      payload: {
        interaction: input.interaction,
        provider: config.provider,
        score: result.score ?? null
      }
    }
  });

  await writeSecurityLog({
    clientId: input.clientId,
    source: result.ok && passedScore ? "captcha.verification_succeeded" : "captcha.verification_failed",
    severity: result.ok && passedScore ? "info" : "warning",
    payload: {
      provider: config.provider,
      interaction: input.interaction,
      score: result.score ?? null,
      min_score: minScore,
      ip_hash: anonymizeIp(input.ip ?? null)
    }
  });

  if (!result.ok || !passedScore) {
    throw new AppError(422, "CAPTCHA_FAILED", "Verification failed. Please try again.");
  }
}
