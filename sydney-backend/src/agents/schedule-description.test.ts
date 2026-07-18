import assert from "node:assert/strict";
import test from "node:test";
import { describeSchedule } from "./schedule-description.js";

test("describes every supported recipe schedule in plain language", () => {
  assert.equal(describeSchedule("0 6 * * *"), "every day at 6:00 AM");
  assert.equal(describeSchedule("30 18 * * *"), "every day at 6:30 PM");
  assert.equal(describeSchedule("0 16 * * 1-5"), "every weekday at 4:00 PM");
  assert.equal(
    describeSchedule("0 17 * * 5"),
    "weekly on Friday at 5:00 PM"
  );
  assert.equal(
    describeSchedule("0 9 1 * *"),
    "monthly on the 1st at 9:00 AM"
  );
});

test("never exposes unsupported cron syntax to users", () => {
  assert.equal(describeSchedule("*/5 * * * *"), "on a custom schedule");
  assert.doesNotMatch(describeSchedule("*/5 * * * *"), /[*]/);
});
