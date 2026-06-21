import assert from "node:assert/strict";
import test from "node:test";
import { parseGitHubCallbackUrl } from "./github.js";

test("accepts the mobile GitHub connector callback", () => {
  const parsed = parseGitHubCallbackUrl(
    "sydney://connectors/github?connector_id=github&status=connected"
  );

  assert.equal(parsed.connectorId, "github");
  assert.equal(parsed.error, undefined);
});

test("rejects callbacks for another connector path", () => {
  assert.throws(
    () =>
      parseGitHubCallbackUrl(
        "sydney://connectors/google?connector_id=github&status=connected"
      ),
    /Invalid GitHub connector callback URL/
  );
});
