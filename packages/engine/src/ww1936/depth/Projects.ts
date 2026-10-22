// World War 1936 P6 lane S (plan Task 6 Step 1, spec §9.1–§9.4): the
// facilities' projects, the scientists, the atomic bomb's production, a
// facility lost to the enemy, and the order routing of the lane (the
// drops, rockets and raids live in Atomic, Rockets and Raids).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  ATOMIC_URANIUM_DAY,
  DAMS,
  FACILITY_IDS,
  FacilityId,
  INTEL_BAND_FLOORS,
  SCIENTIST_SPECS,
  SPECIAL_PROJECTS,
  SpecialProject,
  WW_MAX_ATOMIC_STOCK,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  RESOURCE_IDS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  atomicBombDayMilli,
  inputPm,
  milestoneCrossed,
  PROJECT_DEFS,
  projectBaseDays,
  projectBit,
  projectBonusPct,
  projectDayMilli,
  projectStartBlock,
  SCIENTIST_MAX_SKILL,
  SCIENTIST_SKILL_DAYS,
  scientistPct,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { effectiveBuildings } from "../economy/Buildings";
import type { EffectCtx } from "../politics/Dispatch";
import { issueNukeDrop } from "./Atomic";
import { cancelRaid, issueRaid } from "./Raids";
import { issueRocketStrike } from "./Rockets";
import type { CountryDepth, WwDepth } from "./WwDepth";

type Run = CountryDepth["proj"]["running"][number];

const ATOMIC = SPECIAL_PROJECTS.indexOf("sp_atomic");
const URANIUM = RESOURCE_IDS.indexOf("uranium");
const ATOMIC_KEY = equipKey("atomic_bomb", 1);
const NUCLEAR = FACILITY_IDS.indexOf("facility_nuclear");
const VEMORK = DAMS.indexOf("dam_vemork");
const FULL = 1_000_000;

// ---- Shared reads ----

/** FACILITY_IDS index of the facility standing in `region` (P1's arrays), -1 none. */
export function facilityKindAt(d: WwDepth, region: number): number {
  const econ = d.ww.economy;
  for (let i = 0; i < FACILITY_IDS.length; i++) {
    if ((econ.buildingArray(FACILITY_IDS[i])[region] ?? 0) > 0) return i;
  }
  return -1;
}

/** The facilities of a kind (FACILITY_IDS index) on the map, by region (the foundation's index). */
export function facilitiesOfKind(d: WwDepth, kind: number): number[] {
  const out: number[] = [];
  for (const [r, f] of d.facilityIndex) if (f === kind + 1) out.push(r);
  return out.sort((a, b) => a - b);
}

/** The project row running at a facility region; undefined none. */
export function runAt(c: CountryDepth, region: number): Run | undefined {
  return c.proj.running.find((r) => r.facility === region);
}

/** The uranium P1 handed the country first on its last economy turn. */
function uraniumGot(d: WwDepth, id: number): number {
  return d.lastPriorityGot.get(id)?.[URANIUM] ?? 0;
}

/** A row's facility works today: ours, standing, not stopped by bomb damage. */
function facilityWorks(d: WwDepth, id: number, run: Run): boolean {
  if (run.facility <= 0) return false;
  const p = SPECIAL_PROJECTS[run.project];
  if (p === undefined) return false;
  const kind = PROJECT_DEFS[p].facility;
  return (
    d.ww.land.controller[run.facility] === id &&
    effectiveBuildings(d.ww.economy, run.facility, kind) >= 1
  );
}

/** The nuclear labs that make bombs for `id` today: controlled and legally ours, working. */
function bombLabs(d: WwDepth, id: number): number[] {
  return facilitiesOfKind(d, NUCLEAR).filter(
    (r) =>
      d.ww.land.controller[r] === id &&
      d.ww.politics.legalOwner[r] === id &&
      effectiveBuildings(d.ww.economy, r, "facility_nuclear") >= 1,
  );
}

/** Spec §18.5: the flags' speed bonus of a project for `id`, percent. */
function bonusPctOf(d: WwDepth, id: number, project: SpecialProject): number {
  const pol = d.ww.politics;
  const pc = pol.country(id);
  const day = Math.max(0, d.lastCommonDay);
  const flag = (f: string) => pc?.hasFlag(f, day) ?? false;
  const vemorkRegion = VEMORK < 0 ? 0 : (d.ww.scenario.damRegion[VEMORK] ?? 0);
  return projectBonusPct({
    project,
    heavyWater: flag("heavy_water"),
    radarLab: flag("radar_lab"),
    vemork:
      vemorkRegion > 0 &&
      d.ww.land.controller[vemorkRegion] === id &&
      (d.world.damLevel[VEMORK] ?? 0) > 0,
    norHeavyWater: pol.gflags.has("nor_heavy_water") || flag("nor_heavy_water"),
    quebec: pol.gflags.has("quebec_agreement") && d.ww.tagOf(id) === "USA",
  });
}

/**
 * Spec §9.3: a row's day, milli‰, and its input ‰ (`uranium`: what it
 * takes of today's priority uranium). Paused rows make nothing.
 */
function projectDay(
  d: WwDepth,
  id: number,
  c: CountryDepth,
  run: Run,
  uranium: number,
): { milli: number; inputPm: number } {
  const p = SPECIAL_PROJECTS[run.project];
  if (p === undefined) return { milli: 0, inputPm: 1000 };
  const def = PROJECT_DEFS[p];
  const input = inputPm(uranium, def.uraniumDay);
  if (run.facility <= 0) return { milli: 0, inputPm: input };
  const sci =
    run.scientist < 0
      ? undefined
      : c.proj.scientists.find((s) => s.id === run.scientist);
  const pct =
    (sci === undefined
      ? 0
      : scientistPct(sci.skill, SCIENTIST_SPECS[sci.spec] === def.spec)) +
    (d.ww.economy.country(id)?.stats.projectSpeedPct ?? 0) +
    bonusPctOf(d, id, p);
  const days = projectBaseDays(
    def.days,
    (c.proj.blueprints & projectBit(p)) !== 0,
  );
  return {
    milli: Math.max(
      0,
      projectDayMilli(days, Math.max(-90, pct), input, sci !== undefined),
    ),
    inputPm: input,
  };
}

/** The uranium each running row takes today, in row order (the projects before the labs). */
function uraniumShares(d: WwDepth, id: number, c: CountryDepth): number[] {
  let left = uraniumGot(d, id);
  return c.proj.running.map((run) => {
    const p = SPECIAL_PROJECTS[run.project];
    const need = p === undefined ? 0 : PROJECT_DEFS[p].uraniumDay;
    if (need <= 0 || !facilityWorks(d, id, run)) return 0;
    const take = Math.min(left, need);
    left -= take;
    return take;
  });
}

// ---- Daily ----

/** Spec §9.2–§9.4: the country's day of projects, scientists and bombs. */
export function dailyProjects(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null) return;
  let changed = false;
  // Spec §9.2: a scientist at work gains a level every 365 days (up to 5).
  for (const s of c.proj.scientists) {
    if (s.project < 0 || day - s.sinceDay < SCIENTIST_SKILL_DAYS) continue;
    s.sinceDay = day;
    if (s.skill < SCIENTIST_MAX_SKILL) {
      s.skill++;
      changed = true;
    }
  }
  let uranium = uraniumGot(d, id);
  if (c.proj.running.length > 0) {
    const shares = uraniumShares(d, id, c);
    const done: Run[] = [];
    c.proj.running.forEach((run, i) => {
      uranium -= shares[i];
      if (facilityWorks(d, id, run)) {
        const { milli } = projectDay(d, id, c, run, shares[i]);
        if (milli > 0) {
          const before = run.progressMilli;
          run.progressMilli = Math.min(FULL, before + milli);
          changed = true;
          if (run.project === ATOMIC) {
            const m = milestoneCrossed(
              Math.floor(before / 1000),
              Math.floor(run.progressMilli / 1000),
            );
            if (m >= 0) noteMilestone(d, id, m);
          }
        }
      }
      // An effect may have filled a paused row too.
      if (run.progressMilli >= FULL) done.push(run);
    });
    for (const run of done) completeProject(d, id, c, run);
  }
  produceBombs(d, id, c, uranium);
  if (changed) d.markCountry(id);
}

/** Spec §9.3: the owner and every country with close civil intelligence on it hear of a milestone. */
function noteMilestone(d: WwDepth, id: number, m: number): void {
  const params = {
    n: m + 1,
    total: 3,
    project: "sp_atomic",
    countryTag: d.ww.tagOf(id),
  };
  d.message(id, "ww1936_project_milestone", params);
  for (let o = 1; o < d.cap; o++) {
    if (o === id || !d.ww.isActor(o)) continue;
    if (d.intelOf(o, id, 0) >= INTEL_BAND_FLOORS[2]) {
      d.message(o, "ww1936_project_milestone", params);
    }
  }
}

function completeProject(
  d: WwDepth,
  id: number,
  c: CountryDepth,
  run: Run,
): void {
  const p = SPECIAL_PROJECTS[run.project];
  c.proj.running = c.proj.running.filter((r) => r !== run);
  if (p === undefined) return;
  const bit = projectBit(p);
  c.proj.done |= bit;
  // Spec §9.1: a blueprint helps once.
  c.proj.blueprints &= ~bit;
  const sci = c.proj.scientists.find((s) => s.id === run.scientist);
  if (sci !== undefined) sci.project = -1;
  d.message(id, "ww1936_project_done", { project: p });
  // Spec §9.3: the atomic test is world news (facts only).
  if (p === "sp_atomic") {
    d.news("news_atomic_test", { countryTag: d.ww.tagOf(id) });
  }
  // The proximity fuze's stats, the designs' project gates.
  d.markStats(id);
  d.markCountry(id);
}

/**
 * Spec §9.4: after sp_atomic, each nuclear lab we control and own makes a
 * bomb in 120 days at full uranium (2 a day, the shortfall slows it), up
 * to a stock of 10. A lab's progress waits while it is lost.
 */
function produceBombs(
  d: WwDepth,
  id: number,
  c: CountryDepth,
  uranium: number,
): void {
  if ((c.proj.done & (1 << ATOMIC)) === 0 || !d.nukesOn()) return;
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  let left = Math.max(0, uranium);
  for (const r of bombLabs(d, id)) {
    if (ce.stock[ATOMIC_KEY] >= WW_MAX_ATOMIC_STOCK) break;
    const take = Math.min(left, ATOMIC_URANIUM_DAY);
    left -= take;
    const milli = atomicBombDayMilli(inputPm(take, ATOMIC_URANIUM_DAY));
    if (milli <= 0) continue;
    let e = c.proj.atomic.find((x) => x[0] === r);
    if (e === undefined) {
      e = [r, 0];
      c.proj.atomic.push(e);
      c.proj.atomic.sort((a, b) => a[0] - b[0]);
    }
    e[1] += milli;
    if (e[1] >= FULL) {
      e[1] -= FULL;
      ce.stock[ATOMIC_KEY] += 1;
      d.ww.economy.markCountryDirty(id);
    }
    d.markCountry(id);
  }
}

/** Uranium the atomic project and the bomb labs want today (taken before the lines). */
export function uraniumDemand(d: WwDepth, id: number): number {
  const c = d.country(id);
  if (c === null || !d.nukesOn()) return 0;
  let n = 0;
  for (const run of c.proj.running) {
    const p = SPECIAL_PROJECTS[run.project];
    if (p !== undefined && facilityWorks(d, id, run)) {
      n += PROJECT_DEFS[p].uraniumDay;
    }
  }
  if ((c.proj.done & (1 << ATOMIC)) !== 0) {
    const stock = d.ww.economy.country(id)?.stock[ATOMIC_KEY] ?? 0;
    if (stock < WW_MAX_ATOMIC_STOCK) {
      n += ATOMIC_URANIUM_DAY * bombLabs(d, id).length;
    }
  }
  return n;
}

// ---- Facilities change hands (spec §9.1) ----

/**
 * A region changed hands: the facility's project stops; with no facility
 * of the kind left, its progress halves (once); the captor gets the
 * project's blueprint. A recaptured facility of our own takes a paused
 * project of its kind again.
 */
export function onRegionControl(
  d: WwDepth,
  region: number,
  from: number,
  to: number,
  tick: number,
): void {
  void tick;
  const kind = facilityKindAt(d, region);
  if (kind < 0) return;
  const fc = from > 0 ? d.country(from) : null;
  const tc = to > 0 ? d.country(to) : null;
  if (fc !== null) {
    const lost = fc.proj.running.filter((r) => r.facility === region);
    if (lost.length > 0) {
      const other = facilitiesOfKind(d, kind).some(
        (r) => r !== region && d.ww.land.controller[r] === from,
      );
      for (const run of lost) {
        run.facility = 0;
        const bit = 1 << run.project;
        if (!other && (fc.proj.halved & bit) === 0) {
          run.progressMilli = Math.floor(run.progressMilli / 2);
          fc.proj.halved |= bit;
        }
        if (tc !== null && (tc.proj.done & bit) === 0) {
          tc.proj.blueprints |= bit;
        }
      }
      d.markCountry(from);
      if (to > 0) d.markCountry(to);
    }
  }
  if (
    tc !== null &&
    d.ww.politics.legalOwner[region] === to &&
    runAt(tc, region) === undefined
  ) {
    const paused = tc.proj.running
      .filter((r) => {
        const p = SPECIAL_PROJECTS[r.project];
        return (
          r.facility === 0 &&
          p !== undefined &&
          PROJECT_DEFS[p].facility === FACILITY_IDS[kind]
        );
      })
      .sort((a, b) => a.project - b.project);
    if (paused.length > 0) {
      paused[0].facility = region;
      d.markCountry(to);
    }
  }
}

// ---- The project_progress effect (spec §18.3) ----

export function applyProjectEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "project_progress" }>,
  actor: number,
): void {
  const d = ctx.pol.ww.depth as WwDepth | undefined;
  const c = d?.country(actor) ?? null;
  if (d === undefined || c === null) return;
  if (e.project === "sp_atomic" && !d.nukesOn()) return;
  const idx = SPECIAL_PROJECTS.indexOf(e.project);
  if ((c.proj.done & (1 << idx)) !== 0) return;
  const delta = e.pct * 10_000;
  let run = c.proj.running.find((r) => r.project === idx);
  if (run === undefined) {
    // Progress on a project not started yet: a paused row keeps it.
    if (delta <= 0) return;
    run = { project: idx, facility: 0, progressMilli: 0, scientist: -1 };
    c.proj.running.push(run);
  }
  run.progressMilli = Math.max(0, Math.min(FULL, run.progressMilli + delta));
  d.markCountry(actor);
}

// ---- The view's numbers (review E6) ----

/**
 * Review E6: a running project's days left and today's input, ‰ (spec
 * §9.3 projectDayMilli with its scientist, stats, flags, blueprint and
 * today's uranium share). A paused or stopped row: -1 days.
 */
export function projectEta(
  d: WwDepth,
  id: number,
  run: { project: number; progressMilli: number; scientist: number },
): { daysLeft: number; inputPm: number } {
  const c = d.country(id);
  const row =
    c === null
      ? undefined
      : c.proj.running.find((r) => r.project === run.project);
  if (c === null || row === undefined) return { daysLeft: -1, inputPm: 1000 };
  const shares = uraniumShares(d, id, c);
  const day = projectDay(d, id, c, row, shares[c.proj.running.indexOf(row)]);
  if (!facilityWorks(d, id, row) || day.milli <= 0) {
    return { daysLeft: -1, inputPm: day.inputPm };
  }
  const left = Math.max(0, FULL - run.progressMilli);
  return { daysLeft: Math.ceil(left / day.milli), inputPm: day.inputPm };
}

// ---- Orders (DEPTH_ORDER_KINDS 40–46) ----

/** project_start … raid_cancel. */
export function issueProjects(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  switch (o.kind) {
    case "project_start":
      return startProject(d, id, o.project, o.facility);
    case "project_cancel":
      return cancelProject(d, id, o.project);
    case "project_scientist":
      return assignScientist(d, id, o.project, o.scientist, tick);
    case "nuke_drop":
      return issueNukeDrop(d, id, o.region, o.rocket, tick);
    case "rocket_strike":
      return issueRocketStrike(d, id, o, tick);
    case "raid":
      return issueRaid(d, id, o, tick);
    case "raid_cancel":
      return cancelRaid(d, id, o.raid);
    default:
      return "bad_index";
  }
}

/** Spec §9.3: project_start's view of the region for the shared judge. */
export function projectStartInputOf(
  d: WwDepth,
  id: number,
  project: SpecialProject,
  region: number,
): Parameters<typeof projectStartBlock>[0] {
  const c = d.country(id);
  const idx = SPECIAL_PROJECTS.indexOf(project);
  const kind = facilityKindAt(d, region);
  const ours = d.ww.land.controller[region] === id;
  const row = c?.proj.running.find((r) => r.project === idx);
  return {
    project,
    facilityKind: ours && kind >= 0 ? (FACILITY_IDS[kind] as FacilityId) : null,
    facilityBusy:
      c !== null && c.proj.running.some((r) => r.facility === region),
    techs: d.ww.economy.country(id)?.researched ?? new Set(),
    done: c?.proj.done ?? 0,
    running: row !== undefined && row.facility > 0,
    nukesOn: d.nukesOn(),
  };
}

/** Spec §9.3 project_start: a paused project of the kind starts again where it left off. */
export function startProject(
  d: WwDepth,
  id: number,
  project: SpecialProject,
  region: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  if (d.ww.scenario.region(region) === undefined) return "bad_region";
  const block = projectStartBlock(projectStartInputOf(d, id, project, region));
  if (block !== null) return block;
  const idx = SPECIAL_PROJECTS.indexOf(project);
  const row = c.proj.running.find((r) => r.project === idx);
  if (row !== undefined) {
    row.facility = region;
  } else {
    c.proj.running.push({
      project: idx,
      facility: region,
      progressMilli: 0,
      scientist: -1,
    });
  }
  d.markCountry(id);
  return null;
}

/** Spec §9.3 project_cancel: the progress stays, the facility is free (facility 0 = paused), the scientist too. */
function cancelProject(
  d: WwDepth,
  id: number,
  project: SpecialProject,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  const idx = SPECIAL_PROJECTS.indexOf(project);
  const row = c.proj.running.find((r) => r.project === idx);
  if (row === undefined || row.facility <= 0) return "bad_index";
  row.facility = 0;
  freeScientist(c, row);
  d.markCountry(id);
  return null;
}

function freeScientist(c: CountryDepth, row: Run): void {
  if (row.scientist < 0) return;
  const s = c.proj.scientists.find((x) => x.id === row.scientist);
  if (s !== undefined) s.project = -1;
  row.scientist = -1;
}

/**
 * Spec §9.2 project_scientist: one scientist works on one project — a
 * scientist moved here leaves his old project; null takes the project's
 * scientist off. The skill clock starts on the day he joins.
 */
export function assignScientist(
  d: WwDepth,
  id: number,
  project: SpecialProject,
  scientist: number | null,
  tick: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  const idx = SPECIAL_PROJECTS.indexOf(project);
  const row = c.proj.running.find((r) => r.project === idx);
  if (row === undefined) return "bad_index";
  if (scientist === null) {
    if (row.scientist < 0) return "bad_index";
    freeScientist(c, row);
    d.markCountry(id);
    return null;
  }
  const s = c.proj.scientists.find((x) => x.id === scientist);
  if (s === undefined) return "bad_index";
  if (row.scientist === s.id) return null;
  if (s.project >= 0) {
    const old = c.proj.running.find((r) => r.scientist === s.id);
    if (old !== undefined) old.scientist = -1;
  }
  freeScientist(c, row);
  row.scientist = s.id;
  s.project = idx;
  s.sinceDay = d.ww.day(tick);
  d.markCountry(id);
  return null;
}
