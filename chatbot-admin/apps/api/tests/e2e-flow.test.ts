import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.E2E_API_BASE_URL;
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? "owner@example.com";
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? "change-me-now";

type JsonEnvelope = {
  success: boolean;
  data: any;
  error?: { code?: string; message?: string };
};

async function jsonFetch(path: string, init?: RequestInit): Promise<JsonEnvelope> {
  if (!baseUrl) {
    throw new Error("E2E_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json()) as JsonEnvelope;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? `Request failed for ${path}`);
  }

  return payload;
}

test("full client onboarding and lead lifecycle flow", { skip: !baseUrl }, async () => {
  const suffix = randomUUID().slice(0, 8);
  const domain = `client-${suffix}.example.com`;
  const pluginSecret = `plugin-secret-${suffix}-123`;

  const login = await jsonFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: ownerEmail,
      password: ownerPassword
    })
  });

  const ownerToken = login.data.access_token as string;
  assert.ok(ownerToken);

  const client = await jsonFetch("/platform/clients", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      name: `E2E Client ${suffix}`,
      domain,
      plugin_secret: pluginSecret
    })
  });

  const clientId = client.data.id as string;
  assert.ok(clientId);

  const verify = await jsonFetch("/plugin/verify", {
    method: "POST",
    headers: {
      "Idempotency-Key": `verify-${suffix}`
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: pluginSecret,
      domain,
      plugin_version: "0.1.0",
      wordpress_version: "6.5.0",
      php_version: "8.1.0",
      elementor_version: "3.25.0"
    })
  });

  const pluginToken = verify.data.token as string;
  assert.ok(pluginToken);

  const session = await jsonFetch("/plugin/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pluginToken}`
    }
  });

  const conversationId = session.data.conversation_id as string;
  assert.ok(conversationId);

  const chat = await jsonFetch("/plugin/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pluginToken}`
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      message: "I need pricing and a call back. My name is Jane."
    })
  });

  assert.equal(typeof chat.data.message, "string");

  const lead = await jsonFetch("/plugin/lead", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pluginToken}`,
      "Idempotency-Key": `lead-${suffix}`
    },
    body: JSON.stringify({
      name: "Jane Example",
      email: `jane-${suffix}@example.com`,
      phone: "+15551234567",
      data: {
        source: "e2e"
      }
    })
  });

  assert.ok(lead.data.id);

  const settingsBefore = await jsonFetch(`/clients/${clientId}/settings`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`
    }
  });

  await jsonFetch(`/clients/${clientId}/settings`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      ...settingsBefore.data,
      timezone: "Asia/Calcutta"
    })
  });

  const versions = await jsonFetch(`/clients/${clientId}/config-versions`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`
    }
  });

  assert.ok(Array.isArray(versions.data));
  assert.ok(versions.data.length >= 1);

  const earliestVersion = versions.data[versions.data.length - 1];
  await jsonFetch(`/clients/${clientId}/config-versions/${earliestVersion.versionNumber}/rollback`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`
    }
  });

  const leadsResponse = await fetch(`${baseUrl}/clients/${clientId}/exports/leads.csv`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`
    }
  });
  const leadsCsv = await leadsResponse.text();
  assert.equal(leadsResponse.status, 200);
  assert.match(leadsCsv, /Jane Example/);
});
