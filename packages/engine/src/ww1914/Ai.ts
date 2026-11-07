import {
  GW_FRONT_UP,
  GwAlloc,
  GwNationState,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { aiResearch, pressOdds, warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { peaceStep } from "./Peace";
import { AMERICA_BAR, americaCan } from "./Sea";
import { GW_AI_MAIN, GW_ENTRIES, GW_ENTRY_BAR, GwEntry } from "./Tables";
import { enter, membersOf } from "./Wars";
import { clampTo, everyMonths, fights, seatsOf } from "./World";

const P_AI_MOVE = idHash("gw_ai_move");
const P_HISTORY = idHash("gw_ai_history");
const P_OFFER = idHash("gw_ai_offer");

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
export function neutralChoice(
  gw: GreatWar,
  n: GwNationState,
  e: GwEntry,
): GwSide {
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

/** A side going forward where a neutral is watching draws it in. */
function momentum(gw: GreatWar, e: GwEntry): number {
  const b = gw.s.battles.filter(
    (x) => x.theatre === e.watches && x.chapter === gw.s.chapter,
  );
  return b.some((x) => x.result === "break" || x.result === "advance") ? 3 : 0;
}

/**
 * The sides bid. A government nobody plays raises its price to what it can
 * honestly give when the neutral comes up for it; a seat does it in a scene.
 */
function bids(gw: GreatWar, e: GwEntry, n: GwNationState): void {
  const s = gw.s;
  for (const side of ["central", "entente"] as const) {
    const leader = gw.s.seats.some((x) => gw.nation(x.tag)?.side === side);
    if (leader) continue;
    const held = n.offers[side] ?? 0;
    if (held >= e.offers[side]) continue;
    const i = s.nations.indexOf(n);
    if (
      wwRoll(s.seed, P_OFFER, s.chapter, i, side === "central" ? 1 : 2) % 100 <
      18
    ) {
      n.offers[side] = held + 1;
    }
  }
}

/** A seat is asked its price when a neutral it could buy comes up. */
function askSeats(gw: GreatWar, e: GwEntry, n: GwNationState): void {
  const s = gw.s;
  if (s.day < dayOf(e.earliest) - 120 || !everyMonths(gw, 5, 1)) return;
  for (const seat of s.seats) {
    const side = gw.nation(seat.tag)?.side ?? null;
    if (side === null || (n.offers[side] ?? 0) >= e.offers[side]) continue;
    if (seat.scheduled.some((q) => q.scene === e.scene)) continue;
    seat.scheduled.push({ scene: e.scene, chapter: s.chapter + 1 });
  }
}

function neutralStep(gw: GreatWar, e: GwEntry): void {
  const s = gw.s;
  const n = gw.nation(e.tag);
  if (n === null || n.side !== null || seatsOf(gw, e.tag).length > 0) return;
  const late = s.day >= dayOf(e.earliest);
  const bold = n.ai === "hardline" ? 3 : n.ai === "cautious" ? 0 : 1;
  // Nobody sits out for nothing: the war's pressure and the going price add up.
  n.readiness = clampTo(
    n.readiness + bold + (winning(gw) !== null ? 1 : 0) + momentum(gw, e),
    0,
    100,
  );
  bids(gw, e, n);
  askSeats(gw, e, n);
  if (!late) return;
  const side = neutralChoice(gw, n, e);
  const price = n.offers[side] ?? 0;
  if (n.readiness + price * 12 < GW_ENTRY_BAR[n.ai]) return;
  enter(gw, e.tag, side, "entered_war");
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

function americaEnters(gw: GreatWar): void {
  const n = gw.nation("USA");
  if (n === null || n.side !== null || seatsOf(gw, "USA").length > 0) return;
  if (!americaCan(gw) || n.readiness < AMERICA_BAR) return;
  enter(gw, "USA", "entente", "america_entered");
}

/** Where it can do most: the first of its list that would answer a push. */
function ownFront(gw: GreatWar, n: GwNationState): GwTheatre | null {
  const list = (GW_AI_MAIN[n.tag] ?? []).filter((t) => {
    const th = gw.s.theatres.find((x) => x.id === t)!;
    return th.open && membersOf(gw, t, n.side!).includes(n.tag);
  });
  if (list.length === 0) return null;
  // The first weeks run on the plan drawn up in peace.
  const age = gw.s.chapter - (gw.s.warChapter ?? gw.s.chapter);
  const plan = gw.s.plan;
  if (n.tag === "DEU" && age <= 3 && (plan === "west" || plan === "east")) {
    if (list.includes(plan)) return plan;
  }
  const best = list
    .map((t, i) => ({ t, odds: pressOdds(gw, t, n.side!) - i * 15 }))
    .sort((a, b) => b.odds - a.odds)[0];
  return best.t;
}

/** Odds under which this character will not send men forward. */
const ATTACK_FLOOR = {
  hardline: 70,
  opportunist: 90,
  principled: 85,
  cautious: 105,
} as const;

/** Chapters between a staff's great attacks, by character. */
const CAMPAIGN_REST = {
  hardline: 3,
  opportunist: 4,
  principled: 5,
  cautious: 7,
} as const;
/** Odds under which even the year's attack is called off. */
const CAMPAIGN_FLOOR = 45;

/** Whether this character attacks now, with what it knows of itself. */
function wantsAttack(gw: GreatWar, n: GwNationState, t: GwTheatre): boolean {
  const s = gw.s;
  if (n.gauges.shells === 0) return false;
  if (n.gauges.morale <= 1) return false;
  const age = s.chapter - (s.warChapter ?? s.chapter);
  // The doctrines of August: everyone attacks at first.
  const doctrine: readonly GwTag[] = ["FRA", "RUS", "DEU", "AUH"];
  if (age <= 3 && doctrine.includes(n.tag)) return true;
  if (n.tag === "BEL" || n.tag === "MNE") return false;
  // A great push wants time to count what it cost.
  const rested = s.chapter - n.spent;
  if (rested <= 1 && n.ai !== "hardline") return false;
  const roll = wwRoll(s.seed, P_AI_MOVE, s.chapter, s.nations.indexOf(n)) % 100;
  const odds = pressOdds(gw, t, n.side!);
  // Every staff has its season: bad odds don't stop the year's great attack.
  if (rested >= CAMPAIGN_REST[n.ai] && odds >= CAMPAIGN_FLOOR && roll < 55) {
    return true;
  }
  if (odds < ATTACK_FLOOR[n.ai]) return false;
  const score = warScore(gw, n.side!);
  const base = { hardline: 70, opportunist: 45, principled: 40, cautious: 25 }[
    n.ai
  ];
  const up = GW_FRONT_UP[t] === n.side;
  return roll < base + (score < 0 ? 10 : 0) + (up ? 0 : 5);
}

function aiAlloc(gw: GreatWar, n: GwNationState): GwAlloc | null {
  const main = ownFront(gw, n);
  if (main === null) return null;
  const attack = wantsAttack(gw, n, main);
  const major = attack && n.gauges.shells >= 2;
  return {
    main,
    posture: attack ? "offensive" : "hold",
    scale: major ? "major" : "limited",
    allyShare: 0,
    research: aiResearch(gw, n.tag),
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
  if (s.armistice !== null) return;
  britainStep(gw);
  seatEntry(gw);
  americaEnters(gw);
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
  peaceStep(gw);
}

/** Late in a hard war, a quiet offer comes: the way out is always shown. */
function peaceFeelers(gw: GreatWar): void {
  const s = gw.s;
  if (!everyMonths(gw, 6, 3)) return;
  for (const seat of s.seats) {
    const n = gw.nation(seat.tag);
    if (n === null || !fights(n)) continue;
    seat.scheduled.push({ scene: "gw_peace_feeler", chapter: s.chapter + 1 });
  }
}

/** Chapters before a cabinet that put the vote off is asked again. */
const GW_ENTRY_ASKS_EVERY = 4;

/** The world's call on a seat's way in: Britain's cabinet, for one. */
export function seatEntry(gw: GreatWar): void {
  const s = gw.s;
  for (const seat of seatsOf(gw, "GBR")) {
    const n = gw.nation("GBR");
    if (n === null || n.side !== null) continue;
    if (seat.scheduled.some((q) => q.scene === "gw_gbr_entry")) continue;
    // A put-off vote comes back in months, not by every post.
    const asked = seat.seen.gw_gbr_entry;
    if (asked !== undefined && s.chapter - asked < GW_ENTRY_ASKS_EVERY) continue;
    const belgium = gw.nation("BEL")?.side === "entente";
    const west = s.theatres.find((t) => t.id === "west")!;
    if (belgium || west.line >= 3 || everyMonths(gw, 4, 1)) {
      seat.scheduled.push({ scene: "gw_gbr_entry", chapter: s.chapter + 1 });
    }
  }
}
