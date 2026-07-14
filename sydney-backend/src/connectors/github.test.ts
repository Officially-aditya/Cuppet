import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubAppInstallUrl,
  parseGitHubCallbackUrl
} from "./github.js";

test("builds the GitHub App repository approval URL", () => {
  const url = buildGitHubAppInstallUrl("cuppet", "signed-state");
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/apps/cuppet/installations/new");
  assert.equal(url.searchParams.get("state"), "signed-state");
});

test("rejects an invalid GitHub App slug", () => {
  assert.throws(
    () => buildGitHubAppInstallUrl("https://malicious.example", "state"),
    /invalid_github_app_slug/
  );
});

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
