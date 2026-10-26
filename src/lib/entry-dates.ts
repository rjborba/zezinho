const entryDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Recife",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatEntryDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "";
  const parts = Object.fromEntries(
    entryDateFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// datetime-local has no timezone. Interpret it explicitly in Recife rather
// than in the server's or device's timezone, and reject normalized bad dates.
export function parseEntryDateTime(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value) || value.startsWith("0000")) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isFinite(date.getTime()) && formatEntryDateTime(date) === value
    ? date.toISOString()
    : null;
}

export function entryTimestampForUpdate(value: string, previousTimestamp: string): string | null {
  const timestamp = parseEntryDateTime(value);
  if (!timestamp) return null;
  // Editing quantities must not truncate an existing entry's seconds or
  // microseconds when its displayed date and minute have not changed.
  return formatEntryDateTime(previousTimestamp) === value ? previousTimestamp : timestamp;
}
