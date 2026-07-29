const apiBaseUrl = document.querySelector("#apiBaseUrl");
const browserToken = document.querySelector("#browserToken");
const save = document.querySelector("#save");
const status = document.querySelector("#status");

const existing = await chrome.storage.local.get(["apiBaseUrl", "browserToken"]);
apiBaseUrl.value = typeof existing.apiBaseUrl === "string" ? existing.apiBaseUrl : "";
browserToken.value = typeof existing.browserToken === "string" ? existing.browserToken : "";

save.addEventListener("click", async () => {
  const base = apiBaseUrl.value.trim().replace(/\/$/, "");
  const token = browserToken.value.trim();
  if (!/^https:\/\//i.test(base) && !/^http:\/\/localhost(?::\d+)?$/i.test(base)) {
    status.textContent = "Use the Cuppet HTTPS API URL or localhost during development.";
    return;
  }
  if (!token.startsWith("cup_browser_") || token.length < 32) {
    status.textContent = "Enter the one-time token from Cuppet Personalization settings.";
    return;
  }
  await chrome.storage.local.set({ apiBaseUrl: base, browserToken: token });
  status.textContent = "Saved. Only domain-level signals will be sent while connected.";
});
