/** "2026-07-06" → "Jul 6" (locale-aware). */
export function shortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
