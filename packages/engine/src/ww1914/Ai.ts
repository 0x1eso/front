import {
  GW_FRONT_UP,
  GwAlloc,
  GwNationState,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { GW_AI_MAIN, GW_ENTRIES, GW_ENTRY_BAR, GwEntry } from "./Tables";
import { enter, leaveWar, membersOf } from "./Wars";
import { clampTo, fights, seatsOf } from "./World";

const P_AI_MOVE = idHash("gw_ai_move");
const P_HISTORY = idHash("gw_ai_history");

/** Design §15 no. 13: how often an AI simply does what history did. */
const HISTORY_PCT = 50;

const dayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return daysFromCivil(y, m, d);
};

/** Who is winning, as a neutral's envoy would tell it; up for the side. */
function winning(gw: GreatWar): GwSide | null {
  const score = warScore(gw, "central");
  if (score >= 15) return "central";
  if (score <= -15) return "entente";
  return null;
}

/**
 * A neutral values both sides' prices with the war's state and its own lean;
 * the higher wins (design §10). A character changes what it pays attention to.
 */
export function neutralChoice(gw: GreatWar, n: GwNationState, e: GwEntry): GwSide {
  const best = winning(gw);
  let central = (n.offers.central ?? 0) * 10;
  let entente = (n.offers.entente ?? 0) * 10;
  const follow = n.ai === "opportunist" ? 25 : n.ai === "principled" ? 0 : 12;
  if (best === "central") central += follow;
  if (best === "entente") entente += follow;
  if (e.natural === "central") central += 15;
  if (e.natural === "entente") entente += 15;
  entente += n.lean * 15;
  return central > entente ? "central" : "entente";
}

function neutralStep(gw: GreatWar, e: GwEntry): void {
  const s = gw.s;
  const n = gw.nation(e.tag);
  if (n === null || n.side !== null || seatsOf(gw, e.tag).length > 0) return;
  const late = s.day >= dayOf(e.earliest);
  const bold = n.ai === "hardline" ? 4 : n.ai === "cautious" ? 1 : 2;
  // The rail: nobody sits out for ever, the pressure of the war adds up.
  n.readiness = clampTo(n.readiness + bold + (winning(gw) !== null ? 2 : 0), 0, 100);
  if (!late) return;
  const offer = Math.max(n.offers.central ?? 0, n.offers.entente ?? 0);
  if (n.readiness + offer * 12 < GW_ENTRY_BAR[n.ai]) return;
  enter(gw, e.tag, neutralChoice(gw, n, e), "entered_war");
}

/** Britain: Belgium decides it, or the pressure of France in danger does. */
function britainStep(gw: GreatWar): void {
  const s = gw.s;
  const n = gw.nation("GBR");
  if (n === null || n.side !== null || seatsOf(gw, "GBR").length > 0) return;
  const belgium = gw.nation("BEL")?.side === "entente";
  const west = s.theatres.find((t) => t.id === "west")!;
  const add = belgium ? 40 + n.lean * 20 : 6 + n.lean * 4;
  const france = west.line >= 4 ? 25 : 0;
  n.readiness = clampTo(n.readiness + add + france, 0, 100);
  if (s.secrets.includes("anglo_russian_naval_talks")) n.readiness += 5;
  const bar = belgium ? 40 : n.ai === "principled" ? 90 : 70;
  if (n.readiness >= bar) enter(gw, "GBR", "entente", "britain_entered");
}

/** America comes late and for a reason: the submarines, or France falling. */
function americaStep(gw: GreatWar): void {
  const s = gw.s;
  const n = gw.nation("USA");
  if (n === null || n.side !== null || seatsOf(gw, "USA").length > 0) return;
  if (s.day < dayOf("1916-01-01")) return;
  const add =
    (s.uboat === 2 ? 12 : s.uboat === 1 ? 3 : 1) +
    (s.threads.includes("us_loans") ? 2 : 0) +
    (warScore(gw, "central") >= 40 ? 4 : 0);
  n.readiness = clampTo(n.readiness + add, 0, 100);
  if (n.readiness >= 80) enter(gw, "USA", "entente", "america_entered");
}

function ownFront(gw: GreatWar, n: GwNationState): GwTheatre | null {
  const list = GW_AI_MAIN[n.tag] ?? [];
  return (
    list.find((t) => {
      const th = gw.s.theatres.find((x) => x.id === t)!;
      return th.open && membersOf(gw, t, n.side!).includes(n.tag);
    }) ?? null
  );
}

/** Whether this character attacks now, with what it knows of itself. */
function wantsAttack(gw: GreatWar, n: GwNationState, t: GwTheatre): boolean {
  const s = gw.s;
  if (n.gauges.shells === 0) return false;
  if (n.gauges.morale <= 1) return false;
  const age = s.chapter - (s.warChapter ?? s.chapter);
  // The doctrines of August: everyone attacks at first.
  if (age <= 2 && (n.tag === "FRA" || n.tag === "RUS")) return true;
  if (n.tag === "BEL" || n.tag === "MNE") return false;
  const roll = wwRoll(s.seed, P_AI_MOVE, s.chapter, s.nations.indexOf(n)) % 100;
  const score = warScore(gw, n.side!);
  const base = { hardline: 70, opportunist: 45, principled: 40, cautious: 25 }[n.ai];
  const up = GW_FRONT_UP[t] === n.side;
  return roll < base + (score < 0 ? 10 : 0) + (up ? 0 : 5);
}

function aiAlloc(gw: GreatWar, n: GwNationState): GwAlloc | null {
  const main = ownFront(gw, n);
  if (main === null) return null;
  const attack = wantsAttack(gw, n, main);
  const major = attack && n.gauges.shells >= 2 && n.ai !== "cautious";
  return {
    main,
    posture: attack ? "offensive" : "hold",
    scale: major ? "major" : "limited",
    allyShare: 0,
    research: n.tag === "GBR" ? "sea" : "artillery",
  };
}

function history(gw: GreatWar, i: number): boolean {
  return wwRoll(gw.s.seed, P_HISTORY, i) % 100 < HISTORY_PCT;
}

/** What the AI does when the history rail is on: the theatre the war had. */
function historyMain(gw: GreatWar, n: GwNationState): GwTheatre | null {
  const age = gw.s.chapter - (gw.s.warChapter ?? gw.s.chapter);
  if (n.tag === "AUH" && age <= 1) return "balkan";
  if (n.tag === "OTT") return "caucasus";
  return null;
}

/** Chapter step: AI countries plan the coming chapter and neutrals decide. */
export function aiStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.warChapter === null) return;
  britainStep(gw);
  americaStep(gw);
  for (const e of GW_ENTRIES) neutralStep(gw, e);
  s.nations.forEach((n, i) => {
    if (!fights(n) || seatsOf(gw, n.tag).length > 0) return;
    n.alloc = aiAlloc(gw, n);
    if (n.alloc !== null && history(gw, i + s.chapter * 16)) {
      const main = historyMain(gw, n);
      if (main !== null && membersOf(gw, main, n.side!).includes(n.tag)) {
        n.alloc.main = main;
      }
    }
  });
  peaceFeelers(gw);
  worstOff(gw);
}

/** Beaten countries leave: their capital's line fell, or the front held none. */
function worstOff(gw: GreatWar): void {
  const west = gw.s.theatres.find((t) => t.id === "west")!;
  if (west.open && west.line >= 6) leaveWar(gw, "FRA", "nation_beaten");
  const east = gw.s.theatres.find((t) => t.id === "east")!;
  if (east.open && east.line >= 6) leaveWar(gw, "RUS", "nation_beaten");
}

/** Late in a hard war, a quiet offer comes: the way out is always shown. */
function peaceFeelers(gw: GreatWar): void {
  const s = gw.s;
  if (s.warChapter === null) return;
  const age = s.chapter - s.warChapter;
  if (age < 3 || age % 6 !== 3) return;
  for (const seat of s.seats) {
    const side = gw.nation(seat.tag)?.side ?? null;
    if (side === null) continue;
    seat.scheduled.push({ scene: "gw_peace_feeler", chapter: s.chapter + 1 });
  }
}
