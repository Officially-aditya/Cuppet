import assert from "node:assert/strict";
import test from "node:test";
import { cleanPushNotificationText } from "./firebase.js";

test("push notification text removes markdown and respects its display limit", () => {
  assert.equal(
    cleanPushNotificationText("**[Read the update](https://example.com/update)**\n# Today"),
    "Read the update Today"
  );
  assert.equal(cleanPushNotificationText("123456789", 5), "1234…");
});
