// Great War 1914: the two scales of the sea (design §4.2). Britain's blockade
// starves the Central side slowly; Germany's submarines answer, and every step
// up costs America's patience. Two numbers and a signature.
import {
  GW_SEA_MAX,
  GwNationState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { hasTech, warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { navalStep, uboatSaves, warnedLately } from "./NavalIntel";
import {
  clampTo,
  everyMonths,
  fights,
  isLongChapter,
  moveGauge,
  news,
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

function blockadeStep(gw: GreatWar): void {
  const s = gw.s;
  const gbr = gw.nation("GBR");
  if (gbr === null || !fights(gbr) || !seaOpen(gw)) return;
  const line = s.theatres.find((t) => t.id === "sea")!.line;
  // ww180: told in time when the enemy's fleet puts out, the cruisers keep
  // their stations: the blockade tightens sooner and does not slip.
  const warned = warnedLately(gw, "entente");
  const nets = (hasTech(gbr, "mine_nets") ? 4 : 5) - (warned ? 1 : 0);
  // A fleet that holds the North Sea closes it a little at a time.
  if (line <= 1 && everyMonths(gw, nets)) {
    s.blockade = clampTo(s.blockade + 1, 0, GW_SEA_MAX);
  }
  if (line >= 2 && !warned && everyMonths(gw, 3)) {
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
  if (
    s.uboat === 0 &&
    s.blockade >= 3 &&
    gw.nation("GBR")?.side === "entente"
  ) {
    if (deu.ai !== "principled" || s.blockade >= 5) setUboats(gw, 1);
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
  const gbr = gw.nation("GBR");
  if (deu === null || gbr === null || !fights(gbr)) return;
  const live = fights(deu) && seaOpen(gw);
  let sunk = 0;
  if (live && s.uboat === 1 && everyMonths(gw, 2)) sunk = 1;
  if (live && s.uboat === 2) sunk = hasTech(deu, "ocean_boats") ? 2 : 1;
  // ww180: a chain that hears a U-boat and steers the ships off it.
  if (sunk > 0) sunk -= uboatSaves(gw, "DEU");
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
  if (gw.s.warChapter === null || !isLongChapter(gw)) return;
  navalStep(gw);
  blockadeStep(gw);
  aiUboats(gw);
  uboatStep(gw);
  incidents(gw);
  americaStep(gw, warScoreCentral);
}

/** What the sea does to one country's bread. */
export function seaFor(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  if (n.side === "central" && gw.nation("GBR")?.side === "entente") {
    if (s.blockade >= 2) {
      const every = Math.max(3, 9 - (s.blockade >> 1));
      if (everyMonths(gw, every)) {
        moveGauge(gw, n.tag, "bread", -1, "bread_blockade");
      }
    }
    if (s.blockade >= 7 && everyMonths(gw, 6, 2)) {
      moveGauge(gw, n.tag, "shells", -1, "shells_blockade");
    }
  }
  if (n.tag === "GBR" && s.shipping >= 3) {
    if (everyMonths(gw, s.shipping >= 7 ? 2 : 4)) {
      moveGauge(gw, n.tag, "bread", -1, "bread_uboats");
    }
    if (s.shipping >= 9 && everyMonths(gw, 3)) {
      moveGauge(gw, n.tag, "order", -1, "order_hunger");
    }
  }
}
