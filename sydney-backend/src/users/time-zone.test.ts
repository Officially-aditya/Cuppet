import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveTimeZone,
  ianaTimeZoneSchema,
  normalizeIanaTimeZone
} from "./time-zone.js";

test("accepts regional IANA time zones used by mobile operating systems", () => {
  assert.equal(normalizeIanaTimeZone("Asia/Kolkata"), "Asia/Kolkata");
  assert.equal(normalizeIanaTimeZone("America/New_York"), "America/New_York");
  assert.equal(normalizeIanaTimeZone("America/Argentina/Buenos_Aires"), "America/Argentina/Buenos_Aires");
  assert.equal(normalizeIanaTimeZone("Etc/GMT+5"), "Etc/GMT+5");
});

test("normalizes UTC aliases", () => {
  assert.equal(normalizeIanaTimeZone("UTC"), "UTC");
  assert.equal(normalizeIanaTimeZone("Etc/UTC"), "UTC");
  assert.equal(normalizeIanaTimeZone("GMT"), "UTC");
});

test("rejects invalid zones, numeric offsets, and ambiguous abbreviations", () => {
  for (const value of ["", "Not/AZone", "+05:30", "IST", "PST", 123]) {
    assert.equal(normalizeIanaTimeZone(value), null);
  }
  assert.equal(ianaTimeZoneSchema.safeParse("Mars/Olympus_Mons").success, false);
});

test("uses the legacy deployment zone only when no valid user zone exists", () => {
  assert.equal(
    effectiveTimeZone("Europe/Paris", "Asia/Kolkata"),
    "Europe/Paris"
  );
  assert.equal(effectiveTimeZone(null, "Asia/Kolkata"), "Asia/Kolkata");
  assert.equal(effectiveTimeZone("broken", "also-broken"), "UTC");
});
