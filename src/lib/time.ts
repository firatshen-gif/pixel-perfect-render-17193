import { useEffect, useState } from "react";

export const TZ = "Asia/Nicosia";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const localInputFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getParts(
  formatter: Intl.DateTimeFormat,
  date: Date,
) {
  const result: Record<string, string> = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return result;
}

/** "05 Oct 2026, 18:30" in Cyprus local time */
export function formatDateTime(
  iso: string | Date | null | undefined,
) {
  if (!iso) return "—";

  return dateTimeFormatter.format(new Date(iso));
}

/** Duration in ms -> "3h 45m" */
export function formatDuration(ms: number) {
  if (!isFinite(ms) || ms < 0) ms = 0;

  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Duration in ms -> "01:42:17" */
export function formatLiveDuration(ms: number) {
  if (!isFinite(ms) || ms < 0) ms = 0;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function sessionMs(
  seated: string,
  left: string | null,
  now = Date.now(),
) {
  return (
    (left ? new Date(left).getTime() : now) -
    new Date(seated).getTime()
  );
}

export function sitOutMs(
  sitouts: Array<{ sat_out_at: string; sat_in_at: string | null }> = [],
  now = Date.now(),
) {
  return sitouts.reduce((total, sitout) => {
    const start = new Date(sitout.sat_out_at).getTime();
    const end = sitout.sat_in_at
      ? new Date(sitout.sat_in_at).getTime()
      : now;

    return total + Math.max(0, end - start);
  }, 0);
}

export function playMs(
  seated: string,
  left: string | null,
  sitouts: Array<{ sat_out_at: string; sat_in_at: string | null }> = [],
  now = Date.now(),
) {
  return Math.max(
    0,
    sessionMs(seated, left, now) - sitOutMs(sitouts, now),
  );
}

/**
 * UTC offset used by Cyprus at a specific instant.
 * Automatically handles UTC+3 / UTC+2 DST changes.
 */
function getCyprusOffsetMs(date: Date) {
  const parts = getParts(localInputFormatter, date);

  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  const instantWithoutMs =
    Math.floor(date.getTime() / 1000) * 1000;

  return localAsUtc - instantWithoutMs;
}

/** Value for <input type="datetime-local"> in Cyprus local time. */
export function toLocalInput(d: Date = new Date()) {
  const parts = getParts(localInputFormatter, d);

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Parse datetime-local as Cyprus local time -> UTC ISO string. */
export function fromLocalInput(v: string) {
  const [datePart, timePart] = v.split("T");

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
  );

  // Initial approximation.
  let result = new Date(localAsUtc);

  // Recalculate using the actual Cyprus offset for that date.
  for (let i = 0; i < 2; i++) {
    const offset = getCyprusOffsetMs(result);
    result = new Date(localAsUtc - offset);
  }

  return result.toISOString();
}

/** Cyprus calendar date "YYYY-MM-DD" for a timestamp. */
export function cyprusDate(iso: string) {
  const parts = getParts(
    localDateFormatter,
    new Date(iso),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Keep the old function name temporarily so existing code
 * continues working without changing other files yet.
 */
export const istanbulDate = cyprusDate;

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(
      () => setNow(Date.now()),
      intervalMs,
    );

    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
