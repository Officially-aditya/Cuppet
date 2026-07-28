import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent } from "../agents/parser.js";
import {
  compileAgentDefinition,
  validateCompiledDefinition
} from "../agents/runtime/compiler.js";
import {
  parseAgentDefinitionV2
} from "../agents/runtime/definition.js";
import {
  accessRequirementsForConnectorIds
} from "./requirements.js";
import {
  accessCapabilityKey,
  type AccessProvider,
  providerSupportsRequirement,
} from "./types.js";
import {
  listAccessProviders,
  listNativeAccessProviders,
  listTrustedMcpProviders
} from "./provider-directory.js";

test("native connector requirements are provider-independent", () => {
  assert.deepEqual(accessRequirementsForConnectorIds(["gmail", "drive", "gmail"]), [
    {
      service: "mail",
      capabilities: ["read"],
      required: true,
      preferred_provider_ids: [],
      reason: "Gmail read access"
    },
    {
      service: "files",
      capabilities: ["read"],
      required: true,
      preferred_provider_ids: [],
      reason: "Google Drive file read access"
    }
  ]);
  assert.equal(accessCapabilityKey("Mail", "Read"), "mail.read");
});

test("provider capabilities satisfy every requested access capability", () => {
  const provider: AccessProvider = {
    providerId: "trusted.mail",
    kind: "mcp",
    displayName: "Trusted Mail",
    description: "Read mail",
    iconName: "Mail",
    category: "Communication",
    capabilities: ["mail.read", "mail.search"],
    authMethods: ["oauth2"],
    trusted: true
  };
  assert.equal(
    providerSupportsRequirement(provider, {
      service: "mail",
      capabilities: ["read", "search"],
      required: true,
      preferred_provider_ids: []
    }),
    true
  );
  assert.equal(
    providerSupportsRequirement(provider, {
      service: "mail",
      capabilities: ["write"],
      required: true,
      preferred_provider_ids: []
    }),
    false
  );
});

test("keeps native connectors and exposes the built-in Canva MCP provider", () => {
  assert.deepEqual(
    listNativeAccessProviders().map((provider) => provider.connectorId),
    ["gmail", "drive", "calendar", "github", "slack", "notion", "web_search"]
  );

  const canva = listTrustedMcpProviders().find(
    (provider) => provider.providerId === "mcp.canva"
  );
  assert.ok(canva);
  assert.equal(canva.kind, "mcp");
  assert.equal(canva.endpoint, "https://mcp.canva.com/mcp");
  assert.deepEqual(canva.capabilities, ["canva.read"]);
  assert.ok(listAccessProviders().some((provider) => provider.providerId === "native.gmail"));
  assert.ok(listAccessProviders().some((provider) => provider.providerId === "mcp.canva"));
});

test("schema version 2 keeps explicit access requirements without accepting extra fields", () => {
  const prompt = "Send me tech news every day";
  const base = compileAgentDefinition(parseIntent(prompt), prompt);
  const definition = parseAgentDefinitionV2({
    ...base,
    schema_version: 2,
    required_access: [
      {
        service: "web",
        capabilities: ["search"],
        required: true,
        preferred_provider_ids: ["native.web_search"]
      }
    ]
  });

  assert.equal(definition.schema_version, 2);
  assert.deepEqual(definition.required_access[0]?.capabilities, ["search"]);
  assert.equal(validateCompiledDefinition(definition).schema_version, 2);
  assert.throws(
    () => parseAgentDefinitionV2({ ...definition, unexpected: true }),
    /Unrecognized key|unknown/i
  );
});
