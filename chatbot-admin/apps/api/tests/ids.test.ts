import test from "node:test";
import assert from "node:assert/strict";

import { newId } from "../src/lib/ids.js";

test("newId returns unique UUID-like identifiers", () => {
  const first = newId();
  const second = newId();

  assert.notEqual(first, second);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.match(second, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
