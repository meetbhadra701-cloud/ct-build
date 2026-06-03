import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_EXPIRING_SOON_WINDOW_DAYS,
  addUtcDays,
  buildReminderSchedule,
  daysUntilExpiry,
  getExpiryDateStatus,
  getNextReminderDate,
  isExpiringSoon,
  toIsoDate,
  toUtcDateOnly
} from "../../lib/dates/index.ts";

test("normalizes YYYY-MM-DD values to UTC date-only values", () => {
  const normalized = toUtcDateOnly("2026-06-03");

  assert.equal(normalized.toISOString(), "2026-06-03T00:00:00.000Z");
  assert.equal(toIsoDate(normalized), "2026-06-03");
});

test("rejects impossible calendar dates", () => {
  assert.throws(() => toUtcDateOnly("2026-02-29"), /Invalid date input/);
});

test("computes days until expiry using UTC calendar days", () => {
  assert.equal(daysUntilExpiry("2026-03-01", "2026-02-28"), 1);
  assert.equal(daysUntilExpiry("2028-03-01", "2028-02-28"), 2);
  assert.equal(daysUntilExpiry("2028-03-01", "2028-02-29"), 1);
});

test("treats the expiry date itself as expired", () => {
  assert.equal(getExpiryDateStatus("2026-06-03", { asOf: "2026-06-03" }), "expired");
  assert.equal(getExpiryDateStatus("2026-06-03", { asOf: "2026-06-04" }), "expired");
});

test("uses the frozen default 30-day expiring-soon window", () => {
  assert.equal(DEFAULT_EXPIRING_SOON_WINDOW_DAYS, 30);
  assert.equal(getExpiryDateStatus("2026-07-04", { asOf: "2026-06-03" }), "compliant");
  assert.equal(getExpiryDateStatus("2026-07-03", { asOf: "2026-06-03" }), "expiring-soon");
  assert.equal(getExpiryDateStatus("2026-06-04", { asOf: "2026-06-03" }), "expiring-soon");
  assert.equal(isExpiringSoon("2026-06-04", { asOf: "2026-06-03" }), true);
});

test("supports per-template expiring-soon window overrides", () => {
  assert.equal(
    getExpiryDateStatus("2026-06-18", {
      asOf: "2026-06-03",
      expiringSoonWindowDays: 14
    }),
    "compliant"
  );
  assert.equal(
    getExpiryDateStatus("2026-06-17", {
      asOf: "2026-06-03",
      expiringSoonWindowDays: 14
    }),
    "expiring-soon"
  );
});

test("rejects invalid expiring-soon windows", () => {
  assert.throws(
    () => getExpiryDateStatus("2026-06-17", { asOf: "2026-06-03", expiringSoonWindowDays: 0 }),
    /greater than 0/
  );
  assert.throws(
    () => getExpiryDateStatus("2026-06-17", { asOf: "2026-06-03", expiringSoonWindowDays: 1.5 }),
    /integer/
  );
});

test("adds UTC days across leap days without local timezone drift", () => {
  assert.equal(toIsoDate(addUtcDays("2028-02-28", 1)), "2028-02-29");
  assert.equal(toIsoDate(addUtcDays("2028-02-29", 1)), "2028-03-01");
  assert.equal(toIsoDate(addUtcDays("2028-03-01", -1)), "2028-02-29");
});

test("builds deterministic reminder schedules before expiry", () => {
  const schedule = buildReminderSchedule("2028-03-01");

  assert.deepEqual(
    schedule.map((entry) => ({
      scheduledForDate: entry.scheduledForDate,
      leadDaysBeforeExpiry: entry.leadDaysBeforeExpiry,
      escalationLevel: entry.escalationLevel
    })),
    [
      { scheduledForDate: "2028-01-31", leadDaysBeforeExpiry: 30, escalationLevel: 1 },
      { scheduledForDate: "2028-02-16", leadDaysBeforeExpiry: 14, escalationLevel: 2 },
      { scheduledForDate: "2028-02-23", leadDaysBeforeExpiry: 7, escalationLevel: 3 },
      { scheduledForDate: "2028-02-29", leadDaysBeforeExpiry: 1, escalationLevel: 4 }
    ]
  );
});

test("sorts, deduplicates, and filters reminder lead days", () => {
  const schedule = buildReminderSchedule("2026-07-01", {
    leadDaysBeforeExpiry: [1, 14, 14, 30, 7],
    asOf: "2026-06-20"
  });

  assert.deepEqual(
    schedule.map((entry) => entry.scheduledForDate),
    ["2026-06-24", "2026-06-30"]
  );
});

test("returns the next pending reminder candidate", () => {
  const next = getNextReminderDate("2026-07-01", {
    leadDaysBeforeExpiry: [30, 14, 7, 1],
    asOf: "2026-06-20"
  });

  assert.equal(next?.scheduledForDate, "2026-06-24");
  assert.equal(next?.leadDaysBeforeExpiry, 7);
});
