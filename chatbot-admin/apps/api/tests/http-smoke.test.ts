import test from "node:test";
import assert from "node:assert/strict";

type HealthComponent = {
  name: string;
  status: string;
  message: string;
};

test("health and not-found routes return standardized envelopes", async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/chatbot";
  const { createApp } = await import("../src/app.js");
  const app = createApp();
  const server = app.listen(0);

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Server did not expose a numeric port.");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/api/v1/health`);
    const healthPayload = (await healthResponse.json()) as any;
    assert.equal(healthResponse.status, 200);
    assert.equal(healthPayload.success, true);
    assert.ok(healthPayload.data);
    assert.ok(healthPayload.request_id);
    assert.ok(Array.isArray(healthPayload.data.components));
    const componentMap = new Map<string, HealthComponent>(
      healthPayload.data.components.map((component: HealthComponent) => [component.name, component])
    );
    assert.equal(componentMap.has("license_subsystem"), true);
    assert.equal(componentMap.has("scheduled_jobs"), true);
    assert.notEqual(componentMap.get("license_subsystem")?.message, "License engine stub.");
    assert.notEqual(componentMap.get("openrouter")?.message, "Provider reachability check not implemented yet.");

    const missingResponse = await fetch(`${baseUrl}/api/v1/health/does-not-exist`);
    const missingPayload = (await missingResponse.json()) as any;
    assert.equal(missingResponse.status, 401);
    assert.equal(missingPayload.success, false);
    assert.equal(missingPayload.error.code, "UNAUTHENTICATED");
    assert.ok(missingPayload.request_id);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
