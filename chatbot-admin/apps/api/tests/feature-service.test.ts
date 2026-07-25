import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import { calculateInstantQuote, evaluateServiceArea } from "../src/services/feature-service.js";

function replaceMethod<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("evaluateServiceArea allows matching allowlist rules and records a supported check", async () => {
  const restoreConfig = replaceMethod(prisma.serviceAreaConfig, "findUnique", (async () => ({
    id: "cfg-1",
    clientId: "client-1",
    enabled: true,
    mode: "allowlist",
    inputLabel: "ZIP",
    successMessage: "Covered area",
    failureMessage: "Not covered",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  })) as unknown as typeof prisma.serviceAreaConfig.findUnique);
  const restoreRules = replaceMethod(prisma.serviceAreaRule, "findMany", (async () => [
    {
      id: "rule-1",
      clientId: "client-1",
      ruleType: "city",
      label: "Austin",
      value: "austin",
      enabled: true,
      version: 1,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]) as typeof prisma.serviceAreaRule.findMany);
  const restoreCreate = replaceMethod(prisma.serviceAreaCheck, "create", (async ({ data }: any) => ({
    ...data,
    createdAt: new Date()
  })) as typeof prisma.serviceAreaCheck.create);

  try {
    const result = await evaluateServiceArea("client-1", "Austin, TX");
    assert.equal(result.allowed, true);
    assert.equal(result.message, "Covered area");
    assert.equal(result.check.result, "supported");
  } finally {
    restoreConfig();
    restoreRules();
    restoreCreate();
  }
});

test("evaluateServiceArea blocks non-matching allowlist rules", async () => {
  const restoreConfig = replaceMethod(prisma.serviceAreaConfig, "findUnique", (async () => ({
    id: "cfg-1",
    clientId: "client-1",
    enabled: true,
    mode: "allowlist",
    inputLabel: null,
    successMessage: "Covered",
    failureMessage: "Outside area",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  })) as unknown as typeof prisma.serviceAreaConfig.findUnique);
  const restoreRules = replaceMethod(prisma.serviceAreaRule, "findMany", (async () => [
    {
      id: "rule-1",
      clientId: "client-1",
      ruleType: "zip",
      label: "10001",
      value: "10001",
      enabled: true,
      version: 1,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]) as typeof prisma.serviceAreaRule.findMany);
  const restoreCreate = replaceMethod(prisma.serviceAreaCheck, "create", (async ({ data }: any) => ({
    ...data,
    createdAt: new Date()
  })) as typeof prisma.serviceAreaCheck.create);

  try {
    const result = await evaluateServiceArea("client-1", "30301");
    assert.equal(result.allowed, false);
    assert.equal(result.message, "Outside area");
    assert.equal(result.check.result, "unsupported");
  } finally {
    restoreConfig();
    restoreRules();
    restoreCreate();
  }
});

test("calculateInstantQuote combines base amount and field multipliers", async () => {
  const restoreConfig = replaceMethod(prisma.quoteCalculatorConfig, "findUnique", (async () => ({
    id: "quote-1",
    clientId: "client-1",
    enabled: true,
    title: "Instant Quote",
    description: null,
    successMessage: "Quote ready",
    baseAmount: 100,
    currency: "USD",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  })) as unknown as typeof prisma.quoteCalculatorConfig.findUnique);
  const restoreFields = replaceMethod(prisma.quoteCalculatorField, "findMany", (async () => [
    {
      id: "field-1",
      clientId: "client-1",
      key: "rooms",
      label: "Rooms",
      fieldType: "number",
      required: true,
      options: null,
      multiplier: 25,
      sortOrder: 0,
      version: 1,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "field-2",
      clientId: "client-1",
      key: "deep_clean",
      label: "Deep Clean",
      fieldType: "checkbox",
      required: false,
      options: null,
      multiplier: 50,
      sortOrder: 1,
      version: 1,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]) as typeof prisma.quoteCalculatorField.findMany);

  try {
    const result = await calculateInstantQuote("client-1", {
      rooms: 3,
      deep_clean: true
    });
    assert.equal(result.amount, 225);
    assert.equal(result.currency, "USD");
    assert.equal(result.success_message, "Quote ready");
  } finally {
    restoreConfig();
    restoreFields();
  }
});

test("calculateInstantQuote rejects missing required fields", async () => {
  const restoreConfig = replaceMethod(prisma.quoteCalculatorConfig, "findUnique", (async () => ({
    id: "quote-1",
    clientId: "client-1",
    enabled: true,
    title: "Instant Quote",
    description: null,
    successMessage: null,
    baseAmount: 100,
    currency: "USD",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  })) as unknown as typeof prisma.quoteCalculatorConfig.findUnique);
  const restoreFields = replaceMethod(prisma.quoteCalculatorField, "findMany", (async () => [
    {
      id: "field-1",
      clientId: "client-1",
      key: "postcode",
      label: "Postcode",
      fieldType: "text",
      required: true,
      options: null,
      multiplier: 10,
      sortOrder: 0,
      version: 1,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]) as typeof prisma.quoteCalculatorField.findMany);

  try {
    await assert.rejects(() => calculateInstantQuote("client-1", {}), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "QUOTE_VALIDATION_ERROR");
      return true;
    });
  } finally {
    restoreConfig();
    restoreFields();
  }
});
