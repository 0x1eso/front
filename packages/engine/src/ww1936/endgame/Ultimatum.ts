// World War 1936 diplomacy D5 (ww161 Design B §5; lane L4): the peacetime
// ultimatum — sending it, the target's card (give or refuse; a timeout is a
// refusal), its AI answer and the `diplomacy` auto switch, the guarantors'
// notice, and the AI's own ultimatums.
//
// A sender (fascist or communist any time, a neutral from 25% world
// tension, a democracy never) at peace with the target, outside its faction,
// with no pact with it and no guarantee of it (and neither is the other's
// overlord), names up to 6 of the target's legal regions: never its capital
// or a zone, each the sender's core, in one of its claim groups or bordering
// its legal land, at most 15% of the target's victory points in all. It pays
// 50 PP and adds tension as a justification would. The target gives (the
// regions change legal owner peacefully, it loses stability, the sender
// gains war support) or refuses (the sender gets a ready claim war goal on
// it for 180 days). The pair waits 365 days, 180 after a refusal.
//
// A human target's card is the one answer card it shares with peace offers
// and deals, shown one at a time in id order (as Deals.ts does): an
// ultimatum waiting behind another card keeps deadlineTick −1 and gets its
// full window once it is in front. An AI target answers on the next tick.
// Integers only; countries, regions and offers by id; rolls by idHash.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DIPLO_NOTICES,
  noticeId,
  WW_ULT_AI_DAYS,
  WW_ULT_AI_TENSION_PCT,
  WW_ULT_CARD_TICKS,
  WW_ULT_COOLDOWN_DAYS,
  WW_ULT_GOAL_DAYS,
  WW_ULT_MAX_REGIONS,
  WW_ULT_MAX_VP_PCT,
  WW_ULT_NEUTRAL_TENSION_PCT,
  WW_ULT_PP,
  WW_ULT_REFUSED_DAYS,
  WW_ULT_STABILITY_LOSS_PCT,
  WW_ULT_TENSION_MAJOR_PCT,
  WW_ULT_TENSION_PCT,
  WW_ULT_WS_GAIN_PCT,
} from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { IDEO_DEM, IDEO_NEU } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { ContentRegistry } from "@openfront/engine-lib/ww1936/content/registry";
import {
  historicalAiActive,
  wwRealTicks,
} from "@openfront/engine-lib/ww1936/Pace";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { aiStrength } from "../politics/AiPolitics";
import { isMajor } from "../politics/Factions";
import { payPp } from "../politics/PayPp";
import { addTension, scaledTension } from "../politics/Tension";
import { addWarGoal } from "../politics/WarGoals";
import { claimsRegion } from "./Deals";
import {
  cardFrontId,
  diploCooldownUntil,
  setDiploCooldown,
  type StoredUltimatum,
} from "./DiploState";
import { validId } from "./LendLease";
import { countryParams } from "./Wars";
import type { WwEndgame } from "./WwEndgame";

const P_ULT = idHash("ultimatum");
const P_ULT_AI = idHash("ultimatum_ai");
const MAX_BP = 10_000;

// ---- The AI target's answer (points, then a seeded roll; L7 tunes) ----
/** The chance to give before anything else, percent. */
export const WW_ULT_AI_BASE_PCT = 10;
/** Points by the sender's strength over the target's own (percent), first step reached… */
export const WW_ULT_AI_STRONG_STEPS: readonly (readonly [number, number])[] = [
  [300, 60],
  [200, 40],
  [150, 15],
  [100, 0],
];
/** …and below the last step (a weaker sender). */
export const WW_ULT_AI_WEAK_PTS = -30;
/** Each major guarantor of the target. */
export const WW_ULT_AI_GUARANTOR_PTS = -25;
/** The target is in a faction. */
export const WW_ULT_AI_FACTION_PTS = -20;
/** The sender rules by the target's ideology. */
export const WW_ULT_AI_SAME_IDEOLOGY_PTS = 10;
/** One point off per this much war support over 50% (bp). */
export const WW_ULT_AI_WS_BP_PER_PT = 200;
/** One point off per this much of its victory points asked (‰). */
export const WW_ULT_AI_VP_PM_PER_PT = 10;
/** The chance never goes over this (percent). */
export const WW_ULT_AI_MAX_PCT = 95;

/** What the AI target weighs. */
export interface UltimatumFacts {
  /** aiStrength of the sender and of the target. */
  senderStrength: number;
  targetStrength: number;
  /** Major guarantors of the target (the sender aside). */
  majorGuarantors: number;
  inFaction: boolean;
  sameIdeology: boolean;
  /** The target's war support, bp. */
  wsBp: number;
  /** The share of its victory points asked, ‰. */
  vpPm: number;
}

/** The AI target's chance to give in, percent (0..WW_ULT_AI_MAX_PCT). */
export function ultimatumGivePct(f: UltimatumFacts): number {
  const ratio = Math.floor(
    (f.senderStrength * 100) / Math.max(1, f.targetStrength),
  );
  let pts = WW_ULT_AI_BASE_PCT;
  const step = WW_ULT_AI_STRONG_STEPS.find(([at]) => ratio >= at);
  pts += step === undefined ? WW_ULT_AI_WEAK_PTS : step[1];
  pts += WW_ULT_AI_GUARANTOR_PTS * f.majorGuarantors;
  if (f.inFaction) pts += WW_ULT_AI_FACTION_PTS;
  if (f.sameIdeology) pts += WW_ULT_AI_SAME_IDEOLOGY_PTS;
  pts -= Math.floor(Math.max(0, f.wsBp - 5000) / WW_ULT_AI_WS_BP_PER_PT);
  pts -= Math.floor(Math.max(0, f.vpPm) / WW_ULT_AI_VP_PM_PER_PT);
  return Math.max(0, Math.min(WW_ULT_AI_MAX_PCT, pts));
}

// ---- Facts ----

/** The capital region of `id` (0: none). */
function capitalOf(eg: WwEndgame, id: number): number {
  const sc = eg.ww.scenario;
  const tag = sc.tagOfSmallId(id);
  const tile = tag === undefined ? null : sc.capitalTileOrNull(tag);
  return tile === null ? 0 : sc.regionAt(tile);
}

/** `to`'s legal victory points, and those of `regions` among them. */
function legalVp(
  eg: WwEndgame,
  to: number,
  regions: readonly number[] = [],
): { total: number; asked: number } {
  const legal = eg.ww.politics.legalOwner;
  let total = 0;
  let asked = 0;
  for (const r of eg.ww.scenario.landRegions) {
    if ((legal[r.id] ?? 0) !== to) continue;
    total += r.vp;
    if (regions.includes(r.id)) asked += r.vp;
  }
  return { total, asked };
}

/** `regions`' share of `to`'s legal victory points, ‰ (DiploState's view reads it the same way). */
export function ultimatumVpPm(
  eg: WwEndgame,
  to: number,
  regions: readonly number[],
): number {
  const { total, asked } = legalVp(eg, to, regions);
  return total > 0 ? Math.floor((asked * 1000) / total) : 0;
}

/** Why `from`'s government may not send an ultimatum now (null: it may). */
export function ultimatumGovBlock(
  eg: WwEndgame,
  from: number,
): WwOrderBlock | null {
  const pol = eg.ww.politics;
  const c = pol.country(from);
  if (c === null) return "dead";
  // ww194: the Imjin courts are not 1936 governments (no democracy's ban,
  // no neutral's tension line).
  if (eg.ww.imjin) return null;
  if (c.ruling === IDEO_DEM) return "ultimatum_gov";
  if (c.ruling === IDEO_NEU && pol.wtBp < WW_ULT_NEUTRAL_TENSION_PCT * 100) {
    return "ultimatum_gov";
  }
  return null;
}

/** Why `from` may not send `to` an ultimatum, whatever it asks (null: it may). */
export function ultimatumPairBlock(
  eg: WwEndgame,
  from: number,
  to: number,
  day: number,
): WwOrderBlock | null {
  const ww = eg.ww;
  const pol = ww.politics;
  if (!eg.isActor(from) || eg.exileHost(from) > 0) return "dead";
  if (to === from || !validId(eg, to) || !eg.isActor(to)) return "bad_target";
  if (eg.exileHost(to) > 0) return "bad_target";
  const gov = ultimatumGovBlock(eg, from);
  if (gov !== null) return gov;
  if (
    ww.isAtWar(from, to) ||
    ww.sameFaction(from, to) ||
    pol.isAtWarBlockedByNap(from, to) ||
    pol.guarantees.some((g) => g.by === from && g.to === to) ||
    eg.subjectOf(to)?.overlord === from ||
    eg.subjectOf(from)?.overlord === to
  ) {
    return "ultimatum_relation";
  }
  if (
    diploCooldownUntil(eg, from, to, "ultimatum") > day ||
    eg.ultimatums.some((u) => u.from === from && u.to === to)
  ) {
    return "ultimatum_cooldown";
  }
  return null;
}

/** `region` may be asked of `to` by `from`: its legal land, not its capital or a zone; `from`'s core, claim or bordering its legal land. */
export function ultimatumRegionOk(
  eg: WwEndgame,
  from: number,
  to: number,
  region: number,
  capital: number = capitalOf(eg, to),
): boolean {
  const ww = eg.ww;
  const sc = ww.scenario;
  const legal = ww.politics.legalOwner;
  if (sc.region(region) === undefined || region === capital) return false;
  if ((legal[region] ?? 0) !== to || eg.isZone(region)) return false;
  return (
    eg.hasCore(from, region) ||
    claimsRegion(eg, from, region) ||
    sc.regionNeighbours(region).some((n) => (legal[n] ?? 0) === from)
  );
}

/** Why these regions may not be asked of `to` (null: they may). */
export function ultimatumRegionsBlock(
  eg: WwEndgame,
  from: number,
  to: number,
  regions: readonly number[],
): WwOrderBlock | null {
  if (
    regions.length === 0 ||
    regions.length > WW_ULT_MAX_REGIONS ||
    new Set(regions).size !== regions.length
  ) {
    return "ultimatum_bad_regions";
  }
  const capital = capitalOf(eg, to);
  for (const r of regions) {
    if (!ultimatumRegionOk(eg, from, to, r, capital)) {
      return "ultimatum_bad_regions";
    }
  }
  const { total, asked } = legalVp(eg, to, regions);
  return asked * 100 > WW_ULT_MAX_VP_PCT * total ? "ultimatum_too_much" : null;
}

/** Why `from` may not send this ultimatum today (null: it may). */
export function ultimatumBlock(
  eg: WwEndgame,
  from: number,
  to: number,
  regions: readonly number[],
  day: number,
): WwOrderBlock | null {
  return (
    ultimatumPairBlock(eg, from, to, day) ??
    ultimatumRegionsBlock(eg, from, to, regions)
  );
}

// ---- Sending ----

const cardTicks = (eg: WwEndgame): number =>
  wwRealTicks(eg.mg.config().gameConfig(), WW_ULT_CARD_TICKS);

/**
 * ultimatum from `from` to `target` for `regions`: checked, 50 PP, tension
 * as a justification (scaled), the pair's wait starts; the target's
 * guarantors hear of it and the world reads a news line. Then pending.
 */
export function sendUltimatum(
  eg: WwEndgame,
  from: number,
  target: number,
  regions: readonly number[],
  tick: number,
): WwOrderBlock | null {
  const ww = eg.ww;
  const day = ww.day(tick);
  if (ww.inPrep(tick) || day < 0) return "ultimatum_cooldown";
  const block = ultimatumBlock(eg, from, target, regions, day);
  if (block !== null) return block;
  const pol = ww.politics;
  if (!payPp(pol, from, WW_ULT_PP)) return "no_pp";
  const pct = isMajor(pol, target)
    ? WW_ULT_TENSION_MAJOR_PCT
    : WW_ULT_TENSION_PCT;
  addTension(pol, from, scaledTension(pol, from, pct * 100));
  pol.markCountry(from);
  setDiploCooldown(eg, from, target, "ultimatum", day + WW_ULT_COOLDOWN_DAYS);
  const id = eg.nextOfferId++;
  const human = eg.isHumanControlled(target);
  eg.ultimatums.push({
    id,
    from,
    to: target,
    regions: [...regions].sort((a, b) => a - b),
    sentTick: tick,
    // An AI answers on the next tick; a human's card waits its turn.
    deadlineTick: !human
      ? tick
      : cardFrontId(eg, target) > id
        ? tick + cardTicks(eg)
        : -1,
  });
  eg.ultimatums.sort((a, b) => a.id - b.id);
  eg.dirtyDiplo = true;
  const names = countryParams(eg, { country: from, target });
  const guarantors = [...new Set(pol.guarantorsOf(target))].sort(
    (a, b) => a - b,
  );
  for (const g of guarantors) {
    if (g === from || !eg.isActor(g)) continue;
    eg.message(g, noticeId(DIPLO_NOTICES.ultimatumGuarantor), names);
  }
  eg.news("news_ultimatum", countryParams(eg, { a: from, b: target }));
  return null;
}

// ---- Answering ----

/** deal_reply by `by` to pending ultimatum `offer` (accept: give the regions). */
export function replyUltimatum(
  eg: WwEndgame,
  by: number,
  offer: number,
  accept: boolean,
  tick: number,
): WwOrderBlock | null {
  const u = eg.ultimatums.find((x) => x.id === offer && x.to === by);
  if (u === undefined) return "deal_no_offer";
  return resolveUltimatum(eg, u, accept, tick);
}

/** The ultimatum still means something: both play, at peace, every region still the target's legal land. */
function stands(eg: WwEndgame, u: StoredUltimatum): boolean {
  if (!eg.isActor(u.from) || !eg.isActor(u.to)) return false;
  if (eg.ww.isAtWar(u.from, u.to)) return false;
  const legal = eg.ww.politics.legalOwner;
  return u.regions.every((r) => (legal[r] ?? 0) === u.to);
}

/** The AI target's facts for an ultimatum from `from` to `to` for `regions`. */
export function ultimatumFacts(
  eg: WwEndgame,
  from: number,
  to: number,
  regions: readonly number[],
): UltimatumFacts {
  const pol = eg.ww.politics;
  const majors = new Set(
    pol
      .guarantorsOf(to)
      .filter((g) => g !== from && pol.living(g) && isMajor(pol, g)),
  );
  const t = pol.country(to);
  return {
    senderStrength: aiStrength(pol, from),
    targetStrength: aiStrength(pol, to),
    majorGuarantors: majors.size,
    inFaction: pol.factionIdx(to) >= 0,
    sameIdeology: t !== null && t.ruling === pol.country(from)?.ruling,
    wsBp: t?.wsBp ?? 0,
    vpPm: ultimatumVpPm(eg, to, regions),
  };
}

/** The ultimatum's seeded roll, 0..99. */
export function ultimatumRoll(eg: WwEndgame, u: StoredUltimatum): number {
  return (wwRoll(eg.ww.politics.seed, P_ULT, u.id, u.from, u.to) >>> 8) % 100;
}

/** The AI target's answer: give in when the roll is under its chance. */
export function aiGivesIn(eg: WwEndgame, u: StoredUltimatum): boolean {
  return (
    ultimatumRoll(eg, u) <
    ultimatumGivePct(ultimatumFacts(eg, u.from, u.to, u.regions))
  );
}

/**
 * The regions go to `from` as the scripted transfers move them
 * (Territory.transferGroup): legal owner (no core), control where `to`
 * holds them, its divisions there home, its building projects there ended.
 */
function cedeRegions(
  eg: WwEndgame,
  to: number,
  from: number,
  regions: readonly number[],
  tick: number,
): void {
  const pol = eg.ww.politics;
  const land = eg.ww.land;
  const moved: number[] = [];
  for (const r of regions) {
    pol.setLegalOwner(r, from);
    if (land.controller[r] !== to) continue;
    transferRegionPeaceful(land, r, from, tick);
    moved.push(r);
  }
  for (const r of moved) evictDivisions(land, r, to);
  const econ = eg.ww.economy;
  const ce = econ.country(to);
  if (ce !== null && moved.length > 0) {
    const kept = ce.queue.filter((q) => !moved.includes(q.region));
    if (kept.length !== ce.queue.length) {
      ce.queue = kept;
      econ.markCountryDirty(to);
    }
  }
  pol.markCountry(from);
  pol.markCountry(to);
  pol.markGlobal();
}

/** `from`'s claim group holding the most of `regions` ("" when none does). */
function claimGroupFor(
  eg: WwEndgame,
  from: number,
  regions: readonly number[],
): string {
  const pol = eg.ww.politics;
  const tag = pol.tagOf(from);
  let best = "";
  let most = 0;
  for (const row of pol.content.claims) {
    if (row.tag !== tag) continue;
    for (const g of row.groups) {
      const rs = pol.content.groupIdx.get(g)?.regions ?? [];
      const n = regions.filter((r) => rs.includes(r)).length;
      if (n > most) {
        most = n;
        best = g;
      }
    }
  }
  return best;
}

/**
 * Refused: a ready claim goal on `to` for WW_ULT_GOAL_DAYS, no
 * justification needed (a goal on it that lasts longer stays as it is).
 */
function readyGoal(
  eg: WwEndgame,
  from: number,
  to: number,
  regions: readonly number[],
  day: number,
): void {
  const pol = eg.ww.politics;
  const c = pol.country(from);
  if (c === null) return;
  const until = day + WW_ULT_GOAL_DAYS;
  const had = c.warGoals.find((g) => g.on === to);
  if (had !== undefined && had.untilDay >= until) return;
  addWarGoal(pol, from, to, "claim", claimGroupFor(eg, from, regions), day);
  const g = c.warGoals.find((x) => x.on === to);
  if (g !== undefined) g.untilDay = until;
  pol.message(to, "ww1936_justified_against", { countryTag: c.tag });
  pol.markCountry(from);
}

/**
 * Settles a pending ultimatum. One that no longer stands lapses (the sender
 * hears it); given, the regions change hands and the moods move; refused,
 * the sender gets its ready claim goal and a shorter wait.
 */
function resolveUltimatum(
  eg: WwEndgame,
  u: StoredUltimatum,
  give: boolean,
  tick: number,
): WwOrderBlock | null {
  eg.ultimatums = eg.ultimatums.filter((x) => x !== u);
  eg.dirtyDiplo = true;
  const ww = eg.ww;
  const pol = ww.politics;
  const day = Math.max(0, ww.day(tick));
  if (!stands(eg, u)) {
    eg.message(
      u.from,
      noticeId(DIPLO_NOTICES.ultimatumLapsed),
      countryParams(eg, { target: u.to }),
    );
    return give ? "deal_lapsed" : null;
  }
  const names = countryParams(eg, { country: u.to });
  if (!give) {
    readyGoal(eg, u.from, u.to, u.regions, day);
    setDiploCooldown(eg, u.from, u.to, "ultimatum", day + WW_ULT_REFUSED_DAYS);
    eg.message(u.from, noticeId(DIPLO_NOTICES.ultimatumRefused), {
      ...names,
      days: WW_ULT_GOAL_DAYS,
    });
    return null;
  }
  cedeRegions(eg, u.to, u.from, u.regions, tick);
  const t = pol.country(u.to);
  if (t !== null) {
    t.stabBaseBp = Math.max(0, t.stabBaseBp - WW_ULT_STABILITY_LOSS_PCT * 100);
  }
  const s = pol.country(u.from);
  if (s !== null) {
    s.wsBaseBp = Math.min(MAX_BP, s.wsBaseBp + WW_ULT_WS_GAIN_PCT * 100);
  }
  eg.message(u.from, noticeId(DIPLO_NOTICES.ultimatumGiven), {
    ...names,
    regions: u.regions.join(","),
  });
  eg.news("news_ultimatum_given", countryParams(eg, { a: u.from, b: u.to }));
  return null;
}

/**
 * Every tick (WwEndgame.tick), in id order: one that no longer stands
 * lapses; an AI target answers; a human with the `diplomacy` auto switch
 * on has its AI answer for it; a human card comes to the front (its window
 * starts) or runs out (refused).
 */
export function stepUltimatums(eg: WwEndgame, tick: number): void {
  if (eg.ultimatums.length === 0) return;
  for (const u of [...eg.ultimatums]) {
    if (!eg.ultimatums.includes(u)) continue;
    if (!stands(eg, u)) resolveUltimatum(eg, u, false, tick);
    else if (!eg.isHumanControlled(u.to) || eg.ww.autoOn(u.to, "diplomacy")) {
      resolveUltimatum(eg, u, aiGivesIn(eg, u), tick);
    } else if (u.deadlineTick < 0) {
      if (cardFrontId(eg, u.to) === u.id) {
        u.deadlineTick = tick + cardTicks(eg);
        eg.dirtyDiplo = true;
      }
    } else if (tick >= u.deadlineTick) resolveUltimatum(eg, u, false, tick);
  }
}

// ---- The AI's own ultimatums ----

/** Per content: each history beat's target tags (its act's target, or the tags its decision names). */
const BEAT_TARGETS = new WeakMap<ContentRegistry, Set<string>[]>();
function beatTargets(content: ContentRegistry): Set<string>[] {
  let list = BEAT_TARGETS.get(content);
  if (list !== undefined) return list;
  list = content.beats.map((b) => {
    const out = new Set<string>();
    const act = b.act;
    if ("target" in act && act.target !== undefined) out.add(act.target);
    if (act.kind === "decision") {
      const i = content.decisionIdx.get(act.id);
      const d = i === undefined ? undefined : content.decisions[i];
      // The tags its conditions and effects name (T("LTU") and the like).
      const text = d === undefined ? "" : JSON.stringify(d);
      for (const m of text.matchAll(/"([A-Z]{3})"/g)) out.add(m[1]);
    }
    out.delete(b.actor);
    return out;
  });
  BEAT_TARGETS.set(content, list);
  return list;
}

/** With the historical AI on, a beat of `id`'s still to come names `target` (Munich, Memel…: the script's pair). */
export function scriptedPair(
  eg: WwEndgame,
  id: number,
  target: number,
  day: number,
): boolean {
  const pol = eg.ww.politics;
  if (!historicalAiActive(eg.mg.config(), day)) return false;
  const me = pol.tagOf(id);
  const tag: CountryTag = pol.tagOf(target);
  const targets = beatTargets(pol.content);
  return pol.content.beats.some((b, i) => {
    const s = pol.beats[i];
    return (
      b.actor === me &&
      s !== undefined &&
      !s.done &&
      !s.skipped &&
      (targets[i]?.has(tag) ?? false)
    );
  });
}

/**
 * The regions of `t` the AI `id` would ask for: those of its claim groups
 * that may be asked, smallest first, while within WW_ULT_MAX_REGIONS and
 * WW_ULT_MAX_VP_PCT of `t`'s victory points.
 */
export function aiUltimatumRegions(
  eg: WwEndgame,
  id: number,
  t: number,
): number[] {
  const pol = eg.ww.politics;
  const sc = eg.ww.scenario;
  const tag = pol.tagOf(id);
  const capital = capitalOf(eg, t);
  const cand = new Set<number>();
  for (const row of pol.content.claims) {
    if (row.tag !== tag) continue;
    for (const g of row.groups) {
      for (const r of pol.content.groupIdx.get(g)?.regions ?? []) {
        if (ultimatumRegionOk(eg, id, t, r, capital)) cand.add(r);
      }
    }
  }
  if (cand.size === 0) return [];
  const vp = (r: number) => sc.region(r)?.vp ?? 0;
  const { total } = legalVp(eg, t);
  const out: number[] = [];
  let sum = 0;
  for (const r of [...cand].sort((a, b) => vp(a) - vp(b) || a - b)) {
    if (out.length >= WW_ULT_MAX_REGIONS) break;
    if ((sum + vp(r)) * 100 > WW_ULT_MAX_VP_PCT * total) continue;
    sum += vp(r);
    out.push(r);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Daily for an AI country (staggered by smallID), once every
 * WW_ULT_AI_DAYS: one ultimatum to a neighbour holding land of its claim
 * groups, at most half its strength, that no major guarantees (unless world
 * tension is WW_ULT_AI_TENSION_PCT or more) and no other ultimatum waits
 * on. With the historical AI on, a pair a beat still to come names is left
 * to the script.
 */
export function aiUltimatumDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (day < 0 || (day + id) % WW_ULT_AI_DAYS !== 0) return;
  if (!eg.isActor(id) || ultimatumGovBlock(eg, id) !== null) return;
  const ww = eg.ww;
  const pol = ww.politics;
  const c = pol.country(id);
  if (c === null || c.ppMilli < WW_ULT_PP * 1000) return;
  if (eg.ultimatums.some((u) => u.from === id)) return;
  const mine = aiStrength(pol, id);
  if (mine <= 0) return;
  const tense = pol.wtBp >= WW_ULT_AI_TENSION_PCT * 100;
  const near = [...ww.economy.countryNeighbours(id)].sort((a, b) => a - b);
  if (near.length === 0) return;
  // The neighbours from a seeded start, so no one is always asked first.
  const start = (wwRoll(pol.seed, P_ULT_AI, id, day, 0) >>> 8) % near.length;
  for (let k = 0; k < near.length; k++) {
    const t = near[(start + k) % near.length];
    if (ultimatumPairBlock(eg, id, t, day) !== null) continue;
    if (aiStrength(pol, t) * 2 > mine) continue;
    const guarded = pol
      .guarantorsOf(t)
      .some((g) => g !== id && pol.living(g) && isMajor(pol, g));
    if (guarded && !tense) continue;
    if (eg.ultimatums.some((u) => u.to === t)) continue;
    if (scriptedPair(eg, id, t, day)) continue;
    const regions = aiUltimatumRegions(eg, id, t);
    if (regions.length === 0) continue;
    if (sendUltimatum(eg, id, t, regions, tick) === null) return;
  }
}
