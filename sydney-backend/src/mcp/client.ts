import { fetchRemoteMcp } from "./security.js";

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export type McpResource = {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
};

export type McpServerInfo = {
  protocolVersion?: string;
  serverInfo?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
};

export class McpHttpClient {
  private sessionId: string | undefined;
  private protocolVersion: string | undefined;
  private requestId = 0;

  constructor(
    private readonly input: {
      endpoint: string;
      accessToken: string;
      allowedTools?: string[];
    }
  ) {}

  async initialize(): Promise<McpServerInfo> {
    const result = await this.rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "Cuppet", version: "0.1.0" }
    });
    if (isRecord(result) && typeof result.protocolVersion === "string") {
      this.protocolVersion = result.protocolVersion;
    }
    await this.notify("notifications/initialized", {});
    return result as McpServerInfo;
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.rpc("tools/list", {});
    const tools = (result as { tools?: unknown }).tools;
    if (!Array.isArray(tools)) return [];
    return tools.flatMap((tool) => {
      if (!tool || typeof tool !== "object") return [];
      const value = tool as Record<string, unknown>;
      if (typeof value.name !== "string") return [];
      return [{
        name: value.name,
        ...(typeof value.description === "string" ? { description: value.description } : {}),
        ...(isRecord(value.inputSchema) ? { inputSchema: value.inputSchema } : {}),
        ...(isRecord(value.annotations) ? { annotations: value.annotations } : {})
      }];
    });
  }

  async listResources(): Promise<McpResource[]> {
    const result = await this.rpc("resources/list", {});
    const resources = (result as { resources?: unknown }).resources;
    if (!Array.isArray(resources)) return [];
    return resources.flatMap((resource) => {
      if (!resource || typeof resource !== "object") return [];
      const value = resource as Record<string, unknown>;
      if (typeof value.uri !== "string") return [];
      return [{
        uri: value.uri,
        ...(typeof value.name === "string" ? { name: value.name } : {}),
        ...(typeof value.description === "string" ? { description: value.description } : {}),
        ...(typeof value.mimeType === "string" ? { mimeType: value.mimeType } : {})
      }];
    });
  }

  async callTool(
    name: string,
    argumentsValue: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    const tools = await this.listTools();
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool || !this.isAllowedTool(tool)) {
      throw new Error("MCP tool is not approved for read access.");
    }
    const result = await this.rpc("tools/call", {
      name,
      arguments: argumentsValue
    });
    return isRecord(result) ? result : {};
  }

  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    await this.post({ jsonrpc: "2.0", method, params });
  }

  private async rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const response = await this.post({
      jsonrpc: "2.0",
      id,
      method,
      params
    });
    if (response.error && isRecord(response.error)) {
      throw new Error(String(response.error.message ?? `MCP request failed: ${method}`));
    }
    return response.result;
  }

  private async post(payload: Record<string, unknown>): Promise<JsonRpcResponse> {
    const headers: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.input.accessToken}`
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    if (this.protocolVersion) headers["MCP-Protocol-Version"] = this.protocolVersion;
    const { response, body } = await fetchRemoteMcp(this.input.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const sessionId = response.headers.get("mcp-session-id");
    if (sessionId) this.sessionId = sessionId;
    if (response.status === 401) throw new Error("mcp_auth_required");
    if (!response.ok) throw new Error(`mcp_http_${response.status}`);
    if (!body.trim()) return {};
    return parseJsonRpcBody(body);
  }

  private isAllowedTool(tool: McpTool): boolean {
    if (!this.input.allowedTools?.length || !this.input.allowedTools.includes(tool.name)) {
      return false;
    }
    if (/(create|delete|destroy|update|write|send|post|put|patch|remove|execute|run|invite|grant|revoke)/i.test(tool.name)) {
      return false;
    }
    if (tool.annotations?.readOnlyHint === true) return true;
    return /^(get|list|search|read|fetch|query|find|lookup|retrieve|describe|inspect)(?:$|[_.:-])/i.test(tool.name);
  }
}

export function parseJsonRpcBody(body: string): JsonRpcResponse {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as JsonRpcResponse;
  const events = trimmed
    .split(/\r?\n\r?\n/)
    .flatMap((event) => event.split(/\r?\n/))
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((value) => value && value !== "[DONE]");
  const last = events.at(-1);
  if (!last) throw new Error("MCP response did not contain JSON-RPC data.");
  return JSON.parse(last) as JsonRpcResponse;
}

export type JsonRpcResponse = {
  result?: unknown;
  error?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
