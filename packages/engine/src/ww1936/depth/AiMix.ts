// ww81 lane P (ww78 P2): the AI's line mix, corrected from real stock on its
// turn. The share table stays each country's baseline (its character); this
// moves up to 2 factories a turn (1 for a minor) from the ground group the
// stock covers more than three times over (or whose line starves) to the
// group the divisions are short of. A donor keeps at least one factory, a
// receiver with no resources is skipped, and a group with no line yet (the
// trucks of ww78 B10) gets one. Light lines give way to mediums (ww78).
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIPMENT } from "@openfront/engine-api/ww1936/LandTypes";
import { designNeedGroup } from "@openfront/engine-lib/ww1936/DesignRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import { groupStock } from "@openfront/engine-lib/ww1936/TemplateStats";
import { addLine, setLineFactories } from "../economy/Production";
import type { CountryEconomy, Line } from "../economy/WwEconomy";
import { groundNeeds } from "./AiMarket";
import { lineDraw, resourceMultPm } from "./AiPick";
import type { WwDepth } from "./WwDepth";

const GROUND_SET: ReadonlySet<EquipmentType> = new Set(GROUND_EQUIPMENT);
/** Cover (stock per demand, percent) above which a group gives, and under which it takes. */
export const MIX_GIVE_PCT = 300;
export const MIX_TAKE_PCT = 100;

/** The need group a line feeds; -1 for a line that is no ground line. */
export function lineGroup(d: WwDepth, id: number, key: number): number {
  const [t, g] = EQUIP_KEYS[key];
  if (t === "tank_design") {
    const s = d.country(id)?.des.tank[g - 1];
    return s === null || s === undefined ? -1 : designNeedGroup(s.def);
  }
  return GROUND_SET.has(t) ? EQUIPMENT_TYPES.indexOf(t) : -1;
}

function newestGen(t: EquipmentType, ce: CountryEconomy): number {
  for (let g = EQUIPMENT_GENS[t]; g >= 1; g--) {
    const tech = EQUIPMENT[t].techs[g - 1];
    if (tech === undefined || ce.researched.has(tech)) return g;
  }
  return 0;
}

/** Up to 2 factories (1 for a minor) move from over-covered to short groups. */
export function aiLineMix(d: WwDepth, id: number, ce: CountryEconomy): void {
  const land = d.ww.land;
  if (land.rowsOf(id).length === 0 || ce.lines.length === 0) return;
  const n = groundNeeds(d, id);
  const ks = land.keyStatsOf(id);
  const draw = lineDraw(d, id, ce);
  const econ = d.ww.economy;
  const cover = (g: number): number => {
    const short = Math.max(0, n.need[g] - n.have[g]);
    const demand = short + Math.floor(n.need[g] / 5);
    const stock = groupStock(ce.stock, g, ks);
    if (demand <= 0) return stock > 0 ? 1_000_000 : 0;
    return Math.floor((stock * 100) / demand);
  };
  const lines = new Map<number, Line[]>();
  for (const l of ce.lines) {
    const g = lineGroup(d, id, l.key);
    if (g < 0) continue;
    const list = lines.get(g);
    if (list === undefined) lines.set(g, [l]);
    else list.push(l);
  }
  let moves = ce.major ? 2 : 1;
  const used = new Set<number>();
  while (moves > 0) {
    // Donor: the most covered group (or a starved line of a covered one).
    let donor: Line | null = null;
    let donorG = -1;
    let donorCover = -1;
    for (const [g, list] of lines) {
      if (used.has(g)) continue;
      const c = cover(g);
      for (const l of list) {
        if (l.factories < 2) continue;
        const starved = l.active > 0 && l.fill < 300 && c >= MIX_TAKE_PCT;
        if (c <= MIX_GIVE_PCT && !starved) continue;
        const rank = starved ? 2_000_000 : c;
        if (
          rank > donorCover ||
          (rank === donorCover &&
            donor !== null &&
            l.factories > donor.factories)
        ) {
          donor = l;
          donorG = g;
          donorCover = rank;
        }
      }
    }
    if (donor === null) return;
    // Receiver: the shortest group, with a line or a type to start one.
    let take = -1;
    let takeCover = MIX_TAKE_PCT;
    for (let g = 0; g < n.need.length; g++) {
      if (g === donorG || used.has(g) || n.need[g] <= 0) continue;
      const t = EQUIPMENT_TYPES[g];
      if (t === undefined || !GROUND_SET.has(t)) continue;
      const c = cover(g);
      if (c >= takeCover) continue;
      const line = lines.get(g)?.[0];
      const key =
        line !== undefined
          ? line.key
          : equipKey(t, Math.max(1, newestGen(t, ce)));
      if (line === undefined && newestGen(t, ce) === 0) continue;
      if (resourceMultPm(d, id, ce, key, draw) >= 2500) continue;
      take = g;
      takeCover = c;
    }
    if (take < 0) return;
    const rl = lines.get(take);
    if (rl !== undefined && rl.length > 0) {
      let best = rl[0];
      for (const l of rl) if (l.effBp > best.effBp) best = l;
      setLineFactories(econ, ce, best.id, best.factories + 1);
    } else {
      const t = EQUIPMENT_TYPES[take];
      if (addLine(econ, ce, t, newestGen(t, ce), 1) !== null) return;
    }
    setLineFactories(econ, ce, donor.id, donor.factories - 1);
    used.add(donorG);
    used.add(take);
    moves--;
  }
}
