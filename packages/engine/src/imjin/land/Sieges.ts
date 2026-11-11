// Imjin sieges (ww175 design §5 "Sieges", ww177 merge 1): a fort region
// (walled town, mountain fortress, or any region with a fort) whose every
// land neighbour the enemy holds is under siege. It eats its grain, then
// its garrison's morale (organisation) falls each day; besiegers with guns
// breach a fort level every 3 × level days, others starve it out. Battles
// for it are fought against the walls (LandRound's storm numbers).
import {
  BIGYEOK_SIEGE_DAYS,
  BIGYEOK_SIEGE_MORALE,
  DOCTRINE_FLAGS,
} from "@openfront/engine-lib/imjin/Doctrine";
import { techGrainDays } from "@openfront/engine-lib/imjin/ImjinTechs";
import {
  fortLevelOf,
  type SiegeChoice,
  siegeDay,
  STARVING_MORALE,
  terrainRow,
} from "@openfront/engine-lib/imjin/LandRules";
import { regionTerrain } from "@openfront/engine-lib/imjin/Terrain";
import { effectiveLevel } from "../../ww1936/economy/Buildings";
import type { SeaBattery } from "../sea/SeaCtx";
import type { ImjinSiege, WwImjin } from "../WwImjin";
import { mixOf, techOf } from "./ImjinDoctrine";

/** Grain a fort holds, days (design §5: "days shown"; doctrine §7.3 by kind). */
export const SIEGE_GRAIN_DAYS = 30;
export const FORTRESS_GRAIN_DAYS = 90;
export const WAJO_GRAIN_DAYS = 120;
/** A wajō's wall (doctrine §2). */
export const WAJO_LEVEL = 3;

/**
 * ww177 P7b (doctrine §2): once Japan has built its wajō, every Korean port
 * region it holds is a coastal castle of level 3.
 */
function isWajo(im: WwImjin, region: number): boolean {
  const jpn = im.idOf("JPN");
  if (im.ww.land.controller[region] !== jpn) return false;
  const sc = im.ww.scenario;
  if (!sc.isPort(region) || sc.ownerByRegion()[region] === jpn) return false;
  return (
    im.ww.politics.country(jpn)?.flags.has(DOCTRINE_FLAGS.jpnWaeseong) === true
  );
}

/** The fort level a region fights with (0: none). */
export function imjinFortLevel(im: WwImjin, region: number): number {
  const s = im.st.sieges.find((x) => x.region === region);
  if (s !== undefined) return s.fort;
  const t = regionTerrain(im.ww.scenario, region);
  const lv = effectiveLevel(im.ww.economy, region, "fort");
  const base =
    t === "walled" || t === "fortress" || lv > 0 ? fortLevelOf(t, lv) : 0;
  return isWajo(im, region) ? Math.max(base, WAJO_LEVEL) : base;
}

/** ww177 P7b: the wajō's shore batteries (doctrine §3). */
export function wajoBatteries(im: WwImjin): SeaBattery[] {
  const jpn = im.idOf("JPN");
  if (
    im.ww.politics.country(jpn)?.flags.has(DOCTRINE_FLAGS.jpnWaeseong) !== true
  )
    return [];
  const out: SeaBattery[] = [];
  for (const r of im.ww.scenario.landRegions) {
    if (!isWajo(im, r.id)) continue;
    const tile = im.portTile(r.id);
    if (tile >= 0) out.push({ tile, owner: jpn, level: WAJO_LEVEL });
  }
  return out;
}

/**
 * Divisions of `owner`'s enemies next to the fort, and of `owner` in it.
 * ww181: the enemy's divisions inside the region count as next to it: a
 * deep region's outer bands fall first (Bands.ts), and the besiegers who
 * took them stand in the region, before the walls.
 */
function divisionsAround(
  im: WwImjin,
  region: number,
  owner: number,
): { enemy: number; garrison: number } {
  const land = im.ww.land;
  const t = land.divisions;
  let enemy = 0;
  let garrison = 0;
  for (const row of land.rowsIn(region)) {
    if (t.owner[row] === owner) garrison++;
    else if (land.isEnemy(owner, t.owner[row])) enemy++;
  }
  for (const n of im.ww.scenario.regionNeighbours(region))
    for (const row of land.rowsIn(n))
      if (land.isEnemy(owner, t.owner[row])) enemy++;
  return { enemy, garrison };
}

/**
 * A fort is invested when every land neighbour is enemy-held, or (ww177
 * P7b, doctrine §7.3) when the enemy holds at least half its neighbours
 * with at least twice the garrison's divisions next to it: Hanseong and
 * Suwon can be besieged.
 */
function surrounded(im: WwImjin, region: number, owner: number): boolean {
  const land = im.ww.land;
  const nb = im.ww.scenario.regionNeighbours(region);
  if (nb.length === 0) return false;
  let held = 0;
  for (const n of nb) if (land.isEnemy(owner, land.controller[n])) held++;
  if (held === nb.length) return true;
  if (held * 2 < nb.length) return false;
  const d = divisionsAround(im, region, owner);
  return d.enemy > 0 && d.enemy >= 2 * d.garrison;
}

/** The besiegers' guns: any, Ming's (they breach twice as fast), Joseon's (the bigyeok). */
function besiegersGuns(
  im: WwImjin,
  region: number,
  owner: number,
): { any: boolean; ming: boolean; joseon: boolean; breachPct: number } {
  const land = im.ww.land;
  const out = { any: false, ming: false, joseon: false, breachPct: 0 };
  for (const n of im.ww.scenario.regionNeighbours(region)) {
    const c = land.controller[n];
    if (!land.isEnemy(owner, c)) continue;
    if ((mixOf(im, c).cannon ?? 0) <= 0) continue;
    out.any = true;
    // ww184: the best siege guns researched among the besiegers.
    out.breachPct = Math.max(out.breachPct, techOf(im, c).breachPct);
    const tag = im.ww.scenario.tagOfSmallId(c);
    if (tag === "MIN") out.ming = true;
    if (tag === "JOS") out.joseon = true;
  }
  return out;
}

/** Grain the fort starts a siege with (doctrine §7.3). */
function grainOf(im: WwImjin, region: number, owner: number): number {
  // ww184: granaries and walls researched add their days.
  return techGrainDays(techOf(im, owner), baseGrainOf(im, region, owner));
}

function baseGrainOf(im: WwImjin, region: number, owner: number): number {
  if (isWajo(im, region)) return WAJO_GRAIN_DAYS;
  const t = regionTerrain(im.ww.scenario, region);
  if (t === "fortress") return FORTRESS_GRAIN_DAYS;
  // 청야입보: the countryside's grain carried into Joseon's forts.
  const jos = im.idOf("JOS");
  if (
    owner === jos &&
    im.ww.politics
      .country(jos)
      ?.hasFlag(DOCTRINE_FLAGS.josCheongya, im.ww.day(im.mg.ticks())) === true
  )
    return FORTRESS_GRAIN_DAYS;
  return SIEGE_GRAIN_DAYS;
}

/** One day of every siege: start, eat, breach or starve, end. */
export function siegeDays(im: WwImjin, day: number): void {
  const ww = im.ww;
  const land = ww.land;
  const t = land.divisions;
  const out: ImjinSiege[] = [];
  for (const r of ww.scenario.landRegions) {
    const owner = land.controller[r.id];
    if (owner === 0) continue;
    const fort = imjinFortLevel(im, r.id);
    let s = im.st.sieges.find((x) => x.region === r.id && x.owner === owner);
    if (fort <= 0 && s === undefined) continue;
    if (!surrounded(im, r.id, owner)) continue;
    if (s === undefined) {
      s = {
        region: r.id,
        owner,
        sinceDay: day,
        grainDays: grainOf(im, r.id, owner),
        fort,
        breachDays: 0,
        morale: 1000,
      };
      im.stats.sieges++;
    } else {
      const terrain = terrainRow(regionTerrain(ww.scenario, r.id));
      const guns = besiegersGuns(im, r.id, owner);
      const choice: SiegeChoice = guns.any ? "breach" : "starve";
      const n = siegeDay(
        {
          grainDays: s.grainDays,
          fort: s.fort,
          breachDays: s.breachDays,
          morale: s.morale,
        },
        choice,
        choice === "breach",
        false,
        terrain,
        guns.ming,
        guns.breachPct,
      );
      s = { ...s, ...n };
      // ww177 P7b (doctrine §4): Joseon's guns lob the bigyeokjincheonroe
      // over the walls once the siege has settled in.
      if (guns.joseon && day - s.sinceDay >= BIGYEOK_SIEGE_DAYS) {
        s.morale = Math.max(0, s.morale - BIGYEOK_SIEGE_MORALE);
        for (const row of land.rowsIn(r.id)) {
          if (t.owner[row] !== owner) continue;
          const cut = Math.floor(
            (land.orgMaxOf(row) * BIGYEOK_SIEGE_MORALE) / 1000,
          );
          t.org[row] = Math.max(0, t.org[row] - cut);
          land.markArmy(t.army[row]);
        }
      }
      // Hunger: the garrison's organisation falls with the morale.
      if (s.grainDays === 0) {
        for (const row of land.rowsIn(r.id)) {
          if (t.owner[row] !== owner) continue;
          const cut = Math.floor((land.orgMaxOf(row) * STARVING_MORALE) / 1000);
          t.org[row] = Math.max(0, t.org[row] - cut);
          land.markArmy(t.army[row]);
        }
      }
    }
    out.push(s);
  }
  out.sort((a, b) => a.region - b.region);
  im.st.sieges = out;
}
