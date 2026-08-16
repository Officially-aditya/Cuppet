import { config } from "../config.js";
import {
  type AccessAuthMethod,
  type AccessProvider
} from "./types.js";
import {
  findCustomMcpProvider,
  listCustomMcpProviders
} from "./custom-providers.js";

const nativeProviders: AccessProvider[] = [
  native("native.gmail", "Gmail", "Read approved Gmail context and prepare summaries", "Mail", "EMAIL & COMMUNICATION", "gmail", ["mail.read"]),
  native("native.drive", "Google Drive", "Read selected files and summarize documents", "HardDrive", "PRODUCTIVITY & DOCS", "drive", ["files.read"]),
  native("native.calendar", "Google Calendar", "Read upcoming events and prepare agenda summaries", "Calendar", "CALENDAR & SCHEDULING", "calendar", ["calendar.read"]),
  native("native.github", "GitHub", "Monitor repositories, issues, and pull requests", "Github", "DEVELOPER TOOLS", "github", ["code.read"]),
  native("native.slack", "Slack", "Read selected channels and prepare updates", "MessageSquare", "EMAIL & COMMUNICATION", "slack", ["chat.read"]),
  native("native.notion", "Notion", "Read selected workspace pages and summarize changes", "BookOpen", "PRODUCTIVITY & DOCS", "notion", ["docs.read"]),
  {
    providerId: "native.web_search",
    kind: "native",
    displayName: "Web Search",
    description: "Search the public web without a user login",
    iconName: "search",
    category: "WEB & RESEARCH",
    capabilities: ["web.search"],
    authMethods: ["none"],
    trusted: true,
    connectorId: "web_search"
  }
];

const builtInTrustedMcpProviders: AccessProvider[] = [
  {
    providerId: "mcp.canva",
    kind: "mcp",
    displayName: "Canva",
    description: "Search and read approved Canva designs, assets, and folders",
    iconName: "Palette",
    category: "DESIGN & CREATIVE",
    capabilities: ["canva.read"],
    authMethods: ["oauth2"],
    trusted: true,
    endpoint: "https://mcp.canva.com/mcp",
    allowedTools: [
      "get-assets",
      "get-design",
      "get-design-content",
      "get-design-pages",
      "get-design-thumbnail",
      "get-export-formats",
      "get-presenter-notes",
      "list-brand-kits",
      "list-comments",
      "list-folder-items",
      "list-replies",
      "resolve-shortlink",
      "search-brand-templates",
      "search-designs",
      "search-folders"
    ]
  }
];

const mcpProviderSchema = {
  provider_id: (value: unknown) => typeof value === "string" && /^[a-z][a-z0-9_.:-]{1,119}$/i.test(value),
  name: (value: unknown) => typeof value === "string" && value.trim().length > 0,
  description: (value: unknown) => typeof value === "string",
  icon_name: (value: unknown) => typeof value === "string" && value.trim().length > 0,
  category: (value: unknown) => typeof value === "string" && value.trim().length > 0,
  endpoint: (value: unknown) => typeof value === "string" && /^https:\/\//i.test(value),
  capabilities: (value: unknown) => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0),
  allowed_tools: (value: unknown) => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0),
  oauth_scopes: (value: unknown) => value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string")),
  authorization_endpoint: (value: unknown) => value === undefined || (typeof value === "string" && /^https:\/\//i.test(value)),
  token_endpoint: (value: unknown) => value === undefined || (typeof value === "string" && /^https:\/\//i.test(value)),
  issuer: (value: unknown) => value === undefined || (typeof value === "string" && /^https:\/\//i.test(value)),
  resource: (value: unknown) => value === undefined || (typeof value === "string" && /^https:\/\//i.test(value))
};

export function listNativeAccessProviders(): readonly AccessProvider[] {
  return nativeProviders;
}

export function listTrustedMcpProviders(): AccessProvider[] {
  const raw = config.MCP_TRUSTED_PROVIDER_DIRECTORY;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  const configured = Array.isArray(parsed)
    ? parsed.flatMap((value) => {
        if (!isTrustedMcpProviderConfig(value)) return [];
        const entry = value as Record<string, unknown>;
        const scopes = stringArray(entry.oauth_scopes);
        return [{
          providerId: String(entry.provider_id),
          kind: "mcp" as const,
          displayName: String(entry.name),
          description: String(entry.description),
          iconName: String(entry.icon_name),
          category: String(entry.category),
          capabilities: stringArray(entry.capabilities),
          authMethods: ["oauth2"] as AccessAuthMethod[],
          trusted: true,
          endpoint: String(entry.endpoint),
          allowedTools: stringArray(entry.allowed_tools),
          oauth: {
            authorizationEndpoint: optionalString(entry.authorization_endpoint),
            tokenEndpoint: optionalString(entry.token_endpoint),
            issuer: optionalString(entry.issuer),
            resource: optionalString(entry.resource),
            scopes
          }
        } satisfies AccessProvider];
      })
    : [];
  const configuredIds = new Set(configured.map((provider) => provider.providerId));
  return [
    ...configured,
    ...builtInTrustedMcpProviders.filter(
      (provider) => !configuredIds.has(provider.providerId)
    )
  ];
}

export function listAccessProviders(): AccessProvider[] {
  return [...nativeProviders, ...listTrustedMcpProviders()];
}

export function accessProviderById(providerId: string): AccessProvider | null {
  return listAccessProviders().find((provider) => provider.providerId === providerId) ?? null;
}

export function accessProviderForConnector(connectorId: string): AccessProvider | null {
  return listAccessProviders().find((provider) => provider.connectorId === connectorId) ?? null;
}

export function accessProviderByIdOrConnector(id: string): AccessProvider | null {
  return accessProviderById(id) ?? accessProviderForConnector(id);
}

export async function listAccessProvidersForUser(
  userId: string
): Promise<AccessProvider[]> {
  return [
    ...listAccessProviders(),
    ...(await listCustomMcpProviders(userId))
  ];
}

export async function listMcpProvidersForUser(
  userId: string
): Promise<AccessProvider[]> {
  return [
    ...listTrustedMcpProviders(),
    ...(await listCustomMcpProviders(userId))
  ];
}

export async function accessProviderForUser(
  userId: string,
  id: string
): Promise<AccessProvider | null> {
  return accessProviderByIdOrConnector(id) ?? findCustomMcpProvider(userId, id);
}

function native(
  providerId: string,
  displayName: string,
  description: string,
  iconName: string,
  category: string,
  connectorId: string,
  capabilities: string[]
): AccessProvider {
  return {
    providerId,
    kind: "native",
    displayName,
    description,
    iconName,
    category,
    connectorId,
    capabilities,
    authMethods: connectorId === "web_search" ? ["none"] : ["oauth2"],
    trusted: true
  };
}

function isTrustedMcpProviderConfig(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return Object.entries(mcpProviderSchema).every(([key, check]) => check(entry[key]));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
