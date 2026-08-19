import Image from "next/image";
import { Search } from "lucide-react";
import { AgentIcon } from "./agent-icon";

const connectorAssets = {
  calendar: "/connector-calendar.png",
  drive: "/connector-drive.png",
  github: "/connector-github.png",
  gmail: "/connector-gmail.png",
  notion: "/connector-notion.png",
  slack: "/connector-slack.png"
} as const;

type ConnectorLogoKey = keyof typeof connectorAssets;

const exactAliases: Record<string, ConnectorLogoKey> = {
  calendar: "calendar",
  google_calendar: "calendar",
  googlecalendar: "calendar",
  drive: "drive",
  google_drive: "drive",
  googledrive: "drive",
  gdrive: "drive",
  github: "github",
  gmail: "gmail",
  google_mail: "gmail",
  googlemail: "gmail",
  notion: "notion",
  slack: "slack"
};

function normalizeConnectorValue(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Resolve a connector logo from backend ids, provider ids, or human-readable
 * source names. Provider ids can be namespaced (for example, mcp_google_drive),
 * so keyword matching is intentionally supported after the exact aliases.
 */
export function getConnectorLogoPath(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeConnectorValue(value);
    if (!normalized) continue;

    const compact = normalized.replaceAll("_", "");
    const exact = exactAliases[normalized] ?? exactAliases[compact];
    if (exact) return connectorAssets[exact];

    if (normalized.includes("calendar")) return connectorAssets.calendar;
    if (normalized.includes("drive")) return connectorAssets.drive;
    if (normalized.includes("github")) return connectorAssets.github;
    if (normalized.includes("gmail") || normalized.includes("google_mail")) return connectorAssets.gmail;
    if (normalized.includes("notion")) return connectorAssets.notion;
    if (normalized.includes("slack")) return connectorAssets.slack;
  }
  return undefined;
}

export function ConnectorLogo({
  id,
  providerId,
  name,
  iconName,
  size = 22
}: {
  id?: string;
  providerId?: string;
  name?: string;
  iconName?: string;
  size?: number;
}) {
  const logoPath = getConnectorLogoPath(id, providerId, name);
  if (logoPath) {
    return <Image className="connector-logo-image" src={logoPath} alt="" width={size} height={size} />;
  }

  const source = normalizeConnectorValue(id) || normalizeConnectorValue(providerId) || normalizeConnectorValue(name) || normalizeConnectorValue(iconName);
  if (source.includes("search")) return <Search className="connector-logo-icon" size={size} aria-hidden="true" />;
  return <AgentIcon name={iconName} size={size} />;
}
