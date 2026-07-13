import assert from "node:assert/strict";
import test from "node:test";
import { fetchVisibleCalendarEvents } from "./google-workspace.js";

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
