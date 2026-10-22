// P6 lane W2 (plan Task 8): night bombing and air recon (spec §15.3,
// §15.4), and the air zone's depth day (WwAir, after P4's mission
// effects): today's recon sorties by side (pre-flight §0-8, A11: state,
// computed on the zone's day and read on the observer's turn), the night
// flag of every record of a night group, then the aces (Aces.ts).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { AIR_MISSIONS } from "@openfront/engine-api/ww1936/AirTypes";
import { DS_RADAR, DS_RECON } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  nightBombBp,
  nightLossBp,
  RECON_CAMERA_X,
  RECON_PLAN_CUT_BP,
  RECON_SORTIES,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import { zoneFlights } from "../air/AirCombat";
import { isCarrierWing } from "../air/Deploy";
import type { Deployment } from "../air/WwAir";
import { dailyAces } from "./Aces";
import { sideKeyOf } from "./Mines";
import type { WwDepth } from "./WwDepth";

const M_BOMB = AIR_MISSIONS.indexOf("strategic_bombing");
const M_RECON = AIR_MISSIONS.indexOf("recon");
const NEUTRAL_NIGHT = { lossBp: 10_000, bombBp: 10_000 } as const;

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

/** The air zone's day (after P4's mission effects): recon, night groups, aces. */
export function airZoneDay(
  d: WwDepth,
  sr: number,
  day: number,
  tick: number,
): void {
  void tick;
  if (d.ww.scenario.sr(sr) === undefined) return;
  reconDay(d, sr);
  syncNightGroups(d, sr);
  dailyAces(d, sr, day);
}

/** The DS_* flags of a country's plane design slot (1-based). */
function planeFlags(d: WwDepth, owner: number, slot: number): number {
  return d.designStatsOf(owner, "plane", slot)?.flags ?? 0;
}

/**
 * Spec §15.4: a land zone's recon sorties by side today — P4's sorties of
 * the recon deployments (spec §14.2), their design planes at the same rate
 * (a recon camera design twice over), × (100 + reconPct)%. Kept as
 * [side, sr, sorties], sorted by (sr, side), only sides with sorties.
 */
function reconDay(d: WwDepth, sr: number): void {
  const ww = d.ww;
  const air = ww.air;
  const s = ww.scenario.sr(sr)!;
  const bySide = new Map<number, number>();
  if (s.kind === "land") {
    for (const f of zoneFlights(air, sr)) {
      if (f.mission !== M_RECON || f.total <= 0) continue;
      let milli = f.total;
      const dep = air.deployments.get(f.id);
      const planes = sum(f.counts);
      if (dep !== undefined && planes > 0) {
        const effPm = Math.floor(f.total / planes);
        dep.dcounts.forEach((n, i) => {
          if (n <= 0) return;
          const x =
            (planeFlags(d, dep.owner, i + 1) & DS_RECON) !== 0
              ? RECON_CAMERA_X
              : 1;
          milli += n * effPm * x;
        });
      }
      const pct = ww.economy.country(f.owner)?.stats.reconPct ?? 0;
      milli = Math.floor((milli * Math.max(0, 100 + pct)) / 100);
      bySide.set(f.side, (bySide.get(f.side) ?? 0) + milli);
    }
  }
  const rows: [number, number, number][] = [];
  for (const [side, m] of [...bySide].sort((a, b) => a[0] - b[0])) {
    const n = Math.floor(m / 1000);
    if (n > 0) rows.push([side, sr, n]);
  }
  const old = d.sea.reconBySide;
  const was = old.filter((e) => e[1] === sr);
  if (
    was.length === rows.length &&
    was.every((e, i) => e[0] === rows[i][0] && e[2] === rows[i][2])
  ) {
    return;
  }
  // A new list (never edited in place), then the foundation's index.
  d.sea.reconBySide = [...old.filter((e) => e[1] !== sr), ...rows].sort(
    (a, b) => a[1] - b[1] || a[0] - b[0],
  );
  d.reindexSparse();
}

/** The records of a deployment's group (owner, zone, type, mission, volunteer host), land-based. */
function groupRecords(d: WwDepth, dep: Deployment): Deployment[] {
  const air = d.ww.air;
  const out: Deployment[] = [];
  for (const id of air.deploymentsIn(dep.sr)) {
    const x = air.deployments.get(id);
    if (
      x !== undefined &&
      x.owner === dep.owner &&
      x.type === dep.type &&
      x.mission === dep.mission &&
      x.volunteerFor === dep.volunteerFor &&
      !isCarrierWing(x)
    ) {
      out.push(x);
    }
  }
  return out;
}

/**
 * A group's records share the night flag: a record P4 adds to a night
 * group (a new base) takes it (P4's addDeployment gives a new record the
 * day default).
 */
function syncNightGroups(d: WwDepth, sr: number): void {
  const air = d.ww.air;
  for (const id of air.deploymentsIn(sr)) {
    const dep = air.deployments.get(id);
    if (dep === undefined || !dep.night || dep.mission !== M_BOMB) continue;
    for (const x of groupRecords(d, dep)) {
      if (!x.night) {
        x.night = true;
        air.markDeployment(x.id);
      }
    }
  }
}

/** A strategic bombing record that flies at night (its own flag or its group's). */
export function fliesAtNight(d: WwDepth, dep: Deployment): boolean {
  if (dep.mission !== M_BOMB || isCarrierWing(dep)) return false;
  if (dep.night) return true;
  return groupRecords(d, dep).some((x) => x.night);
}

/** The zone's land regions are all no-strike regions (nothing a raid may hit). */
function nightNoStrike(d: WwDepth, sr: number): boolean {
  const s = d.ww.scenario.sr(sr);
  if (s === undefined || s.kind !== "land" || s.members.length === 0) {
    return false;
  }
  return s.members.every((r) => d.noStrike(r));
}

/** air_night {deployment, on}: the whole group of a strategic bombing deployment flies by night or by day. */
export function issueSeaAir(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  if (o.kind !== "air_night") return "bad_index";
  const air = d.ww.air;
  const dep = air.deployments.get(o.deployment);
  if (dep === undefined) return "bad_index";
  if (dep.owner !== id) return "not_controlled";
  if (dep.mission !== M_BOMB || isCarrierWing(dep)) return "bad_air_mission";
  // Sensitivity (decisions.md, pre-flight §0-11): no night raid where every
  // region the zone could bomb is a no-strike region (Korea, Taiwan).
  if (o.on && nightNoStrike(d, dep.sr)) return "no_strike_region";
  for (const x of groupRecords(d, dep)) {
    if (x.night !== o.on) {
      x.night = o.on;
      air.markDeployment(x.id);
    }
  }
  air.markCountry(id);
  return null;
}

/**
 * Recon's cut of `victim`'s readiness (plan) bonus at `region`, bp ≤ 0:
 * a side at war with it flew ≥ 20 recon sorties over the region's air zone
 * on the zone's last day (spec §15.4).
 */
export function reconPlanCutBp(
  d: WwDepth,
  victim: number,
  region: number,
): number {
  const rows = d.sea.reconBySide;
  if (rows.length === 0) return 0;
  const zone = d.ww.scenario.regionSr(region);
  if (zone === 0) return 0;
  const land = d.ww.land;
  const own = land.sideOf(victim);
  for (const [side, sr, n] of rows) {
    if (sr !== zone || n < RECON_SORTIES || side === own) continue;
    if (land.sideMembers(side).some((m) => land.isEnemy(m, victim))) {
      return RECON_PLAN_CUT_BP;
    }
  }
  return 0;
}

/** `side`'s (a side key or a smallID) recon sorties on the zone's last day. */
export function reconToday(d: WwDepth, side: number, sr: number): number {
  const i = d.reconAt(sideKeyOf(d, side), sr);
  return i < 0 ? 0 : (d.sea.reconBySide[i]?.[2] ?? 0);
}

/**
 * Spec §8.8: the observer's side flew ≥ 20 recon sorties over a land zone
 * holding a region the target controls.
 */
export function reconCovers(
  d: WwDepth,
  observer: number,
  target: number,
): boolean {
  if (observer === target) return false;
  const ww = d.ww;
  const mine = d.reconIndex.get(ww.land.sideOf(observer));
  if (mine === undefined || mine.size === 0) return false;
  const ctrl = ww.land.controller;
  for (const [sr, i] of [...mine].sort((a, b) => a[0] - b[0])) {
    if ((d.sea.reconBySide[i]?.[2] ?? 0) < RECON_SORTIES) continue;
    const s = ww.scenario.sr(sr);
    if (s === undefined || s.kind !== "land") continue;
    if (s.members.some((r) => ctrl[r] === target)) return true;
  }
  return false;
}

/**
 * Spec §15.3: a night strategic bombing deployment's factors, bp — the
 * air-combat losses it takes (×0.5) and its bomb points (×0.6, + the
 * owner's nightBombBp). `shooters`: the enemy deployments firing on it;
 * their radar-design planes (night fighters) are not halved, so the loss
 * factor blends by their share (P4's loss split passes them, T1b). A day
 * deployment or any other mission: 10 000 / 10 000.
 */
export function nightMods(
  d: WwDepth,
  deploymentId: number,
  shooters?: readonly number[],
): { lossBp: number; bombBp: number } {
  const air = d.ww.air;
  const dep = air.deployments.get(deploymentId);
  if (dep === undefined || !fliesAtNight(d, dep)) return { ...NEUTRAL_NIGHT };
  const st = d.ww.economy.country(dep.owner)?.stats;
  const bombBp = nightBombBp(st?.nightBombBp ?? 0);
  let all = 0;
  let radar = 0;
  for (const id of shooters ?? []) {
    const s = air.deployments.get(id);
    if (s === undefined) continue;
    all += sum(s.counts);
    s.dcounts.forEach((n, i) => {
      if (n <= 0) return;
      all += n;
      if ((planeFlags(d, s.owner, i + 1) & DS_RADAR) !== 0) radar += n;
    });
  }
  return { lossBp: nightLossBp(radar, all), bombBp };
}
