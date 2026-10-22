// World War 1936 P6 lane S (plan Task 6 Step 5, spec §19.6): the AI's
// projects, atomic bombs, rockets and raids. History is flavour: with the
// historical AI on, the majors of spec §19.6 follow the flags K5's depth
// beats set (the beats carry the dates, their seeded delays and skips);
// every other country — and every country with the historical AI off —
// judges by its industry. Orders go through the same functions a player's
// do, so the AI is refused alike.
import {
  FACILITY_IDS,
  FacilityId,
  ROCKET_KINDS,
  ROCKET_RANGE_KM,
  SCIENTIST_SPECS,
  SPECIAL_PROJECTS,
  SpecialProject,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BuildingId,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  nukeDropBlock,
  PROJECT_DEFS,
  raidBlock,
  RaidInput,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { effectiveLevel } from "../economy/Buildings";
import { queueBuild } from "../economy/Construction";
import { addLine } from "../economy/Production";
import {
  issueNukeDrop,
  nearestRocketSite,
  nukeBombersIn,
  nukeDropInputOf,
} from "./Atomic";
import {
  assignScientist,
  facilitiesOfKind,
  facilityKindAt,
  runAt,
  startProject,
} from "./Projects";
import { issueRaid, raidAskOf } from "./Raids";
import { issueRocketStrike } from "./Rockets";
import type { WwDepth } from "./WwDepth";

/** Spec §19.6: the majors the historical table names; the rest judge by industry. */
const HISTORY_TAGS: ReadonlySet<string> = new Set([
  "USA",
  "GBR",
  "DEU",
  "SUN",
  "JPN",
]);
/** Spec §19.6 "그 밖": civilian + military factories for the science projects, and for the atomic one. */
export const AI_SCIENCE_FACTORIES = 80;
export const AI_ATOMIC_FACTORIES = 150;
/** Spec §19.6: no AI bomb before this date. */
export const AI_NUKE_FROM = "1944-01-01";
/** Spec §19.6: a major raids at most once in this many days. */
export const AI_RAID_DAYS = 180;
/** The flying bomb and ballistic rocket lines the AI opens (factories). */
const AI_ROCKET_LINE_FACTORIES = 2;

interface Want {
  project: SpecialProject | null;
  /** The facility to have (a project's own, or one alone: hist_deu_rocket_site). */
  facility: FacilityId;
  /** Facilities of the kind to have (built and queued). */
  facilities: number;
  scientist: boolean;
}

/**
 * K5's depth beats (content/depth/beats.ts) set these flags on their
 * actor; the AI acts on whoever holds them (spec §19.6's table).
 */
const HISTORY_FLAGS: readonly (readonly [string, Want])[] = [
  [
    "hist_deu_rocket_site",
    {
      project: null,
      facility: "facility_rocket",
      facilities: 1,
      scientist: false,
    },
  ],
  [
    "hist_gbr_magnetron",
    {
      project: "sp_cavity_magnetron",
      facility: "facility_science",
      facilities: 1,
      scientist: true,
    },
  ],
  [
    "hist_deu_jet",
    {
      project: "sp_jet_engine",
      facility: "facility_science",
      facilities: 1,
      scientist: true,
    },
  ],
  [
    "hist_deu_flying_bomb",
    {
      project: "sp_flying_bomb",
      facility: "facility_rocket",
      facilities: 1,
      scientist: true,
    },
  ],
  [
    "hist_deu_ballistic",
    {
      project: "sp_ballistic",
      facility: "facility_rocket",
      facilities: 1,
      scientist: true,
    },
  ],
  [
    "hist_usa_proximity_fuze",
    {
      project: "sp_proximity_fuze",
      facility: "facility_science",
      facilities: 1,
      scientist: true,
    },
  ],
  [
    "hist_usa_atomic_sites",
    {
      project: null,
      facility: "facility_nuclear",
      facilities: 2,
      scientist: false,
    },
  ],
  [
    "hist_usa_atomic_start",
    {
      project: "sp_atomic",
      facility: "facility_nuclear",
      facilities: 1,
      scientist: true,
    },
  ],
  // Spec §19.6: Germany's atomic work, one facility and no scientist.
  [
    "hist_deu_atomic",
    {
      project: "sp_atomic",
      facility: "facility_nuclear",
      facilities: 1,
      scientist: false,
    },
  ],
  [
    "hist_sun_atomic",
    {
      project: "sp_atomic",
      facility: "facility_nuclear",
      facilities: 1,
      scientist: true,
    },
  ],
  [
    "hist_jpn_atomic",
    {
      project: "sp_atomic",
      facility: "facility_nuclear",
      facilities: 1,
      scientist: true,
    },
  ],
];

/** Spec §19.6 "그 밖·역사 AI 끔": the science projects in order, then the atomic one. */
const GENERIC: readonly (readonly [SpecialProject, number])[] = [
  ["sp_cavity_magnetron", AI_SCIENCE_FACTORIES],
  ["sp_proximity_fuze", AI_SCIENCE_FACTORIES],
  ["sp_jet_engine", AI_SCIENCE_FACTORIES],
  ["sp_atomic", AI_ATOMIC_FACTORIES],
];

/** Plan decision 39: each part keeps its own rhythm inside the country's turn. */
export function aiProjectsDay(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null || !d.ww.isActor(id)) return;
  const tick = d.mg.ticks();
  // Peace or war, every 10 days (spread over the countries).
  if (day % 10 === id % 10) {
    planProjects(d, id, day, tick);
    rocketArsenal(d, id);
  }
  if (!d.ww.hasWar(id)) return;
  aiNuke(d, id, day, tick);
  aiRockets(d, id, day, tick);
  if (
    day % 10 === id % 10 &&
    Math.floor(day / 10) % (AI_RAID_DAYS / 10) === id % (AI_RAID_DAYS / 10)
  ) {
    aiRaid(d, id, tick);
  }
}

// ---- Projects ----

function historical(d: WwDepth, id: number): boolean {
  return (
    d.mg.config().historicalAi() === true && HISTORY_TAGS.has(d.ww.tagOf(id))
  );
}

/** What the country wants now: the beats' flags (historical majors) or its industry. */
function wantsOf(d: WwDepth, id: number, day: number): Want[] {
  const out: Want[] = [];
  if (historical(d, id)) {
    const pc = d.ww.politics.country(id);
    for (const [flag, w] of HISTORY_FLAGS) {
      if (pc?.hasFlag(flag, day) ?? false) out.push(w);
    }
    return out;
  }
  const t = d.ww.economy.country(id)?.totals;
  const factories = t === undefined ? 0 : t.civ + t.mil;
  for (const [p, need] of GENERIC) {
    if (factories < need) continue;
    out.push({
      project: p,
      facility: PROJECT_DEFS[p].facility,
      facilities: 1,
      scientist: true,
    });
  }
  return out;
}

/** The facilities of a kind the country controls and owns, by region. */
function ownFacilities(d: WwDepth, id: number, kind: FacilityId): number[] {
  return facilitiesOfKind(d, FACILITY_IDS.indexOf(kind)).filter(
    (r) => d.ww.land.controller[r] === id && d.ww.politics.legalOwner[r] === id,
  );
}

function planProjects(d: WwDepth, id: number, day: number, tick: number): void {
  const c = d.country(id)!;
  const noScientist = new Set<number>();
  for (const w of wantsOf(d, id, day)) {
    if (w.project === "sp_atomic" && !d.nukesOn()) continue;
    if (w.project !== null) {
      const idx = SPECIAL_PROJECTS.indexOf(w.project);
      if (!w.scientist) noScientist.add(idx);
      if (d.projectDone(id, idx)) continue;
      const row = c.proj.running.find((r) => r.project === idx);
      if (row !== undefined && row.facility > 0) continue;
      const free = ownFacilities(d, id, w.facility).find(
        (r) => runAt(c, r) === undefined,
      );
      if (free !== undefined) {
        startProject(d, id, w.project, free);
        continue;
      }
    }
    ensureFacilities(d, id, w.facility, w.facilities);
  }
  // Spec §9.2: every running project gets the best free scientist (its
  // speciality first, then the skill), unless its row says none.
  for (const run of [...c.proj.running].sort((a, b) => a.project - b.project)) {
    if (run.facility <= 0 || run.scientist >= 0) continue;
    if (noScientist.has(run.project)) continue;
    const p = SPECIAL_PROJECTS[run.project];
    if (p === undefined) continue;
    const spec = PROJECT_DEFS[p].spec;
    let best = -1;
    let bestKey = -1;
    for (const s of c.proj.scientists) {
      if (s.project >= 0) continue;
      const key = (SCIENTIST_SPECS[s.spec] === spec ? 100 : 0) + s.skill;
      if (key > bestKey) {
        best = s.id;
        bestKey = key;
      }
    }
    if (best >= 0) assignScientist(d, id, p, best, tick);
  }
}

/**
 * Queues facilities of a kind up to `n` (built and queued): in the core
 * region we own and control with the most factories (the nuclear one:
 * infrastructure 3 or more; ties: the smaller id). P1's judge decides.
 */
function ensureFacilities(
  d: WwDepth,
  id: number,
  kind: FacilityId,
  n: number,
): void {
  const econ = d.ww.economy;
  const ce = econ.country(id);
  if (ce === null) return;
  const queued = ce.queue.filter((q) => q.building === kind).length;
  let have = ownFacilities(d, id, kind).length + queued;
  if (have >= n) return;
  const pol = d.ww.politics;
  const sites = [...econ.regionsOf(id)]
    .filter(
      (r) =>
        d.ww.land.controller[r] === id &&
        pol.legalOwner[r] === id &&
        pol.isCore(r) &&
        facilityKindAt(d, r) < 0 &&
        !ce.queue.some((q) => q.region === r && isFacility(q.building)) &&
        (kind !== "facility_nuclear" || econ.infra[r] >= 3),
    )
    .sort(
      (a, b) =>
        econ.civ[b] + econ.mil[b] - (econ.civ[a] + econ.mil[a]) || a - b,
    );
  for (const r of sites) {
    if (have >= n) break;
    if (queueBuild(econ, ce, r, kind, 1) === null) have++;
  }
}

function isFacility(b: BuildingId): boolean {
  return (FACILITY_IDS as readonly string[]).includes(b);
}

/**
 * Spec §19.6 rockets: once the flying bomb is ours and we are at war, a
 * rocket site in the region nearest the enemy and a line of each rocket
 * we can make.
 */
function rocketArsenal(d: WwDepth, id: number): void {
  const ww = d.ww;
  if (!ww.hasWar(id)) return;
  if (!d.projectDone(id, SPECIAL_PROJECTS.indexOf("sp_flying_bomb"))) return;
  const econ = ww.economy;
  const ce = econ.country(id);
  if (ce === null) return;
  if (
    econ.countryBuildings(id, "rocket_site") === 0 &&
    !ce.queue.some((q) => q.building === "rocket_site")
  ) {
    const sc = ww.scenario;
    const land = ww.land;
    const enemies = new Set(ww.enemiesOf(id));
    const enemyRegions = sc.landRegions
      .filter((r) => enemies.has(land.controller[r.id] ?? 0))
      .map((r) => sc.centerTile(r.id));
    let best = 0;
    let bestKm = -1;
    for (const r of [...econ.regionsOf(id)].sort((a, b) => a - b)) {
      // Final review B, I3: never in Korea or Taiwan (no P6 data there).
      if (land.controller[r] !== id || d.noStrike(r)) continue;
      const at = sc.centerTile(r);
      let km = -1;
      for (const t of enemyRegions) {
        const k = sc.kmBetween(at, t);
        if (km < 0 || k < km) km = k;
      }
      if (km >= 0 && (bestKm < 0 || km < bestKm)) {
        best = r;
        bestKm = km;
      }
    }
    if (best > 0) queueBuild(econ, ce, best, "rocket_site", 1);
  }
  for (const kind of ROCKET_KINDS) {
    const key = equipKey(kind, 1);
    if (ce.lines.some((l) => l.key === key)) continue;
    addLine(econ, ce, kind, 1, AI_ROCKET_LINE_FACTORIES);
  }
}

// ---- The bomb ----

/**
 * Spec §19.6: from 1944 a bomb in stock goes, one a day, to a major enemy
 * at war: with the historical AI, K5's NUKE_TARGETS first (not before
 * their date, and not that enemy before it); else the enemy region under
 * our strategic bombers (or in a rocket's reach) with the most civilian
 * and military factories, never the capital or a no-strike region (ties:
 * the smaller id).
 */
function aiNuke(d: WwDepth, id: number, day: number, tick: number): void {
  if (!d.nukesOn()) return;
  const ww = d.ww;
  const econ = ww.economy;
  if ((econ.country(id)?.stock[equipKey("atomic_bomb", 1)] ?? 0) < 1) return;
  if (day < dayOfDate(AI_NUKE_FROM)) return;
  const land = ww.land;
  const sc = ww.scenario;
  const myTag = ww.tagOf(id);
  const hist = historical(d, id);
  for (const e of ww.enemiesOf(id)) {
    if (!land.isEnemy(id, e) || econ.country(e)?.major !== true) continue;
    if (hist) {
      const row = ww.politics.content.nukeTargets.find(
        (x) => x.attacker === myTag && x.target === ww.tagOf(e),
      );
      if (row !== undefined) {
        if (day < dayOfDate(row.notBefore)) continue;
        for (const r of row.regions) {
          if (land.controller[r] !== e) continue;
          if (tryDrop(d, id, r, tick)) return;
        }
      }
    }
    const capital = ww.capitalRegion(e);
    const zoneOk = new Map<number, boolean>();
    const regions = [...econ.regionsOf(e)]
      .filter((r) => {
        if (r === capital || land.controller[r] !== e || d.noStrike(r)) {
          return false;
        }
        const sr = sc.regionSr(r);
        let ok = zoneOk.get(sr);
        if (ok === undefined) {
          ok = nukeBombersIn(d, id, sr) >= 10;
          zoneOk.set(sr, ok);
        }
        return ok || nearestRocketSite(d, id, r).km >= 0;
      })
      .sort(
        (a, b) =>
          econ.civ[b] + econ.mil[b] - (econ.civ[a] + econ.mil[a]) || a - b,
      );
    for (const r of regions) if (tryDrop(d, id, r, tick)) return;
  }
}

/** A drop by bombers, else by rocket, through the player's order. */
function tryDrop(
  d: WwDepth,
  id: number,
  region: number,
  tick: number,
): boolean {
  for (const rocket of [false, true]) {
    if (nukeDropBlock(nukeDropInputOf(d, id, region, rocket)) !== null) {
      continue;
    }
    if (issueNukeDrop(d, id, region, rocket, tick) === null) return true;
  }
  return false;
}

// ---- Rockets ----

/**
 * Spec §19.6: each of our rocket sites fires its day's rockets at the
 * enemy region in range with the most victory points (no-strike regions
 * never; ties: the smaller id), ballistic rockets first.
 */
function aiRockets(d: WwDepth, id: number, day: number, tick: number): void {
  const ww = d.ww;
  const econ = ww.economy;
  const ce = econ.country(id);
  if (ce === null) return;
  const stock = ROCKET_KINDS.map((k) => ce.stock[equipKey(k, 1)]);
  if (stock[0] <= 0 && stock[1] <= 0) return;
  const land = ww.land;
  const sc = ww.scenario;
  const sites = [...econ.regionsOf(id)]
    .filter((r) => land.controller[r] === id)
    .sort((a, b) => a - b);
  for (const site of sites) {
    const level = effectiveLevel(econ, site, "rocket_site");
    if (level < 1) continue;
    for (const kind of [1, 0] as const) {
      const promised = d.rocketQueue
        .filter((e) => e.owner === id && e.kind === kind)
        .reduce((a, e) => a + e.count, 0);
      const firedToday = d.rocketQueue
        .filter((e) => e.owner === id && e.site === site && e.day === day)
        .reduce((a, e) => a + e.count, 0);
      const count = Math.min(
        30,
        level * 10 - firedToday,
        stock[kind] - promised,
      );
      if (count <= 0) continue;
      const at = sc.centerTile(site);
      let target = 0;
      let bestVp = -1;
      for (const r of sc.landRegions) {
        const ctl = land.controller[r.id] ?? 0;
        if (ctl === 0 || !land.isEnemy(id, ctl) || d.noStrike(r.id)) continue;
        if (sc.kmBetween(at, sc.centerTile(r.id)) > ROCKET_RANGE_KM[kind]) {
          continue;
        }
        if (r.vp > bestVp) {
          target = r.id;
          bestVp = r.vp;
        }
      }
      if (target === 0) continue;
      issueRocketStrike(
        d,
        id,
        {
          kind: "rocket_strike",
          site,
          target,
          rocket: ROCKET_KINDS[kind],
          count,
        },
        tick,
      );
    }
  }
}

// ---- Raids ----

/** Spec §19.6: the targets a major raids, in this order. */
const AI_RAID_TARGETS: readonly BuildingId[] = [
  "facility_nuclear",
  "radar",
  "dam",
];

/**
 * Spec §19.6: a major raids an enemy's nuclear lab (if its intelligence
 * sees it), else a radar, else a dam — by precision bombing, paratroopers
 * or commandos, whichever the judge allows first.
 */
function aiRaid(d: WwDepth, id: number, tick: number): void {
  const ww = d.ww;
  const econ = ww.economy;
  if (econ.country(id)?.major !== true) return;
  const land = ww.land;
  const sc = ww.scenario;
  const t = land.divisions;
  const units: [RaidInput["kind"], number[]][] = [
    ["raid_para", []],
    ["raid_commando", []],
  ];
  for (const r of land.rowsOf(id)) {
    const bats =
      land.templateOf(id, t.template[r])?.def.battalions ?? ([] as string[]);
    const para = bats.filter((b) => b === "paratrooper").length;
    const sea = bats.filter((b) => b === "marine" || b === "mountain").length;
    if (para * 2 > bats.length && units[0][1].length < 4) {
      units[0][1].push(t.id[r]);
    }
    if (sea * 2 > bats.length && units[1][1].length < 4) {
      units[1][1].push(t.id[r]);
    }
  }
  for (const building of AI_RAID_TARGETS) {
    for (const reg of sc.landRegions) {
      const target = reg.id;
      const ctl = land.controller[target] ?? 0;
      if (ctl === 0 || !land.isEnemy(id, ctl) || d.noStrike(target)) continue;
      const stands =
        building === "dam"
          ? sc.damOf(target) >= 0 &&
            (d.world.damLevel[sc.damOf(target)] ?? 0) > 0
          : (econ.buildingArray(building)[target] ?? 0) > 0;
      if (!stands) continue;
      const tries: [RaidInput["kind"], number][] = [];
      for (const depId of ww.air.deploymentsIn(sc.regionSr(target))) {
        if (ww.air.deployments.get(depId)?.owner === id) {
          tries.push(["raid_bomb", depId]);
        }
      }
      for (const [kind, ids] of units) {
        for (const u of ids) tries.push([kind, u]);
      }
      for (const [kind, unit] of tries) {
        const ask = raidAskOf(d, id, kind, unit, target, building);
        if (raidBlock(ask.input) !== null) continue;
        if (
          issueRaid(
            d,
            id,
            { kind: "raid", raid: kind, unit, target, building },
            tick,
          ) === null
        ) {
          return;
        }
      }
    }
  }
}
