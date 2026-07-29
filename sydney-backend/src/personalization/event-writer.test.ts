import assert from "node:assert/strict";
import test from "node:test";
import { isSafeSubjectKey, normalizeSubjectKey } from "./subject-safety.js";

test("preference subjects stay category-like and exclude private prose", () => {
  assert.equal(isSafeSubjectKey("developer_tools"), true);
  assert.equal(isSafeSubjectKey("The New York Times"), true);
  assert.equal(isSafeSubjectKey("person@example.com"), false);
  assert.equal(isSafeSubjectKey("https://example.com/private"), false);
  assert.equal(isSafeSubjectKey("password reset code"), false);
  assert.equal(normalizeSubjectKey("Developer tools!"), "developer_tools");
});
