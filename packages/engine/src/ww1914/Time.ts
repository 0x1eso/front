// Great War 1914 (ww193): the one time pool (남은 일정). A chapter's summons
// (`seat.audiences`) and schedule slots (`seat.acts`) are one pool: each kind
// of business spends from its own count first, then from the other.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";

/** Time left this chapter. */
export function timeLeft(seat: GwSeatState): number {
  return Math.max(0, seat.audiences) + Math.max(0, seat.acts);
}

/** Spends `n`, from `first`'s count first. False (nothing spent) when short. */
export function spendTime(
  seat: GwSeatState,
  n: number,
  first: "audiences" | "acts",
): boolean {
  if (n <= 0) return true;
  if (timeLeft(seat) < n) return false;
  const other = first === "audiences" ? "acts" : "audiences";
  const a = Math.min(Math.max(0, seat[first]), n);
  seat[first] -= a;
  seat[other] -= n - a;
  return true;
}
