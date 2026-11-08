// World War 1936 (ww88 lane X, report idea 4): Ask for terms. A side that is
// losing need not fight to the end: from WW_ASK_TERMS_MIN_PM of the way to
// its surrender line its leader may ask the other side's leader for a peace
// conference now. The winners get a smaller pool the earlier the side gives
// up; at stake is only what they hold and what borders it, and the loser
// keeps the rest and its army.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_ASK_TERMS_AI_PM,
  WW_ASK_TERMS_MIN_PM,
  WW_ASK_TERMS_MIN_POOL_PCT,
  WW_PEACE_POOL_PCT,
  WW_WHITE_PEACE_PP,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { payPp } from "../politics/PayPp";
import { endWarBetween } from "../politics/Territory";
import { isMajor, openConference } from "./Conference";
import {
  fighting,
  peaceDeadline,
  peaceOfferBlock,
  surrenderPm,
} from "./WhitePeace";
import type { PeaceOffer, WwEndgame } from "./WwEndgame";

/** The pool's share, percent: the minimum at the first chance, all of it at the line. */
export function termsPoolPct(pm: number): number {
  const span = 1000 - WW_ASK_TERMS_MIN_PM;
  const got = Math.max(0, Math.min(span, pm - WW_ASK_TERMS_MIN_PM));
  return (
    WW_ASK_TERMS_MIN_POOL_PCT +
    Math.floor((got * (WW_PEACE_POOL_PCT - WW_ASK_TERMS_MIN_POOL_PCT)) / span)
  );
}

/** Why `from` may not ask for terms in `warId` on `day` (null: it may). */
export function askTermsBlock(
  eg: WwEndgame,
  from: number,
  warId: number,
  day: number,
): WwOrderBlock | null {
  const w = eg.war(warId);
  if (w === null || w.ended !== null) return "not_at_war";
  const s = eg.sideIndex(w, from);
  if (s === -1) return "not_at_war";
  const block = peaceOfferBlock(eg, from, warId, w.sides[1 - s].leader, day);
  if (block !== null) return block;
  if (w.sides[s].leader !== from) return "peace_not_leader";
  return surrenderPm(eg, from) < WW_ASK_TERMS_MIN_PM
    ? "peace_not_beaten"
    : null;
}

/** peace_surrender: `from` asks the other side's leader for a conference. */
export function askForTerms(
  eg: WwEndgame,
  from: number,
  warId: number,
  tick: number,
): WwOrderBlock | null {
  const block = askTermsBlock(eg, from, warId, eg.ww.day(tick));
  if (block !== null) return block;
  const pol = eg.ww.politics;
  if (!payPp(pol, from, WW_WHITE_PEACE_PP)) return "no_pp";
  pol.markCountry(from);
  const w = eg.war(warId)!;
  const to = w.sides[1 - eg.sideIndex(w, from)].leader;
  const id = eg.nextOfferId++;
  eg.peaceOffers.push({
    id,
    war: warId,
    from,
    to,
    whole: true,
    sentTick: tick,
    deadlineTick: peaceDeadline(eg, to, id, tick),
    ask: true,
  });
  eg.dirtyPeace = true;
  return null;
}

/** An AI winner grants terms when clearly ahead: the other side is at least twice as far gone. */
export function askTermsAccepted(eg: WwEndgame, o: PeaceOffer): boolean {
  return surrenderPm(eg, o.to) * 2 <= surrenderPm(eg, o.from);
}

/** Terms granted: the war stops now and its conference opens. */
export function openTermsConference(
  eg: WwEndgame,
  warId: number,
  from: number,
  tick: number,
): void {
  const w = eg.war(warId);
  if (w === null || w.ended !== null) return;
  const s = eg.sideIndex(w, from) as 0 | 1;
  const winner = (1 - s) as 0 | 1;
  const pol = eg.ww.politics;
  const losers = w.sides[s].members
    .filter((m) => m.state !== "left")
    .map((m) => m.id);
  const lost = new Set(losers);
  const poolPct = termsPoolPct(surrenderPm(eg, from));
  // What it stops at: the winners' own land comes back, armies go home,
  // and the land at stake stays with whoever holds it for the conference.
  const keep = (r: number) => lost.has(pol.legalOwner[r] ?? 0);
  w.ended = { day: eg.ww.day(tick), winner };
  const pairs: [number, number][] = [];
  for (const [key, v] of eg.pairWar) {
    if (v === warId) pairs.push([Math.floor(key / eg.size), key % eg.size]);
  }
  for (const [a, b] of pairs) endWarBetween(pol, a, b, tick, keep);
  eg.dirtyWars = true;
  openConference(eg, [warId], tick, { losers, poolPct });
}

/**
 * Terms bind the whole side, so an AI leader does not ask over the head of a
 * great power on it that is still short of the asking line: in a real game a
 * beaten Poland handed Germany France's fleet and made France a puppet with
 * France's 139 divisions unfought. It fights on, and the war outlives it.
 */
function majorAllyStands(eg: WwEndgame, w: WwWar, id: number): boolean {
  return w.sides[eg.sideIndex(w, id) as 0 | 1].members.some(
    (m) =>
      m.id !== id &&
      fighting(m) &&
      isMajor(eg, m.id) &&
      surrenderPm(eg, m.id) < WW_ASK_TERMS_MIN_PM,
  );
}

/** The AI's day: a beaten side leader asks, in its oldest war that allows it. */
export function aiAskTermsDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (eg.peaceOffers.some((o) => o.from === id)) return;
  for (const wid of [...eg.warsOf(id)].sort((a, b) => a - b)) {
    if (surrenderPm(eg, id) < WW_ASK_TERMS_AI_PM) return;
    if (askTermsBlock(eg, id, wid, day) !== null) continue;
    if (majorAllyStands(eg, eg.war(wid)!, id)) continue;
    askForTerms(eg, id, wid, tick);
    return;
  }
}
