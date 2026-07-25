import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../src/lib/prisma.js";
import { AppError } from "../src/lib/errors.js";
import { resumePluginSession } from "../src/services/plugin-service.js";

function replaceMethod<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("plugin heartbeat requires authentication", async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/chatbot";
  const { createApp } = await import("../src/app.js");
  const app = createApp();
  const server = app.listen(0);

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Server did not expose a numeric port.");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/plugin/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "client-1",
        domain: "example.com",
        plugin_version: "1.0.0"
      })
    });

    const payload = (await response.json()) as any;
    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "UNAUTHENTICATED");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("resumePluginSession resumes only the conversation attached to the resume token", async () => {
  const conversation = {
    id: "conversation-1",
    clientId: "client-1",
    domain: "example.com",
    status: "active",
    startedAt: new Date(Date.now() - 60 * 60 * 1000),
    lastSeenAt: new Date()
  };

  const restoreProfile = replaceMethod(prisma.visitorProfile, "findFirst", (async () => ({
    id: "conversation-1",
    clientId: "client-1",
    resumeTokenHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date()
  })) as unknown as typeof prisma.visitorProfile.findFirst);
  const restoreConversationFind = replaceMethod(prisma.conversation, "findFirst", (async () => conversation) as unknown as typeof prisma.conversation.findFirst);
  const restoreProfileUpdate = replaceMethod(prisma.visitorProfile, "updateMany", (async () => ({
    count: 1
  })) as unknown as typeof prisma.visitorProfile.updateMany);
  const restoreConversationUpdate = replaceMethod(prisma.conversation, "update", (async () => conversation) as unknown as typeof prisma.conversation.update);
  const restoreTransaction = replaceMethod(prisma, "$transaction", (async (operations: Array<Promise<unknown>>) => Promise.all(operations)) as unknown as typeof prisma.$transaction);

  try {
    const result = await resumePluginSession("client-1", "resume-token");
    assert.equal(result.resumed, true);
    assert.equal(result.conversation_id, "conversation-1");
  } finally {
    restoreProfile();
    restoreConversationFind();
    restoreProfileUpdate();
    restoreConversationUpdate();
    restoreTransaction();
  }
});

test("resumePluginSession rejects expired conversations even when the resume token exists", async () => {
  const restoreProfile = replaceMethod(prisma.visitorProfile, "findFirst", (async () => ({
    id: "conversation-1",
    clientId: "client-1",
    resumeTokenHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date()
  })) as unknown as typeof prisma.visitorProfile.findFirst);
  const restoreConversationFind = replaceMethod(prisma.conversation, "findFirst", (async () => null) as unknown as typeof prisma.conversation.findFirst);

  try {
    await assert.rejects(() => resumePluginSession("client-1", "resume-token"), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "RESUME_NOT_FOUND");
      return true;
    });
  } finally {
    restoreProfile();
    restoreConversationFind();
  }
});
