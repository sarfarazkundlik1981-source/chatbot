import test from "node:test";
import assert from "node:assert/strict";

import { compareVersions } from "../src/lib/versioning.js";

test("compareVersions handles semantic-style versions", () => {
  assert.equal(compareVersions("0.1.0", "0.1.0"), 0);
  assert.equal(compareVersions("0.2.0", "0.1.9"), 1);
  assert.equal(compareVersions("6.4", "6.5.0"), -1);
  assert.equal(compareVersions("v8.1", "8.1.0"), 0);
});
