import {
  GW_CIPHERS,
  GW_LISTENERS,
  GW_TELEGRAMS_PER_CHAPTER,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { seatsOf } from "./World";

const P_INTERCEPT = idHash("gw_intercept");

/** Friends' telegrams (design §9): free text, one chapter on the wire. */
export function sendTelegram(
  gw: GreatWar,
  seat: GwSeatState,
  to: GwTag,
  cipher: number,
  text: string,
): GwOrderBlock | null {
  const s = gw.s;
  if (to === seat.tag || seatsOf(gw, to).length === 0) return "no_seat";
  if (seat.wired >= GW_TELEGRAMS_PER_CHAPTER) return "too_many";
  const n = gw.nation(seat.tag);
  const cost = GW_CIPHERS[cipher].cost;
  if (n === null || n.authority < cost) return "no_authority_cipher";
  n.authority -= cost;
  seat.wired++;
  s.telegrams.push({
    uid: s.nextTelegram++,
    from: seat.tag,
    to,
    cipher,
    text,
    chapter: s.chapter,
    delivered: false,
    copies: [],
  });
  return null;
}

/** Chapter step: what was sent arrives, and third seats may read it. */
export function telegramStep(gw: GreatWar): void {
  const s = gw.s;
  for (const t of s.telegrams) {
    if (t.delivered) continue;
    t.delivered = true;
    for (const seat of s.seats) {
      if (seat.tag === t.from || seat.tag === t.to) continue;
      const pct = GW_CIPHERS[t.cipher].pct + (GW_LISTENERS[seat.tag] ?? 0);
      const roll = wwRoll(s.seed, P_INTERCEPT, t.uid, seat.smallID) % 100;
      if (roll < pct) t.copies.push(seat.tag);
    }
  }
}
