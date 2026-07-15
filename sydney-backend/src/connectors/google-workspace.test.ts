import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGmailDigestMessages,
  fetchVisibleCalendarEvents,
  formatCalendarDateTime,
  gmailMessageSourceRef,
  googleScopesCoverConnector,
  startGmailWatch
} from "./google-workspace.js";

test("Calendar connections require both event and calendar-list grants", () => {
  assert.equal(
    googleScopesCoverConnector(
      ["https://www.googleapis.com/auth/calendar.events.readonly"],
      "calendar"
    ),
    false
  );
  assert.equal(
    googleScopesCoverConnector(
      [
        "https://www.googleapis.com/auth/calendar.events.readonly",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
      ],
      "calendar"
    ),
    true
  );
  assert.equal(
    googleScopesCoverConnector(
      ["https://www.googleapis.com/auth/calendar.readonly"],
      "calendar"
    ),
    true
  );
});

test("calendar event labels use the account time zone", () => {
  const instant = "2026-07-14T12:00:00.000Z";

  assert.match(
    formatCalendarDateTime(instant, "America/New_York"),
    /8:00\s*am/i
  );
  assert.match(
    formatCalendarDateTime(instant, "Asia/Kolkata"),
    /5:30\s*pm/i
  );
});

test("calendar agenda merges selected calendars and sorts upcoming events", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.includes("/users/me/calendarList")) {
      return Response.json({
        items: [
          { id: "primary@example.com", summary: "Personal", primary: true, selected: true },
          { id: "team@example.com", summary: "Team", selected: true },
          { id: "hidden@example.com", summary: "Hidden", selected: false }
        ]
      });
    }

    if (url.includes(encodeURIComponent("primary@example.com"))) {
      return Response.json({
        items: [
          {
            id: "personal-later",
            summary: "Dentist",
            status: "confirmed",
            start: { dateTime: "2026-07-14T12:00:00.000Z" }
          }
        ]
      });
    }

    if (url.includes(encodeURIComponent("team@example.com"))) {
      return Response.json({
        items: [
          {
            id: "team-first",
            summary: "Team standup",
            status: "confirmed",
            start: { dateTime: "2026-07-14T09:00:00.000Z" }
          },
          {
            id: "cancelled",
            summary: "Cancelled meeting",
            status: "cancelled",
            start: { dateTime: "2026-07-14T10:00:00.000Z" }
          }
        ]
      });
    }

    return Response.json({ error: { message: "Unexpected URL" } }, { status: 500 });
  };

  try {
    const events = await fetchVisibleCalendarEvents(
      "access-token",
      new Date("2026-07-14T00:00:00.000Z"),
      new Date("2026-07-21T00:00:00.000Z"),
      12
    );

    assert.deepEqual(events.map((event) => event.id), ["team-first", "personal-later"]);
    assert.deepEqual(events.map((event) => event.calendarName), ["Team", "Personal"]);
    assert.equal(requestedUrls.some((url) => url.includes("hidden%40example.com")), false);
    assert.equal(
      requestedUrls.every((url) =>
        url.includes("/calendarList") ||
        (url.includes("singleEvents=true") && url.includes("orderBy=startTime"))
      ),
      true
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("calendar agenda falls back to primary when calendar-list lookup fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/users/me/calendarList")) {
      return Response.json({ error: { message: "Temporary failure" } }, { status: 500 });
    }
    assert.match(url, /calendars\/primary\/events/);
    return Response.json({
      items: [
        {
          id: "fallback-event",
          summary: "Primary event",
          status: "confirmed",
          start: { dateTime: "2026-07-14T09:00:00.000Z" }
        }
      ]
    });
  };

  try {
    const events = await fetchVisibleCalendarEvents(
      "access-token",
      new Date("2026-07-14T00:00:00.000Z"),
      new Date("2026-07-21T00:00:00.000Z"),
      12
    );
    assert.equal(events[0]?.id, "fallback-event");
    assert.equal(events[0]?.calendarId, "primary");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("calendar agenda keeps readable calendars when one selected calendar fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/users/me/calendarList")) {
      return Response.json({
        items: [
          { id: "primary@example.com", summary: "Personal", primary: true },
          { id: "stale@example.com", summary: "Stale shared calendar", selected: true }
        ]
      });
    }
    if (url.includes(encodeURIComponent("primary@example.com"))) {
      return Response.json({
        items: [
          {
            id: "visible-event",
            summary: "Planning session",
            status: "confirmed",
            start: { dateTime: "2026-07-14T11:00:00.000Z" }
          }
        ]
      });
    }
    return Response.json(
      { error: { status: "NOT_FOUND", message: "Calendar no longer exists" } },
      { status: 404 }
    );
  };

  try {
    const events = await fetchVisibleCalendarEvents(
      "access-token",
      new Date("2026-07-14T00:00:00.000Z"),
      new Date("2026-07-21T00:00:00.000Z"),
      12
    );
    assert.deepEqual(events.map((event) => event.id), ["visible-event"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("calendar agenda follows event pagination until it finds an event", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/users/me/calendarList")) {
      return Response.json({
        items: [{ id: "primary@example.com", summary: "Personal", primary: true }]
      });
    }
    if (!url.searchParams.has("pageToken")) {
      return Response.json({ items: [], nextPageToken: "next-page" });
    }
    assert.equal(url.searchParams.get("pageToken"), "next-page");
    return Response.json({
      items: [
        {
          id: "paginated-event",
          summary: "Later result",
          status: "confirmed",
          start: { dateTime: "2026-07-15T09:00:00.000Z" }
        }
      ]
    });
  };

  try {
    const events = await fetchVisibleCalendarEvents(
      "access-token",
      new Date("2026-07-14T00:00:00.000Z"),
      new Date("2026-07-21T00:00:00.000Z"),
      12
    );
    assert.deepEqual(events.map((event) => event.id), ["paginated-event"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gmail push watch targets Pub/Sub and filters to inbox changes", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer access-token"
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      topicName: "projects/cuppet/topics/gmail-events",
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE"
    });
    return Response.json({ historyId: "123", expiration: "9999999999999" });
  };

  try {
    const watch = await startGmailWatch(
      "access-token",
      "projects/cuppet/topics/gmail-events"
    );
    assert.deepEqual(watch, {
      historyId: "123",
      expiration: "9999999999999"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gmail digest keeps structured mail details in newest-first order", () => {
  const messages = buildGmailDigestMessages([
    {
      id: "older",
      threadId: "thread-older",
      snippet: "Your payment receipt is ready.",
      internalDate: String(Date.parse("2026-07-15T08:00:00.000Z")),
      payload: {
        headers: [
          { name: "Subject", value: "July receipt" },
          { name: "From", value: "Billing <billing@example.com>" }
        ]
      }
    },
    {
      id: "newer",
      threadId: "thread-newer",
      snippet: "Please verify this sign-in immediately.",
      payload: {
        headers: [
          { name: "Subject", value: "Security alert &amp; action required" },
          { name: "From", value: '"Cuppet Security" <security@example.com>' },
          { name: "Date", value: "Wed, 15 Jul 2026 09:30:00 +0000" }
        ]
      }
    }
  ]);

  assert.deepEqual(messages.map((message) => message.id), ["newer", "older"]);
  assert.equal(messages[0]?.subject, "Security alert & action required");
  assert.equal(messages[0]?.sender, "Cuppet Security");
  assert.equal(messages[0]?.category, "attention");
  assert.equal(messages[0]?.timestamp, "2026-07-15T09:30:00.000Z");
  assert.equal(messages[1]?.category, "finance");
});

test("Gmail source references are explicitly routed as messages", () => {
  assert.deepEqual(
    gmailMessageSourceRef({
      id: "message-1",
      threadId: "thread-1",
      payload: { headers: [{ name: "Subject", value: "Project update" }] }
    }),
    {
      type: "gmail_message",
      source: "Gmail",
      id: "message-1",
      thread_id: "thread-1",
      subject: "Project update"
    }
  );
});
