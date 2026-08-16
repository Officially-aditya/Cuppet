import assert from "node:assert/strict";
import test from "node:test";
import { validateTokenBinding } from "../access/oauth.js";
import { cimdClientMetadata } from "./cimd.js";
import { parseJsonRpcBody } from "./client.js";
import { assertSafeRemoteMcpUrl } from "./security.js";

test("CIMD metadata advertises the stable client identity and backend callback", () => {
  const metadata = cimdClientMetadata();
  assert.equal(
    metadata.client_id,
    "https://connect.cuppet.in/.well-known/oauth-client.json"
  );
  assert.deepEqual(metadata.response_types, ["code"]);
  assert.equal(metadata.token_endpoint_auth_method, "none");
  assert.deepEqual(metadata.redirect_uris, ["http://localhost:3000/access/oauth/callback"]);
});

test("MCP remote URLs require HTTPS and reject local targets", () => {
  assert.equal(
    assertSafeRemoteMcpUrl("https://mcp.example.com/server").hostname,
    "mcp.example.com"
  );
  assert.throws(
    () => assertSafeRemoteMcpUrl("http://mcp.example.com/server"),
    /HTTPS/
  );
  assert.throws(
    () => assertSafeRemoteMcpUrl("https://127.0.0.1/server"),
    /private or local/
  );
  assert.throws(
    () => assertSafeRemoteMcpUrl("https://user:pass@mcp.example.com/server"),
    /credentials/
  );
});

test("MCP client accepts JSON and server-sent JSON-RPC responses", () => {
  assert.deepEqual(parseJsonRpcBody('{"jsonrpc":"2.0","result":{"ok":true}}'), {
    jsonrpc: "2.0",
    result: { ok: true }
  });
  assert.deepEqual(
    parseJsonRpcBody(
      "event: message\ndata: {\"jsonrpc\":\"2.0\",\"result\":{\"ok\":true}}\n\n"
    ),
    { jsonrpc: "2.0", result: { ok: true } }
  );
});

test("MCP OAuth token bindings reject issuer and resource substitution", () => {
  assert.doesNotThrow(() =>
    validateTokenBinding(
      {
        issuer: "https://login.example.com/issuer",
        resource: "https://mcp.example.com/server"
      },
      {
        iss: "https://login.example.com/issuer/",
        resource: "https://mcp.example.com/server"
      }
    )
  );
  assert.throws(
    () =>
      validateTokenBinding(
        { issuer: "https://login.example.com/issuer" },
        { iss: "https://login.example.com/other" }
      ),
    /issuer_mismatch/
  );
  assert.throws(
    () =>
      validateTokenBinding(
        { resource: "https://mcp.example.com/server" },
        { resource: "https://mcp.example.com/other" }
      ),
    /resource_mismatch/
  );
});
