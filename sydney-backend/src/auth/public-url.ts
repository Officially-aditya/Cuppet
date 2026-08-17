import { config } from "../config.js";

export const authPublicOrigin = config.WEB_APP_URL ?? config.AUTH_BASE_URL;
export const authPublicBasePath = config.WEB_APP_URL
  ? config.WEB_AUTH_BASE_PATH
  : "/auth";

export function publicAuthRequestUrl(requestUrl: string): URL {
  const incoming = new URL(requestUrl, config.AUTH_BASE_URL);
  const internalSuffix = incoming.pathname.startsWith("/auth")
    ? incoming.pathname.slice("/auth".length)
    : incoming.pathname;
  const external = new URL(authPublicOrigin);
  external.pathname = `${authPublicBasePath}${internalSuffix}`.replace(
    /\/{2,}/g,
    "/"
  );
  external.search = incoming.search;
  return external;
}
