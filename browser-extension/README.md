# Cuppet Preference Signals

This Manifest V3 extension is an opt-in browser bridge for Cuppet. It sends a bounded `page_view` event containing only the active tab's public domain.

It does not collect page URLs, page titles, page contents, form input, cookies, search terms, or a browsing-history export. Cuppet must separately have `browser_activity` personalization consent before an event becomes a preference signal.

## Install for development

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked and select this directory.
4. Open the extension's options page.
5. Paste the API URL and the one-time browser token generated in Cuppet Personalization settings.

Disconnect the browser in Cuppet settings or remove the token from the extension options to stop sending events. Browser tokens expire after one year and are revocable server-side.
