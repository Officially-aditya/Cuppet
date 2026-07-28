import type { AccessRequirement } from "./types.js";

const connectorRequirements: Record<string, AccessRequirement> = {
  gmail: requirement("mail", "read", "Gmail read access"),
  drive: requirement("files", "read", "Google Drive file read access"),
  calendar: requirement("calendar", "read", "Google Calendar event read access"),
  github: requirement("code", "read", "GitHub repository read access"),
  slack: requirement("chat", "read", "Slack message history access"),
  notion: requirement("docs", "read", "Notion page read access"),
  web_search: requirement("web", "search", "Public web search")
};

export function accessRequirementsForConnectorIds(
  connectorIds: string[]
): AccessRequirement[] {
  const seen = new Set<string>();
  const requirements: AccessRequirement[] = [];
  for (const connectorId of connectorIds) {
    const value = connectorRequirements[connectorId];
    if (!value) continue;
    const key = `${value.service}.${value.capabilities.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    requirements.push({ ...value });
  }
  return requirements;
}

export function accessRequirementsForConfig(
  config: Record<string, unknown>
): AccessRequirement[] {
  const explicit = config.access_refs;
  if (Array.isArray(explicit)) {
    const parsed = explicit.flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      const service = typeof item.service === "string" ? item.service.trim() : "";
      const capabilities = Array.isArray(item.capabilities)
        ? item.capabilities.filter((candidate): candidate is string => typeof candidate === "string")
        : [];
      if (!service || capabilities.length === 0) return [];
      return [{
        service,
        capabilities,
        required: item.required !== false,
        preferred_provider_ids: Array.isArray(item.preferred_provider_ids)
          ? item.preferred_provider_ids.filter((candidate): candidate is string => typeof candidate === "string")
          : [],
        ...(typeof item.reason === "string" ? { reason: item.reason } : {})
      }];
    });
    if (parsed.length > 0) return parsed;
  }
  return accessRequirementsForConnectorIds(connectorIdsFromConfig(config));
}

export function connectorIdsFromConfig(config: Record<string, unknown>): string[] {
  const value = config.connector_ids;
  return Array.isArray(value)
    ? value.filter((connector): connector is string => typeof connector === "string")
    : [];
}

function requirement(
  service: string,
  capability: string,
  reason: string
): AccessRequirement {
  return {
    service,
    capabilities: [capability],
    required: true,
    preferred_provider_ids: [],
    reason
  };
}
