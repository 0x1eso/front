// World War 1936: negotiated peace (owner request "7번", 2026-10-30) — a
// white peace offer (WhitePeace.ts) with terms. The engine's side of
// engine-lib NegPeaceRules: its facts from the state; the terms checked
// when offered and again when accepted; settled when the peace is made
// (regions ceded with their legal ownership and control — no core, so
// resistance and integration follow as for a conference take —
// reparations, subjects set free), before the armies go home; the AI
// judge's war facts; the AI proposer's terms; the screens' rows. Integers
// only; wars, countries and regions by id.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_NEG_PEACE_MAX_REGIONS,
  WW_NEG_REPARATIONS_DAYS,
  WW_NEG_REPARATIONS_MAX_LEVEL,
  WwPeaceJudgeRow,
  WwPeaceOfferView,
  WwPeaceTerms,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  AI_NEG_AIM_PCT,
  AI_NEG_GIVE_FROM_PCT,
  hasPeaceTerms,
  NegPeaceFacts,
  NegPeaceJudge,
  negPeacePctValue,
  negPeaceRegionValue,
  negPeaceRepK,
  negPeaceRepValue,
  negPeaceTermsBlock,
  negPeaceUnit,
  negPeaceValue,
  negPeaceWinNeed,
  noPeaceTerms,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import {
  peaceSensitivity,
  PeaceSensitivity,
  SENSITIVE_EXCLUDED_TAG,
} from "@openfront/engine-lib/ww1936/PeaceRules";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { regionBase } from "./Conference";
import { endSubject } from "./Subjects";
import {
  acceptPct,
  fighting,
  heldPm,
  proposerGroup,
  sideIds,
  surrenderPm,
} from "./WhitePeace";
import type { PeaceOffer, WwEndgame } from "./WwEndgame";

// ---- Facts ----

/** The state as NegPeaceRules reads it (per-country totals made once, on first use). */
export function negPeaceFacts(eg: WwEndgame): NegPeaceFacts {
  const ww = eg.ww;
  const sc = ww.scenario;
  const legal = ww.politics.legalOwner;
  const ctrl = ww.land.controller;
  const bases = new Map<number, number>();
  const base = (r: number): number => {
    let b = bases.get(r);
    if (b === undefined) {
      b = regionBase(eg, r);
      bases.set(r, b);
    }
    return b;
  };
  let totals: { vp: Map<number, number>; base: Map<number, number> } | null =
    null;
  const sums = () => {
    if (totals === null) {
      const vp = new Map<number, number>();
      const bs = new Map<number, number>();
      for (const r of sc.landRegions) {
        const l = legal[r.id] ?? 0;
        if (l <= 0) continue;
        vp.set(l, (vp.get(l) ?? 0) + r.vp);
        bs.set(l, (bs.get(l) ?? 0) + base(r.id));
      }
      totals = { vp, base: bs };
    }
    return totals;
  };
  return {
    legalOwner: (r) => legal[r] ?? 0,
    controller: (r) => ctrl[r] ?? 0,
    vp: (r) => sc.region(r)?.vp ?? 0,
    base,
    capital: (id) => {
      const tag = sc.tagOfSmallId(id);
      const tile = tag === undefined ? null : sc.capitalTileOrNull(tag);
      return tile === null ? 0 : sc.regionAt(tile);
    },
    legalVp: (id) => sums().vp.get(id) ?? 0,
    legalBase: (id) => sums().base.get(id) ?? 0,
    civs: (id) => ww.economy.country(id)?.totals.civ ?? 0,
    overlordOf: (id) => eg.subjectOf(id)?.overlord ?? 0,
    isZone: (r) => eg.isZone(r),
  };
}

/** Korea's and Taiwan's rules outside a conference (no claimant, no main victor). */
export function negPeaceSens(eg: WwEndgame): PeaceSensitivity {
  const content = eg.ww.politics.content;
  return peaceSensitivity(
    (g) => content.groupIdx.get(g)?.regions ?? [],
    eg.ww.scenario.smallIdOf(SENSITIVE_EXCLUDED_TAG),
    0,
    [],
  );
}

/** The order's terms as state: ascending, no terms → undefined (a white peace). */
export function storedTerms(
  t: WwPeaceTerms | undefined,
): WwPeaceTerms | undefined {
  if (t === undefined || !hasPeaceTerms(t)) return undefined;
  const asc = (a: readonly number[]) => [...a].sort((x, y) => x - y);
  return {
    give: asc(t.give),
    take: asc(t.take),
    pay: t.pay,
    demand: t.demand,
    free: asc(t.free),
  };
}

/** Why `from` may not offer `to` these terms now (null: it may; none: always). */
export function peaceTermsBlock(
  eg: WwEndgame,
  from: number,
  to: number,
  t: WwPeaceTerms | undefined,
): WwOrderBlock | null {
  if (t === undefined || !hasPeaceTerms(t)) return null;
  return negPeaceTermsBlock(negPeaceFacts(eg), negPeaceSens(eg), t, from, to);
}

// ---- The peace ----

/**
 * The terms take effect (before P3 end_war sends the armies home): each
 * ceded region's legal owner and control go to the receiver (no core, as a
 * conference take), the divisions of its controller and giver there go
 * home; reparations of the level's factories a day for
 * WW_NEG_REPARATIONS_DAYS (P5's record); subjects set free.
 */
export function applyPeaceTerms(
  eg: WwEndgame,
  o: PeaceOffer,
  tick: number,
): void {
  const t = o.terms;
  if (t === undefined || !hasPeaceTerms(t)) return;
  const ww = eg.ww;
  const pol = ww.politics;
  const land = ww.land;
  const day = ww.day(tick);
  const cede = (r: number, giver: number, receiver: number) => {
    const was = land.controller[r] ?? 0;
    pol.setLegalOwner(r, receiver);
    transferRegionPeaceful(land, r, receiver, tick);
    for (const x of was === giver ? [giver] : [was, giver]) {
      if (x > 0 && x !== receiver) evictDivisions(land, r, x);
    }
  };
  for (const r of t.give) cede(r, o.from, o.to);
  for (const r of t.take) cede(r, o.to, o.from);
  const civs = (id: number) => ww.economy.country(id)?.totals.civ ?? 0;
  const pay = (a: number, b: number, level: number) => {
    const k = negPeaceRepK(civs(a), level);
    if (k <= 0) return;
    eg.reparations.push({
      from: a,
      to: b,
      k,
      untilDay: day + WW_NEG_REPARATIONS_DAYS,
    });
  };
  pay(o.from, o.to, t.pay);
  pay(o.to, o.from, t.demand);
  for (const x of t.free) endSubject(eg, x, tick);
  pol.markCountry(o.from);
  pol.markCountry(o.to);
  pol.markGlobal();
}

// ---- The AI's judge ----

/** What the AI target `to` weighs an offer of `from` in `w` against (its war, not the terms). */
export function peaceJudgeOf(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  to: number,
  whole: boolean,
  day: number,
  f: NegPeaceFacts = negPeaceFacts(eg),
): NegPeaceJudge {
  const pct = acceptPct(eg, w, from, to, whole, day);
  const s = eg.sideIndex(w, from);
  const gp = proposerGroup(eg, w, from, whole);
  const gt = s < 0 ? [] : sideIds(w, s === 0 ? 1 : 0);
  let pBase = 0;
  for (const x of gp) pBase += f.legalBase(x);
  let tBase = 0;
  for (const x of gt) tBase += f.legalBase(x);
  const lead = Math.max(surrenderPm(eg, from), heldPm(eg, gt, gp));
  return {
    pct,
    unit: negPeaceUnit(pBase, tBase),
    winNeed: negPeaceWinNeed(pct, lead, pBase),
  };
}

/** The offer's terms' worth to the target's side, points (a white peace: 0). */
export function offerValue(
  eg: WwEndgame,
  w: WwWar,
  o: PeaceOffer,
  f: NegPeaceFacts = negPeaceFacts(eg),
): number {
  const t = o.terms;
  if (t === undefined || !hasPeaceTerms(t)) return 0;
  const s = eg.sideIndex(w, o.from);
  const gp = new Set(proposerGroup(eg, w, o.from, o.whole));
  const gt = new Set(s < 0 ? [] : sideIds(w, s === 0 ? 1 : 0));
  return negPeaceValue(
    f,
    t,
    o.from,
    o.to,
    (x) => gp.has(x),
    (x) => gt.has(x),
  );
}

// ---- The AI's terms ----

/**
 * The terms the AI `id` offers `target` in `w` (null: a white peace). It
 * aims at the target's AI_NEG_AIM_PCT chance by the target's judge. When a
 * white peace falls short, the losing side gives — land the other side
 * holds already (the cheapest concession), most valuable first, then
 * reparations — as much as its own wish for peace is worth (its own
 * white-peace chance past AI_NEG_GIVE_FROM_PCT). When the target would
 * take a white peace with room to spare, a proposer ahead on land demands
 * the target's land it holds, within that room.
 */
export function aiPeaceTerms(
  eg: WwEndgame,
  w: WwWar,
  id: number,
  target: number,
  day: number,
): WwPeaceTerms | null {
  const si = eg.sideIndex(w, id);
  if (si < 0) return null;
  const s = si === 0 ? 0 : 1;
  const whole = w.sides[s].leader === id;
  const f = negPeaceFacts(eg);
  const sens = negPeaceSens(eg);
  const gp = proposerGroup(eg, w, id, whole);
  const gt = sideIds(w, s === 0 ? 1 : 0);
  const inP = (x: number) => gp.includes(x);
  const inT = (x: number) => gt.includes(x);
  const j = peaceJudgeOf(eg, w, id, target, whole, day, f);
  // The value that lifts the target's chance to the aim (rounded up), and
  // the room a demand has above it (rounded down).
  const want =
    j.winNeed + Math.ceil((j.unit * (AI_NEG_AIM_PCT - j.pct)) / 1000);
  const room = negPeacePctValue(j, j.pct - AI_NEG_AIM_PCT) - j.winNeed;
  const t = noPeaceTerms();
  const regions = eg.ww.scenario.landRegions.map((r) => r.id);
  /**
   * Most valuable first: each that keeps the total within `most` and the
   * terms legal, until the total reaches `enough`. The total.
   */
  const fill = (
    list: number[],
    cands: number[],
    value: (r: number) => number,
    enough: number,
    most: number,
  ): number => {
    const vals = new Map(cands.map((r) => [r, value(r)]));
    cands.sort((a, b) => vals.get(b)! - vals.get(a)! || a - b);
    let sum = 0;
    for (const r of cands) {
      if (sum >= enough || list.length >= WW_NEG_PEACE_MAX_REGIONS) break;
      const v = vals.get(r)!;
      if (v <= 0 || sum + v > most) continue;
      list.push(r);
      if (negPeaceTermsBlock(f, sens, t, id, target) !== null) {
        list.pop();
        continue;
      }
      sum += v;
    }
    return sum;
  };
  if (want > 0) {
    const mine = acceptPct(eg, w, target, id, true, day);
    const most = negPeacePctValue(j, Math.max(0, mine - AI_NEG_GIVE_FROM_PCT));
    if (most <= 0) return null;
    const held = regions.filter(
      (r) => f.legalOwner(r) === id && inT(f.controller(r)),
    );
    let sum = fill(
      t.give,
      held,
      (r) => negPeaceRegionValue(f, r, inT),
      want,
      most,
    );
    // Reparations: the smallest level that reaches the aim, else the
    // largest that still fits.
    for (let lv = 1; lv <= WW_NEG_REPARATIONS_MAX_LEVEL && sum < want; lv++) {
      const v = negPeaceRepValue(negPeaceRepK(f.civs(id), lv));
      if (v <= 0 || sum + v > most) break;
      t.pay = lv;
      if (sum + v >= want) sum += v;
    }
  } else if (room > 0 && heldPm(eg, gp, gt) > heldPm(eg, gt, gp)) {
    const held = regions.filter(
      (r) => f.legalOwner(r) === target && inP(f.controller(r)),
    );
    fill(t.take, held, (r) => negPeaceRegionValue(f, r, inP), room, room);
  }
  if (!hasPeaceTerms(t)) return null;
  return negPeaceTermsBlock(f, sens, t, id, target) === null ? t : null;
}

// ---- Screens ----

/** An offer's terms as the card reads them (null: a white peace). */
export function peaceTermsView(
  eg: WwEndgame,
  o: PeaceOffer,
): WwPeaceOfferView["terms"] {
  const t = o.terms;
  if (t === undefined || !hasPeaceTerms(t)) return null;
  const civs = (id: number) => eg.ww.economy.country(id)?.totals.civ ?? 0;
  return {
    give: [...t.give],
    take: [...t.take],
    pay: t.pay,
    demand: t.demand,
    free: [...t.free],
    payK: negPeaceRepK(civs(o.from), t.pay),
    demandK: negPeaceRepK(civs(o.to), t.demand),
  };
}

/**
 * The judge's war facts for every human country that may offer peace in
 * an ongoing normal war (the composer's hint), once a day; null when
 * unchanged since sent (read-only: screens only).
 */
export function peaceJudgeData(
  eg: WwEndgame,
  first: boolean,
): WwPeaceJudgeRow[] | null {
  const day = eg.lastCommonDay;
  if (!first && day === eg.judgeDay) return null;
  eg.judgeDay = day;
  const rows: WwPeaceJudgeRow[] = [];
  let f: NegPeaceFacts | null = null;
  for (const w of eg.wars) {
    if (w.ended !== null || w.kind !== "normal" || day < 0) continue;
    for (const s of [0, 1] as const) {
      const target = w.sides[s === 0 ? 1 : 0].leader;
      if (target <= 0) continue;
      for (const m of w.sides[s].members) {
        if (!fighting(m) || !eg.isHumanControlled(m.id)) continue;
        f ??= negPeaceFacts(eg);
        const whole = w.sides[s].leader === m.id;
        const j = peaceJudgeOf(eg, w, m.id, target, whole, day, f);
        rows.push({ war: w.id, from: m.id, to: target, ...j });
      }
    }
  }
  const json = JSON.stringify(rows);
  if (!first && json === eg.judgeSent) return null;
  eg.judgeSent = json;
  return rows;
}
