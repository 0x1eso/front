import {
  GW_FRONT_START,
  GW_FRONT_UP,
  GW_THEATRES,
  GwPlan,
  GwSide,
  GwTheatre,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { armyCommander } from "./People";
import { GW_BEHIND, GW_THEATRE_SIDES, GW_TRANSFERS } from "./Tables";
import { clampTo, fights, news, other, turn } from "./World";

const P_PLAN = idHash("gw_ai_plan");

/** Who fights a theatre now on `side`, the lead first. */
export function membersOf(gw: GreatWar, t: GwTheatre, side: GwSide): GwTag[] {
  const behind = GW_BEHIND[t];
  const waiting =
    behind !== undefined && gw.nation(behind.once)?.out !== true
      ? behind.tags
      : [];
  return GW_THEATRE_SIDES[t][side].filter((tag) => {
    const n = gw.nation(tag);
    return fights(n) && n!.side === side && !waiting.includes(tag);
  });
}

function refreshTheatre(gw: GreatWar, t: GwTheatreState): void {
  const up = GW_FRONT_UP[t.id];
  const a = membersOf(gw, t.id, up);
  const d = membersOf(gw, t.id, other(up));
  const live = a.length > 0 && d.length > 0;
  t.attacker = a[0] ?? null;
  t.defender = d[0] ?? null;
  if (live && !t.open) {
    t.open = true;
    if (t.since === null) {
      t.since = gw.s.chapter;
      t.line = GW_FRONT_START[t.id];
      // A front opened in the machine-gun years is dug in from its first day.
      t.trench = Math.min(3, Math.floor(warMonths(gw) / 5));
      news(gw, "front_opened", null, null, t.id);
    }
  } else if (!live) {
    t.open = false;
  }
  for (const seat of gw.s.seats) {
    const mine = [...a, ...d].includes(seat.tag);
    if (t.open && mine && t.commander === null) {
      t.commander = armyCommander(gw, seat, t.id);
    }
  }
}

/** Opens and closes the theatres to match who fights. */
export function refreshTheatres(gw: GreatWar): void {
  for (const id of GW_THEATRES) {
    refreshTheatre(gw, gw.s.theatres.find((t) => t.id === id)!);
  }
}

/** `tag` joins `side`: at war with all that fight on the other. */
export function enter(
  gw: GreatWar,
  tag: GwTag,
  side: GwSide,
  why: string,
): void {
  const n = gw.nation(tag);
  if (n === null || n.side !== null) return;
  n.side = side;
  n.mob = 2;
  n.entered = gw.s.chapter;
  for (const e of gw.s.nations) {
    if (e.side !== other(side)) continue;
    if (!n.atWar.includes(e.tag)) n.atWar.push(e.tag);
    if (!e.atWar.includes(tag)) e.atWar.push(tag);
  }
  news(gw, why, tag);
  turn(gw, `entered_${tag.toLowerCase()}`);
  refreshTheatres(gw);
}

/** Beaten, or fallen apart: it leaves the war and its theatres close. */
export function leaveWar(gw: GreatWar, tag: GwTag, why: string): void {
  const n = gw.nation(tag);
  if (n === null || n.out) return;
  n.out = true;
  n.atWar = [];
  for (const e of gw.s.nations) e.atWar = e.atWar.filter((x) => x !== tag);
  news(gw, why, tag);
  turn(gw, `out_${tag.toLowerCase()}`);
  transfers(gw, tag);
  refreshTheatres(gw);
}

/** The divisions a fallen enemy freed go to the fronts that are left. */
function transfers(gw: GreatWar, out: GwTag): void {
  for (const row of GW_TRANSFERS) {
    const n = gw.nation(row.tag);
    if (row.out !== out || n === null || !fights(n)) continue;
    n.base[row.to] = clampTo((n.base[row.to] ?? 0) + row.bands, 1, 5);
    n.strength[row.to] = clampTo((n.strength[row.to] ?? 0) + row.bands, 1, 5);
  }
}

/** Germany nobody plays still has its generals: most go west, not all. */
function germanPlan(gw: GreatWar): GwPlan {
  const deu = gw.nation("DEU");
  if (deu === null || gw.s.seats.some((x) => x.tag === "DEU")) return "west";
  const east = { cautious: 25, principled: 15, opportunist: 10, hardline: 0 };
  return wwRoll(gw.s.seed, P_PLAN, 0) % 100 < east[deu.ai] ? "east" : "west";
}

/**
 * The great war begins (design §2.4): the alliances pull each other in, then
 * Germany's plan says whether Belgium goes with them. Britain, Italy and the
 * rest come through the AI's entry rules, not here.
 */
export function openWar(gw: GreatWar): void {
  const s = gw.s;
  if (s.warChapter !== null) return;
  s.warChapter = s.chapter;
  s.plan ??= germanPlan(gw);
  turn(gw, "war_began");
  enter(gw, "AUH", "central", "war_declared");
  enter(gw, "SRB", "entente", "war_declared");
  enter(gw, "MNE", "entente", "war_declared");
  enter(gw, "RUS", "entente", "war_declared");
  enter(gw, "DEU", "central", "war_declared");
  enter(gw, "FRA", "entente", "war_declared");
  if (s.plan === "west") {
    enter(gw, "BEL", "entente", "belgium_invaded");
    turn(gw, "belgium_invaded");
  }
}
