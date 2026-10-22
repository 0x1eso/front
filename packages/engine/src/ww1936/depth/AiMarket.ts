// P6 lane M (plan Task 4): the AI's MIOs, licences, market and embargoes
// (spec §19.1, §19.4). Plan decision 39: each AI decides its own rhythm —
// the MIOs at war every day and at peace every 10th day (the first
// archetypes at once); the market, licences and embargoes every 30th day
// at peace and every 10th at war (a purchase takes 10 days to arrive, so a
// daily look would buy the same gap again — a recorded deviation from
// "전쟁 중이면 매일"). The AI judges the situation (the owner's rule):
// what its divisions hold and need, its free factories, the tension.
import {
  EMBARGO_PP,
  MIO_FAMILIES,
  MIO_FREE_TRAIT,
  WW_MAX_LICENCES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIPMENT,
  NEED_GROUP_COUNT,
} from "@openfront/engine-api/ww1936/LandTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  marketCivs,
  newestStaticYear,
  staticGenResearched,
  staticKeyYear,
} from "@openfront/engine-lib/ww1936/MarketRules";
import { mioTraitBlock } from "@openfront/engine-lib/ww1936/MioRules";
import {
  equipByType,
  groupStock,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { aiPersonality } from "../economy/AiEconomy";
import { changeLine, setLineFactories } from "../economy/Production";
import { payPp } from "../politics/PayPp";
import { embargoBlock, setEmbargo } from "./Embargo";
import {
  freeCivsOf,
  licenceRequestBlock,
  requestLicence,
  topThreats,
} from "./Licences";
import { listingPriceMilli, marketBuy, marketList } from "./Market";
import {
  mioFamilyOfKey,
  mioInvest,
  mioPick,
  mioPointsOf,
  mioTrait,
  mioTraitsOf,
} from "./Mio";
import type { WwDepth } from "./WwDepth";

/** Spec §19.4: an AI at war invests in its main family with this much political power. */
export const AI_MIO_INVEST_MIN_PP = 200;
/** Spec §19.4: old stock — this many years behind the newest generation it makes. */
export const AI_SELL_OLD_YEARS = 2;
/** Spec §19.4: old stock past the divisions' need × 1.2 is surplus; half of it goes on the market. */
export const AI_SELL_NEED_PCT = 120;
/** No listing smaller than this (a market of crumbs helps nobody). */
export const AI_MIN_LISTING = 10;
/** Spec §19.4: at war, a kind whose divisions and stock hold less than 70% of the need is bought. */
export const AI_BUY_FILL_PM = 700;
/** Spec §19.4: …paying with at most 30% of the free civilian factories. */
export const AI_BUY_CIV_PCT = 30;
/** Spec §19.4: the generations a faction member asks its leader for, first first. */
export const AI_LICENCE_TYPES: readonly EquipmentType[] = [
  "fighter",
  "medium_tank",
  "artillery",
];
/** A human faction leader is asked for a licence (a card on its screen) only on this rhythm. */
export const AI_HUMAN_LICENCE_DAYS = 90;
/** Spec §7.3: a democracy embargoes from 40% world tension… */
export const AI_EMBARGO_WT_BP = 4_000;
/** …its top two threats. */
export const AI_EMBARGO_TOP = 2;

const ARMOR = MIO_FAMILIES.indexOf("mio_armor");
const AIR_LIGHT = MIO_FAMILIES.indexOf("mio_air_light");
const STATE_ARSENAL = 0;
const PRIVATE_COMBINE = 1;
const DESIGN_BUREAU = 2;
const P3 = 2;
const Q3 = 5;

/**
 * Spec §19.4: aggressor majors' armour and light aircraft are design
 * bureaus, democracies' families private combines, the rest state arsenals.
 */
export function aiArchetype(
  family: number,
  aggressorMajor: boolean,
  democracy: boolean,
): number {
  if (aggressorMajor && (family === ARMOR || family === AIR_LIGHT)) {
    return DESIGN_BUREAU;
  }
  return democracy ? PRIVATE_COMBINE : STATE_ARSENAL;
}

/**
 * Spec §19.4: the trait order — the free trait's column up, then the other
 * two columns row by row; of p3 and q3 an aggressor takes q3, anyone else p3.
 */
export function aiTraitOrder(archetype: number, aggressor: boolean): number[] {
  const col = Math.floor(MIO_FREE_TRAIT[archetype] / 3);
  const order = [col * 3 + 1, col * 3 + 2];
  const others = [0, 1, 2].filter((x) => x !== col);
  for (let r = 0; r < 3; r++) for (const x of others) order.push(x * 3 + r);
  const skip = aggressor ? P3 : Q3;
  return order.filter((t) => t !== skip);
}

export function aiMarketDay(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null) return;
  const war = d.ww.hasWar(id);
  if (c.mio.arch.some((a) => a < 0) || war || day % 10 === id % 10) {
    aiMio(d, id, day, war);
  }
  const every = war ? 10 : 30;
  if (day % every !== id % every) return;
  aiEmbargoes(d, id);
  aiLicences(d, id, day);
  const need = groundNeeds(d, id);
  aiSell(d, id, need);
  if (war) aiBuy(d, id, need, day);
}

// ---- MIOs ----

function aiMio(d: WwDepth, id: number, day: number, war: boolean): void {
  const c = d.country(id)!;
  const tag = d.ww.tagOf(id);
  const aggressor = aiPersonality(tag) === "aggressor";
  const major = d.ww.economy.country(id)?.major ?? false;
  const democracy = d.ww.politics.country(id)?.ruling === IDEO_DEM;
  for (let f = 0; f < MIO_FAMILIES.length; f++) {
    if (c.mio.arch[f] < 0) {
      mioPick(d, id, f, aiArchetype(f, aggressor && major, democracy));
    }
  }
  for (let f = 0; f < MIO_FAMILIES.length; f++) {
    let points = mioPointsOf(c, f);
    if (points <= 0) continue;
    const order = aiTraitOrder(c.mio.arch[f], aggressor);
    while (points > 0) {
      const traits = mioTraitsOf(c, f);
      const t = order.find(
        (x) =>
          (traits & (1 << x)) === 0 &&
          mioTraitBlock(traits, x, points) === null,
      );
      if (t === undefined || mioTrait(d, id, f, t) !== null) break;
      points--;
    }
  }
  if (!war) return;
  const pp = d.ww.politics.country(id)?.ppMilli ?? 0;
  if (pp < AI_MIO_INVEST_MIN_PP * 1000) return;
  const f = mainFamily(d, id);
  if (f >= 0) mioInvest(d, id, f, day);
}

/** Spec §19.4: the family of the line with the most factories (the first on a tie), -1 none. */
function mainFamily(d: WwDepth, id: number): number {
  const ce = d.ww.economy.country(id);
  if (ce === null) return -1;
  let best = -1;
  let most = 0;
  for (const line of ce.lines) {
    if (line.factories > most) {
      most = line.factories;
      best = line.key;
    }
  }
  return best < 0 ? -1 : mioFamilyOfKey(d, id, best);
}

// ---- The market ----

interface GroundNeeds {
  /** NEED_GROUPS-ordered units the divisions' templates need. */
  need: number[];
  /** …and hold. */
  have: number[];
}

/** What the country's divisions need and hold, by need group. */
function groundNeeds(d: WwDepth, id: number): GroundNeeds {
  const land = d.ww.land;
  const need = new Array<number>(NEED_GROUP_COUNT).fill(0);
  const have = new Array<number>(NEED_GROUP_COUNT).fill(0);
  const rows = land.rowsOf(id);
  if (rows.length === 0) return { need, have };
  const ks = land.keyStatsOf(id);
  for (const r of rows) {
    const s = land.baseStatsOf(r);
    for (let g = 0; g < NEED_GROUP_COUNT; g++) need[g] += s.need[g] ?? 0;
    const h = equipByType(land.divisions.equipOf(r), ks);
    for (let g = 0; g < NEED_GROUP_COUNT; g++) have[g] += h[g] ?? 0;
  }
  return { need, have };
}

/**
 * Spec §19.4: the stock of a ground kind at least two years behind its
 * newest generation, past the divisions' need × 1.2, goes half on the
 * market (oldest first) — never while the divisions are short of it.
 */
function aiSell(d: WwDepth, id: number, n: GroundNeeds): void {
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  for (const t of GROUND_EQUIPMENT) {
    const g = EQUIPMENT_TYPES.indexOf(t);
    if (n.have[g] < n.need[g]) continue;
    const newest = newestStaticYear(t, ce.researched);
    if (newest === 0) continue;
    const old: number[] = [];
    let oldUnits = 0;
    for (let gen = 1; gen <= EQUIPMENT_GENS[t]; gen++) {
      if (staticKeyYear(t, gen) > newest - AI_SELL_OLD_YEARS) continue;
      const k = equipKey(t, gen);
      old.push(k);
      oldUnits += ce.stock[k] ?? 0;
    }
    const keep = Math.floor((n.need[g] * AI_SELL_NEED_PCT) / 100);
    let sell = Math.floor((oldUnits - keep) / 2);
    if (sell < AI_MIN_LISTING) continue;
    for (const k of old) {
      const units = Math.min(sell, ce.stock[k] ?? 0);
      if (units < 1) continue;
      if (marketList(d, id, k, units) === null) sell -= units;
      if (sell <= 0) break;
    }
  }
}

/**
 * Spec §19.4: at war, a ground kind whose divisions and stock hold less
 * than 70% of the need is bought — the newest generation first, then the
 * cheapest — with at most 30% of the free civilian factories; never a kind
 * a deal is still bringing.
 */
function aiBuy(d: WwDepth, id: number, n: GroundNeeds, day: number): void {
  let budget = Math.floor((freeCivsOf(d, id) * AI_BUY_CIV_PCT) / 100);
  if (budget < 1 || d.market.listings.length === 0) return;
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  const ks = d.ww.land.keyStatsOf(id);
  for (const t of GROUND_EQUIPMENT) {
    const g = EQUIPMENT_TYPES.indexOf(t);
    const need = n.need[g];
    if (need <= 0) continue;
    const holding = n.have[g] + groupStock(ce.stock, g, ks);
    if (holding * 1000 >= need * AI_BUY_FILL_PM) continue;
    if (
      d.market.deals.some((x) => x.buyer === id && EQUIP_KEYS[x.key]?.[0] === t)
    ) {
      continue;
    }
    const offers = d.market.listings
      .filter((l) => l.seller !== id && EQUIP_KEYS[l.key]?.[0] === t)
      .map((l) => ({
        l,
        gen: EQUIP_KEYS[l.key][1],
        per100: listingPriceMilli(d, l, 100),
      }))
      .sort((a, b) => b.gen - a.gen || a.per100 - b.per100 || a.l.id - b.l.id);
    const short = need - holding;
    for (const { l, per100 } of offers) {
      let units = Math.min(l.count, short);
      if (per100 > 0) {
        units = Math.min(units, Math.floor((budget * 150_000 * 100) / per100));
      }
      while (units > 0 && marketCivs(listingPriceMilli(d, l, units)) > budget) {
        units = Math.floor((units * 9) / 10);
      }
      if (units < 1) continue;
      const civs = marketCivs(listingPriceMilli(d, l, units));
      if (marketBuy(d, id, l.id, units, day) === null) {
        budget -= civs;
        break;
      }
    }
    if (budget < 1) return;
  }
}

// ---- Licences ----

/** The newest generation of `t` `id` builds — its techs or a licence it holds; 0 none. */
function bestGen(d: WwDepth, id: number, t: EquipmentType): number {
  const ce = d.ww.economy.country(id);
  if (ce === null) return 0;
  for (let g = EQUIPMENT_GENS[t]; g >= 1; g--) {
    const key = equipKey(t, g);
    if (staticGenResearched(t, g, ce.researched)) return g;
    if (
      d.market.licences.some(
        (l) => l.to === id && l.ship === 0 && l.key === key,
      )
    ) {
      return g;
    }
  }
  return 0;
}

/**
 * A licensed generation goes to work: the biggest line of that kind (a
 * medium tank licence: of light tanks, when there is no medium line) on an
 * older generation moves to it. One a run.
 */
function aiUseLicences(d: WwDepth, id: number): void {
  const econ = d.ww.economy;
  const ce = econ.country(id);
  if (ce === null) return;
  for (const l of d.market.licences) {
    if (l.to !== id || l.ship > 0) continue;
    const [t, gen] = EQUIP_KEYS[l.key];
    if (!(AI_LICENCE_TYPES as readonly string[]).includes(t)) continue;
    if (staticGenResearched(t, gen, ce.researched)) continue;
    const pick = (type: EquipmentType) => {
      let best: (typeof ce.lines)[number] | null = null;
      for (const line of ce.lines) {
        const [lt, lg] = EQUIP_KEYS[line.key];
        if (lt !== type || (lt === t && lg >= gen)) continue;
        if (best === null || line.factories > best.factories) best = line;
      }
      return best;
    };
    if (ce.lines.some((x) => x.key === l.key)) continue;
    const line = pick(t) ?? (t === "medium_tank" ? pick("light_tank") : null);
    if (line !== null && changeLine(econ, ce, line.id, t, gen) === null) {
      return;
    }
  }
}

/**
 * Lane M review minor 6: an AI's lines a licence's end stopped ([line id,
 * factories before]) move to the newest generation it builds itself —
 * of the same kind; a medium tank (or a tank design) falls back to light
 * tanks, a plane design to the P4 type it flies as — and keep their
 * factories. A line with nothing to move to stays stopped.
 */
export function aiRetoolStopped(
  d: WwDepth,
  id: number,
  stopped: readonly (readonly [number, number])[],
): void {
  const econ = d.ww.economy;
  const ce = econ.country(id);
  if (ce === null) return;
  for (const [lineId, factories] of stopped) {
    const line = ce.lines.find((l) => l.id === lineId);
    if (line === undefined) continue;
    const [type, slot] = EQUIP_KEYS[line.key];
    const kinds: EquipmentType[] =
      type === "tank_design"
        ? ["medium_tank", "light_tank"]
        : type === "medium_tank"
          ? ["medium_tank", "light_tank"]
          : type === "plane_design"
            ? planeTypeKinds(d, id, slot)
            : [type];
    for (const t of kinds) {
      const gen = bestOwnGen(d, id, t);
      if (gen === 0) continue;
      if (changeLine(econ, ce, lineId, t, gen) !== null) continue;
      setLineFactories(econ, ce, lineId, factories);
      break;
    }
  }
}

/** The P4 type a plane design slot flies as, as a kind list (none when unknown). */
function planeTypeKinds(d: WwDepth, id: number, slot: number): EquipmentType[] {
  const s = d.designStatsOf(id, "plane", slot);
  if (s === null || s.kind !== "plane") return [];
  const t = EQUIPMENT_TYPES.find((x) => x === s.type);
  return t === undefined ? [] : [t];
}

/**
 * Spec §19.4: a faction member asks its leader for what it cannot make
 * yet — the fighter, medium tank and artillery generations first, then a
 * tank design when it has none of its own. One request a run.
 */
function aiLicences(d: WwDepth, id: number, day: number): void {
  aiUseLicences(d, id);
  const pol = d.ww.politics;
  const fi = pol.factionIdx(id);
  if (fi < 0) return;
  const leader = pol.faction(fi)?.leader ?? 0;
  if (leader <= 0 || leader === id || !d.ww.isActor(leader)) return;
  // A human leader gets a card to answer: asked at most every 90th day.
  if (
    d.ww.isHumanControlled(leader) &&
    day % AI_HUMAN_LICENCE_DAYS !== id % AI_HUMAN_LICENCE_DAYS
  ) {
    return;
  }
  const m = d.market;
  const held =
    m.licences.filter((l) => l.to === id).length +
    m.pending.filter((p) => p.from === id).length;
  if (held >= WW_MAX_LICENCES) return;
  const tick = d.mg.ticks();
  for (const t of AI_LICENCE_TYPES) {
    const theirs = bestOwnGen(d, leader, t);
    if (theirs <= bestGen(d, id, t)) continue;
    const key = equipKey(t, theirs);
    if (licenceRequestBlock(d, id, leader, key, 0) !== null) continue;
    requestLicence(d, id, leader, key, 0, tick);
    aiUseLicences(d, id);
    return;
  }
  const own = d.country(id)?.des.tank ?? [];
  if (own.some((s) => s !== null && s.origin !== "captured" && !s.obsolete)) {
    return;
  }
  let slot = 0;
  let year = 0;
  d.country(leader)?.des.tank.forEach((s, i) => {
    if (s === null || s.origin !== "own" || s.obsolete) return;
    const st = d.designStatsOf(leader, "tank", i + 1);
    const y = st !== null && "year" in st ? st.year : 0;
    if (slot === 0 || y > year) {
      slot = i + 1;
      year = y;
    }
  });
  if (slot === 0) return;
  const key = equipKey("tank_design", slot);
  if (licenceRequestBlock(d, id, leader, key, 0) === null) {
    requestLicence(d, id, leader, key, 0, tick);
  }
}

/** The newest generation of `t` the country's own techs open; 0 none. */
function bestOwnGen(d: WwDepth, id: number, t: EquipmentType): number {
  const ce = d.ww.economy.country(id);
  if (ce === null) return 0;
  for (let g = EQUIPMENT_GENS[t]; g >= 1; g--) {
    if (staticGenResearched(t, g, ce.researched)) return g;
  }
  return 0;
}

// ---- Embargoes ----

/**
 * Spec §7.3 / §19.4: a democracy embargoes its top two threats from 40%
 * world tension (the US–Japan history beat is K5's DEPTH_BEATS); anyone
 * lifts an embargo on a country now in its faction.
 */
function aiEmbargoes(d: WwDepth, id: number): void {
  const pol = d.ww.politics;
  for (const [by, on] of [...d.market.embargoes]) {
    if (by === id && d.ww.sameFaction(id, on)) setEmbargo(d, id, on, false);
  }
  if (pol.country(id)?.ruling !== IDEO_DEM) return;
  if (pol.wtBp < AI_EMBARGO_WT_BP) return;
  for (const t of topThreats(d, id, AI_EMBARGO_TOP)) {
    if (d.ww.sameFaction(id, t)) continue;
    if (embargoBlock(d, id, t) !== null) continue;
    if (!payPp(pol, id, EMBARGO_PP)) return;
    pol.markCountry(id);
    setEmbargo(d, id, t, true);
  }
}
