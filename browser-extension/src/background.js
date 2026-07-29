const minimumDomainIntervalMs = 15 * 60 * 1000;
const lastSentAt = new Map();

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void recordTabDomain(tabId, "page_view");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    void recordTabDomain(tabId, "page_view");
  }
});

async function recordTabDomain(tabId, eventType) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const domain = publicDomain(tab?.url);
  if (!domain) return;

  const previous = lastSentAt.get(domain) ?? 0;
  if (Date.now() - previous < minimumDomainIntervalMs) return;

  const settings = await chrome.storage.local.get(["apiBaseUrl", "browserToken"]);
  const apiBaseUrl = typeof settings.apiBaseUrl === "string" ? settings.apiBaseUrl : "";
  const browserToken = typeof settings.browserToken === "string" ? settings.browserToken : "";
  if (!apiBaseUrl || !browserToken) return;

  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/users/me/personalization/browser-events`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cuppet-browser-token": browserToken
    },
    body: JSON.stringify({
      event_id: crypto.randomUUID(),
      event_type: eventType,
      domain
    })
  }).catch(() => null);

  if (response?.ok) lastSentAt.set(domain, Date.now());
}

function publicDomain(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const hostname = url.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":")
  ) return null;
  return hostname;
}
