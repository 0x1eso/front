// Great War 1914, ww180 (owner's pick 5): the secret war at sea. A sea power
// builds a chain of radio direction-finding stations on its coast (Britain
// first, on its own; Germany and America by choice). The chain takes bearings
// on the enemy's wireless: it finds U-boats, which cuts sinkings while the
// Admiralty steers ships off them, and it hears a fleet put out, which tells
// our fleet in time. Where the service also reads the enemy's codes at sea
// (Spies.serviceOf), it hears more and surer, but acting on a read raises the
// enemy's suspicion, as Room 40's did (Spies.actedOnRead). Hidden: a seat sees
// only its own chain and what it heard. Every roll has its own purpose.
import type {
  GwNaval,
  GwSeatState,
  GwSide,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_NAVAL_USES,
  type GwNavalAct,
  type GwNavalCan,
} from "@openfront/engine-api/ww1914/GwNaval";
import type { GwSeaView } from "@openfront/engine-api/ww1914/GwWorldView";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { actedOnRead, serviceOf, skillOf } from "./Spies";
import { memberEnd, membersOf } from "./Wars";
import { monthsFrom, reason, ruledBySeat, seatsOf } from "./World";

const P_UBOAT = idHash("gw_df_uboat");
const P_SORTIE = idHash("gw_df_sortie");
const P_NOTICE = idHash("gw_df_notice");
const P_AI = idHash("gw_df_ai");

/** The countries with a fleet on the sea front (Tables.GW_FRONT_ENDS.sea). */
export const GW_NAVAL_POWERS: readonly GwTag[] = ["GBR", "DEU", "USA"];
/** Months a new station takes; the chain is whole at three. */
const STATION_MONTHS = 4;
const STATIONS_MAX = 3;
/** Britain's Admiralty asks for its chain once the war is this old. */
const GBR_FROM_MONTHS = 4;
/** Another sea power's AI thinks of one from this many months of war. */
const AI_FROM_MONTHS = 6;
const AI_PCT: Record<string, number> = {
  hardline: 12,
  opportunist: 10,
  cautious: 8,
  principled: 6,
};
/** Percent to hear, by bearing: base and per station; a read adds more. */
const HEAR_BASE = 20;
const HEAR_STATION = 20;
const HEAR_READ = 20;
const HEAR_MOST = 90;
/** Odds a warned fleet's sortie loses: by bearing, and read in its codes. */
export const WARN_COST = 10;
export const WARN_COST_READ = 15;
/** A captain hunted by bearing alone may still guess he is heard. */
const NOTICE_PCT = 33;
/** Chapters a warning stays "lately" for scenes and the blockade. */
const LATELY = 3;
const HEARD_KEPT = 6;

const roll = (gw: GreatWar, p: number, ...k: number[]) =>
  wwRoll(gw.s.seed, p, gw.s.chapter, ...k) % 100;
const idx = (gw: GreatWar, tag: GwTag) =>
  gw.s.nations.findIndex((n) => n.tag === tag);

/** The chain, or null while none was ordered. Never fills state. */
export function navalOf(gw: GreatWar, tag: GwTag): GwNaval | null {
  return gw.nation(tag)?.naval ?? null;
}

/** Stations up, 0..3: the first at once, then one every few months. */
export function stationsOf(gw: GreatWar, tag: GwTag): number {
  const n = navalOf(gw, tag);
  if (n === null) return 0;
  const up = 1 + Math.floor(monthsFrom(gw, n.since) / STATION_MONTHS);
  return Math.min(STATIONS_MAX, up);
}

/** It fights at sea now: a fleet on the sea front's end. */
export function atSea(gw: GreatWar, tag: GwTag): boolean {
  const sea = gw.s.theatres.find((t) => t.id === "sea");
  return sea !== undefined && sea.open && memberEnd(gw, "sea", tag) !== null;
}

/** The use an AI keeps by its character: the bold use everything. */
function aiUse(gw: GreatWar, tag: GwTag): number {
  const ai = gw.nation(tag)?.ai;
  return ai === "hardline" || ai === "opportunist" ? 2 : 1;
}

/** The chain is ordered: stations go up from this chapter. */
export function buildChain(gw: GreatWar, tag: GwTag, use?: number): void {
  const n = gw.nation(tag);
  if (n === null || n.naval !== undefined) return;
  const seat = ruledBySeat(gw, tag);
  n.naval = {
    since: gw.s.chapter,
    use: use ?? (seat ? 1 : aiUse(gw, tag)),
    heard: [],
  };
  for (const s of seatsOf(gw, tag)) reason(gw, s, "naval_df_ordered");
}

/** Whether `tag`'s service reads `foe`'s traffic at sea (SA's levels). */
function readsAtSea(gw: GreatWar, tag: GwTag, foe: GwTag): boolean {
  return serviceOf(gw, tag).crypt > serviceOf(gw, foe).secure;
}

/** The best chain on `end` of the sea front: most stations, then the list. */
function holderOn(gw: GreatWar, end: GwSide): GwTag | null {
  let best: GwTag | null = null;
  let most = 0;
  for (const tag of membersOf(gw, "sea", end)) {
    const k = stationsOf(gw, tag);
    if (k > most) {
      best = tag;
      most = k;
    }
  }
  return best;
}

function hearPct(gw: GreatWar, tag: GwTag, read: boolean): number {
  const pct =
    HEAR_BASE +
    HEAR_STATION * stationsOf(gw, tag) +
    (read ? HEAR_READ : 0) +
    skillOf(gw, tag);
  return Math.min(HEAR_MOST, Math.max(0, pct));
}

function log(
  gw: GreatWar,
  holder: GwTag,
  kind: "uboat" | "sortie",
  tag: GwTag,
  used: boolean,
  decoded: boolean,
): void {
  const n = navalOf(gw, holder)!;
  n.heard.push({ kind, tag, chapter: gw.s.chapter, used, decoded });
  if (n.heard.length > HEARD_KEPT)
    n.heard.splice(0, n.heard.length - HEARD_KEPT);
}

/**
 * Sea.uboatStep, when U-boats sank something this chapter: the sinkings the
 * enemy's chain saves, 0 or 1. Heard and steered off: one ship fewer. Used,
 * a read tells the enemy; a hunt by bearing alone now and then does too.
 */
export function uboatSaves(gw: GreatWar, uboats: GwTag): number {
  const end = memberEnd(gw, "sea", uboats);
  if (end === null) return 0;
  const holder = holderOn(gw, end === "central" ? "entente" : "central");
  if (holder === null) return 0;
  const read = readsAtSea(gw, holder, uboats);
  const r = roll(gw, P_UBOAT, idx(gw, holder));
  if (r >= hearPct(gw, holder, read)) return 0;
  const used = navalOf(gw, holder)!.use >= 2;
  log(gw, holder, "uboat", uboats, used, read);
  for (const s of seatsOf(gw, holder)) {
    reason(gw, s, used ? "naval_uboat_steered" : "naval_uboat_heard");
  }
  if (!used) return 0;
  if (read || roll(gw, P_NOTICE, idx(gw, holder)) < NOTICE_PCT) {
    actedOnRead(gw, holder, uboats);
  }
  return 1;
}

/**
 * Fronts.judge, for a fight at sea: the side that puts out may be heard by
 * the other's chain. Told in time, the enemy's fleet is waiting: the odds the
 * sortie loses. Listening only, it is heard and nothing is done.
 */
export function sortieWarning(
  gw: GreatWar,
  t: GwTheatreState,
  by: GwSide,
): number {
  if (t.id !== "sea") return 0;
  const lead = membersOf(gw, "sea", by)[0];
  const holder = holderOn(gw, by === "central" ? "entente" : "central");
  if (lead === undefined || holder === null) return 0;
  const read = readsAtSea(gw, holder, lead);
  if (roll(gw, P_SORTIE, idx(gw, holder)) >= hearPct(gw, holder, read)) {
    return 0;
  }
  const used = navalOf(gw, holder)!.use >= 1;
  log(gw, holder, "sortie", lead, used, read);
  for (const s of seatsOf(gw, holder)) {
    reason(gw, s, used ? "naval_sortie_warned" : "naval_sortie_heard");
  }
  if (!used) return 0;
  if (read) actedOnRead(gw, holder, lead);
  return read ? WARN_COST_READ : WARN_COST;
}

/** A warning of an enemy sortie went to the fleet of `side`, lately. */
export function warnedLately(gw: GreatWar, side: GwSide): boolean {
  return membersOf(gw, "sea", side).some((tag) =>
    (navalOf(gw, tag)?.heard ?? []).some(
      (h) => h.kind === "sortie" && h.used && gw.s.chapter - h.chapter < LATELY,
    ),
  );
}

/** `tag`'s fleet put out lately and the enemy had been told. */
function metLately(gw: GreatWar, tag: GwTag): boolean {
  return gw.s.nations.some((n) =>
    (n.naval?.heard ?? []).some(
      (h) =>
        h.kind === "sortie" &&
        h.tag === tag &&
        h.used &&
        gw.s.chapter - h.chapter < LATELY,
    ),
  );
}

/** Chapter step, from Sea.seaStep: Britain's chain, and the AI's. */
export function navalStep(gw: GreatWar): void {
  const months = warMonths(gw);
  for (const tag of GW_NAVAL_POWERS) {
    const n = gw.nation(tag);
    if (n === null || n.naval !== undefined || !atSea(gw, tag)) continue;
    // The Admiralty asks for its chain of its own (Round's stations, 1915).
    if (tag === "GBR" && months >= GBR_FROM_MONTHS) {
      buildChain(gw, tag);
      continue;
    }
    if (ruledBySeat(gw, tag) || months < AI_FROM_MONTHS) continue;
    if (roll(gw, P_AI, idx(gw, tag)) < (AI_PCT[n.ai] ?? 8)) {
      buildChain(gw, tag);
    }
  }
}

/** `world({ is: "naval", can })` for a seat. */
export function navalHolds(
  gw: GreatWar,
  seat: GwSeatState,
  can: GwNavalCan,
): boolean {
  const n = navalOf(gw, seat.tag);
  switch (can) {
    case "build":
      return n === null && atSea(gw, seat.tag);
    case "use":
      return n !== null;
    case "listen":
    case "fleet":
    case "all":
      return n !== null && GW_NAVAL_USES[n.use] === can;
    case "warned":
      return (
        n !== null &&
        n.heard.some(
          (h) =>
            h.kind === "sortie" && h.used && gw.s.chapter - h.chapter < LATELY,
        )
      );
    case "met":
      return metLately(gw, seat.tag);
  }
}

/** `doWorld({ do: "naval", act })` for a seat. */
export function navalEffect(
  gw: GreatWar,
  seat: GwSeatState,
  act: GwNavalAct,
): void {
  if (act === "build") {
    buildChain(gw, seat.tag);
    return;
  }
  const n = navalOf(gw, seat.tag);
  if (n === null) return;
  n.use = GW_NAVAL_USES.indexOf(act);
}

/** The seat's own chain for the 정보부 tab; undefined with no fleet at sea. */
export function seaView(
  gw: GreatWar,
  seat: GwSeatState,
): GwSeaView | undefined {
  const n = navalOf(gw, seat.tag);
  if (n === null && !GW_NAVAL_POWERS.includes(seat.tag)) return undefined;
  return {
    atSea: atSea(gw, seat.tag),
    stations: stationsOf(gw, seat.tag),
    use: n?.use ?? null,
    log: (n?.heard ?? []).map((h) => ({ ...h })),
  };
}
