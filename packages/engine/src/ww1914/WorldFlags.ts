import {
  GW_LINES,
  GwBattle,
  GwSeatState,
  GwSide,
  GwTheatre,
  GwWorldFlag,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { GW_LINKS, LOCAL_WAR_AT } from "./Crises";
import { warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { lastOf } from "./World";

/** Chapters of a war in which a battle still counts as its opening. */
const OPENING_CHAPTERS = 2;

function winnerOf(b: GwBattle): GwSide | null {
  if (b.by === null) return null;
  if (b.result === "advance" || b.result === "break") return b.by;
  if (b.result === "repelled")
    return b.by === "central" ? "entente" : "central";
  return null;
}

/** The theatre's last battle, while the war is in its opening chapters. */
function openingBattle(gw: GreatWar, t: GwTheatre): GwBattle | null {
  const s = gw.s;
  if (s.warChapter === null) return null;
  if (s.chapter - s.warChapter > OPENING_CHAPTERS) return null;
  return lastOf(s.battles.filter((b) => b.theatre === t)) ?? null;
}

/** The last chapter a war can begin in and still be the summer's war. */
const SUMMER_ENDS = 6;

/** What the world has done by now, in the words scenes ask for it. */
function flagsNow(gw: GreatWar): GwWorldFlag[] {
  const s = gw.s;
  const out: GwWorldFlag[] = [];
  if (s.warChapter !== null && s.warChapter <= SUMMER_ENDS) {
    out.push("w_summer_war");
  }
  const link = s.chain?.topic === "balkan" ? s.chain.step : -1;
  if (link >= GW_LINKS.indexOf("ultimatum")) out.push("w_ultimatum_out");
  const localWar = link >= GW_LINKS.indexOf("local_war");
  if (s.warChapter !== null || (localWar && s.temp >= LOCAL_WAR_AT)) {
    out.push("w_aut_at_war");
  }
  const mob = gw.nation("RUS")?.mob ?? 0;
  if (mob >= 1) out.push("w_rus_partial");
  if (mob >= 2) out.push("w_rus_general");
  const east = openingBattle(gw, "east");
  if (east !== null && winnerOf(east) === "central") out.push("w_tannenberg");
  if (east !== null && winnerOf(east) === "entente") {
    out.push("w_bad_luck_east");
  }
  const west = openingBattle(gw, "west");
  if (s.plan === "west" && west !== null && winnerOf(west) !== "central") {
    out.push("w_marne_stopped");
  }
  if (gw.nation("SRB")?.out === true) out.push("w_serbia_fallen");
  if (gw.nation("ITA")?.side === "entente") out.push("w_italy_in");
  if (gw.nation("USA")?.side === "entente") out.push("w_america_in");
  if (gw.nation("RUS")?.out === true) out.push("w_russia_out");
  if (s.uboat === 2) out.push("w_unrestricted");
  if (gw.nation("OTT")?.side === "central") out.push("w_ottoman_in");
  if (gw.nation("ROU")?.side === "entente") out.push("w_romania_in");
  const eastFront = s.theatres.find((t) => t.id === "east")!;
  if (
    eastFront.since !== null &&
    eastFront.line >= GW_LINES.east.indexOf("warsaw")
  ) {
    out.push("w_warsaw_lost");
  }
  // Berlin sounds Petersburg out once the east has cost it enough.
  if (
    warMonths(gw) >= 18 &&
    gw.nation("RUS")?.out === false &&
    (s.secrets.includes("rus_german_feeler") ||
      eastFront.line >= GW_LINES.east.indexOf("vistula"))
  ) {
    out.push("w_german_offer");
  }
  const front = s.theatres.find((t) => t.id === "west")!;
  if (front.since !== null && front.line >= GW_LINES.west.indexOf("aisne")) {
    out.push("w_france_falling");
  }
  const auh = gw.nation("AUH");
  if (
    auh !== null &&
    civilFromDays(s.day).year >= 1916 &&
    civilFromDays(s.day).month >= 7 &&
    (auh.unrest >= 1 || (auh.inst.nations ?? 0) < 0)
  ) {
    out.push("w_auh_sturgkh_shot");
  }
  return out;
}

function raise(seat: GwSeatState, flags: readonly GwWorldFlag[]): void {
  for (const f of flags) if (!seat.flags.includes(f)) seat.flags.push(f);
}

/**
 * Chapter step: scene plan §1. Each flag stays once raised, so a scene can ask
 * "has this happened" in any later chapter. Raised before the next desk is
 * dealt, so a scene can follow in the chapter that opens.
 */
export function worldFlagsStep(gw: GreatWar): void {
  const flags = flagsNow(gw);
  for (const seat of gw.s.seats) raise(seat, flags);
}

/**
 * Flags that told of one moment: true now once raised. The rest read the
 * state they were raised from (flagsNow), so "is it so now" can fall back.
 */
const EVENTS: readonly GwWorldFlag[] = [
  "w_summer_war",
  "w_ultimatum_out",
  "w_tannenberg",
  "w_bad_luck_east",
  "w_liner_sunk",
  "w_auh_karl",
  "w_auh_ff_throne",
  "w_auh_sturgkh_shot",
  "w_treaty_kept",
  "w_treaty_broken",
  "w_treaty_leaked",
  "w_treaty_i_broke",
];

/**
 * ww187: a world flag true now, not only once. The Marne stop holds while
 * Paris is French and the west line short of it; the others hold while what
 * raised them holds.
 */
export function flagNow(
  gw: GreatWar,
  seat: GwSeatState,
  f: GwWorldFlag,
): boolean {
  if (!seat.flags.includes(f)) return false;
  if (EVENTS.includes(f)) return true;
  if (f === "w_marne_stopped") {
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    const paris = GW_LINES.west.indexOf("paris");
    return (
      holderOf(gw, "paris") === GW_PLACES.paris.owner &&
      (west.since === null || west.line < paris)
    );
  }
  return flagsNow(gw).includes(f);
}
