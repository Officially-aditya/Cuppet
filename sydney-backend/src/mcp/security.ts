import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "../config.js";

export function assertSafeRemoteMcpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid MCP endpoint URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("MCP endpoints must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("MCP endpoints cannot include credentials.");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error("MCP endpoint targets a private or local address.");
  }
  const allowedHosts = configuredAllowedHosts();
  if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error("MCP endpoint host is not trusted.");
  }
  return url;
}

export async function assertSafeRemoteMcpUrlWithDns(value: string): Promise<URL> {
  const url = assertSafeRemoteMcpUrl(value);
  if (isIP(url.hostname)) return url;
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("MCP endpoint hostname could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedHost(address))) {
    throw new Error("MCP endpoint resolves to a private or local address.");
  }
  return url;
}

export async function fetchRemoteMcp(
  input: string | URL,
  init: RequestInit = {}
): Promise<{ response: Response; body: string }> {
  const url = await assertSafeRemoteMcpUrlWithDns(String(input));
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(30_000)
  });
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > config.MCP_MAX_RESPONSE_BYTES) {
    throw new Error("MCP response exceeded the configured size limit.");
  }
  return {
    response,
    body: Buffer.from(bytes).toString("utf8")
  };
}

export function configuredAllowedHosts(): string[] {
  return config.MCP_ALLOWED_HOSTS.split(/[\s,]+/)
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (["localhost", "localhost.localdomain", "ip6-localhost"].includes(host)) {
    return true;
  }
  if (isIP(host) === 4) return isPrivateIpv4(host);
  if (isIP(host) === 6) return isPrivateIpv6(host);
  return host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local");
}

function isPrivateIpv4(value: string): boolean {
  const octets = value.split(".").map(Number);
  const [first, second] = octets;
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 0
  );
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (/^\d+(?:\.\d+){3}$/.test(mapped)) return isPrivateIpv4(mapped);
    return true;
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("fec")
  );
}
