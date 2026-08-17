import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  callbackResponse,
  callbackSchemeForRequest,
  oauthCallbackRedirect,
  oauthCallbackRequestSchema,
  sanitizeSupportedCallbackScheme
} from "./oauth-callback.js";

describe("OAuth callback policy", () => {
  it("keeps native callback schemes backwards compatible", () => {
    assert.equal(callbackSchemeForRequest({ callbackScheme: "sydney" }), "sydney");
    assert.deepEqual(callbackResponse("sydney"), { callbackScheme: "sydney" });
    assert.equal(sanitizeSupportedCallbackScheme("sydney"), "sydney");
  });

  it("rejects ambiguous and untrusted web callbacks", () => {
    assert.equal(
      oauthCallbackRequestSchema.safeParse({
        callbackScheme: "sydney",
        callbackUrl: "https://attacker.example/oauth/callback"
      }).success,
      false
    );
    assert.equal(
      oauthCallbackRequestSchema.safeParse({
        callbackUrl: "https://attacker.example/oauth/callback"
      }).success,
      false
    );
  });

  it("builds the expected native redirect shape", () => {
    const redirect = oauthCallbackRedirect({
      callbackScheme: "sydney",
      nativePath: "connectors/github",
      flow: "connector",
      params: { connector_id: "github", status: "connected" }
    });
    assert.equal(redirect.protocol, "sydney:");
    assert.equal(redirect.hostname, "connectors");
    assert.equal(redirect.pathname, "/github");
    assert.equal(redirect.searchParams.get("status"), "connected");
  });
});
