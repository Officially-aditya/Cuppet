import { trustedMcpProviderForConnector } from "../access/compat.js";
import { isIP } from "node:net";

const nativeConnectors = new Set([
  "gmail",
  "calendar",
  "drive",
  "github",
  "slack",
  "notion"
]);

export function isSupportedConnectorId(connectorId: string): boolean {
  return /^[a-z][a-z0-9_.-]{1,79}$/.test(connectorId) &&
    (nativeConnectors.has(connectorId) ||
      Boolean(trustedMcpProviderForConnector(connectorId)) ||
      /^mcp\.[a-z][a-z0-9_.:-]{1,119}$/i.test(connectorId));
}

export function safePublicUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!/^https:\/\//i.test(url) || url.length > 1800) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      isPrivateIp(hostname)
    ) return null;
    for (const [key, value] of parsed.searchParams) {
      if (/(?:token|secret|password|passwd|api[_-]?key|authorization|access[_-]?code)/i.test(key)) {
        return null;
      }
      if (/(?:bearer\s+|sk-[a-z0-9]|gh[pousr]_[a-z0-9])/i.test(value)) return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isPrivateIp(hostname: string): boolean {
  const ipHostname = hostname.replace(/^\[|\]$/g, "");
  const version = isIP(ipHostname);
  if (version === 4) {
    const octets = ipHostname.split(".").map(Number);
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  if (version === 6) {
    const normalized = ipHostname.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  return false;
}
