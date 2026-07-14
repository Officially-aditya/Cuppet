import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config.js";
import {
  createNotionAuthUrl,
  notionAuthConfigured,
  parseNotionCallbackUrl
} from "./notion.js";

test("creates a Notion OAuth URL with signed state and mobile callback", async () => {
  const original = {
    clientId: config.NOTION_CLIENT_ID,
    clientSecret: config.NOTION_CLIENT_SECRET,
    authorizationUrl: config.NOTION_AUTHORIZATION_URL
  };
  try {
    config.NOTION_CLIENT_ID = "notion-client";
    config.NOTION_CLIENT_SECRET = "notion-secret";
    config.NOTION_AUTHORIZATION_URL =
      "https://api.notion.com/v1/oauth/authorize?client_id=notion-client&response_type=code&owner=user&redirect_uri=https%3A%2F%2Fexample.com%2Fconnectors%2Fnotion%2Fcallback";

    assert.equal(notionAuthConfigured(), true);
    const session = await createNotionAuthUrl({
      userId: "user-1",
      callbackScheme: "sydney"
    });
    const url = new URL(session.authUrl);

    assert.equal(url.origin, "https://api.notion.com");
    assert.equal(url.searchParams.get("client_id"), "notion-client");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("owner"), "user");
    assert.ok(url.searchParams.get("state"));
    assert.equal(session.callbackScheme, "sydney");
  } finally {
    config.NOTION_CLIENT_ID = original.clientId;
    config.NOTION_CLIENT_SECRET = original.clientSecret;
    config.NOTION_AUTHORIZATION_URL = original.authorizationUrl;
  }
});

test("accepts only the mobile Notion connector callback", () => {
  assert.deepEqual(
    parseNotionCallbackUrl(
      "sydney://connectors/notion?connector_id=notion&status=connected"
    ),
    { connectorId: "notion", error: undefined }
  );
  assert.throws(
    () =>
      parseNotionCallbackUrl(
        "sydney://connectors/github?connector_id=github&status=connected"
      ),
    /Invalid Notion connector callback URL/
  );
});
