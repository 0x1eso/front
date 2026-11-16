// Great War 1914: the two scales of the sea (design §4.2). Britain's blockade
// starves the Central side slowly; Germany's submarines answer, and every step
// up costs America's patience. Two numbers and a signature.
import {
  GW_LINES,
  GW_SEA_MAX,
  GwNationState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { hasTech, warMonths } from "./Eras";
import {
  battleShips,
  blockadeHolds,
  escortSaves,
  fleetStep,
  uboatScale,
} from "./Fleets";
import type { GreatWar } from "./GreatWar";
import { navalStep, uboatSaves, warnedLately } from "./NavalIntel";
import { naturalSide } from "./Wars";
import {
  clampTo,
  everyMonths,
  fights,
  isLongChapter,
  moveGauge,
  news,
  other,
  reason,
  ruledBySeat,
  turn,
} from "./World";

const P_LINER = idHash("gw_liner");
const P_NOTE = idHash("gw_note");
const P_UBOAT = idHash("gw_uboat_ai");

/** America reads the sea from this many months of war. */
const LINER_PCT = 8;
const NOTE_PCT = 12;

const seaOpen = (gw: GreatWar) =>
  gw.s.theatres.find((t) => t.id === "sea")!.open;

// ---- ww220: whoever holds the main fleet blockades the other side ----

/**
 * The battle fleet a country brings to the scales, by its dreadnoughts in the
 * summer of 1914: only before ww221's fleets are laid down (Fleets.battleShips).
 */
const BATTLE_FLEET: Readonly<Partial<Record<GwTag, number>>> = {
  GBR: 10,
  DEU: 6,
  USA: 4,
  FRA: 3,
  JPN: 2,
  ITA: 2,
  AUH: 2,
  RUS: 1,
};

export function battleFleet(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  if (n === null || !fights(n)) return 0;
  return battleShips(gw, tag) ?? BATTLE_FLEET[tag] ?? 0;
}

/**
 * ww220 (design ww220 §4): the side that holds the main fleet: Britain's
 * coalition, or the one it would join while it makes up its mind; else the
 * side with the stronger battle fleet; null when neither, or both alike. The
 * blockade falls on the other side, and the U-boats are the other side's
 * answer.
 */
export function blockaderOf(gw: GreatWar): GwSide | null {
  const gbr = gw.nation("GBR");
  if (gbr !== null && gbr.side !== null) return gbr.side;
  const camp = gbr === null || gbr.out ? null : naturalSide(gw, "GBR");
  if (camp !== null) return camp;
  const sum: Record<GwSide, number> = { central: 0, entente: 0 };
  for (const n of gw.s.nations) {
    if (n.side !== null) sum[n.side] += battleFleet(gw, n.tag);
  }
  if (sum.central === sum.entente) return null;
  return sum.central > sum.entente ? "central" : "entente";
}

/** ww220: the biggest fleet of `side` in the war, the list's first on a tie. */
export function fleetLead(gw: GreatWar, side: GwSide): GwTag | null {
  let best: GwTag | null = null;
  let most = 0;
  for (const n of gw.s.nations) {
    const k = n.side === side ? battleFleet(gw, n.tag) : 0;
    if (k > most) {
      best = n.tag;
      most = k;
    }
  }
  return best;
}

/**
 * ww220: the main fleet's side while that fleet is at war: not while Britain
 * still makes up its mind, nor when no ship of the side fights.
 */
export function fleetAtWar(gw: GreatWar): GwSide | null {
  const gbr = gw.nation("GBR");
  const undecided =
    gbr !== null &&
    gbr.side === null &&
    !gbr.out &&
    naturalSide(gw, "GBR") !== null;
  const by = undecided ? null : blockaderOf(gw);
  return by !== null && fleetLead(gw, by) !== null ? by : null;
}

/** ww220: a country the blockade falls on: in the coalition without the main fleet. */
export function isBlockaded(gw: GreatWar, n: GwNationState): boolean {
  const by = blockaderOf(gw);
  return by !== null && n.side !== null && n.side !== by;
}

/**
 * ww222 HM: the side Germany's U-boats hunt: the one Germany is at war with.
 * In June 1914's camps that is the main fleet's; with Britain in the Central
 * Powers the boats close the ring on France's and Russia's shipping instead.
 */
export function uboatPrey(gw: GreatWar): GwSide | null {
  const deu = gw.nation("DEU");
  return deu === null || deu.side === null ? null : other(deu.side);
}

/** ww220: whose merchant fleet the U-boats sink: the hunted side's main fleet. */
export function shipperOf(gw: GreatWar): GwTag {
  const prey = uboatPrey(gw);
  const by = prey ?? blockaderOf(gw);
  return (by === null ? null : fleetLead(gw, by)) ?? "GBR";
}

/**
 * ww220: where the sea line starts: at the North Sea when the main fleet is
 * the entente's, at the Channel (the mirror) when it is the Central Powers'.
 */
export function seaStartLine(gw: GreatWar, start: number): number {
  return blockaderOf(gw) === "central"
    ? GW_LINES.sea.length - 1 - start
    : start;
}

/** The sea line from which the North Sea is the Central Powers' (Seas.ts). */
const SEA_CENTRAL_FROM = 2;

function blockadeStep(gw: GreatWar): void {
  const s = gw.s;
  const by = blockaderOf(gw);
  const lead = by === null ? null : gw.nation(fleetLead(gw, by) ?? "GBR");
  if (by === null || lead === null || !seaOpen(gw)) return;
  const line = s.theatres.find((t) => t.id === "sea")!.line;
  // ww180: told in time when the enemy's fleet puts out, the cruisers keep
  // their stations: the blockade tightens sooner and does not slip.
  const warned = warnedLately(gw, by);
  const nets = (hasTech(lead, "mine_nets") ? 4 : 5) - (warned ? 1 : 0);
  // ww221: the holder's battle fleet in the north and cruisers on station.
  const fleets = blockadeHolds(gw, by);
  // A fleet that holds the North Sea closes it a little at a time.
  const holds = (line >= SEA_CENTRAL_FROM ? "central" : "entente") === by;
  if (holds && fleets.tighten && everyMonths(gw, nets)) {
    s.blockade = clampTo(s.blockade + 1, 0, GW_SEA_MAX);
  }
  if ((!holds || fleets.slips) && !warned && everyMonths(gw, 3)) {
    s.blockade = clampTo(s.blockade - 1, 0, GW_SEA_MAX);
  }
  // America is a neutral too, and the list of contraband grows.
  const usa = gw.nation("USA");
  if (
    usa !== null &&
    usa.side === null &&
    s.blockade >= 6 &&
    everyMonths(gw, 3)
  ) {
    usa.readiness = clampTo(usa.readiness - 2, 0, 100);
  }
}

/** What Germany does with its boats when nobody signs for it. */
function aiUboats(gw: GreatWar): void {
  const s = gw.s;
  const deu = gw.nation("DEU");
  if (deu === null || !fights(deu) || ruledBySeat(gw, "DEU")) return;
  const months = warMonths(gw);
  // ww220: the boats answer a blockade by the other side's main fleet.
  const by = blockaderOf(gw);
  if (
    s.uboat === 0 &&
    s.blockade >= 3 &&
    deu.side !== null &&
    by === other(deu.side)
  ) {
    if (deu.ai !== "principled" || s.blockade >= 5) setUboats(gw, 1);
    return;
  }
  // ww222 HM: with the main fleet on Germany's side, the boats join the ring
  // (restricted only: nobody's blockade to answer with a sink-on-sight war).
  if (s.uboat === 0 && deu.side !== null && by === deu.side) {
    if (s.blockade >= 3 && deu.ai !== "principled") setUboats(gw, 1);
    return;
  }
  if (s.uboat !== 1 || months < 24) return;
  const roll = wwRoll(s.seed, P_UBOAT, s.chapter) % 100;
  const hungry = deu.gauges.bread <= 1 || s.blockade >= 6;
  const bar = { hardline: 50, opportunist: 30, principled: 8, cautious: 12 }[
    deu.ai
  ];
  if (hungry && roll < bar) setUboats(gw, 2);
}

/** A signature, from a scene or from the AI. Turns and news go with it. */
export function setUboats(gw: GreatWar, level: number): void {
  const s = gw.s;
  const to = clampTo(level, 0, 2);
  if (to === s.uboat) return;
  s.uboat = to;
  news(gw, `uboat_${to}`);
  if (to === 2) turn(gw, "uboat_unrestricted");
}

function uboatStep(gw: GreatWar): void {
  const s = gw.s;
  const deu = gw.nation("DEU");
  // ww220: the boats hunt the side Germany fights (ww222 HM: uboatPrey).
  const prey = uboatPrey(gw);
  if (deu === null || prey === null) return;
  const live = fights(deu) && seaOpen(gw);
  let sunk = 0;
  // ww221: few, some or many boats at sea (Fleets.uboatScale; 2 is today's).
  const boats = uboatScale(gw);
  const every = [0, 3, 2, 1][boats];
  if (live && boats > 0 && s.uboat === 1 && everyMonths(gw, every)) sunk = 1;
  if (live && boats > 0 && s.uboat === 2) {
    sunk =
      boats === 1
        ? 1
        : (hasTech(deu, "ocean_boats") ? 2 : 1) + (boats === 3 ? 1 : 0);
  }
  // ww180: a chain that hears a U-boat and steers the ships off it.
  if (sunk > 0) sunk -= uboatSaves(gw, "DEU");
  // ww221: cruisers on escort in the atlantic.
  if (sunk > 0) sunk -= escortSaves(gw, prey);
  let built = everyMonths(gw, 3) ? 1 : 0;
  // ww179: convoys any of the three sail count, not Britain's alone.
  const convoys = (["GBR", "FRA", "USA"] as const).some((t) => {
    const x = gw.nation(t);
    return x !== null && fights(x) && hasTech(x, "convoys");
  });
  if (convoys) built += 2;
  s.shipping = clampTo(s.shipping + sunk - built, 0, GW_SEA_MAX);
}

/** Sinkings with neutrals aboard, a note decoded: the seed's, by the signature. */
function incidents(gw: GreatWar): void {
  const s = gw.s;
  const usa = gw.nation("USA");
  if (usa === null || usa.side !== null || s.uboat === 0) return;
  if (wwRoll(s.seed, P_LINER, s.chapter) % 100 < LINER_PCT * s.uboat) {
    usa.readiness = clampTo(usa.readiness + 12, 0, 100);
    news(gw, "liner_sunk");
    for (const seat of s.seats) {
      if (!seat.flags.includes("w_liner_sunk")) seat.flags.push("w_liner_sunk");
      if (seat.tag === "DEU") reason(gw, seat, "liner_sunk");
    }
  }
  const pct = s.secrets.includes("deu_zimmermann_wire")
    ? NOTE_PCT * 3
    : NOTE_PCT;
  if (s.uboat === 2 && wwRoll(s.seed, P_NOTE, s.chapter) % 100 < pct) {
    if (!s.news.some((x) => x.key === "note_decoded")) {
      usa.readiness = clampTo(usa.readiness + 15, 0, 100);
      news(gw, "note_decoded");
    }
  }
}

/** America comes late and for a reason: the sea, France falling, the loans. */
function americaStep(gw: GreatWar, warScoreCentral: number): void {
  const s = gw.s;
  const n = gw.nation("USA");
  if (n === null || n.side !== null || ruledBySeat(gw, "USA")) return;
  // The first winter of the war passes before anyone in Washington counts it.
  if (warMonths(gw) < 10) return;
  const add =
    (s.uboat === 2 ? 6 : s.uboat === 1 ? 1 : 0) +
    (s.threads.includes("us_loans") ? 1 : 0) +
    (warScoreCentral >= 40 ? 3 : 0);
  n.readiness = clampTo(n.readiness + add, 0, 100);
}

/** Readiness at which America comes in. */
export const AMERICA_BAR = 80;
/**
 * America by state, not by date (ww171): the sea war has to reach it, an
 * unrestricted submarine war or the German note read in Washington.
 */
export const americaCan = (gw: GreatWar) =>
  gw.s.uboat === 2 || gw.s.news.some((x) => x.key === "note_decoded");

/** Chapter step, before the home front: the two scales move. */
export function seaStep(gw: GreatWar, warScoreCentral: number): void {
  // ww221: the fleets build and repair in peace too.
  fleetStep(gw);
  if (gw.s.warChapter === null || !isLongChapter(gw)) return;
  navalStep(gw);
  blockadeStep(gw);
  aiUboats(gw);
  uboatStep(gw);
  incidents(gw);
  americaStep(gw, warScoreCentral);
}

/**
 * What the sea does to one country's order. ww201: its grain and copper are
 * the production step's terms (Economy.ts: imports, blockade, U-boats).
 */
export function seaFor(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  if (n.tag === shipperOf(gw) && s.shipping >= 9 && everyMonths(gw, 3)) {
    moveGauge(gw, n.tag, "order", -1, "order_hunger");
  }
}
