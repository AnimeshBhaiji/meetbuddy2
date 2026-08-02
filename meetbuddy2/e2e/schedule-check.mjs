// Self-check for src/lib/schedule.js — the date/time conversions the editor
// and calendar both depend on. Run: node e2e/schedule-check.mjs
import assert from "node:assert/strict";
import {
  toDateInput, toTimeInput, fromDateTimeInput, toLocalISO, parseISO, slotToPrefill,
} from "../src/lib/schedule.js";

// round trip: inputs -> Date -> inputs
const d = fromDateTimeInput("2026-08-05", "15:00");
assert.equal(toDateInput(d), "2026-08-05");
assert.equal(toTimeInput(d), "15:00");
assert.equal(d.getHours(), 15, "must stay local, not shift to UTC");

// local ISO keeps the wall-clock time the user typed
assert.match(toLocalISO(d), /^2026-08-05T15:00:00[+-]\d{2}:\d{2}$/);
assert.equal(toTimeInput(parseISO(toLocalISO(d))), "15:00");

// missing date -> null, never an Invalid Date
assert.equal(fromDateTimeInput("", "15:00"), null);
assert.equal(parseISO(null), null);
assert.equal(parseISO("nonsense"), null);

// week/day click keeps the clicked time; the 30-min cell it landed on is grid
// resolution, not intent, so it becomes the default 2h block
const week = slotToPrefill(new Date(2026, 7, 5, 15, 0), new Date(2026, 7, 5, 15, 30), "click");
assert.deepEqual(week, { date: "2026-08-05", startTime: "15:00", endTime: "17:00" });

// month click (midnight, whole-day span) falls back to 12:00-14:00
const month = slotToPrefill(new Date(2026, 7, 5, 0, 0), new Date(2026, 7, 6, 0, 0), "click");
assert.deepEqual(month, { date: "2026-08-05", startTime: "12:00", endTime: "14:00" });

// a dragged range IS intent and is preserved
const dragged = slotToPrefill(new Date(2026, 7, 5, 9, 0), new Date(2026, 7, 5, 11, 30), "select");
assert.deepEqual(dragged, { date: "2026-08-05", startTime: "09:00", endTime: "11:30" });

// dragging across month cells is a date range, not a 3-day meetup -> default block
const monthDrag = slotToPrefill(new Date(2026, 7, 5, 0, 0), new Date(2026, 7, 8, 0, 0), "select");
assert.deepEqual(monthDrag, { date: "2026-08-05", startTime: "12:00", endTime: "14:00" });

// end before start is repaired rather than passed through
const bad = slotToPrefill(new Date(2026, 7, 5, 16, 0), new Date(2026, 7, 5, 15, 0), "select");
assert.equal(bad.endTime, "18:00");

// missing end (some views omit it) still yields a usable block
assert.deepEqual(slotToPrefill(new Date(2026, 7, 5, 8, 0), null, "click"),
  { date: "2026-08-05", startTime: "08:00", endTime: "10:00" });

console.log("SCHEDULE CHECK: PASS");
