import test from "node:test";
import assert from "node:assert/strict";

import {
  clearFieldError,
  defaultBusinessSchedule,
  formatBusinessSchedule,
  formatCtaLines,
  formatKeyValueLines,
  formatStringList,
  parseCtaLines,
  parseKeyValueLines,
  parseStringList,
  serializeBusinessSchedule
} from "./feature-form-utils";

test("formatStringList and parseStringList convert list fields without raw JSON", () => {
  assert.equal(formatStringList(["name", "phone"]), "name\nphone");
  assert.deepEqual(parseStringList("name, phone\nemail"), ["name", "phone", "email"]);
});

test("business schedule helpers preserve weekday hours", () => {
  const form = formatBusinessSchedule({
    mon: { open: "10:00", close: "18:00" },
    sun: { closed: true }
  });

  assert.equal(form.mon.open, "10:00");
  assert.equal(form.sun.closed, true);
  assert.deepEqual(serializeBusinessSchedule(form).sun, { closed: true });
});

test("defaultBusinessSchedule marks weekends closed", () => {
  const schedule = defaultBusinessSchedule();

  assert.equal(schedule.mon.closed, false);
  assert.equal(schedule.sun.closed, true);
});

test("CTA line helpers convert label URL kind rows", () => {
  const rows = parseCtaLines("Call us | tel:+15551234567 | call\nBook | https://example.com | booking");

  assert.deepEqual(rows, [
    { label: "Call us", url: "tel:+15551234567", kind: "call" },
    { label: "Book", url: "https://example.com", kind: "booking" }
  ]);
  assert.equal(formatCtaLines(rows), "Call us | tel:+15551234567 | call\nBook | https://example.com | booking");
});

test("key value helpers convert scoring rules", () => {
  const parsed = parseKeyValueLines("budget = 5\nurgent = high");

  assert.deepEqual(parsed, { budget: 5, urgent: "high" });
  assert.equal(formatKeyValueLines(parsed), "budget = 5\nurgent = high");
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
