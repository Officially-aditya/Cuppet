import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedConnectorId, safePublicUrl } from "./action-safety.js";

test("capability actions accept native connector ids only", () => {
  assert.equal(isSupportedConnectorId("github"), true);
  assert.equal(isSupportedConnectorId("web_search"), false);
  assert.equal(isSupportedConnectorId("evil_connector"), false);
  assert.equal(isSupportedConnectorId("https://example.com"), false);
});

test("content actions accept public HTTPS URLs without embedded credentials", () => {
  assert.equal(safePublicUrl("https://example.com/article"), "https://example.com/article");
  assert.equal(safePublicUrl("http://example.com/article"), null);
  assert.equal(safePublicUrl("https://user:pass@example.com/article"), null);
  assert.equal(safePublicUrl("https://127.0.0.1/article"), null);
  assert.equal(safePublicUrl("https://example.com/article?access_token=secret"), null);
  assert.equal(safePublicUrl("not-a-url"), null);
});
