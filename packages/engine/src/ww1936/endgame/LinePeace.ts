// World War 1936: peace on the current line (현 점령선 평화, owner request
// 2026-10-31) — a third peace offer beside the white and the negotiated
// one, through their machinery: the same gate, cost, refusal cooldown,
// human card and truce (WhitePeace.peaceOfferBlock, resolveOffer,
// makePeace), the same AI judge entry point (NegPeace.peaceJudgeOf). What
// it adds: each occupied region goes, legal ownership and control, to its
// occupier (engine-lib LinePeaceRules) before the white peace's status quo
// ante returns the rest; the AI's value of a line; the AI's own line
// offers; the screens' rows. Integers only; wars, countries, regions and
// offers by id.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_PP,
  WW_WHITE_PEACE_STALEMATE_DAYS,
  WwLinePeaceRow,
  WwLinePeaceSplit,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  AI_LINE_PROPOSE_MIN_PCT,
  AI_LINE_SELF_ROLL,
  LineMove,
  LinePeaceFacts,
  linePeaceMoves,
  linePeaceReliefPm,
  linePeaceSplit,
  linePeaceValue,
} from "@openfront/engine-lib/ww1936/LinePeaceRules";
import {
  negPeaceAccepts,
  negPeaceChance,
  NegPeaceFacts,
  NegPeaceJudge,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import { wwRealTicks } from "@openfront/engine-lib/ww1936/Pace";
import {
  peaceClaimantTags,
  peaceSensitivity,
  PeaceSensitivity,
  SENSITIVE_EXCLUDED_TAG,
} from "@openfront/engine-lib/ww1936/PeaceRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { payPp } from "../politics/PayPp";
import { negPeaceFacts, peaceJudgeOf } from "./NegPeace";
import {
  AI_PROPOSE_CAP_PM,
  AI_PROPOSE_LOST_PM,
  fighting,
  followers,
  heldPm,
  muchStronger,
  pairsOf,
  peaceOfferBlock,
  proposerGroup,
  sideIds,
  stalemateDays,
  surrenderPm,
} from "./WhitePeace";
import type { PeaceOffer, WwEndgame } from "./WwEndgame";

type Member = WwWar["sides"][0]["members"][number];

// ---- Facts ----

/** LinePeaceRules' facts from the state (the negotiated peace's, the land regions, the capitals). */
export function linePeaceFacts(
  eg: WwEndgame,
  f: NegPeaceFacts = negPeaceFacts(eg),
): LinePeaceFacts {
  return {
    ...f,
    regions: eg.ww.scenario.landRegions.map((r) => r.id),
    capitals: (id) => {
      const out: number[] = [];
      const cap = eg.capitalRegion(id);
      if (cap > 0) out.push(cap);
      const ex = eg.exileIdx.get(id);
      const home = ex === undefined ? 0 : (eg.exiles[ex]?.capital ?? 0);
      if (home > 0 && home !== cap) out.push(home);
      return out;
    },
  };
}

/**
 * Korea's and Taiwan's rules for a line (the conference's sensitivity with
 * no main victor): Korea never changes hands, Taiwan only to its static
 * claimants still playing (China), the excluded country (Japan) never
 * receives either.
 */
export function linePeaceSens(eg: WwEndgame): PeaceSensitivity {
  const content = eg.ww.politics.content;
  const sc = eg.ww.scenario;
  return peaceSensitivity(
    (g) => content.groupIdx.get(g)?.regions ?? [],
    sc.smallIdOf(SENSITIVE_EXCLUDED_TAG),
    0,
    peaceClaimantTags(content.claims)
      .map((tag) => sc.smallIdOf(tag))
      .filter((id) => id > 0 && eg.isActor(id)),
  );
}

/**
 * The two groups a line offer of `from` in `w` settles between: [its own,
 * the other]. The whole war: both sides' members still in it (fighting, or
 * capitulated without an exile — those the white peace revives); a
 * separate peace: the proposer and its puppets there, and the enemies they
 * fight in that war (the pairs the separate peace ends).
 */
export function lineGroups(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
): [number[], number[]] {
  const s = eg.sideIndex(w, from);
  if (s === -1) return [[], []];
  if (whole) {
    const inIt = (m: Member) =>
      fighting(m) || (m.state === "capitulated" && !eg.isExile(m.id));
    const ids = (x: 0 | 1) => w.sides[x].members.filter(inIt).map((m) => m.id);
    return [ids(s), ids(s === 0 ? 1 : 0)];
  }
  const mine = [from, ...followers(eg, w, from)];
  const own = new Set(mine);
  const theirs = new Set<number>();
  for (const [p, q] of pairsOf(eg, w)) {
    if (own.has(p) && !own.has(q)) theirs.add(q);
    else if (own.has(q) && !own.has(p)) theirs.add(p);
  }
  return [mine, [...theirs].sort((x, y) => x - y)];
}

/** What a line offer of `from` in `w` would settle now: the regions changing hands and the two groups. */
export function lineMovesOf(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
  f: LinePeaceFacts = linePeaceFacts(eg),
): { moves: LineMove[]; mine: number[]; theirs: number[] } {
  const [mine, theirs] = lineGroups(eg, w, from, whole);
  if (mine.length === 0 || theirs.length === 0) {
    return { moves: [], mine, theirs };
  }
  const moves = linePeaceMoves(
    f,
    linePeaceSens(eg),
    new Set(mine),
    new Set(theirs),
  );
  return { moves, mine, theirs };
}

// ---- The offer ----

/**
 * line_peace_offer: `from` offers `target` peace on the current line in
 * war `warId` — the whole war when it leads its side, else a separate
 * peace. The white peace's gate (WW_WHITE_PEACE_MIN_DAYS, the cooldown
 * shared by every kind of offer, one pending offer per war, no puppet,
 * the other side's leader), its political power paid now; a human target
 * gets the card until its deadline and answers by peace_reply.
 */
export function offerLinePeace(
  eg: WwEndgame,
  from: number,
  warId: number,
  target: number,
  tick: number,
): WwOrderBlock | null {
  const day = eg.ww.day(tick);
  const block = peaceOfferBlock(eg, from, warId, target, day);
  if (block !== null) return block;
  const pol = eg.ww.politics;
  if (!payPp(pol, from, WW_WHITE_PEACE_PP)) return "no_pp";
  pol.markCountry(from);
  const w = eg.war(warId)!;
  const s = eg.sideIndex(w, from);
  if (s === -1) return "not_at_war";
  const human = eg.isHumanControlled(target);
  eg.peaceOffers.push({
    id: eg.nextOfferId++,
    war: warId,
    from,
    to: target,
    whole: w.sides[s].leader === from,
    sentTick: tick,
    // Its real 30 s at the game's pace, as the white peace's card.
    deadlineTick: human
      ? tick +
        wwRealTicks(eg.mg.config().gameConfig(), WW_WHITE_PEACE_CARD_TICKS)
      : tick,
    line: true,
  });
  eg.dirtyPeace = true;
  return null;
}

/**
 * The line takes effect when the peace is made (WhitePeace.makePeace,
 * before P3 end_war sends the armies home and gives the rest back): each
 * region changing hands gets its occupier as legal owner (no core, as a
 * conference take: resistance and integration follow) and the giver's
 * divisions there go home. Nothing for another kind of offer.
 */
export function applyLinePeace(
  eg: WwEndgame,
  o: PeaceOffer,
  tick: number,
): void {
  if (o.line !== true) return;
  const w = eg.war(o.war);
  if (w === null) return;
  const { moves } = lineMovesOf(eg, w, o.from, o.whole);
  if (moves.length === 0) return;
  const ww = eg.ww;
  const pol = ww.politics;
  const land = ww.land;
  for (const [r, giver, receiver] of moves) {
    pol.setLegalOwner(r, receiver);
    transferRegionPeaceful(land, r, receiver, tick);
    evictDivisions(land, r, giver);
    pol.markCountry(giver);
    pol.markCountry(receiver);
  }
  pol.markGlobal();
}

// ---- The AI's judge ----

const P_LINE = idHash("line_peace");

/** A line offer's seeded roll, 0..99 (its own, not the white peace's). */
export function lineOfferRoll(eg: WwEndgame, o: PeaceOffer): number {
  return (wwRoll(eg.ww.politics.seed, P_LINE, o.id, o.from, o.to) >>> 8) % 100;
}

/**
 * What `to`'s judge reads of a line offered by `from` in `w`: the
 * negotiated peace's war facts (war score, surrender lines, land held, war
 * support, the stalemate — peaceJudgeOf) and the line's value to `to`'s
 * group, its losses counted less the nearer `to` is to its own surrender
 * line (linePeaceReliefPm).
 */
export function lineJudgeOf(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  to: number,
  whole: boolean,
  day: number,
  f: LinePeaceFacts = linePeaceFacts(eg),
): { j: NegPeaceJudge; value: number; moves: LineMove[]; mine: number[] } {
  const { moves, mine, theirs } = lineMovesOf(eg, w, from, whole, f);
  const j = peaceJudgeOf(eg, w, from, to, whole, day, f);
  const t = new Set(theirs);
  const value = linePeaceValue(
    f,
    moves,
    (x) => t.has(x),
    linePeaceReliefPm(surrenderPm(eg, to)),
  );
  return { j, value, moves, mine };
}

/**
 * The AI target's answer to a line offer: its value against what the war
 * says it needs at the offer's seeded roll (NegPeaceRules.negPeaceAccepts).
 * A side clearly winning (no chance of a white peace) needs its lead's
 * worth on top; a losing side counts little of what it gives up.
 */
export function lineAiAccepts(
  eg: WwEndgame,
  o: PeaceOffer,
  day: number,
): boolean {
  const w = eg.war(o.war);
  if (w === null) return false;
  const { j, value } = lineJudgeOf(eg, w, o.from, o.to, o.whole, day);
  return negPeaceAccepts(j, value, lineOfferRoll(eg, o));
}

// ---- The AI's own offers ----

/**
 * Whether the AI `id` offers the other side's leader a line in `w` now:
 * - losing (AI_PROPOSE_CAP_PM to its surrender line, or AI_PROPOSE_LOST_PM
 *   of its land — its side's, for a leader — held) while the front still
 *   moves (no stalemate of WW_WHITE_PEACE_STALEMATE_DAYS): the line now is
 *   better than the way the war goes;
 * - or, as a side leader not AI_PEACE_STRONGER_RATIO times stronger, on a
 *   front stalemated WW_WHITE_PEACE_STALEMATE_DAYS with its side gaining
 *   more than it gives up, and its own judge (as if the other side offered
 *   the line) taking it at AI_LINE_SELF_ROLL — not a side clearly winning.
 * Either way something changes hands, and the other side's judge takes
 * the line at least AI_LINE_PROPOSE_MIN_PCT of the time.
 */
export function aiWantsLinePeace(
  eg: WwEndgame,
  w: WwWar,
  id: number,
  day: number,
): boolean {
  const si = eg.sideIndex(w, id);
  if (si === -1) return false;
  const s = si === 0 ? 0 : 1;
  const target = w.sides[s === 0 ? 1 : 0].leader;
  if (target <= 0) return false;
  const whole = w.sides[s].leader === id;
  const stalled = stalemateDays(eg, w.id, day) >= WW_WHITE_PEACE_STALEMATE_DAYS;
  const losing =
    surrenderPm(eg, id) >= AI_PROPOSE_CAP_PM ||
    heldPm(eg, sideIds(w, s === 0 ? 1 : 0), proposerGroup(eg, w, id, whole)) >=
      AI_PROPOSE_LOST_PM;
  if (losing ? stalled : !whole || !stalled || muchStronger(eg, w, s)) {
    return false;
  }
  const f = linePeaceFacts(eg);
  const t = lineJudgeOf(eg, w, id, target, whole, day, f);
  if (t.moves.length === 0) return false;
  if (!losing) {
    const own = new Set(t.mine);
    const mine = (x: number) => own.has(x);
    if (linePeaceValue(f, t.moves, mine, 0) <= 0) return false;
    const self = peaceJudgeOf(eg, w, target, id, true, day, f);
    const selfValue = linePeaceValue(
      f,
      t.moves,
      mine,
      linePeaceReliefPm(surrenderPm(eg, id)),
    );
    if (!negPeaceAccepts(self, selfValue, AI_LINE_SELF_ROLL)) return false;
  }
  return negPeaceChance(t.j, t.value) >= AI_LINE_PROPOSE_MIN_PCT;
}

/**
 * The AI's day (its dailyCountry, after its white and negotiated peace's):
 * at most one offer of any kind pending, in its oldest war that wants a line.
 */
export function aiLinePeaceDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (eg.peaceOffers.some((o) => o.from === id)) return;
  const c = eg.ww.politics.country(id);
  if (c === null || c.ppMilli < WW_WHITE_PEACE_PP * 1000) return;
  for (const wid of [...eg.warsOf(id)].sort((a, b) => a - b)) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null || w.kind !== "normal") continue;
    const s = eg.sideIndex(w, id);
    if (s === -1) continue;
    const target = w.sides[s === 0 ? 1 : 0].leader;
    if (peaceOfferBlock(eg, id, wid, target, day) !== null) continue;
    if (!aiWantsLinePeace(eg, w, id, day)) continue;
    offerLinePeace(eg, id, wid, target, tick);
    return;
  }
}

// ---- Screens ----

/** A pending line offer as its card reads it: what changes hands now, from the proposer's side. */
export function linePeaceOfferView(
  eg: WwEndgame,
  o: PeaceOffer,
): WwLinePeaceSplit {
  const w = eg.war(o.war);
  const f = linePeaceFacts(eg);
  if (w === null) return { gain: [], lose: [], gainVp: 0, loseVp: 0 };
  const { moves, mine } = lineMovesOf(eg, w, o.from, o.whole, f);
  const own = new Set(mine);
  return linePeaceSplit(f, moves, (x) => own.has(x));
}

/**
 * Every human country's possible line offer in each ongoing normal war it
 * fights — what would change hands, and the other leader's chance by its
 * judge (the preview's hint) — once a day; null when unchanged since sent
 * (read-only: screens only).
 */
export function linePeaceData(
  eg: WwEndgame,
  first: boolean,
): WwLinePeaceRow[] | null {
  const day = eg.lastCommonDay;
  if (!first && day === eg.lineDay) return null;
  eg.lineDay = day;
  const rows: WwLinePeaceRow[] = [];
  let f: LinePeaceFacts | null = null;
  for (const w of eg.wars) {
    if (w.ended !== null || w.kind !== "normal" || day < 0) continue;
    for (const s of [0, 1] as const) {
      const target = w.sides[s === 0 ? 1 : 0].leader;
      if (target <= 0) continue;
      for (const m of w.sides[s].members) {
        if (!fighting(m) || !eg.isHumanControlled(m.id)) continue;
        f ??= linePeaceFacts(eg);
        const whole = w.sides[s].leader === m.id;
        const t = lineJudgeOf(eg, w, m.id, target, whole, day, f);
        const own = new Set(t.mine);
        rows.push({
          war: w.id,
          from: m.id,
          to: target,
          ...linePeaceSplit(f, t.moves, (x) => own.has(x)),
          chance: negPeaceChance(t.j, t.value),
        });
      }
    }
  }
  const json = JSON.stringify(rows);
  if (!first && json === eg.lineSent) return null;
  eg.lineSent = json;
  return rows;
}
