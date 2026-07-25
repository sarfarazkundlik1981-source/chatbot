import test from "node:test";
import assert from "node:assert/strict";

import { evaluateCompatibility } from "../src/lib/compatibility.js";

test("evaluateCompatibility reports required updates and unsupported environments", () => {
  assert.equal(
    evaluateCompatibility({
      pluginVersion: "0.0.1",
      wordpressVersion: "6.5.0",
      phpVersion: "8.1.0"
    }).status,
    "update_required"
  );

  assert.equal(
    evaluateCompatibility({
      pluginVersion: "0.1.0",
      wordpressVersion: "6.0.0",
      phpVersion: "8.1.0"
    }).status,
    "unsupported_environment"
  );
});
