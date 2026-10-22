// P6 lane W1 (plan Task 7): the AI's world devices (spec §16.2 end,
// §16.4 beats, §16.6, §16.7, §19.7). Each part keeps its own rhythm (plan
// decision 39) and leaves at once when it has nothing to do:
// - energy below 90%: buy coal (P1's open_trade path), else queue a power
//   plant — every 10 days, the day after P1's own AI turn;
// - the Soviet Union from 1941, at war: a factory region (2 or more) an
//   enemy stands next to has its factories moved inland (P3's
//   move_buildings) and what is left scorched — one region a day, never
//   the capital (the AI's own judgement);
// - the Dnipro dam beat (K5's flag hist_sun_dnipro_dam): the Soviet Union
//   scorches the dam's region once Germany is next to it;
// - a floating harbour in stock goes to a beachhead of its side (K5's
//   hist_gbr_floating_harbor is the British case of it);
// - railway guns in stock go to the largest armies at the front.
import { DAMS, WW_MAX_RAILGUNS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BuildingId,
  equipKey,
  RESOURCE_IDS,
  WW_AI_PERIOD_DAYS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { tradeUnitsPerCiv } from "@openfront/engine-lib/ww1936/EconomyRules";
import { scorchBlock } from "@openfront/engine-lib/ww1936/WorldRules";
import { queueBuild, usedSlots } from "../economy/Construction";
import { exportRoom, openTrade, tradePartners } from "../economy/Trade";
import type { CountryEconomy } from "../economy/WwEconomy";
import { capitalRegion } from "../land/LandStartRun";
import { applyEffect, makeCtx } from "../politics/Dispatch";
import { coalAvailable, coalDemand, energyOn } from "./Energy";
import { issueHarbor } from "./Harbors";
import { issueRailGun } from "./RailGuns";
import { issueScorch, scorchInputOf, threatsTo } from "./Scorch";
import type { WwDepth } from "./WwDepth";

/**
 * Spec §16.2: the AI acts on its energy below this ratio, ‰. Final
 * balance: 900 → 980 and up to AI_PLANTS_QUEUED plants at once (it was
 * one): a big builder (the United States) added demand faster than one
 * plant at a time could follow and sat at 40–50% from 1940.
 */
export const AI_ENERGY_PM = 980;
export const AI_PLANTS_QUEUED = 8;
/** Spec §16.7: the Soviet scorched earth starts in 1941. */
export const AI_SCORCH_FROM = "1941-01-01";
/** Spec §16.7: a region with this many factories is worth moving and burning. */
export const AI_SCORCH_FACTORIES = 2;
export const DNIPRO_FLAG = "hist_sun_dnipro_dam";
export const HARBOR_FLAG = "hist_gbr_floating_harbor";

const COAL = RESOURCE_IDS.indexOf("coal");
const HARBOR_KEY = equipKey("floating_harbor", 1);
const GUN_KEY = equipKey("railway_gun", 1);
const SCORCH_FROM_DAY = dayOfDate(AI_SCORCH_FROM);
const DNIPRO = DAMS.indexOf("dam_dnipro");
const MOVED: readonly BuildingId[] = ["mil", "civ"];

export function aiWorldDay(d: WwDepth, id: number, day: number): void {
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  aiEnergy(d, id, ce, day);
  if (ce.totals.warDays < 0) return;
  aiDniproDam(d, id, day);
  aiScorch(d, id, day);
  aiHarbor(d, id, ce);
  aiRailGuns(d, id, ce, day);
}

// ---- energy (spec §16.2) ----

function aiEnergy(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  day: number,
): void {
  // The day after P1's AI turn ((day + id) % 10 === 0), whose trade plan
  // looks only at its lines' needs.
  if ((day + id) % WW_AI_PERIOD_DAYS !== 1) return;
  const c = d.country(id);
  if (c === null || c.mech.energyPm >= AI_ENERGY_PM || !energyOn(d)) return;
  if (aiBuyCoal(d, id, ce)) return;
  aiBuildPlant(d, ce);
}

/** One coal deal for what the energy and the refineries lack; false when none could open. */
function aiBuyCoal(d: WwDepth, id: number, ce: CountryEconomy): boolean {
  const missing = coalDemand(d, id) - coalAvailable(d, id);
  if (missing <= 0) return false;
  const econ = d.ww.economy;
  // P1's AI budget (spec §12.2): 30% of the free civilian factories, at least one.
  const budget = Math.max(
    1,
    Math.floor((ce.totals.freeCivMilli * 30) / 100_000),
  );
  const per = Math.max(1, tradeUnitsPerCiv(ce.stats));
  const sellers = tradePartners(econ, id)
    .map((s) => ({
      s,
      room: exportRoom(econ, s, COAL),
      faction: d.ww.sameFaction(id, s),
    }))
    .filter((x) => x.room >= per)
    .sort(
      (a, b) =>
        Number(b.faction) - Number(a.faction) || b.room - a.room || a.s - b.s,
    );
  for (const x of sellers) {
    const civs = Math.min(
      Math.ceil(missing / per),
      Math.floor(x.room / per),
      budget,
    );
    if (civs >= 1 && openTrade(econ, ce, x.s, COAL, civs) === null) {
      return true;
    }
  }
  return false;
}

/** A power plant in the best home region (most free slots, then infrastructure), up to AI_PLANTS_QUEUED queued. */
function aiBuildPlant(d: WwDepth, ce: CountryEconomy): void {
  const queued = ce.queue.filter((q) => q.building === "power_plant").length;
  if (queued >= AI_PLANTS_QUEUED) return;
  const econ = d.ww.economy;
  const pol = d.ww.politics;
  const id = ce.smallID;
  const free = (r: number) =>
    econ.regionSlots(r, ce.stats.slotPct) - usedSlots(econ, r);
  const home = econ
    .regionsOf(id)
    .filter((r) => (pol.legalOwner[r] ?? 0) === id && free(r) > 0)
    .sort(
      (a, b) => free(b) - free(a) || econ.infra[b] - econ.infra[a] || a - b,
    );
  let want = AI_PLANTS_QUEUED - queued;
  for (const r of home) {
    while (want > 0 && queueBuild(econ, ce, r, "power_plant", 1) === null) {
      want--;
    }
    if (want <= 0) return;
  }
}

// ---- scorched earth (spec §16.7, §16.4) ----

function aiScorch(d: WwDepth, id: number, day: number): void {
  if (day < SCORCH_FROM_DAY || d.ww.tagOf(id) !== "SUN") return;
  const econ = d.ww.economy;
  const land = d.ww.land;
  const pol = d.ww.politics;
  const capital = capitalRegion(land, id);
  const factories = (r: number) =>
    (econ.civ[r] ?? 0) + (econ.mil[r] ?? 0) + (econ.dock[r] ?? 0);
  const mine = econ
    .regionsOf(id)
    .filter((r) => (pol.legalOwner[r] ?? 0) === id);
  let target = 0;
  for (const r of mine) {
    if (r === capital || factories(r) < AI_SCORCH_FACTORIES) continue;
    if (scorchBlock(scorchInputOf(d, id, r)) !== null) continue;
    if (
      target === 0 ||
      factories(r) > factories(target) ||
      (factories(r) === factories(target) && r < target)
    ) {
      target = r;
    }
  }
  if (target === 0) return;
  // Inland first: the regions no enemy stands next to, most room first.
  const safe = mine
    .filter((r) => r !== target && threatsTo(d, id, r).length === 0)
    .sort((a, b) => room(d, id, b) - room(d, id, a) || a - b);
  const tick = d.mg.ticks();
  if (safe.length > 0) {
    const ctx = makeCtx(pol, id, id, 0, tick);
    for (const b of MOVED) {
      const n = econ.buildingArray(b)[target] ?? 0;
      if (n <= 0) continue;
      applyEffect(ctx, {
        kind: "move_buildings",
        from: { regions: [target] },
        to: { regions: safe },
        building: b,
        count: n,
      });
    }
  }
  issueScorch(d, id, { kind: "scorch", region: target }, tick);
}

/** Free factory slots of a region for `id` (P1's slots less built and queued). */
function room(d: WwDepth, id: number, r: number): number {
  const econ = d.ww.economy;
  const ce = econ.country(id);
  return ce === null
    ? 0
    : econ.regionSlots(r, ce.stats.slotPct) - usedSlots(econ, r);
}

/**
 * Spec §16.4 beat (K5's DEPTH_BEATS sets the flag on the date): the
 * Soviet Union scorches the Dnipro dam's region once Germany, at war with
 * it, stands next to it; the flag waits until then and goes once done.
 */
function aiDniproDam(d: WwDepth, id: number, day: number): void {
  const pol = d.ww.politics;
  const c = pol.country(id);
  if (c === null || !c.hasFlag(DNIPRO_FLAG, day)) return;
  const region = d.ww.scenario.damRegion[DNIPRO] ?? 0;
  const deu = pol.idOfTag("DEU");
  if (region <= 0 || (d.world.damLevel[DNIPRO] ?? 0) === 0) {
    c.flags.delete(DNIPRO_FLAG);
    pol.markCountry(id);
    return;
  }
  if (deu === 0 || !threatsTo(d, id, region).includes(deu)) return;
  const tick = d.mg.ticks();
  if (issueScorch(d, id, { kind: "scorch", region }, tick) === null) {
    c.flags.delete(DNIPRO_FLAG);
    pol.markCountry(id);
  }
}

// ---- floating harbours (spec §16.6) ----

function aiHarbor(d: WwDepth, id: number, ce: CountryEconomy): void {
  if ((ce.stock[HARBOR_KEY] ?? 0) < 1) return;
  const navy = d.ww.navy;
  if (navy.beachhead.size === 0) return;
  const side = navy.sideOf(id);
  const heads = [...navy.beachhead.entries()]
    .filter(([r, b]) => b.side === side && d.ww.land.controller[r] === id)
    .map(([r]) => r)
    .sort((a, b) => a - b);
  for (const region of heads) {
    if (issueHarbor(d, id, { kind: "harbor_deploy", region }) === null) {
      const pol = d.ww.politics;
      const c = pol.country(id);
      if (c !== null && c.flags.delete(HARBOR_FLAG)) pol.markCountry(id);
      return;
    }
  }
}

// ---- railway guns (spec §16.5) ----

function aiRailGuns(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  day: number,
): void {
  if ((day + id) % WW_AI_PERIOD_DAYS !== 2) return;
  let stock = ce.stock[GUN_KEY] ?? 0;
  if (stock < 1) return;
  const armies = d.ww.land
    .armiesOf(id)
    .filter(
      (a) =>
        a.front.length > 0 &&
        a.volunteerFor === 0 &&
        a.railGuns < WW_MAX_RAILGUNS,
    )
    .sort((a, b) => b.divisions.length - a.divisions.length || a.id - b.id);
  for (const a of armies) {
    if (stock < 1) return;
    const count = Math.min(WW_MAX_RAILGUNS - a.railGuns, stock);
    if (
      issueRailGun(d, id, { kind: "railgun_assign", army: a.id, count }) ===
      null
    ) {
      stock -= count;
    }
  }
}
