import { useEffect, useState } from "react";

export const TZ = "Europe/Istanbul";
// Istanbul is fixed UTC+3 (no DST since 2016).
const OFFSET = "+03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "05 Oct 2026, 18:30" */
export function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return fmt.format(new Date(iso));
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

export function sessionMs(seated: string, left: string | null, now = Date.now()) {
  return (left ? new Date(left).getTime() : now) - new Date(seated).getTime();
}

/** Value for <input type="datetime-local"> in Istanbul time. */
export function toLocalInput(d: Date = new Date()) {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** Parse a datetime-local value as Istanbul time -> ISO string. */
export function fromLocalInput(v: string) {
  return new Date(`${v}:00${OFFSET}`).toISOString();
}

/** Istanbul calendar date "YYYY-MM-DD" for a timestamp. */
export function istanbulDate(iso: string) {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
