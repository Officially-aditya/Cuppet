import assert from "node:assert/strict";
import test from "node:test";
import { renderPasswordResetPage } from "./reset-page.js";

test("password reset page includes the token without allowing HTML injection", () => {
  const page = renderPasswordResetPage('token-<script>alert("x")</script>');

  assert.match(page, /name="newPassword"/);
  assert.match(page, /fetch\('\/auth\/reset-password'/);
  assert.match(page, /token-&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(page, /<input[^>]+value="token-<script>/);
});

test("password reset page checks confirmation before making the request", () => {
  const page = renderPasswordResetPage("safe-token");

  assert.match(page, /The passwords do not match/);
  assert.match(page, /newPassword !== confirmation/);
  assert.doesNotMatch(page, /revoke/i);
});
