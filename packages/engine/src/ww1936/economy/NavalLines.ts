// World War 1936 P4: naval lines on dockyards (P4 spec §5.2–§5.4): the
// orders, the dockyards assigned top down after what repairs borrowed,
// the resources after P1's lines, the day's output, launches into the
// port's new-ships fleet or the convoy stock, and the drawer's idle count.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NavalLineOrder,
  SHIP_CLASSES,
  SHIP_GENS,
  ShipClass,
  WW_MAX_DOCKS_PER_LINE,
  WW_MAX_LINE_COUNT,
  WW_MAX_NAVAL_LINES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  lineCostMilli,
  navalLineOutputMilli,
} from "@openfront/engine-lib/ww1936/NavalLineRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { shipNameKey } from "@openfront/engine-lib/ww1936/ShipNames";
import {
  lineResources,
  lineUnitCost,
  shipGenTech,
} from "@openfront/engine-lib/ww1936/ShipStats";
import { navalBuildBlock } from "../navy/EndgameHooks";
import { bestNavalBase, navalPort } from "../navy/Ports";
import { addConvoys } from "./Buildings";
import type { CountryEconomy, NavalLine, WwEconomy } from "./WwEconomy";

/** NavalLine.cls of a convoy line (SHIP_CLASSES.length). */
const CONVOY_CLS = SHIP_CLASSES.length;

function lineClass(l: NavalLine): ShipClass | "convoy" {
  return l.cls >= CONVOY_CLS ? "convoy" : SHIP_CLASSES[l.cls];
}

function lineIndex(ce: CountryEconomy, id: number): number {
  return ce.navalLines.findIndex((l) => l.id === id);
}

function dockCount(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(WW_MAX_DOCKS_PER_LINE, Math.floor(n)));
}

/**
 * A port the line may launch into now: a working naval base (plan
 * decision 11) the owner controls in the land war (the tick it changes
 * hands, as Ports.navalPortsOf reads it).
 */
function portUsable(econ: WwEconomy, owner: number, region: number): boolean {
  return (
    region > 0 &&
    econ.ww.land.controller[region] === owner &&
    navalPort(econ.ww, region)
  );
}

/** Why (cls, gen) may not go on a line now (spec §4.2, §4.3, §5.3); null if it may. */
function classBlock(
  ce: CountryEconomy,
  cls: ShipClass | "convoy",
  gen: number,
): WwOrderBlock | null {
  if (cls === "convoy") return gen === 1 ? null : "bad_ship_class";
  if (!(gen >= 1 && gen <= SHIP_GENS[cls])) return "bad_ship_class";
  const tech = shipGenTech(cls, gen);
  return tech === null || ce.researched.has(tech) ? null : "bad_ship_class";
}

/**
 * naval_line_add / _docks / _count / _remove / _move (spec §5.2); a new
 * line asks navy/EndgameHooks.navalBuildBlock first (P5). The order of
 * ce.navalLines is the dockyard and resource priority, top first.
 */
export function issueNavalLineOrder(
  econ: WwEconomy,
  ce: CountryEconomy,
  order: NavalLineOrder,
  sc: ScenarioIndex,
): WwOrderBlock | null {
  switch (order.kind) {
    case "naval_line_add": {
      if (ce.navalLines.length >= WW_MAX_NAVAL_LINES) return "line_full";
      const block = classBlock(ce, order.cls, order.gen);
      if (block !== null) return block;
      const p5 = navalBuildBlock(econ, ce, order.cls);
      if (p5 !== null) return p5;
      if (
        sc.region(order.port) === undefined ||
        !portUsable(econ, ce.smallID, order.port)
      ) {
        return "no_naval_base";
      }
      // Spec §5.3: only a convoy line may keep going (count 0).
      const count = Math.floor(order.count);
      if (!(count >= 0 && count <= WW_MAX_LINE_COUNT)) return "bad_index";
      if (count === 0 && order.cls !== "convoy") return "bad_index";
      ce.navalLines.push({
        id: ce.nextNavalLineId++,
        cls:
          order.cls === "convoy" ? CONVOY_CLS : SHIP_CLASSES.indexOf(order.cls),
        gen: order.gen,
        docks: dockCount(order.docks),
        activeDocks: 0,
        progress: 0,
        left: count,
        port: order.port,
        fill: 1000,
        lastOutput: 0,
        names: [],
      });
      return null;
    }
    case "naval_line_docks": {
      const i = lineIndex(ce, order.line);
      if (i < 0) return "bad_line";
      ce.navalLines[i].docks = dockCount(order.docks);
      return null;
    }
    case "naval_line_count": {
      const i = lineIndex(ce, order.line);
      if (i < 0) return "bad_line";
      const l = ce.navalLines[i];
      const count = Math.floor(order.count);
      if (!(count >= 0 && count <= WW_MAX_LINE_COUNT)) return "bad_index";
      if (count === 0 && l.cls < CONVOY_CLS) return "bad_index";
      l.left = count;
      return null;
    }
    case "naval_line_remove": {
      // Its progress is lost (spec §5.2; the screen asks twice).
      const i = lineIndex(ce, order.line);
      if (i < 0) return "bad_line";
      ce.navalLines.splice(i, 1);
      return null;
    }
    case "naval_line_move": {
      const i = lineIndex(ce, order.line);
      if (i < 0) return "bad_line";
      if (!(order.to >= 0 && order.to < ce.navalLines.length)) {
        return "bad_index";
      }
      const [l] = ce.navalLines.splice(i, 1);
      ce.navalLines.splice(order.to, 0, l);
      return null;
    }
    default:
      return "bad_index";
  }
}

/**
 * The first half of the line step, run from P1's allocation (spec §5.2,
 * §5.4): every line's port (a lost one moves to the best naval base; with
 * none the line stalls, its progress kept), then the dockyards top down
 * — the usable ones (occupied at P1's controlPct: totals.dock) less what
 * repairs borrowed (docksLent, the navy's day yesterday) — and the
 * resources each line asks for (lineResources × its working dockyards).
 */
function assignNavalLines(econ: WwEconomy, ce: CountryEconomy): void {
  const owner = ce.smallID;
  let best = -1; // computed once, when a line needs it
  let avail = Math.max(0, ce.totals.dock - ce.docksLent);
  for (const l of ce.navalLines) {
    if (!portUsable(econ, owner, l.port)) {
      if (best < 0) best = bestNavalBase(econ.ww, owner);
      if (best !== 0) {
        l.port = best;
      } else {
        // Stalled (spec §5.2): one message, the day it stops (the line
        // made something yesterday, or still had a port).
        if (l.port !== 0 || l.lastOutput > 0) {
          econ.ww.navy.message(
            owner,
            "events_display.ww1936_naval_line_stalled",
            { cls: lineClass(l) },
          );
        }
        l.port = 0;
        l.activeDocks = 0;
        continue;
      }
    }
    const now = Math.min(l.docks, avail);
    avail -= now;
    l.activeDocks = now;
  }
}

/**
 * Resources a day each naval line asks for, ce.navalLines order
 * (RESOURCE_IDS rows): P1's allocation serves them after the P1 lines and
 * writes each line's `fill` (Production.stepProduction). It assigns the
 * day's dockyards first (assignNavalLines): stepNavalLines, later in the
 * same country turn, builds on them.
 */
export function navalLineDemand(
  econ: WwEconomy,
  ce: CountryEconomy,
): number[][] {
  assignNavalLines(econ, ce);
  return ce.navalLines.map((l) => {
    const per = lineResources(lineClass(l));
    return per.map((v) => v * l.activeDocks);
  });
}

/**
 * The country turn's naval lines (after production, spec §5.2, §16.1):
 * each line's day of output on its working dockyards at its resource
 * fill; a launch at the line's cost (the progress past it goes on to the
 * next unit), a finished line removed. Then the dockyards repairs borrowed
 * yesterday come back (docksLent = 0: the navy's day lends them again).
 */
export function stepNavalLines(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
): void {
  void day;
  const navy = econ.ww.navy;
  const owner = ce.smallID;
  const pct = ce.stats.dockOutputPct + ce.law().outputPct + ce.stats.outputPct;
  let ships = 0;
  // The launch the day's message names: the dearest ship, the first on a tie.
  let topCost = -1;
  let topShip = 0;
  const done: number[] = [];
  for (const l of ce.navalLines) {
    const out =
      l.port === 0 ? 0 : navalLineOutputMilli(l.activeDocks, pct, l.fill);
    l.lastOutput = out;
    if (out === 0) continue;
    l.progress += out;
    const cost = lineCostMilli(l);
    const cls = lineClass(l);
    while (l.progress >= cost) {
      l.progress -= cost;
      if (cls === "convoy") {
        addConvoys(ce, 1);
      } else {
        // A 1936 line's historical names first, then the country's next.
        const name = l.names.shift() ?? 0;
        const id = navy.commissionShip(
          owner,
          cls,
          l.gen,
          l.port,
          name > 0 ? name : undefined,
        );
        ships++;
        const unit = lineUnitCost(cls, l.gen);
        if (unit > topCost) {
          topCost = unit;
          topShip = id;
        }
      }
      // left 0 keeps going (a convoy line); the last of a count ends it.
      if (l.left > 0) {
        l.left--;
        if (l.left === 0) {
          done.push(l.id);
          navy.message(owner, "events_display.ww1936_naval_line_done", {
            cls,
          });
          break;
        }
      }
    }
  }
  if (done.length > 0) {
    ce.navalLines = ce.navalLines.filter((l) => !done.includes(l.id));
  }
  if (ships > 0) {
    const r = navy.ships.rowOf(topShip);
    const cls = SHIP_CLASSES[navy.ships.cls[r]];
    const nameIdx = navy.ships.nameIdx[r];
    const key = shipNameKey(ce.tag, cls, nameIdx);
    // `ship`: the name key (ww1936.ship.<key>), or n of "<class> No. n".
    navy.message(owner, "events_display.ww1936_ship_commissioned", {
      n: ships,
      cls,
      ship: key ?? Math.max(0, -nameIdx),
    });
  }
  // Spec §5.4 (pre-flight A6): what repairs borrowed counted today only.
  ce.docksLent = 0;
}

/**
 * Spec §5.4: lends `n` dockyards to repairs; returns how many it lent —
 * at most the usable dockyards not lent yet. The navy's day (N2's repair)
 * calls it after the economy's turn, so the lines lose them the next day.
 */
export function lendDocks(ce: CountryEconomy, n: number): number {
  const left = Math.max(0, ce.totals.dock - ce.docksLent);
  const lent = Math.max(0, Math.min(Math.floor(n), left));
  ce.docksLent += lent;
  return lent;
}

/** The dockyards no line or repair uses (the drawer's "idle N"). */
export function dockyardsFree(econ: WwEconomy, ce: CountryEconomy): number {
  void econ;
  let used = ce.docksLent;
  for (const l of ce.navalLines) used += l.activeDocks;
  return Math.max(0, ce.totals.dock - used);
}
