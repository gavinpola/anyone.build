/** Cents as people read them: "3¢", "42¢", "$1.20". Under a cent shows as "<1¢"; nothing for 0 or unknown. */
export function formatCents(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return null;
  if (cents < 1) return "<1¢";
  if (cents < 100) return `${Math.round(cents)}¢`;
  const dollars = cents / 100;
  return `$${dollars.toFixed(dollars >= 10 ? 0 : 2)}`;
}
