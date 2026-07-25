import test from "node:test";
import assert from "node:assert/strict";

import { clearFieldError, parseJsonInput } from "./feature-form-utils";

test("parseJsonInput returns parsed values for valid JSON", () => {
  const parsed = parseJsonInput<{ answer: string }>("{\"answer\":\"ok\"}", "Knowledge content");

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.value, { answer: "ok" });
  }
});

test("parseJsonInput returns a field-specific error for invalid JSON", () => {
  const parsed = parseJsonInput("{invalid", "Business hours schedule");

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.match(parsed.error, /Business hours schedule must be valid JSON/i);
  }
});

test("clearFieldError removes only the requested key", () => {
  const cleared = clearFieldError(
    {
      business_hours_schedule: "Bad JSON",
      quote_field_options: "Also bad"
    },
    "business_hours_schedule"
  );

  assert.deepEqual(cleared, { quote_field_options: "Also bad" });
});
