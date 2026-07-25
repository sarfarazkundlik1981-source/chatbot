import test from "node:test";
import assert from "node:assert/strict";
import { healthStatuses } from "@platform/contracts";
test("health statuses stay within the documented contract", () => {
    assert.deepEqual(healthStatuses, ["healthy", "warning", "critical"]);
});
