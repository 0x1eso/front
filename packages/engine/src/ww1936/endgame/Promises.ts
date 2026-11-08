// World War 1936 diplomacy D4 (ww161 Design B §4; lane L3): promised land.
// The deal items promise and join_war (checked, valued and applied here,
// called from Deals.ts), lapsing when the war ends otherwise (the daily
// sweep Wars.checkWarEnds runs), and the AI side leader's offers to
// neutrals. The conference's pre-assignment is Conference.assignPromises.
//
// A promise is "region group G of enemy X, at the peace": the giver is a
// fighting member of a war on X, the taker either joins that war in the
// same deal (join_war, applied last) or already fights X on the giver's
// side. The kept record holds G's regions that were X's when it was made.
// Integers only; countries, regions and deals by id.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import {
  type DealItem,
  DIPLO_NOTICES,
  noticeId,
  WW_DEAL_AI_TO_HUMAN_DAYS,
  WW_DEAL_PP,
  WW_PROMISE_AI_DAYS,
  WW_PROMISE_WS_PCT,
} from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwWar } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  dealAcceptPct,
  dealItemPoints,
  dealMargin,
  promiseWantOf,
  WW_DEAL_VETO,
} from "@openfront/engine-lib/ww1936/DiploRules";
import { historicalAiActive } from "@openfront/engine-lib/ww1936/Pace";
import {
  promiseGateBlock,
  promisePairBlock,
  promiseStrengthOk,
  WW_PROMISE_JOIN_PTS,
} from "@openfront/engine-lib/ww1936/PromiseRules";
import { congressBlock } from "../depth/Congress";
import { declareWarBlock } from "../Diplomacy";
import { aiStrength } from "../politics/AiPolitics";
import { hasRule } from "../politics/Spirits";
import { addWarGoal } from "../politics/WarGoals";
import {
  dealFacts,
  dealMoodOf,
  dealNet,
  dealValueFacts,
  offerDeal,
} from "./Deals";
import { diploCooldownUntil, setDiploCooldown } from "./DiploState";
import { countryParams, registerAfterWarEnds, warBetween } from "./Wars";
import { muchStronger } from "./WhitePeace";
import type { WwEndgame } from "./WwEndgame";

type PromiseItem = Extract<DealItem, { kind: "promise" | "join_war" }>;

/** An AI side leader looks for neutrals to promise land to this often (staggered by smallID). */
export const WW_PROMISE_AI_CHECK_DAYS = 30;

// ---- Facts ----

/** The regions of content group `group` that are `target`'s by law now, ascending. */
export function promisedRegions(
  eg: WwEndgame,
  target: number,
  group: string,
): number[] {
  const pol = eg.ww.politics;
  const regions = pol.content.groupIdx.get(group)?.regions ?? [];
  return regions
    .filter((r) => (pol.legalOwner[r] ?? 0) === target)
    .sort((a, b) => a - b);
}

const activeIn = (eg: WwEndgame, w: WwWar, id: number): boolean =>
  eg.member(w, id)?.state === "active";

/** The armies of side `s` of `w`: Σ aiStrength of its members still fighting. */
function sideStrength(eg: WwEndgame, w: WwWar, s: 0 | 1): number {
  let n = 0;
  for (const m of w.sides[s].members) {
    if (m.state === "active" && eg.isActor(m.id)) {
      n += aiStrength(eg.ww.politics, m.id);
    }
  }
  return n;
}

/**
 * How much `id` wants `regions` (a promised group): 2 when one is its core
 * or claim, 1 when the group borders its land and holds
 * WW_PROMISE_BORDER_VP victory points or more, else 0.
 */
export function promiseWant(
  eg: WwEndgame,
  id: number,
  regions: readonly number[],
): 0 | 1 | 2 {
  return promiseWantOf(dealValueFacts(eg), id, regions);
}

// ---- Items: checks ----

/** Why `giver` may not give `item` to `taker` today (null: it may). */
export function promiseItemBlock(
  eg: WwEndgame,
  giver: number,
  taker: number,
  item: PromiseItem,
  _day: number,
): WwOrderBlock | null {
  return item.kind === "promise"
    ? promiseBlock(eg, giver, taker, item.target, item.group)
    : joinWarBlock(eg, giver, taker, item.war, item.target);
}

/**
 * A promise of `target`'s group `group` by `giver` to `taker`: the giver
 * fights `target` (an ongoing normal war, still active in it); the group
 * holds land of `target` nobody was promised yet; the taker is no enemy of
 * the giver's, not in `target`'s faction nor on its side.
 */
function promiseBlock(
  eg: WwEndgame,
  giver: number,
  taker: number,
  target: number,
  group: string,
): WwOrderBlock | null {
  const ww = eg.ww;
  if (target === giver || target === taker || !eg.isActor(target)) {
    return "deal_bad_item";
  }
  const w = warBetween(eg, giver, target);
  if (w === null || w.kind !== "normal" || !activeIn(eg, w, giver)) {
    return "deal_bad_item";
  }
  if (promisedRegions(eg, target, group).length === 0) return "deal_bad_item";
  if (eg.promises.some((p) => p.target === target && p.group === group)) {
    return "deal_bad_item";
  }
  if (!eg.isActor(taker) || ww.isAtWar(giver, taker)) {
    return "promise_bad_target";
  }
  if (ww.sameFaction(taker, target)) return "promise_bad_target";
  const st = eg.sideIndex(w, taker);
  if (st >= 0 && st === eg.sideIndex(w, target)) return "promise_bad_target";
  return null;
}

/**
 * `joiner` declares on `target` and joins war `warId` on `side`'s side:
 * the war is ongoing and normal, `side` and `target` fight in it on
 * opposite sides; the joiner is not in it, not in `target`'s faction, has
 * no pact with it, may declare on it (a truce, its guarantee, a puppet's
 * leash, an exile, isolation, the US congress) and its government's gate
 * is open (a democracy 50% world tension, a neutral 25%).
 */
export function joinWarBlock(
  eg: WwEndgame,
  joiner: number,
  side: number,
  warId: number,
  target: number,
): WwOrderBlock | null {
  const ww = eg.ww;
  const pol = ww.politics;
  const w = eg.war(warId);
  if (w === null || w.ended !== null || w.kind !== "normal") {
    return "deal_bad_item";
  }
  const ss = eg.sideIndex(w, side);
  const st = eg.sideIndex(w, target);
  if (ss < 0 || st < 0 || ss === st) return "deal_bad_item";
  if (!activeIn(eg, w, side) || !activeIn(eg, w, target)) {
    return "deal_bad_item";
  }
  if (joiner === target || joiner === side) return "deal_bad_item";
  if (!eg.isActor(joiner) || eg.isExile(joiner)) return "dead";
  if (eg.sideIndex(w, joiner) >= 0) return "promise_bad_target";
  if (
    ww.sameFaction(joiner, target) ||
    pol.isAtWarBlockedByNap(joiner, target)
  ) {
    return "promise_bad_target";
  }
  const a = eg.mg.playerBySmallID(joiner);
  const b = eg.mg.playerBySmallID(target);
  if (!a.isPlayer() || !b.isPlayer()) return "dead";
  if (declareWarBlock(eg.mg, ww, a, b, eg.mg.ticks(), true) !== null) {
    return "promise_bad_target";
  }
  if (hasRule(pol, joiner, "no_justify")) return "promise_bad_target";
  if (congressBlock(ww.depth, joiner, "declare", target)) {
    return "promise_bad_target";
  }
  const c = pol.country(joiner);
  if (c === null) return "dead";
  return promiseGateBlock(c.ruling, pol.wtBp);
}

/** Why a deal's promises lack a receiver that fights for them (Deals.dealBlock; null: fine). */
export function promiseDealBlock(
  eg: WwEndgame,
  from: number,
  to: number,
  give: readonly DealItem[],
  take: readonly DealItem[],
): WwOrderBlock | null {
  if (!give.some(isPromise) && !take.some(isPromise)) return null;
  return promisePairBlock(dealFacts(eg), from, to, give, take);
}

const isPromise = (i: DealItem): boolean => i.kind === "promise";

// ---- Items: the AI's value points ----

/**
 * The AI's value points of `item` (`giver` gives it, `taker` gets it) for
 * `judge`, the country judging the deal (the giver or the taker; L2 added
 * the parameter): positive is good for the judge, DiploRules.WW_DEAL_VETO
 * never.
 *
 * A promise, to its receiver: the group's base value × 2 when it is its
 * core or claim, × 1 when it only borders it (with WW_PROMISE_BORDER_VP),
 * else nothing. To the promiser: never its own core; its claim at twice
 * the value; otherwise half (it is only owed at a peace won). Joining a
 * war, to the joiner: never unless the side it joins is
 * WW_PROMISE_STRENGTH_PCT as strong as the enemy's and its war support is
 * WW_PROMISE_WS_PCT or more, and then WW_PROMISE_JOIN_PTS; to the side it
 * joins, WW_PROMISE_ALLY_PTS when it has an army.
 */
export function promiseItemValue(
  eg: WwEndgame,
  giver: number,
  taker: number,
  item: PromiseItem,
  judge: number,
): number {
  return dealItemPoints(dealValueFacts(eg), giver, taker, item, judge);
}

/** `joiner` joining war `warId` on `side`'s side, to the joiner (DealValueFacts.joinPts). */
export function joinWarPts(
  eg: WwEndgame,
  joiner: number,
  warId: number,
  side: number,
): number {
  const ws = eg.ww.politics.country(joiner)?.wsBp ?? 0;
  if (!joinSideStrong(eg, warId, side) || ws < WW_PROMISE_WS_PCT * 100) {
    return WW_DEAL_VETO;
  }
  return -WW_PROMISE_JOIN_PTS;
}

/** `side`'s side of war `warId` is strong enough for a joiner (PromiseRules.promiseStrengthOk). */
export function joinSideStrong(
  eg: WwEndgame,
  warId: number,
  side: number,
): boolean {
  const w = eg.war(warId);
  if (w === null) return false;
  const si = eg.sideIndex(w, side);
  if (si < 0) return false;
  const s = si as 0 | 1;
  return promiseStrengthOk(
    sideStrength(eg, w, s),
    sideStrength(eg, w, (1 - s) as 0 | 1),
  );
}

// ---- Items: an accepted deal happens ----

/** An accepted deal's promise or join_war item takes effect (`deal`: the deal's id, the promise's id). */
export function applyPromiseItem(
  eg: WwEndgame,
  giver: number,
  taker: number,
  item: PromiseItem,
  deal: number,
  tick: number,
): void {
  if (item.kind === "promise") {
    const w = warBetween(eg, giver, item.target);
    if (w === null) return;
    eg.promises.push({
      id: deal,
      war: w.id,
      from: giver,
      to: taker,
      target: item.target,
      group: item.group,
      regions: promisedRegions(eg, item.target, item.group),
    });
    eg.promises.sort(
      (a, b) =>
        a.id - b.id ||
        a.from - b.from ||
        a.to - b.to ||
        a.target - b.target ||
        (a.group < b.group ? -1 : a.group > b.group ? 1 : 0),
    );
    eg.dirtyDiplo = true;
    return;
  }
  joinWar(eg, giver, item.war, item.target, deal, tick);
}

/**
 * `joiner` goes to war on `target` and its faction, into war `warId` on
 * the side opposite them. With a promise of the same deal it declares with
 * a granted claim goal on the promised group (no justification; the
 * declaration's tension, halved for a claim, and its calls); without one it
 * only joins (as a call to arms does).
 */
function joinWar(
  eg: WwEndgame,
  joiner: number,
  warId: number,
  target: number,
  deal: number,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const w = eg.war(warId);
  if (w === null || w.ended !== null) return;
  const day = Math.max(0, ww.day(tick));
  const promise = eg.promises.find(
    (p) => p.id === deal && p.to === joiner && p.target === target,
  );
  if (promise !== undefined) {
    addWarGoal(pol, joiner, target, "claim", promise.group, day);
  }
  const link = { kind: "into" as const, warId: w.id };
  const joined: number[] = [];
  if (ww.setWar(joiner, target, tick, link)) joined.push(target);
  const faction = ww.factionOf(target);
  if (faction !== null) {
    for (const m of [...ww.factionMembers(faction)].sort((a, b) => a - b)) {
      if (m === target || m === joiner || !ww.isActor(m)) continue;
      if (ww.sameFaction(joiner, m)) continue;
      if (eg.truceUntil(joiner, m) > ww.day(tick)) continue;
      if (ww.setWar(joiner, m, tick, link)) joined.push(m);
    }
  }
  eg.mg.displayMessage(
    "events_display.ww1936_war_declared",
    MessageType.WORLD_WAR,
    null,
    undefined,
    {
      attackerTag: ww.tagOf(joiner),
      targetTag: ww.tagOf(target),
      allies: Math.max(0, joined.length - 1),
    },
  );
  if (promise !== undefined) {
    pol.onWarDeclared(joiner, target, joined, false, tick);
  } else {
    pol.onWarJoined(joiner, target, tick);
  }
}

// ---- Lapse ----

/**
 * After each check of the wars' ends (daily, and on a capitulation;
 * Wars.checkWarEnds): a promise whose war is over and no conference took it
 * (a white or line peace, a war that ended without a winner), whose
 * promiser or receiver left that war, or either of which stopped playing,
 * lapses, and its receiver is told. (A conference that opens takes its
 * wars' promises first: Conference.assignPromises.)
 */
export function lapsePromises(eg: WwEndgame, _tick: number): void {
  if (eg.promises.length === 0) return;
  const kept = eg.promises.filter((p) => {
    const w = eg.war(p.war);
    if (
      w !== null &&
      w.ended === null &&
      eg.isActor(p.from) &&
      eg.isActor(p.to) &&
      (eg.member(w, p.from)?.state ?? "left") !== "left" &&
      (eg.member(w, p.to)?.state ?? "left") !== "left"
    ) {
      return true;
    }
    tellLapsed(eg, p.to, p.from, p.target);
    return false;
  });
  if (kept.length !== eg.promises.length) {
    eg.promises = kept;
    eg.dirtyDiplo = true;
  }
}
registerAfterWarEnds(lapsePromises);

/** `to` hears that the land of `target` `from` promised it is no longer promised. */
function tellLapsed(
  eg: WwEndgame,
  to: number,
  from: number,
  target: number,
): void {
  if (!eg.isActor(to)) return;
  eg.message(
    to,
    noticeId(DIPLO_NOTICES.promiseLapsed),
    countryParams(eg, { country: from, target }),
  );
}

// ---- The AI's offers ----

/** The first of `id`'s claim groups (content order) that holds land of `target` (null: none). */
function claimGroupOn(
  eg: WwEndgame,
  id: number,
  target: number,
): string | null {
  const pol = eg.ww.politics;
  const tag = pol.tagOf(id);
  for (const row of pol.content.claims) {
    if (row.tag !== tag) continue;
    for (const g of row.groups) {
      if (promisedRegions(eg, target, g).length > 0) return g;
    }
  }
  return null;
}

/** A history beat of `id` still to come declares on or joins against `target`. */
function joinBeatWith(eg: WwEndgame, id: number, target: number): boolean {
  const pol = eg.ww.politics;
  const a = pol.tagOf(id);
  const t = pol.tagOf(target);
  return pol.content.beats.some((b, i) => {
    const s = pol.beats[i];
    if (s === undefined || s.skipped || s.done || b.actor !== a) return false;
    return (
      (b.act.kind === "declare" || b.act.kind === "join") && b.act.target === t
    );
  });
}

/**
 * Daily for an AI country (staggered by smallID), once every
 * WW_PROMISE_AI_CHECK_DAYS: a side leader not clearly winning (WhitePeace's
 * muchStronger) looks for neutrals (in no war) bordering an enemy member X
 * that claim a group of X's land, each at most once every
 * WW_PROMISE_AI_DAYS, and offers the first one its claim group for joining
 * the war. With the historical AI on, a neutral with a beat against X still
 * to come is left to it. An AI neutral is only asked when it might accept;
 * a human gets one AI deal in its queue at a time, one from each AI every
 * WW_DEAL_AI_TO_HUMAN_DAYS. One offer a check at most.
 */
export function aiPromiseDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (day < 0 || (day + id) % WW_PROMISE_AI_CHECK_DAYS !== 0) return;
  if (!eg.isActor(id)) return;
  const ww = eg.ww;
  const pol = ww.politics;
  const c = pol.country(id);
  if (c === null || c.ppMilli < WW_DEAL_PP * 1000) return;
  if (eg.deals.some((o) => o.from === id)) return;
  const historical = historicalAiActive(eg.mg.config(), day);
  const econ = ww.economy;
  for (const wid of [...eg.warsOf(id)].sort((a, b) => a - b)) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null || w.kind !== "normal") continue;
    const si = eg.sideIndex(w, id);
    if (si < 0) continue;
    const s = si as 0 | 1;
    if (w.sides[s].leader !== id || !activeIn(eg, w, id)) continue;
    if (muchStronger(eg, w, s)) continue;
    const enemies = w.sides[1 - s].members
      .filter((m) => m.state === "active" && eg.isActor(m.id))
      .map((m) => m.id)
      .sort((a, b) => a - b);
    for (const x of enemies) {
      for (let n = 1; n < eg.size; n++) {
        if (n === id || n === x || !eg.isActor(n) || ww.hasWar(n)) continue;
        if (!econ.countryNeighbours(n).includes(x)) continue;
        const group = claimGroupOn(eg, n, x);
        if (group === null) continue;
        if (diploCooldownUntil(eg, id, n, "ai_promise") > day) continue;
        if (historical && joinBeatWith(eg, n, x)) continue;
        setDiploCooldown(eg, id, n, "ai_promise", day + WW_PROMISE_AI_DAYS);
        if (tryOffer(eg, id, n, w, x, group, day, tick)) return;
      }
    }
  }
}

/** The AI `id`'s promise of `group` to `n` for joining `w` on `x`; true when sent. */
function tryOffer(
  eg: WwEndgame,
  id: number,
  n: number,
  w: WwWar,
  x: number,
  group: string,
  day: number,
  tick: number,
): boolean {
  if (
    eg.deals.some(
      (o) => (o.from === id && o.to === n) || (o.from === n && o.to === id),
    )
  ) {
    return false;
  }
  if (diploCooldownUntil(eg, id, n, "deal_refused") > day) return false;
  const give: DealItem[] = [{ kind: "promise", target: x, group }];
  const take: DealItem[] = [{ kind: "join_war", war: w.id, target: x }];
  const human = eg.isHumanControlled(n);
  if (human) {
    if (
      diploCooldownUntil(eg, id, 0, "ai_deal") > day ||
      eg.deals.some((o) => o.to === n && !eg.isHumanControlled(o.from))
    ) {
      return false;
    }
  } else {
    const net = dealNet(eg, id, n, give, take);
    if (dealAcceptPct(net, dealMargin(dealMoodOf(eg, n, id)), false) <= 0) {
      return false;
    }
  }
  if (offerDeal(eg, id, { kind: "deal_offer", to: n, give, take }, tick)) {
    return false;
  }
  if (human) {
    setDiploCooldown(eg, id, 0, "ai_deal", day + WW_DEAL_AI_TO_HUMAN_DAYS);
  }
  return true;
}
