/**
 * Calendar-day keys in LOCAL time.
 *
 * `toISOString().slice(0, 10)` is UTC, so east of Greenwich it returns
 * yesterday's date for anything logged between midnight and the UTC offset
 * (00:00–02:00 in Amsterdam summer time). Every day key the app writes or
 * matches on — logger date inputs, chart buckets, calendar cells — must come
 * from here so they agree with the calendar the user is looking at.
 */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's local `YYYY-MM-DD`. */
export function todayKey(): string {
  return dayKey(new Date());
}
