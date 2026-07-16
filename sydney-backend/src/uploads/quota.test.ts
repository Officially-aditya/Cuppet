import assert from "node:assert/strict";
import test from "node:test";
import { uploadQuotaExceeded } from "./quota.js";

const limits = { maxFiles: 40, maxBytes: 250 * 1024 * 1024 };

test("allows a temporary upload at the rolling quota boundary", () => {
  assert.equal(
    uploadQuotaExceeded(
      { activeFiles: 39, activeBytes: limits.maxBytes - 1024 },
      1024,
      limits
    ),
    false
  );
});

test("rejects temporary uploads beyond either rolling quota", () => {
  assert.equal(
    uploadQuotaExceeded({ activeFiles: 40, activeBytes: 0 }, 1, limits),
    true
  );
  assert.equal(
    uploadQuotaExceeded({ activeFiles: 0, activeBytes: limits.maxBytes }, 1, limits),
    true
  );
});
