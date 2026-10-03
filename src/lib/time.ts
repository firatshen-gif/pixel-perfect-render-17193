import { useEffect, useState } from "react";

/**
 * All timezone handling is per-tournament: every function takes an IANA
 * timezone identifier (e.g. "Asia/Nicosia"). DST is handled by Intl.
 */

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(kind: "display" | "parts" | "date", tz: string) {
  const key = `${kind}|${tz}`;
  let f = cache.get(key);
  if (!f) {
    f =
      kind === "display"
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: tz,
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })
        : kind === "parts"
          ? new Intl.DateTimeFormat("en-CA", {
              timeZone: tz,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hourCycle: "h23",
            })
          : new Intl.DateTimeFormat("en-CA", {
              timeZone: tz,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });
    cache.set(key, f);
  }
  return f;
}

function getParts(formatter: Intl.DateTimeFormat, date: Date) {
  const result: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") result[part.type] = part.value;
  }
  return result;
}

/** All IANA timezones supported by the browser. */
export function listTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = intl.supportedValuesOf?.("timeZone");
  if (list?.length) return list;
  return ["Asia/Nicosia", "Europe/Istanbul", "Europe/London", "America/New_York", "Asia/Dubai", "UTC"];
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return /\//.test(tz) || tz === "UTC";
  } catch {
    return false;
  }
}

/** "05 Oct 2026, 18:30" in the given timezone */
export function formatDateTime(iso: string | Date | null | undefined, tz: string) {
  if (!iso) return "—";
  return fmt("display", tz).format(new Date(iso));
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
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

export function sessionMs(seated: string, left: string | null, now = Date.now()) {
  return (left ? new Date(left).getTime() : now) - new Date(seated).getTime();
}

/** Wall-clock components of an instant in tz, expressed as a UTC ms value. */
export function wallClockAsUtcMs(date: Date, tz: string) {
  const p = getParts(fmt("parts", tz), date);
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
}

function offsetMs(date: Date, tz: string) {
  return wallClockAsUtcMs(date, tz) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Value for <input type="datetime-local"> in the given timezone. */
export function toLocalInput(d: Date, tz: string) {
  const p = getParts(fmt("parts", tz), d);
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}`;
}

/** Parse datetime-local as wall-clock time in tz -> UTC ISO string. */
export function fromLocalInput(v: string, tz: string) {
  const [datePart = "", timePart = "00:00"] = v.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const localAsUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0);
  let result = new Date(localAsUtc);
  for (let i = 0; i < 2; i++) result = new Date(localAsUtc - offsetMs(result, tz));
  return result.toISOString();
}

/** Calendar date "YYYY-MM-DD" for a timestamp in tz. */
export function localDate(iso: string, tz: string) {
  const p = getParts(fmt("date", tz), new Date(iso));
  return `${p.year}-${p.month}-${p.day}`;
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
