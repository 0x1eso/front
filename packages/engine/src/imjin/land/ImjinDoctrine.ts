// ww177 P7b (doctrine, /home/eser/dev/ww177-doctrine.md): the engine side of
// each country's way of war. It keeps what the doctrine learns (Joseon's
// captured arquebuses, Japan's lesson from Ming's guns, Joseon's routs for
// the court and 진관, Japan's ship losses for its caution at sea), sets the
// flags the decisions wait on, and runs the daily sea rules of doctrine §3
// and §5: sortie endurance and the scuttling of the Gyeongsang fleets.
import { pickFlag } from "@openfront/engine-lib/imjin/CourtScenes";
import {
  BIGYEOK_SIEGE_DAYS,
  DOCTRINE_FLAGS as D,
  type DoctrinePerks,
  type DoctrineState,
  JINGWAN_HOME_BLOCK_PCT,
  MUSTER_ORG_PCT,
  perksOf,
  rowMixFor,
} from "@openfront/engine-lib/imjin/Doctrine";
import { SCUTTLE_SCENE } from "@openfront/engine-lib/imjin/DoctrineContent";
import type { RowMix } from "@openfront/engine-lib/imjin/LandRound";
import { MT } from "@openfront/engine-lib/imjin/SeaRules";
import type { WwLand } from "../../ww1936/land/WwLand";
import { TRUCE_PHASE } from "../japan/ImjinJapan";
import { seaOrder } from "../sea/SeaFleets";
import { fleetStrength, type SeaFleet } from "../sea/SeaState";
import type { WwImjin } from "../WwImjin";

/** What the doctrine has learned (ImjinState.doc; absent until the war). */
export interface ImjinDocState {
  /** Japanese divisions Joseon routed. */
  josArq: number;
  /** 1 once Ming routed Japanese divisions. */
  jpnLearned: number;
  /** Joseon's armies of 2+ divisions that routed: flat [day, region], last ROUT_KEEP_DAYS. */
  josRouts: number[];
  /** Japan's ships a day: flat [day, ships], the last CAUTION_DAYS + 1 days. */
  jpnShips: number[];
  /** The most Korean regions Japan has held at once. */
  jpnPeak: number;
  /** Fleets asked about scuttling (ascending). */
  scuttleAsked: number[];
  /** The fleet the open scuttling scene is about (-1: none). */
  scuttleFleet: number;
}

const ROUT_KEEP_DAYS = 10;
/** Japan has lost ground once it holds this many Korean regions fewer than its peak. */
const LOST_REGIONS = 3;
const JAPANESE_HULLS: readonly string[] = ["atakebune", "sekibune", "kobaya"];
/** Japan keeps to harbour once it lost this many ships within CAUTION_DAYS (§3). */
export const CAUTION_SHIPS = 40;
/** Game days: a battle runs for weeks of the game's compressed clock. */
export const CAUTION_DAYS = 90;
/** Ming's drill masters are in the country this long after its relief came. */
const DRILL_DAYS = 60;
/** Sortie endurance (§5): days out, the AI's turn for home, the morale a day after. */
export const SORTIE_DAYS = 12;
export const SORTIE_HOME_DAYS = 10;
const SORTIE_MORALE = 20;
/** A fleet this near one of its own ports is in port. */
const IN_PORT_MT = 6 * MT;
/** Scuttling (§5; main's call): Japan's force ashore, the odds, the reach. */
const LANDED_DIVISIONS = 5;
const SCUTTLE_ODDS = 5;
const SCUTTLE_NERVE = 2;
const SCUTTLE_COHESION_BP = 2000;
const SCUTTLE_REACH_MT = 40 * MT;

export function docOf(im: WwImjin): ImjinDocState {
  im.st.doc ??= {
    josArq: 0,
    jpnLearned: 0,
    josRouts: [],
    jpnShips: [],
    jpnPeak: 0,
    scuttleAsked: [],
    scuttleFleet: -1,
  };
  return im.st.doc;
}

export function docHash(
  d: ImjinDocState | undefined,
  mix: (v: number) => void,
): void {
  if (d === undefined) return;
  mix(d.josArq);
  mix(d.jpnLearned);
  for (const v of d.josRouts) mix(v);
  for (const v of d.jpnShips) mix(v);
  mix(d.jpnPeak);
  for (const v of d.scuttleAsked) mix(v);
  mix(d.scuttleFleet);
}

function flagDay(im: WwImjin, owner: number, f: string): number {
  const c = im.ww.politics.country(owner);
  const v = c?.flags.get(f);
  return v === undefined ? -1 : v[0];
}

function today(im: WwImjin): number {
  const t = im.mg.ticks();
  return im.ww.inPrep(t) ? 0 : im.ww.day(t);
}

/** The doctrine's state now (§1). */
export function doctrineOf(im: WwImjin): DoctrineState {
  const ww = im.ww;
  const jos = im.idOf("JOS");
  const d = im.st.doc;
  const hDay = flagDay(im, jos, D.josHullyeon);
  const jp = ww.japan?.state();
  const second =
    jp !== undefined &&
    (jp.phase === TRUCE_PHASE.second ||
      (jp.phase === TRUCE_PHASE.broken && ww.isAtWar(im.idOf("JPN"), jos)));
  return {
    josArqPts: d?.josArq ?? 0,
    hullyeonDays: hDay < 0 ? -1 : today(im) - hDay,
    jingwan: ww.politics.country(jos)?.hasSpirit("imjin_jos_jingwan") === true,
    jpnLearned: (d?.jpnLearned ?? 0) === 1 || second,
    mingRelief: ww.politics.gflags.has("imjin_ming_relief"),
  };
}

/** A country's army now (its doctrine's mix). */
export function mixOf(im: WwImjin, owner: number): RowMix {
  return rowMixFor(im.ww.scenario.tagOfSmallId(owner) ?? "", doctrineOf(im));
}

/**
 * A side's perks in a battle at `region`: the country's, plus Joseon's
 * bigyeok once its own siege there has run BIGYEOK_SIEGE_DAYS.
 */
export function perksAt(
  im: WwImjin,
  owner: number,
  region: number,
  attacking: boolean,
): DoctrinePerks {
  const tag = im.ww.scenario.tagOfSmallId(owner) ?? "";
  const p = perksOf(tag, doctrineOf(im));
  if (tag !== "JOS" || !attacking) return p;
  const s = im.st.sieges.find((x) => x.region === region && x.owner !== owner);
  const guns = (mixOf(im, owner).cannon ?? 0) > 0;
  return s !== undefined && guns && today(im) - s.sinceDay >= BIGYEOK_SIEGE_DAYS
    ? { ...p, bigyeok: true }
    : p;
}

/** Joseon's garrison at home under 진관 holds harder (§4 stage A). */
export function homeBlockPct(
  im: WwImjin,
  owner: number,
  region: number,
): number {
  const jos = im.idOf("JOS");
  if (owner !== jos || !doctrineOf(im).jingwan) return 0;
  return im.ww.scenario.ownerByRegion()[region] === jos
    ? JINGWAN_HOME_BLOCK_PCT
    : 0;
}

/**
 * Rows that routed in a battle round against `enemy`: Joseon picks up the
 * arquebuses of the Japanese it routs, Japan learns from Ming's guns, and
 * Joseon's routed armies count for 진관 and the court's flight.
 */
export function noteRouts(
  land: WwLand,
  rows: readonly number[],
  enemy: number,
): void {
  const im = land.ww.imjinWar;
  if (im === null || rows.length === 0) return;
  const t = land.divisions;
  const jos = im.idOf("JOS");
  const jpn = im.idOf("JPN");
  const min = im.idOf("MIN");
  const doc = docOf(im);
  const japanese = rows.filter((r) => t.owner[r] === jpn).length;
  if (enemy === jos) doc.josArq += japanese;
  if (enemy === min && japanese > 0) doc.jpnLearned = 1;
  const armies = new Map<number, number>();
  let region = -1;
  for (const r of rows) {
    if (t.owner[r] !== jos) continue;
    armies.set(t.army[r], (armies.get(t.army[r]) ?? 0) + 1);
    region = t.region[r];
  }
  let big = false;
  for (const [, n] of armies) if (n >= 2) big = true;
  if (!big) return;
  const day = today(im);
  doc.josRouts.push(day, region);
  const c = land.ww.politics.country(jos);
  if (c !== null && !c.flags.has(D.josRouted)) {
    c.flags.set(D.josRouted, [day, -1]);
    land.ww.politics.markCountry(jos);
  }
}

/** Joseon's armies of 2+ divisions routed in the last 10 days: their regions. */
export function recentJosRouts(im: WwImjin): number[] {
  const d = im.st.doc;
  if (d === undefined) return [];
  const out: number[] = [];
  for (let i = 0; i + 1 < d.josRouts.length; i += 2)
    out.push(d.josRouts[i + 1]);
  return out;
}

/** Joseon's conscription stops at "limited" until the 훈련도감 (doctrine §7.1). */
export function joseonLevyCapped(im: WwImjin, owner: number): boolean {
  const jos = im.idOf("JOS");
  return owner === jos && flagDay(im, jos, D.josHullyeon) < 0;
}

/** A division Joseon raises in the war waits at its muster point (§4 stage A). */
export function musterOrg(land: WwLand, row: number): void {
  const im = land.ww.imjinWar;
  if (im === null) return;
  const jos = im.idOf("JOS");
  const t = land.divisions;
  if (t.owner[row] !== jos || im.st.warDay < 0) return;
  if (doctrineOf(im).jingwan) return;
  const cap = Math.floor((land.orgMaxOf(row) * MUSTER_ORG_PCT) / 100);
  if (t.org[row] > cap) t.org[row] = cap;
}

/** The doctrine's day (WwImjin.daily). */
export function doctrineDay(im: WwImjin, day: number): void {
  if (im.st.warDay < 0) return;
  const ww = im.ww;
  const doc = docOf(im);
  const jos = im.idOf("JOS");
  const jpn = im.idOf("JPN");
  const pol = ww.politics;
  // Old routs drop out of the court's reckoning.
  const keep: number[] = [];
  for (let i = 0; i + 1 < doc.josRouts.length; i += 2)
    if (day - doc.josRouts[i] <= ROUT_KEEP_DAYS)
      keep.push(doc.josRouts[i], doc.josRouts[i + 1]);
  doc.josRouts = keep;
  // Ming's drill masters (§4 stage C).
  const relief = pol.gflags.get("imjin_ming_relief");
  const jc = pol.country(jos);
  if (
    jc !== null &&
    relief !== undefined &&
    day - relief >= DRILL_DAYS &&
    !jc.flags.has(D.josDrill)
  ) {
    jc.flags.set(D.josDrill, [day, -1]);
    pol.markCountry(jos);
  }
  // Japan's hold in Korea and its losses there (§2 the wajō).
  const start = ww.scenario.ownerByRegion();
  let held = 0;
  for (const r of ww.scenario.landRegions)
    if (ww.land.controller[r.id] === jpn && start[r.id] !== jpn) held++;
  doc.jpnPeak = Math.max(doc.jpnPeak, held);
  const jc2 = pol.country(jpn);
  if (
    jc2 !== null &&
    held + LOST_REGIONS <= doc.jpnPeak &&
    !jc2.flags.has(D.jpnLostRegion)
  ) {
    jc2.flags.set(D.jpnLostRegion, [day, -1]);
    pol.markCountry(jpn);
  }
  // Japan's caution at sea (§3).
  const sea = im.st.sea;
  // Japan's own hulls only: prizes taken do not make up for ships lost.
  const ships = sea.ships.filter(
    (s) => s.owner === jpn && JAPANESE_HULLS.includes(s.kind),
  ).length;
  doc.jpnShips.push(day, ships);
  while (doc.jpnShips.length > 0 && day - doc.jpnShips[0] > CAUTION_DAYS)
    doc.jpnShips.splice(0, 2);
  let most = 0;
  for (let i = 1; i < doc.jpnShips.length; i += 2)
    most = Math.max(most, doc.jpnShips[i]);
  if (most - ships >= CAUTION_SHIPS && !pol.gflags.has(D.jpnSeaCaution)) {
    pol.gflags.set(D.jpnSeaCaution, day);
    pol.markGlobal();
  }
  sortie(im);
  scuttle(im);
}

/** Sortie endurance (§5): days out of port; past SORTIE_DAYS the crews tire. */
function sortie(im: WwImjin): void {
  const ctx = im.ctx(im.mg.ticks());
  for (const f of im.st.sea.fleets) {
    if (f.ships.length === 0) continue;
    const p = ctx.nearestPort(f.owner, f.x, f.y);
    const px = p < 0 ? 0 : ctx.tileX(p) * MT + (MT >> 1);
    const py = p < 0 ? 0 : ctx.tileY(p) * MT + (MT >> 1);
    const near =
      p >= 0 && Math.abs(px - f.x) + Math.abs(py - f.y) <= IN_PORT_MT;
    if (near) {
      if (f.daysOut !== undefined) delete f.daysOut;
      continue;
    }
    f.daysOut = (f.daysOut ?? 0) + 1;
    if (f.daysOut > SORTIE_DAYS && f.battle === 0)
      f.morale = Math.max(0, f.morale - SORTIE_MORALE);
  }
}

/** Japan's divisions ashore in Korea. */
function japanAshore(im: WwImjin): number {
  const land = im.ww.land;
  const jpn = im.idOf("JPN");
  const start = im.ww.scenario.ownerByRegion();
  let n = 0;
  for (const a of land.armiesOf(jpn))
    for (const id of a.divisions) {
      const r = land.divisions.rowOf(id);
      if (r >= 0 && start[land.divisions.region[r]] !== jpn) n++;
    }
  return n;
}

/**
 * The Gyeongsang fleets (§5; main's call): a Joseon fleet under a weak
 * commander (or of a shaken court) that sees Japan's fleets five times its
 * weight while Japan lands in force is scuttled, by the AI by state; a
 * human is asked (scuttle, withdraw west or fight).
 */
function scuttle(im: WwImjin): void {
  const ww = im.ww;
  const jos = im.idOf("JOS");
  const jpn = im.idOf("JPN");
  if (!ww.isAtWar(jos, jpn)) return;
  const doc = docOf(im);
  const sea = im.st.sea;
  if (japanAshore(im) < LANDED_DIVISIONS) return;
  const human = ww.politics.isHuman(jos);
  const cohesion = ww.politics.country(jos)?.stabBp ?? 10000;
  for (const f of [...sea.fleets].sort((a, b) => a.id - b.id)) {
    if (f.owner !== jos || f.ships.length === 0 || f.battle !== 0) continue;
    if (doc.scuttleAsked.includes(f.id)) continue;
    const nerve = f.admiral.alive ? f.admiral.nerve : 0;
    const weak = nerve <= SCUTTLE_NERVE || cohesion < SCUTTLE_COHESION_BP;
    if (!weak) continue;
    let foe = 0;
    for (const e of sea.fleets)
      if (
        e.owner === jpn &&
        Math.abs(e.x - f.x) + Math.abs(e.y - f.y) <= SCUTTLE_REACH_MT
      )
        foe += fleetStrength(sea, e);
    const mine = fleetStrength(sea, f);
    if (foe < SCUTTLE_ODDS * Math.max(1, mine)) continue;
    doc.scuttleAsked.push(f.id);
    doc.scuttleAsked.sort((a, b) => a - b);
    if (human) {
      if (doc.scuttleFleet >= 0) continue;
      doc.scuttleFleet = f.id;
      ww.politics.queueEvent(SCUTTLE_SCENE, jos, jos, 0, 0);
    } else scuttleFleet(im, f);
  }
}

/** Two thirds of the fleet go down by their own crews; the crews go to the walls. */
function scuttleFleet(im: WwImjin, f: SeaFleet): void {
  const sea = im.st.sea;
  const n = Math.floor((f.ships.length * 2) / 3);
  if (n <= 0) return;
  const gone = new Set(f.ships.slice(f.ships.length - n));
  let crews = 0;
  for (const s of sea.ships)
    if (gone.has(s.id)) {
      crews += s.crew;
      s.hull = 0;
      sea.events.push({
        tick: im.mg.ticks(),
        kind: "scuttled",
        a: s.id,
        b: f.id,
      });
    }
  f.ships = f.ships.filter((id) => !gone.has(id));
  sea.ships = sea.ships.filter((s) => s.hull > 0);
  sea.fleets = sea.fleets.filter((x) => x.ships.length > 0);
  const ec = im.ww.economy.country(f.owner);
  if (ec !== null) ec.manpower += crews;
  im.ww.politics.messageAll("ww1936_imjin_fleet_scuttled", {});
}

/** The scuttling scene's pick (a human Joseon's). */
export function scuttlePicks(im: WwImjin): void {
  const jos = im.idOf("JOS");
  const c = im.ww.politics.country(jos);
  const doc = im.st.doc;
  if (c === null || doc === undefined || doc.scuttleFleet < 0) return;
  const take = (o: string) => {
    const k = pickFlag(SCUTTLE_SCENE, o);
    if (!c.flags.has(k)) return false;
    c.flags.delete(k);
    im.ww.politics.markCountry(jos);
    return true;
  };
  const f = im.st.sea.fleets.find((x) => x.id === doc.scuttleFleet);
  if (take("a")) {
    if (f !== undefined) scuttleFleet(im, f);
  } else if (take("b")) {
    if (f !== undefined) withdrawWest(im, f);
    im.ww.politics.messageAll("ww1936_imjin_fleet_withdrawn", {});
  } else if (take("c")) {
    im.ww.politics.messageAll("ww1936_imjin_fleet_stands", {});
  } else return;
  doc.scuttleFleet = -1;
}

/** To the nearest own port to the west of the fleet. */
function withdrawWest(im: WwImjin, f: SeaFleet): void {
  const ctx = im.ctx(im.mg.ticks());
  let best = -1;
  let bd = Infinity;
  for (const r of im.ww.scenario.landRegions) {
    if (im.ww.land.controller[r.id] !== f.owner) continue;
    const t = im.portTile(r.id);
    if (t < 0) continue;
    const x = ctx.tileX(t) * MT;
    if (x >= f.x - 5 * MT) continue;
    const d = Math.abs(x - f.x) + Math.abs(ctx.tileY(t) * MT - f.y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  if (best >= 0)
    seaOrder(im.st.sea, ctx, f.owner, f.id, { kind: "move", tile: best });
}
