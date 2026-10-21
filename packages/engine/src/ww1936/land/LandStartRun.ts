// World War 1936 P2: the 1936 order of battle (P2 spec §4.5, §4.6, §6.4,
// plan decision 14). Runs once, from WwLand.start after economy.start.
import { EQUIPMENT_TYPES } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  idleOrder,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { startArmy } from "@openfront/engine-lib/ww1936/EconomyStart";
import {
  GENERALS,
  generalServes,
  rosterOf,
  titledGeneralId,
  traitMask,
} from "@openfront/engine-lib/ww1936/Generals";
import {
  genericDivisions,
  OobArmy,
  START_OOB,
  startTemplates,
} from "@openfront/engine-lib/ww1936/LandStart";
import {
  genMixOf,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { drawManpower, drawTemplateEquip } from "../economy/Stock";
import type { CountryEconomy } from "../economy/WwEconomy";
import { borderRegions, nearestBorder } from "./Fronts";
import type {
  Army,
  CountryLand,
  GeneralState,
  LandTemplate,
  WwLand,
} from "./WwLand";

export function newGeneralState(rosterIndex: number): GeneralState {
  const g = GENERALS[rosterIndex];
  return {
    id: rosterIndex + 1,
    roster: rosterIndex,
    titleNo: 0,
    att: g.att,
    dfn: g.def,
    plan: g.plan,
    log: g.log,
    traits: traitMask(g.traits),
    xp: 0,
    level: 1,
    army: 0,
    use: [0, 0, 0, 0],
    terrainDays: [0, 0, 0, 0],
  };
}

/** Spec §6.2: a titled general ("Commander No. n"), every skill 1, no traits. */
export function newTitledGeneralState(
  smallID: number,
  titleNo: number,
): GeneralState {
  return {
    id: titledGeneralId(smallID, titleNo),
    roster: -1,
    titleNo,
    att: 1,
    dfn: 1,
    plan: 1,
    log: 1,
    traits: 0,
    xp: 0,
    level: 1,
    army: 0,
    use: [0, 0, 0, 0],
    terrainDays: [0, 0, 0, 0],
  };
}

/** The capital region if the country holds it, else its most valuable region (spec §11.1); 0: none. */
export function capitalRegion(land: WwLand, smallID: number): number {
  const sc = land.scenario;
  const tag = sc.tagOfSmallId(smallID);
  if (tag === undefined) return 0;
  const cap = sc.regionAt(sc.capitalTile(tag));
  if (land.controller[cap] === smallID) return cap;
  let best = 0;
  let bestVp = -1;
  for (const r of sc.landRegions) {
    if (land.controller[r.id] === smallID && r.vp > bestVp) {
      best = r.id;
      bestVp = r.vp;
    }
  }
  return best;
}

/** One full-strength division as far as manpower and stock allow; false when the men ran out. */
export function fieldDivision(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  tpl: LandTemplate,
  region: number,
  army: Army,
): boolean {
  const s = templateStats(
    tpl.def,
    ce.stats,
    genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
  );
  if (!drawManpower(ce, s.men)) return false;
  const slots = new Array<number>(GROUND_SLOTS).fill(0);
  drawTemplateEquip(ce, slots, s.need, EQUIPMENT_TYPES);
  const full = templateStats(tpl.def, ce.stats, genMixOf(slots));
  land.spawnDivision(
    cl.smallID,
    tpl.id,
    region,
    army,
    s.men,
    slots,
    full.orgMilli,
  );
  return true;
}

export function startLand(land: WwLand): void {
  const sc = land.scenario;
  const historical = sc.data.historicalOob === true;
  const counts = new Map<number, number>();
  const plans: {
    cl: CountryLand;
    ce: CountryEconomy;
    oob: readonly OobArmy[] | null;
  }[] = [];
  for (const cl of land.countries()) {
    const p = land.mg.playerBySmallID(cl.smallID);
    const ce = land.econ.country(cl.smallID);
    if (!p.isPlayer() || ce === null) continue;
    let civ = 0;
    for (const id of land.econ.regionsOf(cl.smallID)) civ += land.econ.civ[id];
    // (Its land techs came with economy.start: landStartTechs.)
    const dev = sc.devOf(cl.tag, civ);
    for (const st of startTemplates(cl.tag, dev)) {
      cl.templates.push({ id: cl.nextTemplateId++, key: st.key, def: st.def });
    }
    for (const id of rosterOf(cl.tag))
      cl.generals.push(newGeneralState(id - 1));
    const oob = historical ? (START_OOB[cl.tag] ?? null) : null;
    const first = land.templateStatsOf(cl.smallID, cl.templates[0].id)!;
    const army = startArmy(
      cl.tag,
      land.econ.recruitableWith(cl.smallID, ce.law().conscriptionPermille),
    );
    counts.set(
      cl.smallID,
      oob === null
        ? genericDivisions(army, dev, first.men)
        : oob.reduce(
            (n, a) => n + a.divisions.reduce((m, [, k]) => m + k, 0),
            0,
          ),
    );
    plans.push({ cl, ce, oob });
  }
  const day = land.day();
  for (const { cl, ce, oob } of plans) {
    const armies: Army[] = [];
    // START_OOB armies that start under a titled general (Japan).
    const titled: Army[] = [];
    if (oob !== null) {
      for (const o of oob) {
        const region =
          o.regions.find((r) => land.controller[r] === cl.smallID) ??
          capitalRegion(land, cl.smallID);
        const a = land.newArmy(cl.smallID);
        if (a === null) break;
        armies.push(a);
        if (o.titledGeneral === true) titled.push(a);
        for (const [key, n] of o.divisions) {
          const tpl =
            cl.templates.find((t) => t.key === key) ?? cl.templates[0];
          for (
            let i = 0;
            i < n && a.divisions.length < WW_MAX_ARMY_DIVISIONS;
            i++
          ) {
            if (!fieldDivision(land, cl, ce, tpl, region, a)) break;
          }
        }
        if (a.divisions.length === 0) {
          land.removeArmy(a.id);
          continue;
        }
        if (o.planTargets !== undefined && o.planTargets.length > 0) {
          // Task 11 (controller ruling 4): the plan stands on the engine's
          // own front, anchored on our border region nearest the targets
          // against their country (Orders.setPlan's anchor; the orders
          // themselves are refused in the preparation minute), so the
          // day's front step keeps it instead of sending it idle.
          const targets = [...o.planTargets];
          const owners = new Set(targets.map((r) => land.controller[r]));
          const enemy = owners.size === 1 ? [...owners][0] : 0;
          // Its own stretch's border (Eritrea's army and Somaliland's
          // stand on two coasts): the border regions our land joins to it.
          const ours = (r: number) =>
            land.sameSide(cl.smallID, land.controller[r]);
          const all = borderRegions(land, cl.smallID, enemy);
          const reach = new Set<number>([region]);
          const queue = [region];
          for (let i = 0; i < queue.length; i++) {
            for (const e of land.scenario.edgesOf(queue[i])) {
              if (reach.has(e.to) || !ours(e.to)) continue;
              reach.add(e.to);
              queue.push(e.to);
            }
          }
          const near = all.filter((r) => reach.has(r));
          const border = new Set(near.length > 0 ? near : all);
          const anchor = nearestBorder(land, border, targets, () => true);
          if (anchor !== 0) {
            a.order = {
              ...idleOrder(),
              kind: "plan",
              anchor,
              enemy,
              targets,
              stance: "balanced",
              executing: true,
            };
            a.pending = true;
          }
        }
      }
    } else {
      const regions = startRegions(land, cl.smallID, counts);
      let left = counts.get(cl.smallID) ?? 0;
      for (let i = 0; left > 0 && regions.length > 0; i++) {
        const a = land.newArmy(cl.smallID);
        if (a === null) break;
        armies.push(a);
        const region = regions[i % regions.length];
        let ok = true;
        for (let k = 0; k < WW_MAX_ARMY_DIVISIONS && left > 0; k++, left--) {
          if (!fieldDivision(land, cl, ce, cl.templates[0], region, a)) {
            ok = false;
            break;
          }
        }
        if (a.divisions.length === 0) land.removeArmy(a.id);
        if (!ok) break;
      }
    }
    // Spec §6.4: the roster by skill sum to the armies by number.
    const free = cl.generals.filter(
      (g) => g.roster >= 0 && generalServes(GENERALS[g.roster], day),
    );
    let gi = 0;
    for (const a of armies) {
      if (!land.armies.has(a.id) || gi >= free.length) continue;
      a.general = free[gi].id;
      free[gi].army = a.id;
      gi++;
    }
    // Titled generals for the marked armies the roster left without one,
    // numbered in army order (no army experience at the start).
    for (const a of titled) {
      if (!land.armies.has(a.id) || a.general !== 0) continue;
      const g = newTitledGeneralState(cl.smallID, cl.nextTitleNo++);
      g.army = a.id;
      cl.generals.push(g);
      a.general = g.id;
    }
  }
}

/** Spec §6.4 "그 밖": the capital, then a border region per neighbour, most divisions first. */
function startRegions(
  land: WwLand,
  smallID: number,
  counts: ReadonlyMap<number, number>,
): number[] {
  const out: number[] = [];
  const cap = capitalRegion(land, smallID);
  if (cap !== 0) out.push(cap);
  const neighbours = [...land.econ.countryNeighbours(smallID)].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a - b,
  );
  for (const n of neighbours) {
    let pick = 0;
    for (const id of land.econ.regionsOf(smallID)) {
      if (land.scenario.edgesOf(id).some((e) => land.controller[e.to] === n)) {
        pick = id;
        break;
      }
    }
    if (pick !== 0 && !out.includes(pick)) out.push(pick);
  }
  return out;
}
