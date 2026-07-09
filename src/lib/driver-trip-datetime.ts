const UTC = "UTC" as const;
const UTC_LOCALE = "en-GB";

/** Parse a UTC timestamp from the driver trip DB (e.g. "2026-06-02 05:00:00" or ISO with Z). */
export function parseUtcTimestamp(raw: string): Date | null {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return new Date(
      Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)),
    );
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Format YYYY-MM-DD scheduling date for display (UTC calendar date). */
export function formatUtcTripDate(iso: string): string {
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return iso;
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  return dt.toLocaleDateString(UTC_LOCALE, {
    timeZone: UTC,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Short UTC date for ranges: "2 Jun" or "2 Jun 2026". */
export function formatUtcTripDateShort(iso: string, withYear = false): string {
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return iso;
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  return dt.toLocaleDateString(UTC_LOCALE, {
    timeZone: UTC,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/** Format trip time stored in UTC (clock-only or full timestamp). */
export function formatUtcTripTime(raw: string | null): string {
  if (!raw) return "—";
  const clock = raw.match(/(\d{1,2}):(\d{2})/);
  if (clock && raw.length <= 12) {
    return `${clock[1].padStart(2, "0")}:${clock[2]}`;
  }
  const dt = parseUtcTimestamp(raw);
  if (dt) {
    return dt.toLocaleTimeString(UTC_LOCALE, {
      timeZone: UTC,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return raw.slice(0, 5);
}
