import {
  GwBattle,
  GwSeatState,
  GwSide,
  GwTheatre,
  GwWorldFlag,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_LINKS, LOCAL_WAR_AT } from "./Crises";
import type { GreatWar } from "./GreatWar";
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
