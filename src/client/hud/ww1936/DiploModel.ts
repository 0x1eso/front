// World War 1936 diplomacy on the screens (ww161 Design B §6–§7; ww162
// lane L6): the country panel's rows (거래 제안, 최후통첩, 참전 약속, 협력
// 정부 세우기, 단독 강화), the composer's views (a deal's two columns, an
// ultimatum's or a collaboration government's regions), the one answer
// card's queue (peace offers, deals and ultimatums, oldest first) and the
// war card's lines. Reads only the views and engine-lib; the engine checks
// everything again and its block reason wins.
//
// The client's checks mirror the design's rules where the views carry the
// facts. The deal's chance bar values items with engine-lib DiploRules,
// the engine's own function, fed by the views and the engine's dealJudge
// row; the promise checks are PromiseRules'.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  type DealItem,
  WW_COLLAB_MIN_VP_PCT,
  WW_COLLAB_PP,
  WW_DEAL_CARD_TICKS,
  WW_DEAL_LL_MAX_MONTHS,
  WW_DEAL_MAX_ITEMS,
  WW_DEAL_PP,
  WW_ULT_CARD_TICKS,
  WW_ULT_MAX_REGIONS,
  WW_ULT_MAX_VP_PCT,
  WW_ULT_NEUTRAL_TENSION_PCT,
  WW_ULT_PP,
  WW_ULT_REFUSED_DAYS,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  type EquipmentType,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_PP,
  type WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  IDEO_DEM,
  IDEOLOGIES,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  type CollabRegionFacts,
  collabRegionOk,
} from "@openfront/engine-lib/ww1936/CollabRules";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  accessGivePoints,
  dealAcceptPct,
  dealNetPoints,
  dealShapeBlock,
  type DealValueFacts,
  guaranteePoints,
  isGift,
  licencePoints,
  WW_DEAL_LICENCE_GIVE_PTS,
  WW_DEAL_SCORE_ZERO,
  WW_DEAL_VETO,
} from "@openfront/engine-lib/ww1936/DiploRules";
import {
  promiseGateBlock,
  promisePairBlock,
  WW_PROMISE_JOIN_PTS,
} from "@openfront/engine-lib/ww1936/PromiseRules";
import { translateText } from "../../Utils";
import {
  type DealForm,
  type DealMode,
  type DealSide,
  dealUiOf,
} from "./DealUi";
import { DEAL_ITEM_KEYS, DEAL_KIND_KEYS, DEAL_UI_KEYS } from "./DiploKeys";
import { BLOCK_KEYS } from "./EconomyModel";
import {
  coreHoldersNow,
  type EndgameGame,
  llGenName,
  llItemName,
} from "./EndgameModel";
import { countryText } from "./EndgameNames";
import { negPeaceFactsOf, type NegPeaceGame } from "./NegPeaceModel";
import { peaceGroupName, peaceRegionName } from "./PeaceModel";
import {
  whitePeaceCardModel,
  type WhitePeaceCardView,
} from "./WhitePeaceModel";
import { today, wwActive, wwSeconds, wwWindowTicks } from "./WorldWarModel";

export type DiploGame = NegPeaceGame;

const blockText = (b: WwOrderBlock): string => translateText(BLOCK_KEYS[b]);
const ppText = (pp: number): string =>
  translateText("ww1936.pol.pp_amount", { pp });

// ---- Facts from the views ----

function ppMilli(game: DiploGame, id: number): number {
  return game.wwPolitics?.()?.summary(id)?.ppMilli ?? 0;
}

function rulingOf(game: DiploGame, id: number): number {
  return (
    game.wwPolitics?.()?.summary(id)?.ruling ?? IDEOLOGIES.indexOf("neutral")
  );
}

function factionIdx(game: DiploGame, id: number): number {
  const fs = game.wwPolitics?.()?.global?.factions ?? [];
  return fs.find((f) => f.members.includes(id))?.idx ?? -1;
}

function napBetween(game: DiploGame, a: number, b: number): boolean {
  return (game.wwPolitics?.()?.global?.naps ?? []).some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

function guaranteesOf(game: DiploGame, by: number, to: number): boolean {
  return (game.wwPolitics?.()?.global?.guarantees ?? []).some(
    ([x, y]) => x === by && y === to,
  );
}

function wtBp(game: DiploGame): number {
  return game.wwPolitics?.()?.global?.wtBp ?? 0;
}

function wtPct(game: DiploGame): number {
  return Math.floor(wtBp(game) / 100);
}

/** My ongoing wars, oldest first. */
function myWars(game: DiploGame, me: number): WwWarSummary[] {
  return (game.wwEndgame?.()?.wars ?? []).filter(
    (w) => !w.ended && w.sides.some((s) => s.members.some((m) => m.id === me)),
  );
}

function sideIndex(w: WwWarSummary, id: number): number {
  return w.sides.findIndex((s) => s.members.some((m) => m.id === id));
}

function atWarWith(game: DiploGame, a: number, b: number): boolean {
  return myWars(game, a).some((w) => {
    const sa = sideIndex(w, a);
    const sb = sideIndex(w, b);
    return sa >= 0 && sb >= 0 && sa !== sb;
  });
}

/** Region groups a country claims (content). */
function claimGroups(game: DiploGame, id: number): readonly string[] {
  const tag = game.worldWarScenario()?.tagOfSmallId(id);
  return CONTENT.claims.find((c) => c.tag === tag)?.groups ?? [];
}

function groupRegions(group: string): readonly number[] {
  return CONTENT.groupIdx.get(group)?.regions ?? [];
}

/** A region's share of `owner`'s legal victory points, percent (floor). */
function vpPct(game: DiploGame, regions: readonly number[], owner: number) {
  const f = negPeaceFactsOf(game);
  if (f === null) return 0;
  let vp = 0;
  for (const r of regions) vp += f.vp(r);
  const total = f.legalVp(owner);
  return total > 0 ? Math.floor((vp * 100) / total) : 0;
}

// ---- Item names ----

function equipKeyName(key: number): string {
  const k = EQUIP_KEYS[key];
  if (k === undefined) return "";
  return `${llItemName(k[0])} ${llGenName(k[0], k[1])}`.trim();
}

/** One deal item as a chip's text. */
export function dealItemText(game: DiploGame, item: DealItem): string {
  const sc = game.worldWarScenario();
  const key = DEAL_ITEM_KEYS[item.kind];
  switch (item.kind) {
    case "region":
      return translateText(key, {
        region: sc === null ? "" : peaceRegionName(sc, item.region),
      });
    case "equipment":
      return translateText(key, {
        item: equipKeyName(item.key),
        count: item.count,
      });
    case "lend_lease":
      return translateText(key, {
        item: `${llItemName(item.item)} ${llGenName(item.item, item.gen)}`.trim(),
        perMonth: item.perMonth,
        months: item.months,
      });
    case "licence":
      return translateText(key, { design: equipKeyName(item.key) });
    case "promise":
      return translateText(key, {
        country: countryText(game, item.target),
        group: peaceGroupName(item.group),
      });
    case "join_war":
      return translateText(key, { country: countryText(game, item.target) });
    default:
      return translateText(key);
  }
}

// ---- The valuation (engine-lib DiploRules, the engine's own) ----

/** `a` and `b` fight on one side of an ongoing war. */
function sameSideWith(game: DiploGame, a: number, b: number): boolean {
  return myWars(game, a).some((w) => {
    const sa = sideIndex(w, a);
    return sa >= 0 && sa === sideIndex(w, b);
  });
}

/** The facts PromiseRules' pair check reads, from the views. */
function warFacts(game: DiploGame) {
  return {
    atWar: (a: number, b: number) => atWarWith(game, a, b),
    sameSide: (a: number, b: number) => sameSideWith(game, a, b),
  };
}

/**
 * DiploRules' value facts for `judge`'s view of an offer from `me`: the
 * map, cores and claims from the views, and the parts only the engine can
 * price from its dealJudge row for (me, judge). Before a row came: the
 * neutral defaults.
 */
export function dealValueFactsOf(
  game: DiploGame,
  me: number,
  judge: number,
): DealValueFacts | null {
  const f = negPeaceFactsOf(game);
  const sc = game.worldWarScenario();
  if (f === null || sc === null) return null;
  const row = game.wwEndgame?.()?.dealJudgeFor(me, judge) ?? null;
  const claimed = new Map<number, Set<number>>();
  const claims = (id: number, r: number) => {
    let set = claimed.get(id);
    if (set === undefined) {
      set = new Set(claimGroups(game, id).flatMap((g) => groupRegions(g)));
      claimed.set(id, set);
    }
    return set.has(r);
  };
  const hasWar = (id: number) => myWars(game, id).length > 0;
  return {
    legalOwner: f.legalOwner,
    regionBase: f.base,
    vp: f.vp,
    neighbours: (r) => sc.regionNeighbours(r),
    groupRegions,
    hasCore: (id, r) => coreHoldersNow(game, r).includes(id),
    claims,
    wartime: (g, t) => sameSideWith(game, g, t) || hasWar(g) || hasWar(t),
    cedesTo: (j, t) => j === judge && t === me && row?.cede === true,
    accessGetPts: () => row?.access ?? 0,
    accessGivePts: () =>
      row?.accessGive ?? accessGivePoints(WW_DEAL_SCORE_ZERO),
    napPts: () => row?.nap ?? 0,
    guaranteePts: (_j, _o, gets) =>
      (gets ? row?.guarantee : row?.guaranteeGive) ??
      guaranteePoints(gets, false, true),
    // A licence the judge gets: the tech gap is the engine's (0 here).
    licencePts: (_g, taker, _i, j) =>
      j === taker
        ? licencePoints(0)
        : (row?.licence ?? -WW_DEAL_LICENCE_GIVE_PTS),
    hasArmy: () => (row?.join ?? 0) > 0,
    joinPts: (_joiner, war) =>
      row === null || (row.joinWars ?? []).includes(war)
        ? -WW_PROMISE_JOIN_PTS
        : WW_DEAL_VETO,
  };
}

export type DealChanceLevel = "none" | "low" | "medium" | "high";

/**
 * The bar under the composer: the target's value of the deal (what it gets
 * less what it gives, DiploRules as the engine values it) against the
 * margin its AI wants (the dealJudge row; 0 before one came), as the
 * engine's accept chance. Percent 0–100 and the level in words.
 */
export function dealChance(
  game: DiploGame,
  me: number,
  to: number,
  give: readonly DealItem[],
  take: readonly DealItem[],
): { pct: number; level: DealChanceLevel } {
  const v = dealValueFactsOf(game, me, to);
  const net = v === null ? 0 : dealNetPoints(v, me, to, give, take);
  const margin = game.wwEndgame?.()?.dealJudgeFor(me, to)?.margin ?? 0;
  const pct = dealAcceptPct(net, margin, isGift(give, take));
  const level: DealChanceLevel =
    pct >= 75 ? "high" : pct >= 50 ? "medium" : pct > 0 ? "low" : "none";
  return { pct, level };
}

/** A country a human controls now. */
export function isHumanCountry(game: DiploGame, id: number): boolean {
  return game.wwEndgame?.()?.controllers.some(([, x]) => x === id) ?? false;
}

// ---- The country panel's rows ----

export type DiploRowId =
  | "deal"
  | "ultimatum"
  | "promise"
  | "collab"
  | "separate";

/** What a row's tap does: open the composer, or the negotiated peace composer of war `war` toward `target`. */
export type DiploAct =
  | {
      kind: "compose";
      mode: DealMode;
      to: number;
      give?: DealItem[];
      take?: DealItem[];
      regions?: number[];
    }
  | { kind: "peace"; war: number; target: number };

export interface DiploRow {
  id: DiploRowId;
  label: string;
  cost: string | null;
  block: string | null;
  act: DiploAct;
}

function dealPairBlock(
  game: DiploGame,
  me: number,
  other: number,
): WwOrderBlock | null {
  const eg = game.wwEndgame?.() ?? null;
  if ((eg?.dealBetween(me, other) ?? null) !== null) return "deal_pending";
  if ((eg?.diploCooldownUntil(me, other, "deal_refused") ?? 0) > today(game)) {
    return "deal_cooldown";
  }
  return null;
}

function ppBlock(game: DiploGame, me: number, pp: number): string | null {
  return ppMilli(game, me) < pp * 1000 ? blockText("no_pp") : null;
}

/** The ultimatum's government and relation gate (null: it may be sent). */
export function ultimatumGate(
  game: DiploGame,
  me: number,
  other: number,
): WwOrderBlock | null {
  const eg = game.wwEndgame?.() ?? null;
  if (eg?.isExile(me) === true) return "dead";
  if (eg?.isExile(other) === true) return "bad_target";
  const ruling = rulingOf(game, me);
  if (ruling === IDEO_DEM) return "ultimatum_gov";
  if (
    IDEOLOGIES[ruling] === "neutral" &&
    wtPct(game) < WW_ULT_NEUTRAL_TENSION_PCT
  ) {
    return "ultimatum_gov";
  }
  const fi = factionIdx(game, me);
  if (
    atWarWith(game, me, other) ||
    (fi >= 0 && fi === factionIdx(game, other)) ||
    napBetween(game, me, other) ||
    guaranteesOf(game, me, other) ||
    eg?.subjectOf(other)?.overlord === me ||
    eg?.subjectOf(me)?.overlord === other
  ) {
    return "ultimatum_relation";
  }
  if (
    (game.wwEndgame?.()?.diploCooldownUntil(me, other, "ultimatum") ?? 0) >
    today(game)
  ) {
    return "ultimatum_cooldown";
  }
  return null;
}

/** The target's regions an ultimatum may name: legal, not the capital, my core or claim or bordering my land. */
export function ultimatumCandidates(
  game: DiploGame,
  me: number,
  target: number,
): number[] {
  const sc = game.worldWarScenario();
  const f = negPeaceFactsOf(game);
  if (sc === null || f === null) return [];
  const capital = f.capital(target);
  const claimed = new Set<number>();
  for (const g of claimGroups(game, me)) {
    for (const r of groupRegions(g)) claimed.add(r);
  }
  const out: number[] = [];
  for (const r of sc.landRegions) {
    if (f.legalOwner(r.id) !== target || r.id === capital) continue;
    if (f.isZone(r.id)) continue;
    const mine =
      claimed.has(r.id) ||
      coreHoldersNow(game, r.id).includes(me) ||
      sc.regionNeighbours(r.id).some((n) => f.legalOwner(n) === me);
    if (mine) out.push(r.id);
  }
  return out;
}

/**
 * The ultimatum's pre-picked regions (3 taps in all): my claimed or core
 * regions first, then bordering ones, smallest first, while they stay
 * within 6 regions and 15% of the target's victory points.
 */
export function ultimatumPrepick(
  game: DiploGame,
  me: number,
  target: number,
): number[] {
  const f = negPeaceFactsOf(game);
  if (f === null) return [];
  const claimed = new Set<number>();
  for (const g of claimGroups(game, me)) {
    for (const r of groupRegions(g)) claimed.add(r);
  }
  const rank = (r: number) =>
    claimed.has(r) || coreHoldersNow(game, r).includes(me) ? 0 : 1;
  const list = ultimatumCandidates(game, me, target).sort(
    (a, b) => rank(a) - rank(b) || f.vp(a) - f.vp(b) || a - b,
  );
  const total = f.legalVp(target);
  const out: number[] = [];
  let vp = 0;
  for (const r of list) {
    if (out.length >= WW_ULT_MAX_REGIONS) break;
    if ((vp + f.vp(r)) * 100 > WW_ULT_MAX_VP_PCT * total) continue;
    vp += f.vp(r);
    out.push(r);
  }
  return out;
}

/**
 * The regions of a capitulated country a collaboration government may take
 * (CollabRules, the engine's rule): its legal land I control, not my cores
 * or claims, not at stake in the conference still to settle.
 */
export function collabCandidates(
  game: DiploGame,
  me: number,
  target: number,
): number[] {
  const sc = game.worldWarScenario();
  const f = negPeaceFactsOf(game);
  if (sc === null || f === null) return [];
  const claimed = new Set<number>();
  for (const g of claimGroups(game, me)) {
    for (const r of groupRegions(g)) claimed.add(r);
  }
  const conf = game.wwEndgame?.()?.conference() ?? null;
  const stake = new Set(
    conf === null || conf.status === "done"
      ? []
      : conf.stake.map((s) => s.region),
  );
  const facts: CollabRegionFacts = {
    legalOwner: f.legalOwner,
    controller: f.controller,
    hasCore: (id, r) => coreHoldersNow(game, r).includes(id),
    claims: (_id, r) => claimed.has(r),
    inOpenStake: (r) => stake.has(r),
  };
  return sc.landRegions
    .map((r) => r.id)
    .filter((r) => collabRegionOk(facts, me, target, r));
}

/** Capitulated (gone) or in exile: a country a collaboration government may stand for. */
function capitulated(game: DiploGame, id: number): boolean {
  const eg = game.wwEndgame?.() ?? null;
  return eg !== null && (eg.isExile(id) || eg.countryState(id) === "gone");
}

/** The country controlling the most of `target`'s legal victory points (0: none). */
function topOccupier(game: DiploGame, target: number): number {
  const sc = game.worldWarScenario();
  const f = negPeaceFactsOf(game);
  if (sc === null || f === null) return 0;
  const by = new Map<number, number>();
  for (const r of sc.landRegions) {
    if (f.legalOwner(r.id) !== target) continue;
    const c = f.controller(r.id);
    if (c === target || c <= 0) continue;
    by.set(c, (by.get(c) ?? 0) + r.vp);
  }
  let best = 0;
  let bestVp = -1;
  for (const [c, vp] of [...by.entries()].sort((a, b) => a[0] - b[0])) {
    if (vp > bestVp) {
      best = c;
      bestVp = vp;
    }
  }
  return best;
}

function collabGate(
  game: DiploGame,
  me: number,
  target: number,
): WwOrderBlock | null {
  if (rulingOf(game, me) === IDEO_DEM) return "collab_democracy";
  const sc = game.worldWarScenario();
  const tag = sc?.tagOfSmallId(target);
  const vic = sc?.smallIdOf("VIC") ?? 0;
  if (tag === "FRA" && vic > 0 && wwActive(game, vic)) return "collab_scripted";
  if (topOccupier(game, target) !== me) return "collab_not_occupier";
  return null;
}

/** The war, enemy leader and group a "참전 약속" to `other` names by default (null: none fits). */
function promiseDefaults(
  game: DiploGame,
  me: number,
  other: number,
): { war: number; target: number; group: string } | null {
  const f = negPeaceFactsOf(game);
  const sc = game.worldWarScenario();
  for (const w of myWars(game, me)) {
    if (w.kind !== "normal" || sideIndex(w, other) >= 0) continue;
    const s = sideIndex(w, me);
    const target = w.sides[1 - s]?.leader ?? 0;
    if (target <= 0) continue;
    // Prefer the neighbour's own claim on the enemy, else a group of the
    // enemy's that borders it.
    const owned = (g: string) =>
      f !== null && groupRegions(g).some((r) => f.legalOwner(r) === target);
    let group = claimGroups(game, other).find(owned) ?? "";
    if (group === "" && f !== null && sc !== null) {
      for (const g of CONTENT.groupIdx.keys()) {
        if (!owned(g)) continue;
        const touches = groupRegions(g).some((r) =>
          sc.regionNeighbours(r).some((n) => f.legalOwner(n) === other),
        );
        if (touches) {
          group = g;
          break;
        }
      }
    }
    return { war: w.id, target, group };
  }
  return null;
}

export interface SeparatePeaceButton {
  war: number;
  target: number;
  name: string;
  block: string | null;
  /** My offer in this war waits for its answer. */
  pending: boolean;
  /** The target is in exile: "come home as my subject" may go too. */
  exile: boolean;
}

/**
 * D1: in each ongoing war where I lead my side, a separate peace button
 * for every fighting enemy member but its leader (leader to leader is the
 * whole war, the war row's offer). A puppet is greyed: its overlord speaks
 * for it. The other reasons are the white peace's.
 */
export function separatePeaceButtons(
  game: DiploGame,
  me: number,
  w: WwWarSummary,
): SeparatePeaceButton[] {
  if (w.ended || me <= 0) return [];
  const s = sideIndex(w, me);
  if (s < 0 || w.sides[s].leader !== me) return [];
  const enemy = w.sides[1 - s];
  if (enemy === undefined) return [];
  const eg = game.wwEndgame?.() ?? null;
  const day = today(game);
  const pending = (eg?.offerFrom(me, w.id) ?? null) !== null;
  const out: SeparatePeaceButton[] = [];
  for (const m of enemy.members) {
    if (m.id === enemy.leader) continue;
    if (m.state !== "active" && m.state !== "exiled") continue;
    const sub = eg?.subjectOf(m.id) ?? null;
    const cool = eg?.cooldownUntil(me, m.id) ?? 0;
    let block: string | null = null;
    if (w.kind !== "normal") {
      block = translateText("ww1936.wpeace.block.war_kind");
    } else if (
      sub !== null &&
      (sub.level === "puppet" || sub.level === "integrated")
    ) {
      block = blockText("peace_puppet");
    } else if (day - w.startDay < WW_WHITE_PEACE_MIN_DAYS) {
      block = translateText("ww1936.wpeace.block.too_early", {
        days: WW_WHITE_PEACE_MIN_DAYS - (day - w.startDay),
      });
    } else if (cool > day) {
      block = translateText("ww1936.wpeace.block.cooldown", {
        days: cool - day,
      });
    } else if (ppMilli(game, me) < WW_WHITE_PEACE_PP * 1000) {
      block = translateText("ww1936.wpeace.block.no_pp", {
        pp: WW_WHITE_PEACE_PP,
      });
    }
    out.push({
      war: w.id,
      target: m.id,
      name: countryText(game, m.id),
      block,
      pending,
      exile: m.state === "exiled" || (eg?.isExile(m.id) ?? false),
    });
  }
  return out;
}

/**
 * The country panel's diplomacy rows for `other`, each greyed with one
 * reason when blocked (design §7): 거래 제안 for anyone, 최후통첩 for one I
 * am at peace with, 참전 약속 when I am at war and they are not in it, 협력
 * 정부 세우기 on a capitulated country I occupy, 단독 강화 on an enemy
 * member while I lead my side.
 */
export function diploRows(
  game: DiploGame,
  me: number,
  other: number,
): DiploRow[] {
  if (me <= 0 || other === me || game.worldWarScenario() === null) return [];
  if (!wwActive(game, me)) return [];
  const rows: DiploRow[] = [];
  const otherActive = wwActive(game, other);
  const pair = dealPairBlock(game, me, other);
  if (otherActive) {
    rows.push({
      id: "deal",
      label: translateText(DEAL_UI_KEYS.rowDeal),
      cost: ppText(WW_DEAL_PP),
      block: pair !== null ? blockText(pair) : ppBlock(game, me, WW_DEAL_PP),
      act: { kind: "compose", mode: "deal", to: other },
    });
  }
  if (otherActive && !atWarWith(game, me, other)) {
    const gate = ultimatumGate(game, me, other);
    const pick = gate === null ? ultimatumPrepick(game, me, other) : [];
    rows.push({
      id: "ultimatum",
      label: translateText(DEAL_UI_KEYS.rowUltimatum),
      cost: ppText(WW_ULT_PP),
      block:
        gate !== null
          ? blockText(gate)
          : game
                .wwEndgame?.()
                ?.ultimatums.some((u) => u.from === me && u.to === other)
            ? translateText(DEAL_UI_KEYS.pending)
            : pick.length === 0
              ? blockText("ultimatum_bad_regions")
              : ppBlock(game, me, WW_ULT_PP),
      act: { kind: "compose", mode: "ultimatum", to: other, regions: pick },
    });
  }
  const promise = otherActive ? promiseDefaults(game, me, other) : null;
  if (promise !== null) {
    const enemyFaction = factionIdx(game, promise.target);
    const bad =
      (enemyFaction >= 0 && factionIdx(game, other) === enemyFaction) ||
      napBetween(game, other, promise.target) ||
      atWarWith(game, other, promise.target);
    const gate = promiseGateBlock(rulingOf(game, other), wtBp(game));
    rows.push({
      id: "promise",
      label: translateText(DEAL_UI_KEYS.rowPromise),
      cost: ppText(WW_DEAL_PP),
      block: bad
        ? blockText("promise_bad_target")
        : gate !== null
          ? blockText(gate)
          : pair !== null
            ? blockText(pair)
            : ppBlock(game, me, WW_DEAL_PP),
      act: {
        kind: "compose",
        mode: "deal",
        to: other,
        give:
          promise.group === ""
            ? []
            : [
                {
                  kind: "promise",
                  target: promise.target,
                  group: promise.group,
                },
              ],
        take: [{ kind: "join_war", war: promise.war, target: promise.target }],
      },
    });
  }
  if (
    capitulated(game, other) &&
    collabCandidates(game, me, other).length > 0
  ) {
    const gate = collabGate(game, me, other);
    rows.push({
      id: "collab",
      label: translateText(DEAL_UI_KEYS.rowCollab),
      cost: ppText(WW_COLLAB_PP),
      block: gate !== null ? blockText(gate) : ppBlock(game, me, WW_COLLAB_PP),
      act: {
        kind: "compose",
        mode: "collab",
        to: other,
        regions: collabCandidates(game, me, other),
      },
    });
  }
  for (const w of myWars(game, me)) {
    const b = separatePeaceButtons(game, me, w).find((x) => x.target === other);
    if (b === undefined) continue;
    rows.push({
      id: "separate",
      label: translateText(DEAL_UI_KEYS.rowSeparate),
      cost: ppText(WW_WHITE_PEACE_PP),
      block: b.pending ? translateText("ww1936.wpeace.pending") : b.block,
      act: { kind: "peace", war: w.id, target: other },
    });
    break;
  }
  return rows;
}

/** Opens the composer a row asks for (the panel's tap). */
export function openDiploAct(game: DiploGame, act: DiploAct): void {
  if (act.kind !== "compose") return;
  dealUiOf(game).open(act.mode, act.to, {
    give: act.give,
    take: act.take,
    regions: act.regions,
  });
}

// ---- The composer ----

export interface DealChipView {
  side: DealSide;
  index: number;
  text: string;
}

export interface DealKindView {
  kind: DealItem["kind"];
  label: string;
  block: string | null;
}

export interface DealChoice {
  /** The value a tap sets (an item key, a gen, a country id, a group id…). */
  value: string;
  label: string;
  on: boolean;
}

export interface DealFormView {
  side: DealSide;
  kind: DealItem["kind"];
  title: string;
  /** Equipment / lend-lease / licence: the item; promise and join war: the enemy. */
  choices: DealChoice[];
  /** Equipment, lend-lease, licence: the generation. */
  gens: DealChoice[];
  /** Promise: the region group. */
  groups: DealChoice[];
  /** Equipment: count; lend-lease: a month (null: no count). */
  count: number | null;
  /** The most the count may be (my stock; null: no cap known). */
  countMax: number | null;
  months: number | null;
  /** The item the form makes now (null: not complete yet). */
  item: DealItem | null;
}

export interface DealComposerView {
  mode: DealMode;
  to: number;
  title: string;
  give: DealChipView[];
  take: DealChipView[];
  /** The "+ 추가" list under this column (null: closed). */
  adding: DealSide | null;
  kinds: DealKindView[];
  form: DealFormView | null;
  /** Ultimatum and collaboration government: the regions and their share. */
  regions: { region: number; name: string }[];
  share: string | null;
  /** The last tap on the map (region name) and its refusal. */
  tapRegion: string;
  tapNote: string | null;
  /** The engine-like refusal of the draft as it stands (null: it may go). */
  block: string | null;
  /** The chance bar (null: none, e.g. a human target or not a deal). */
  chancePct: number | null;
  chanceLevel: DealChanceLevel | null;
  chanceText: string;
  cost: string;
  order: WwOrder | null;
}

/** What I have of each equipment type in stock: [gen, count]. */
function myStock(game: DiploGame, me: number): Map<string, [number, number][]> {
  const d = game.wwEconomy?.()?.detail(me) ?? null;
  const out = new Map<string, [number, number][]>();
  if (d === null) return out;
  for (const t of EQUIPMENT_TYPES) {
    const gens: [number, number][] = [];
    for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) {
      const n = d.stock[equipKey(t, g)] ?? 0;
      if (n > 0) gens.push([g, n]);
    }
    if (gens.length > 0) out.set(t, gens);
  }
  const fuel = Math.floor(d.fuelMilli / 1000);
  if (fuel > 0) out.set("fuel", [[1, fuel]]);
  return out;
}

/** Why `kind` can't go into `side` now (null: it can). */
function kindBlock(
  game: DiploGame,
  me: number,
  to: number,
  side: DealSide,
  kind: DealItem["kind"],
  give: readonly DealItem[],
  take: readonly DealItem[],
): string | null {
  const list = side === "give" ? give : take;
  if (list.length >= WW_DEAL_MAX_ITEMS) {
    return translateText("ww1936.deal.full", { n: WW_DEAL_MAX_ITEMS });
  }
  const giver = side === "give" ? me : to;
  const taker = side === "give" ? to : me;
  const twice = translateText("ww1936.deal.twice");
  switch (kind) {
    case "access":
    case "guarantee":
      if (list.some((x) => x.kind === kind)) return twice;
      if (kind === "guarantee" && guaranteesOf(game, giver, taker)) {
        return blockText("deal_bad_item");
      }
      return null;
    case "nap":
      if ([...give, ...take].some((x) => x.kind === "nap")) return twice;
      return napBetween(game, me, to) || atWarWith(game, me, to)
        ? blockText("deal_bad_item")
        : null;
    case "equipment":
    case "lend_lease":
    case "licence":
      return giver === me && myStock(game, me).size === 0
        ? blockText("deal_bad_item")
        : null;
    case "promise":
      return myWars(game, giver).length === 0
        ? blockText("promise_bad_target")
        : null;
    case "join_war": {
      if (joinWarChoices(game, giver, taker).length === 0) {
        return blockText("promise_bad_target");
      }
      const gate = promiseGateBlock(rulingOf(game, giver), wtBp(game));
      return gate === null ? null : blockText(gate);
    }
    default:
      return null;
  }
}

/** The enemies `giver` may promise land of: the other sides' members of its wars. */
function promiseTargets(game: DiploGame, giver: number): number[] {
  const out = new Set<number>();
  for (const w of myWars(game, giver)) {
    const s = sideIndex(w, giver);
    for (const m of w.sides[1 - s]?.members ?? []) out.add(m.id);
  }
  return [...out].sort((a, b) => a - b);
}

/** (war, enemy leader) pairs `giver` may join on `taker`'s side. */
function joinWarChoices(
  game: DiploGame,
  giver: number,
  taker: number,
): { war: number; target: number }[] {
  const out: { war: number; target: number }[] = [];
  for (const w of myWars(game, taker)) {
    if (w.kind !== "normal" || sideIndex(w, giver) >= 0) continue;
    const s = sideIndex(w, taker);
    const target = w.sides[1 - s]?.leader ?? 0;
    if (target > 0) out.push({ war: w.id, target });
  }
  return out;
}

function formView(
  game: DiploGame,
  me: number,
  to: number,
  form: DealForm,
): DealFormView {
  const giver = form.side === "give" ? me : to;
  const taker = form.side === "give" ? to : me;
  const base: DealFormView = {
    side: form.side,
    kind: form.kind,
    title: translateText(DEAL_KIND_KEYS[form.kind]),
    choices: [],
    gens: [],
    groups: [],
    count: null,
    countMax: null,
    months: null,
    item: null,
  };
  if (
    form.kind === "equipment" ||
    form.kind === "lend_lease" ||
    form.kind === "licence"
  ) {
    const stock = giver === me ? myStock(game, me) : null;
    const types: string[] =
      stock !== null
        ? [...stock.keys()].filter(
            (t) => t !== "fuel" || form.kind === "lend_lease",
          )
        : [...EQUIPMENT_TYPES, ...(form.kind === "lend_lease" ? ["fuel"] : [])];
    base.choices = types.map((t) => ({
      value: t,
      label: llItemName(t as EquipmentType),
      on: t === form.item,
    }));
    if (form.item !== "") {
      const gens: [number, number][] =
        stock?.get(form.item) ??
        (form.item === "fuel"
          ? [[1, 0]]
          : Array.from(
              { length: EQUIPMENT_GENS[form.item as EquipmentType] ?? 1 },
              (_, i) => [i + 1, 0] as [number, number],
            ));
      if (form.item !== "fuel") {
        base.gens = gens.map(([g]) => ({
          value: String(g),
          label: llGenName(form.item as EquipmentType, g),
          on: g === form.gen,
        }));
      }
      const have = gens.find(([g]) => g === form.gen)?.[1] ?? 0;
      if (form.kind !== "licence") {
        base.count = form.count;
        base.countMax = stock !== null && have > 0 ? have : null;
      }
      if (form.kind === "lend_lease") base.months = form.months;
      const gen = form.item === "fuel" ? 1 : form.gen;
      const ok = form.item === "fuel" || gens.some(([g]) => g === gen);
      if (ok) {
        if (form.kind === "equipment") {
          const key = equipKey(form.item as EquipmentType, gen);
          if (key >= 0) {
            base.item = { kind: "equipment", key, count: form.count };
          }
        } else if (form.kind === "licence") {
          const key = equipKey(form.item as EquipmentType, gen);
          if (key >= 0) base.item = { kind: "licence", key };
        } else {
          base.item = {
            kind: "lend_lease",
            item: form.item as EquipmentType | "fuel",
            gen: form.item === "fuel" ? 0 : gen,
            perMonth: form.count,
            months: form.months,
          };
        }
      }
    }
    return base;
  }
  if (form.kind === "promise") {
    base.choices = promiseTargets(game, giver).map((id) => ({
      value: String(id),
      label: countryText(game, id),
      on: id === form.target,
    }));
    const f = negPeaceFactsOf(game);
    if (form.target > 0 && f !== null) {
      const groups = [...CONTENT.groupIdx.keys()]
        .filter((g) =>
          groupRegions(g).some((r) => f.legalOwner(r) === form.target),
        )
        .sort((a, b) => {
          const claims = claimGroups(game, taker);
          return (
            Number(claims.includes(b)) - Number(claims.includes(a)) ||
            peaceGroupName(a).localeCompare(peaceGroupName(b))
          );
        });
      base.groups = groups.map((g) => ({
        value: g,
        label: peaceGroupName(g),
        on: g === form.group,
      }));
      if (form.group !== "" && groups.includes(form.group)) {
        base.item = { kind: "promise", target: form.target, group: form.group };
      }
    }
    return base;
  }
  if (form.kind === "join_war") {
    const wars = joinWarChoices(game, giver, taker);
    base.choices = wars.map((c) => ({
      value: `${c.war}:${c.target}`,
      label: countryText(game, c.target),
      on: c.war === form.war && c.target === form.target,
    }));
    const c = wars.find((x) => x.war === form.war && x.target === form.target);
    if (c !== undefined) {
      base.item = { kind: "join_war", war: c.war, target: c.target };
    }
    return base;
  }
  return base;
}

/** A new, empty form for `kind`. */
export function newDealForm(side: DealSide, kind: DealItem["kind"]): DealForm {
  return {
    side,
    kind,
    item: "",
    gen: 1,
    count: kind === "lend_lease" ? 10 : 100,
    months: kind === "lend_lease" ? 6 : 0,
    target: 0,
    war: 0,
    group: "",
  };
}

/** The months a lend-lease item may run. */
export function clampMonths(n: number): number {
  return Math.max(1, Math.min(WW_DEAL_LL_MAX_MONTHS, Math.floor(n)));
}

function regionShare(
  game: DiploGame,
  regions: readonly number[],
  owner: number,
): string | null {
  if (regions.length === 0) return null;
  return translateText("ww1936.deal.share", {
    country: countryText(game, owner),
    pct: vpPct(game, regions, owner),
  });
}

/** The open composer (null: none open, or no country to compose for). */
export function dealComposer(game: DiploGame): DealComposerView | null {
  const ui = dealUiOf(game);
  const me = game.myPlayer()?.smallID() ?? 0;
  const sc = game.worldWarScenario();
  if (ui.mode === null || me <= 0 || sc === null) return null;
  const to = ui.to;
  const name = countryText(game, to);
  const chips = (side: DealSide): DealChipView[] =>
    ui.list(side).map((item, index) => ({
      side,
      index,
      text: dealItemText(game, item),
    }));
  const tap = {
    region: ui.region > 0 ? peaceRegionName(sc, ui.region) : "",
    note: ui.note,
  };
  const regions = ui.regions.map((r) => ({
    region: r,
    name: peaceRegionName(sc, r),
  }));
  if (ui.mode === "deal") {
    const kinds: DealKindView[] =
      ui.adding === null
        ? []
        : (Object.keys(DEAL_KIND_KEYS) as DealItem["kind"][]).map((k) => ({
            kind: k,
            label: translateText(DEAL_KIND_KEYS[k]),
            block: kindBlock(game, me, to, ui.adding!, k, ui.give, ui.take),
          }));
    const empty = ui.give.length === 0 && ui.take.length === 0;
    const pair = dealPairBlock(game, me, to);
    const rule = empty
      ? "deal_empty"
      : (pair ??
        dealShapeBlock(ui.give, ui.take) ??
        promisePairBlock(warFacts(game), me, to, ui.give, ui.take));
    const block =
      rule !== null ? blockText(rule) : ppBlock(game, me, WW_DEAL_PP);
    const human = isHumanCountry(game, to);
    const c = human ? null : dealChance(game, me, to, ui.give, ui.take);
    return {
      mode: "deal",
      to,
      title: translateText("ww1936.deal.title", { country: name }),
      give: chips("give"),
      take: chips("take"),
      adding: ui.adding,
      kinds,
      form: ui.form === null ? null : formView(game, me, to, ui.form),
      regions: [],
      share: null,
      tapRegion: tap.region,
      tapNote: tap.note,
      block,
      chancePct: c?.pct ?? null,
      chanceLevel: c?.level ?? null,
      chanceText: human
        ? translateText("ww1936.npeace.chance_human")
        : translateText(DEAL_UI_KEYS.chance),
      cost: ppText(WW_DEAL_PP),
      order: empty
        ? null
        : { kind: "deal_offer", to, give: [...ui.give], take: [...ui.take] },
    };
  }
  if (ui.mode === "ultimatum") {
    const gate = ultimatumGate(game, me, to);
    const allowed = new Set(ultimatumCandidates(game, me, to));
    const pct = vpPct(game, ui.regions, to);
    const block =
      gate !== null
        ? blockText(gate)
        : ui.regions.length === 0 || ui.regions.some((r) => !allowed.has(r))
          ? blockText("ultimatum_bad_regions")
          : pct > WW_ULT_MAX_VP_PCT
            ? blockText("ultimatum_too_much")
            : ppBlock(game, me, WW_ULT_PP);
    return {
      mode: "ultimatum",
      to,
      title: translateText("ww1936.deal.ult_title", { country: name }),
      give: [],
      take: [],
      adding: null,
      kinds: [],
      form: null,
      regions,
      share: regionShare(game, ui.regions, to),
      tapRegion: tap.region,
      tapNote: tap.note,
      block,
      chancePct: null,
      chanceLevel: null,
      chanceText: translateText("ww1936.deal.ult_hint", {
        days: WW_ULT_REFUSED_DAYS,
      }),
      cost: ppText(WW_ULT_PP),
      order:
        ui.regions.length === 0
          ? null
          : { kind: "ultimatum", target: to, regions: [...ui.regions] },
    };
  }
  // A collaboration government.
  const gate = collabGate(game, me, to);
  const allowed = new Set(collabCandidates(game, me, to));
  const pct = vpPct(game, ui.regions, to);
  const block =
    gate !== null
      ? blockText(gate)
      : ui.regions.some((r) => !allowed.has(r))
        ? blockText("collab_bad_region")
        : pct < WW_COLLAB_MIN_VP_PCT
          ? blockText("collab_too_small")
          : ppBlock(game, me, WW_COLLAB_PP);
  return {
    mode: "collab",
    to,
    title: translateText("ww1936.deal.collab_title", { country: name }),
    give: [],
    take: [],
    adding: null,
    kinds: [],
    form: null,
    regions,
    share: regionShare(game, ui.regions, to),
    tapRegion: tap.region,
    tapNote: tap.note,
    block,
    chancePct: null,
    chanceLevel: null,
    chanceText: translateText("ww1936.deal.collab_hint"),
    cost: ppText(WW_COLLAB_PP),
    order:
      ui.regions.length === 0
        ? null
        : { kind: "collab_create", target: to, regions: [...ui.regions] },
  };
}

// ---- The one answer card ----

interface CardBase {
  /** The offer id (peace offers, deals and ultimatums share the counter). */
  id: number;
  from: number;
  secondsLeft: number;
  fraction: number;
  /** Other offers waiting behind this one. */
  more: number;
}

export type DiploCardView =
  | (CardBase & {
      kind: "peace";
      peace: WhitePeaceCardView;
      /** "Come home as my subject" to my exile. */
      home: boolean;
    })
  | (CardBase & {
      kind: "deal";
      title: string;
      /** What the proposer gives me, and what it asks of me. */
      gives: string[];
      wants: string[];
      givesHead: string;
      wantsHead: string;
      /** The counter-offer's draft: the columns swapped. */
      counter: { give: DealItem[]; take: DealItem[] };
    })
  | (CardBase & {
      kind: "ultimatum";
      title: string;
      regions: string;
      hint: string;
    });

/**
 * My answer card: the oldest of the peace offers, deals and ultimatums
 * made to my country (one counter, so the lowest id came first); null
 * without one.
 */
export function diploCardModel(game: DiploGame): DiploCardView | null {
  const me = game.myPlayer()?.smallID() ?? 0;
  const eg = game.wwEndgame?.() ?? null;
  if (me <= 0 || eg === null) return null;
  const peace = eg.offersTo(me);
  const deals = eg.dealsTo(me);
  const ults = eg.ultimatumsTo(me);
  const total = peace.length + deals.length + ults.length;
  if (total === 0) return null;
  const first = Math.min(
    peace[0]?.id ?? Infinity,
    deals[0]?.id ?? Infinity,
    ults[0]?.id ?? Infinity,
  );
  const more = total - 1;
  const timing = (deadline: number, window: number) => {
    const left = Math.max(0, deadline - game.ticks());
    return {
      secondsLeft: wwSeconds(game, left),
      fraction: Math.min(1, left / Math.max(1, wwWindowTicks(game, window))),
    };
  };
  const p = peace[0];
  if (p !== undefined && p.id === first) {
    const v = whitePeaceCardModel(game);
    if (v === null) return null;
    const home = p.home === true;
    const from = countryText(game, p.from);
    return {
      kind: "peace",
      id: p.id,
      from: p.from,
      secondsLeft: v.secondsLeft,
      fraction: v.fraction,
      more,
      home,
      peace: {
        ...v,
        more,
        ...(home
          ? {
              title: translateText("ww1936.deal.card_home", { country: from }),
              scope: translateText("ww1936.deal.card_home_scope", {
                country: from,
              }),
            }
          : {}),
      },
    };
  }
  const d = deals[0];
  if (d !== undefined && d.id === first) {
    const from = countryText(game, d.from);
    return {
      kind: "deal",
      id: d.id,
      from: d.from,
      ...timing(d.deadlineTick, WW_DEAL_CARD_TICKS),
      more,
      title: translateText(DEAL_UI_KEYS.cardTitle, { country: from }),
      givesHead: translateText("ww1936.deal.card_gives", { country: from }),
      wantsHead: translateText("ww1936.deal.card_wants", { country: from }),
      gives: d.give.map((x) => dealItemText(game, x)),
      wants: d.take.map((x) => dealItemText(game, x)),
      counter: { give: [...d.take], take: [...d.give] },
    };
  }
  const u = ults[0]!;
  const sc = game.worldWarScenario();
  const from = countryText(game, u.from);
  return {
    kind: "ultimatum",
    id: u.id,
    from: u.from,
    ...timing(u.deadlineTick, WW_ULT_CARD_TICKS),
    more,
    title: translateText(DEAL_UI_KEYS.cardUltimatum, { country: from }),
    regions: translateText("ww1936.deal.card_regions", {
      regions:
        sc === null
          ? ""
          : u.regions.map((r) => peaceRegionName(sc, r)).join(", "),
      pct: Math.floor(u.vpPm / 10),
    }),
    hint: translateText(DEAL_UI_KEYS.ultRefuseHint, { country: from }),
  };
}

// ---- The war card's lines ----

/** "약속: G → N" for each promise kept in war `war`. */
export function promiseLines(game: EndgameGame, war: number): string[] {
  return (game.wwEndgame?.()?.promises ?? [])
    .filter((p) => p.war === war)
    .map((p) =>
      translateText(DEAL_UI_KEYS.promiseLine, {
        group: peaceGroupName(p.group),
        country: countryText(game, p.to),
      }),
    );
}

/** The wars tab's "최후통첩을 보낸 나라": each pending ultimatum to me, with what it asks. */
export function ultimatumsInLines(game: DiploGame, me: number): string[] {
  const sc = game.worldWarScenario();
  return (game.wwEndgame?.()?.ultimatumsTo(me) ?? []).map((u) =>
    translateText("ww1936.deal.ultimatum_in_line", {
      country: countryText(game, u.from),
      n: u.regions.length,
      pct: Math.floor(u.vpPm / 10),
      regions:
        sc === null
          ? ""
          : u.regions.map((r) => peaceRegionName(sc, r)).join(", "),
    }),
  );
}
