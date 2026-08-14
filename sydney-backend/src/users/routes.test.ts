import assert from "node:assert/strict";
import test from "node:test";
import { updateUserSchema } from "./schemas.js";

test("accepts numbered profile avatars", () => {
  assert.deepEqual(updateUserSchema.parse({ avatar: 1 }), { avatar: 1 });
  assert.deepEqual(updateUserSchema.parse({ avatar: 9 }), { avatar: 9 });
});

test("rejects avatar numbers outside the available set", () => {
  for (const avatar of [0, 10, 1.5, "3"]) {
    assert.equal(updateUserSchema.safeParse({ avatar }).success, false);
  }
});
