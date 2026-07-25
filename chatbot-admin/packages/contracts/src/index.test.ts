import test from "node:test";
import assert from "node:assert/strict";

import {
  clientRoles,
  healthStatuses,
  knowledgeEntryTypes,
  licenseStatuses,
  logTypes,
  platformRoles,
  pluginCompatibilityStatuses
} from "./index.js";

test("contracts export documented enum-like values", () => {
  assert.deepEqual(healthStatuses, ["healthy", "warning", "critical"]);
  assert.deepEqual(clientRoles, ["owner", "admin", "editor", "viewer", "support"]);
  assert.deepEqual(platformRoles, ["platform_owner", "platform_admin"]);
  assert.deepEqual(licenseStatuses, ["trial", "active", "expired", "suspended", "cancelled"]);
  assert.deepEqual(knowledgeEntryTypes, ["company", "services", "pricing", "faq", "team", "hours", "locations", "contact", "policies"]);
  assert.deepEqual(logTypes, ["API", "ERROR", "AUDIT", "EMAIL", "SECURITY"]);
  assert.deepEqual(pluginCompatibilityStatuses, ["compatible", "update_recommended", "update_required", "unsupported_environment"]);
});
