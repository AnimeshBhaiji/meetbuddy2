// Conversion between the API's ISO datetimes and the local values that
// <input type="date"> / <input type="time"> expect. Shared by the itinerary
// editor and the calendar so both agree on what "3pm on the 5th" means.
//
// Everything is local time: toISOString() would shift the user's 15:00 into
// UTC and render the plan an hour off in the calendar.

export const DEFAULT_HOUR = 12;        // month-view clicks carry no time
export const DEFAULT_DURATION_MIN = 120;

const pad = (n) => String(n).padStart(2, "0");

/** Date -> "2026-08-05" */
export const toDateInput = (d) =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";

/** Date -> "15:00" */
export const toTimeInput = (d) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "");

/** "2026-08-05" + "15:00" -> Date in local time (null if the date is missing) */
export const fromDateTimeInput = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const out = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return isNaN(out.getTime()) ? null : out;
};

/** API ISO string -> Date, tolerating null/garbage */
export const parseISO = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** Date -> ISO string with the local offset preserved ("2026-08-05T15:00:00+05:30") */
export const toLocalISO = (d) => {
  if (!d) return null;
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
};

export const addMinutes = (d, min) => new Date(d.getTime() + min * 60000);

/**
 * Normalize a calendar slot selection into the editor's prefill shape.
 *
 * react-big-calendar reports how the slot was chosen: "click"/"doubleClick" for
 * a single cell, "select" for a dragged range. A click only says *when to
 * start*, so it gets the default duration — the 30-minute cell it happens to
 * land on is grid resolution, not the user's intent. A dragged range is intent
 * and is preserved. Month cells carry no time at all, so they fall back to
 * DEFAULT_HOUR.
 */
export const slotToPrefill = (start, end, action = "click") => {
  const s = new Date(start);
  const hasTime = s.getHours() !== 0 || s.getMinutes() !== 0;
  if (!hasTime) s.setHours(DEFAULT_HOUR, 0, 0, 0);

  const e = new Date(end || 0);
  const dragged =
    action === "select" && end && hasTime && e > s && e - s <= 12 * 3600_000;

  return {
    date: toDateInput(s),
    startTime: toTimeInput(s),
    endTime: toTimeInput(dragged ? e : addMinutes(s, DEFAULT_DURATION_MIN)),
  };
};
