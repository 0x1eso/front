import {
  GW_FRONT_START,
  GW_FRONT_UP,
  GwAlloc,
  GwNationState,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { aiResearch, pairScore, pressOdds, warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { aiOffensive } from "./Offensives";
import { peaceStep } from "./Peace";
import { bondOf } from "./PeaceYears";
import { AMERICA_BAR, americaCan } from "./Sea";
import { believedStrain } from "./Spies";
import {
  easeStrain,
  endStrain,
  NEW_ARMIES_EASE,
  STRAIN_WORN,
  worstStrain,
} from "./Strain";
import { GW_AI_MAIN, GW_ENTRIES, GW_ENTRY_BAR, GwEntry } from "./Tables";
import { brokenWords, treatyBars } from "./Treaties";
import { declareWar, enter, memberEnd, membersOf } from "./Wars";
import {
  clampTo,
  everyMonths,
  fights,
  other,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_AI_MOVE = idHash("gw_ai_move");
const P_OFFER = idHash("gw_ai_offer");

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
  // A side whose heads of state break treaties pays for it (design §9).
  central -= brokenWords(gw, "central") * 10;
  entente -= brokenWords(gw, "entente") * 10;
  const pick = central > entente ? "central" : "entente";
  return treatyBars(gw, n.tag, pick) ? other(pick) : pick;
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

/** Readiness a neutral needs to come in: its character's bar and its own. */
export const entryBar = (n: GwNationState, e: GwEntry): number =>
  GW_ENTRY_BAR[n.ai] + e.holds;

/** A seat is asked its price when a neutral it could buy comes near. */
function askSeats(gw: GreatWar, e: GwEntry, n: GwNationState): void {
  const s = gw.s;
  const near = n.readiness + 4 * 12 + 20 >= entryBar(n, e);
  if (!near || !everyMonths(gw, 5, 1)) return;
  for (const seat of s.seats) {
    const side = gw.nation(seat.tag)?.side ?? null;
    if (side === null || (n.offers[side] ?? 0) >= e.offers[side]) continue;
    if (seat.scheduled.some((q) => q.scene === e.scene)) continue;
    seat.scheduled.push({ scene: e.scene, chapter: s.chapter + 1 });
  }
}

/**
 * A neutral comes in when the war has made it ready (ww171: no date). Its
 * readiness grows with the war's pressure, the going price and a side going
 * forward where it watches; its bar is its character's and its own `holds`.
 */
function neutralStep(gw: GreatWar, e: GwEntry): void {
  const n = gw.nation(e.tag);
  if (n === null || n.side !== null || n.out || ruledBySeat(gw, e.tag)) return;
  const bold = n.ai === "hardline" ? 3 : n.ai === "cautious" ? 0 : 1;
  // Nobody sits out for nothing: the war's pressure and the going price add up.
  n.readiness = clampTo(
    n.readiness + bold + (winning(gw) !== null ? 1 : 0) + momentum(gw, e),
    0,
    100,
  );
  bids(gw, e, n);
  askSeats(gw, e, n);
  const side = neutralChoice(gw, n, e);
  const price = n.offers[side] ?? 0;
  if (n.readiness + price * 12 < entryBar(n, e)) return;
  enter(gw, e.tag, side, "entered_war");
  if (n.side !== null) reasonAll(gw, e.tag, "neutral_joined");
}

/** Every seat hears why a neutral came in: the line names it. */
function reasonAll(gw: GreatWar, tag: GwNationState["tag"], key: string): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null) continue;
    seat.log.push({ key, chapter: gw.s.chapter, tag });
  }
}

/**
 * Britain: the 1839 guarantee decides it when Belgium is attacked, or the
 * pressure of France in danger does. Against a coalition's member Britain
 * joins the other; against a war of Belgium's own it declares on the attacker.
 */
function britainStep(gw: GreatWar): void {
  const s = gw.s;
  const n = gw.nation("GBR");
  if (n === null || n.side !== null || n.out || ruledBySeat(gw, "GBR")) return;
  const bel = gw.nation("BEL");
  const attacker = bel === null || bel.out ? undefined : bel.atWar[0];
  const belgium = attacker !== undefined;
  if (!belgium && s.warChapter === null) return;
  const west = s.theatres.find((t) => t.id === "west")!;
  const add = belgium ? 40 + n.lean * 20 : 6 + n.lean * 4;
  const france = west.line >= 4 ? 25 : 0;
  // ww190: the Entente's bond, five a step either way.
  const entente = 5 * (bondOf(gw, "FRA", "GBR") ?? 0);
  n.readiness = clampTo(n.readiness + add + france + entente, 0, 100);
  if (s.secrets.includes("anglo_russian_naval_talks")) n.readiness += 5;
  const bar = belgium ? 40 : n.ai === "principled" ? 90 : 70;
  if (n.readiness < bar) return;
  const foe = belgium ? gw.nation(attacker!) : null;
  if (foe === null || foe.side === "central") {
    enter(gw, "GBR", "entente", "britain_entered");
  } else {
    declareWar(gw, "GBR", foe.tag, "treaty");
  }
}

function americaEnters(gw: GreatWar): void {
  const n = gw.nation("USA");
  if (n === null || n.side !== null || n.out || ruledBySeat(gw, "USA")) return;
  if (!americaCan(gw) || n.readiness < AMERICA_BAR) return;
  enter(gw, "USA", "entente", "america_entered");
  easeStrain(gw, "west", "entente", -NEW_ARMIES_EASE);
}

/** Russians past the frontier: no German staff leaves that alone. */
function russiansOnGermanSoil(gw: GreatWar, n: GwNationState): boolean {
  if (n.tag !== "DEU") return false;
  const east = gw.s.theatres.find((t) => t.id === "east")!;
  return east.open && east.line < GW_FRONT_START.east;
}

/**
 * A seat sends corps east by a signed paper (GW_WAR_ORDERS); a Germany nobody
 * plays does it by itself, a band a chapter, while the west can spare one.
 */
function corpsEast(gw: GreatWar): void {
  const n = gw.nation("DEU");
  if (n === null || !fights(n) || ruledBySeat(gw, "DEU")) return;
  if (!russiansOnGermanSoil(gw, n)) return;
  if ((n.base.west ?? 0) <= CORPS_WEST_KEEPS) return;
  if ((n.base.east ?? 0) >= CORPS_EAST_WANTS) return;
  for (const [t, step] of [
    ["west", -1],
    ["east", 1],
  ] as const) {
    n.base[t] = clampTo((n.base[t] ?? 1) + step, 1, 5);
    n.strength[t] = clampTo((n.strength[t] ?? 1) + step, 1, 5);
  }
}

/** Where it can do most: the first of its list that would answer a push. */
function ownFront(gw: GreatWar, n: GwNationState): GwTheatre | null {
  const list = (GW_AI_MAIN[n.tag] ?? []).filter((t) => {
    const th = gw.s.theatres.find((x) => x.id === t)!;
    return th.open && memberEnd(gw, t, n.tag) !== null;
  });
  if (list.length === 0) return null;
  // The first weeks run on the plan drawn up in peace.
  const age = gw.s.chapter - (gw.s.warChapter ?? gw.s.chapter);
  const plan = gw.s.plan;
  if (n.tag === "DEU" && age <= 3 && (plan === "west" || plan === "east")) {
    if (list.includes(plan)) return plan;
  }
  if (russiansOnGermanSoil(gw, n) && list.includes("east")) return "east";
  const best = list
    .map((t, i) => ({
      t,
      odds: pressOdds(gw, t, memberEnd(gw, t, n.tag)!) - i * 15,
    }))
    .sort((a, b) => b.odds - a.odds)[0];
  return best.t;
}

/** What a Germany nobody plays leaves in the west, and wants in the east. */
const CORPS_WEST_KEEPS = 4;
const CORPS_EAST_WANTS = 4;

/** Odds under which this character will not send men forward. */
const ATTACK_FLOOR = {
  hardline: 70,
  opportunist: 90,
  principled: 85,
  cautious: 105,
} as const;

/** Odds under which even a push on a believed-worn enemy is called off. */
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
  if (russiansOnGermanSoil(gw, n)) return true;
  if (n.tag === "BEL" || n.tag === "MNE") return false;
  // A great push wants time to count what it cost.
  const rested = s.chapter - n.spent;
  if (rested <= 1 && n.ai !== "hardline") return false;
  const roll = wwRoll(s.seed, P_AI_MOVE, s.chapter, s.nations.indexOf(n)) % 100;
  const end = memberEnd(gw, t, n.tag);
  if (end === null) return false;
  // A worn army holds: its staff knows what its own men can take (ww173).
  const th = gw.s.theatres.find((x) => x.id === t)!;
  if (endStrain(th, end) >= STRAIN_WORN) return false;
  const odds = pressOdds(gw, t, end);
  // An enemy its reports call worn is worth a push (S7c's reports; they can
  // be wrong).
  const foeLead = membersOf(gw, t, other(end))[0];
  const believed =
    foeLead === undefined ? null : believedStrain(gw, n.tag, t, foeLead);
  if (believed !== null && believed >= STRAIN_WORN && odds >= CAMPAIGN_FLOOR) {
    return roll < 70;
  }
  // The year's great attack is a great offensive now, prepared (ww173).
  if (odds < ATTACK_FLOOR[n.ai]) return false;
  // A war of its own is weighed on its own fronts (ww171).
  const foe = gw.s.theatres.find((x) => x.id === t)!;
  const rival = foe.attacker === n.tag ? foe.defender : foe.attacker;
  const score =
    n.side !== null
      ? warScore(gw, n.side)
      : rival === null
        ? 0
        : pairScore(gw, n.tag, rival);
  const base = { hardline: 70, opportunist: 45, principled: 40, cautious: 25 }[
    n.ai
  ];
  const up = GW_FRONT_UP[t] === end;
  return roll < base + (score < 0 ? 10 : 0) + (up ? 0 : 5);
}

function aiAlloc(gw: GreatWar, n: GwNationState): GwAlloc | null {
  const main = ownFront(gw, n);
  if (main === null) return null;
  const great = aiOffensive(gw, n, main, aiResearch(gw, n.tag));
  if (great !== null) return great;
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

/**
 * Chapter step: AI countries plan the coming chapter and neutrals decide. No
 * history rail (ww171): every staff picks its front by its own odds. A war of
 * a pair's own is planned for before the general war too.
 */
export function aiStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice !== null) return;
  britainStep(gw);
  if (s.warChapter !== null) {
    seatEntry(gw);
    americaEnters(gw);
    corpsEast(gw);
    for (const e of GW_ENTRIES) neutralStep(gw, e);
  }
  for (const n of s.nations) {
    if (!fights(n) || ruledBySeat(gw, n.tag)) continue;
    n.alloc = aiAlloc(gw, n);
  }
  if (s.warChapter === null) return;
  wornAsk(gw);
  peaceFeelers(gw);
  peaceStep(gw);
}

/**
 * A staff whose own front is worn asks its friends for men (ww173 §3): a
 * friend nobody plays, fresh itself and not attacking, sends some; a seat
 * on its side hears the ask, every few months.
 */
function wornAsk(gw: GreatWar): void {
  const s = gw.s;
  for (const n of s.nations) {
    if (!fights(n) || n.side === null || ruledBySeat(gw, n.tag)) continue;
    if (worstStrain(gw, n.tag) < STRAIN_WORN) continue;
    for (const f of s.nations) {
      if (f === n || !fights(f) || f.side !== n.side) continue;
      if (ruledBySeat(gw, f.tag)) {
        if (!everyMonths(gw, 3, 1)) continue;
        for (const seat of seatsOf(gw, f.tag)) {
          const same = seat.log.some(
            (l) => l.key === "ally_worn_asks" && l.chapter === s.chapter,
          );
          if (!same) {
            seat.log.push({
              key: "ally_worn_asks",
              chapter: s.chapter,
              tag: n.tag,
            });
          }
        }
        continue;
      }
      const a = f.alloc;
      if (a === null || a.posture !== "hold") continue;
      if (worstStrain(gw, f.tag) >= STRAIN_WORN / 2) continue;
      f.alloc = { ...a, allyShare: 1 };
    }
  }
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
    if (asked !== undefined && s.chapter - asked < GW_ENTRY_ASKS_EVERY)
      continue;
    const belgium = gw.nation("BEL")?.side === "entente";
    const west = s.theatres.find((t) => t.id === "west")!;
    if (belgium || west.line >= 3 || everyMonths(gw, 4, 1)) {
      seat.scheduled.push({ scene: "gw_gbr_entry", chapter: s.chapter + 1 });
    }
  }
}
