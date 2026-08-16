import assert from "node:assert/strict";
import test from "node:test";
import { customMcpProviderInputSchema } from "./custom-providers.js";
import { assertSafeRemoteMcpUrl } from "../mcp/security.js";
import { isReadOnlyMcpTool } from "../mcp/client.js";
import { readOnlyMcpScopes } from "../mcp/discovery.js";

test("custom MCP provider input defaults to OAuth-only read access", () => {
  const parsed = customMcpProviderInputSchema.parse({
    name: "Linear workspace",
    endpoint: "https://mcp.example.com/mcp",
    capabilities: ["linear.read", "linear.search"]
  });

  assert.equal(parsed.icon_name, "Extension");
  assert.equal(parsed.category, "CUSTOM MCP");
  assert.deepEqual(parsed.oauth_scopes, []);
  assert.deepEqual(parsed.capabilities, ["linear.read", "linear.search"]);
});

test("custom MCP provider input rejects credentials and write-oriented metadata", () => {
  assert.throws(
    () =>
      customMcpProviderInputSchema.parse({
        name: "Unsafe provider",
        endpoint: "https://mcp.example.com/mcp",
        capabilities: ["linear.write"]
      }),
    /read-only|Invalid/i
  );

  assert.throws(
    () =>
      customMcpProviderInputSchema.parse({
        name: "Provider",
        endpoint: "https://mcp.example.com/mcp",
        capabilities: ["provider.read"],
        api_key: "must-not-be-accepted"
      }),
    /Unrecognized key|unknown/i
  );

  assert.throws(
    () =>
      customMcpProviderInputSchema.parse({
        name: "Provider",
        endpoint: "https://mcp.example.com/mcp",
        capabilities: ["provider.read"],
        oauth_scopes: ["provider:write"]
      }),
    /read-only/i
  );
});

test("discovered MCP OAuth scopes exclude obvious write permissions", () => {
  assert.deepEqual(
    readOnlyMcpScopes([
      "profile:read",
      "design:content:write",
      "folder:read",
      "comment:write",
      "mcp"
    ]),
    ["profile:read", "folder:read", "mcp"]
  );
});

test("custom MCP endpoint validation requires public HTTPS", () => {
  assert.throws(
    () => assertSafeRemoteMcpUrl("http://mcp.example.com/mcp"),
    /HTTPS/i
  );
  assert.throws(
    () => assertSafeRemoteMcpUrl("https://127.0.0.1/mcp"),
    /private|local/i
  );
});

test("custom MCP tools are limited to read-only names or read-only annotations", () => {
  assert.equal(isReadOnlyMcpTool({ name: "list_projects" }), true);
  assert.equal(
    isReadOnlyMcpTool({ name: "custom_operation", annotations: { readOnlyHint: true } }),
    true
  );
  assert.equal(isReadOnlyMcpTool({ name: "update_project" }), false);
  assert.equal(isReadOnlyMcpTool({ name: "send_message" }), false);
});
