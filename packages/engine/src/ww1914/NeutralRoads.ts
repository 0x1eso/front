// Great War 1914 (ww220 §5 R5-R8, decisions 3B and 5B): the small powers'
// reasons, America's other roads, and Austria-Hungary's own peace.
//
// - The neutrals weigh the war with reasons, not with history: Italy will not
//   fight the side that holds the Mediterranean, and the Triple Alliance
//   counts only while Vienna offers the Trentino; the Ottomans weigh Russia's
//   side, the dreadnoughts Britain seized and the Goeben; Bulgaria weighs
//   Serbia's side, Romania Russia's, Japan the side with the main fleet.
// - America comes in early when a liner goes down in the war's first months
//   under a hard president; a neutral principled or cautious America offers
//   to broker a peace (the House mission); the Central side only when the
//   blockade takes everything and Berlin has its friendship.
// - An AI Karl, his war lost and his lands restless, offers France or Italy a
//   peace of their own, once; Berlin answers with distrust and a watch on
//   Vienna.
import {
  GW_SEA_MAX,
  GwNationState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PAIR_OFFER } from "@openfront/engine-lib/ww1914/content/ladder";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { canSwitch, switchSide } from "./Alignment";
import { warMonths } from "./Eras";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { pairPeace, peaceWill } from "./PairWar";
import { armistice, judgesTalks, sideLead } from "./Peace";
import { bondOf } from "./PeaceYears";
import { AMERICA_BAR, americaCan, fleetAtWar } from "./Sea";
import { seaHold } from "./Seas";
import { easeStrain } from "./Strain";
import type { GwEntry, GwStartTreaty } from "./Tables";
import { atWarWith } from "./Wars";
import {
  clampTo,
  fights,
  isLongChapter,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_US_MEDIATE = idHash("gw_us_mediate");
const P_US_CENTRAL = idHash("gw_us_central");
const P_KARL = idHash("gw_karl_peace");
const P_KARL_ANSWER = idHash("gw_karl_answer");

// ---- The sea, as the neutrals read it ----

/**
 * The side with the main battle fleet while that fleet is at war: HF's
 * `blockaderOf` (Britain's coalition, else the bigger battle fleets of
 * ww221), not while Britain still makes up its mind (Sea.fleetAtWar).
 */
export function fleetSide(gw: GreatWar): GwSide | null {
  return fleetAtWar(gw);
}

/**
 * Who holds the Mediterranean: the French fleet with Britain out, Britain's
 * side with it in, the other side once the submarines have sunk enough
 * (Seas.seaHold "med"); null while neither of the two is at war.
 */
export function medHolder(gw: GreatWar): GwSide | null {
  const fra = gw.nation("FRA");
  const fleet =
    fleetSide(gw) ?? (fra !== null && fights(fra) ? fra.side : null);
  if (fleet === null) return null;
  // seaHold already reads the main fleet's side and ww221's fleets.
  return seaHold(gw, "med");
}

// ---- The neutrals' reasons (R5, R8) ----

/** Italy will not fight the side that holds its coasts. */
const MED_FEAR = 15;
/** The Triple Alliance counts this much while Vienna pays the Trentino. */
const TRENTINO_PULL = 15;
/** Vienna's price, in offer steps, that makes the Triple Alliance real. */
export const TRENTINO_PRICE = 3;
/** A neutral that will not stand beside its old enemy. */
const OLD_ENEMY = 8;
/** ww222 HM: Bulgaria's grudge against Serbia's side, lighter than Turkey's. */
const BGR_OLD_ENEMY = 4;
/** The dreadnoughts Britain took in August, and the Goeben. */
const SHIPS_SEIZED = 4;
const GOEBEN = 4;
/** Romania's fear of the Russian army over the Prut. */
const RUSSIAN_NEXT_DOOR = 5;
/** Japan goes with the fleet that rules the seas it trades on. */
const JAPAN_FLEET = 35;

const sideOf = (gw: GreatWar, tag: GwTag): GwSide | null => {
  const n = gw.nation(tag);
  return n !== null && fights(n) ? n.side : null;
};

/**
 * What a neutral's own reasons add to each side's price (Ai.neutralChoice);
 * every term reads the war as it stands, so a new camp moves them too.
 */
export function neutralTerms(
  gw: GreatWar,
  n: GwNationState,
  e: GwEntry,
): Record<GwSide, number> {
  const add: Record<GwSide, number> = { central: 0, entente: 0 };
  switch (e.tag) {
    case "ITA": {
      const hold = medHolder(gw);
      if (hold !== null) add[other(hold)] -= MED_FEAR;
      if ((n.offers.central ?? 0) >= TRENTINO_PRICE) {
        add.central += TRENTINO_PULL;
      }
      break;
    }
    case "OTT": {
      const rus = sideOf(gw, "RUS");
      if (rus !== null) add[rus] -= OLD_ENEMY;
      const gbr = sideOf(gw, "GBR");
      if (gbr !== null) add[other(gbr)] += SHIPS_SEIZED;
      const deu = sideOf(gw, "DEU");
      if (deu !== null) add[deu] += GOEBEN;
      break;
    }
    case "BGR": {
      const srb = sideOf(gw, "SRB");
      if (srb !== null) add[srb] -= BGR_OLD_ENEMY;
      break;
    }
    case "ROU": {
      const rus = sideOf(gw, "RUS");
      if (rus !== null) add[rus] += RUSSIAN_NEXT_DOOR;
      break;
    }
    case "JPN": {
      const fleet = fleetSide(gw);
      if (fleet !== null) add[fleet] += JAPAN_FLEET;
      break;
    }
  }
  return add;
}

/** What Italy's Triple Alliance is worth without the Trentino. */
const NO_TRENTINO = 20;

/**
 * Wars.honourPct's term for a June 1914 pact the neutrals read for
 * themselves: Italy's Triple Alliance (the Trentino, the sea), Romania's
 * pact with Vienna (Russia's army next door).
 */
export function treatyTerm(gw: GreatWar, row: GwStartTreaty): number {
  const n = gw.nation(row.by);
  const side = sideOf(gw, row.for);
  if (n === null) return 0;
  if (row.by === "ITA") {
    let d = (n.offers.central ?? 0) >= TRENTINO_PRICE ? 0 : -NO_TRENTINO;
    const hold = medHolder(gw);
    if (side !== null && hold !== null && hold !== side) d -= MED_FEAR;
    return d;
  }
  if (row.by === "ROU") {
    const rus = sideOf(gw, "RUS");
    return rus !== null && rus !== side ? -RUSSIAN_NEXT_DOOR : 0;
  }
  return 0;
}

// ---- America (R6) ----

/** Months of war within which a liner sunk makes a hard president move. */
const EARLY_LINER_MONTHS = 24;
/** Readiness a hard president gathers each month after it (preparedness). */
const EARLY_PUSH = 10;
/**
 * ww230: what a hard president after the early liner takes off America's bar
 * (before ww230 he needed 90, above the bar: America never came early).
 */
export const EARLY_EASE = 10;
/**
 * ww222 HM: the readiness America's war road needs, below Sea.AMERICA_BAR:
 * with ww221's fleets the submarine war comes later and rarer, and America
 * stayed out of two wars in three (ww220 §7: about two in five). ww230: 20,
 * with the liners of a restricted war on the road (Sea.americaCan).
 */
const US_BAR_EASE = 20;
/** With Britain in the Central Powers, fighting it costs this, and the bond. */
const AGAINST_BRITAIN = 10;
const BRITAIN_BOND = 5;
/** Berlin's friendship the Central road needs. */
const DEU_FRIEND = 2;
/** Odds in 100, each month the state allows it, of the Central road. */
const CENTRAL_ODDS = 10;
/** Months of war before Washington brokers, and between two offers. */
export const US_MEDIATE_FROM = 18;
const US_MEDIATE_EVERY = 4;
/** Odds in 100 that a month the state allows it brings the House mission. */
const US_MEDIATE_ODDS = 70;
/** The House missions a war sees at most (ww230: 4, from 3). */
const US_MEDIATE_MAX = 4;
/**
 * ww230: America's guarantee is worth one weariness to a lead weighing House's
 * terms (Peace.judgesTalks): more missions alone left the peace at 3% (§7: 6%).
 */
const US_GUARANTEE = 1;
/** Scheduled to every seat at war when America offers (common pack). */
export const GW_US_MEDIATION = "gw_us_mediation";
/** Seat flag: the seat took America's offer on its card. */
export const GW_US_MEDIATION_YES = "gw_us_mediation_yes";

/** A liner went down early in the war and the president is a hard man. */
export function americaEarly(gw: GreatWar): boolean {
  const usa = gw.nation("USA");
  if (usa === null || usa.ai !== "hardline") return false;
  return gw.s.news.some(
    (x) =>
      x.key === "liner_sunk" && warMonths(gw, x.chapter) < EARLY_LINER_MONTHS,
  );
}

/** America's bar to join the Entente: higher when that means fighting Britain. */
export function americaBar(gw: GreatWar): number {
  const bar = AMERICA_BAR - US_BAR_EASE;
  if (sideOf(gw, "GBR") !== "central") return bar;
  const bond = Math.max(0, bondOf(gw, "GBR", "USA") ?? 0);
  return bar + AGAINST_BRITAIN + BRITAIN_BOND * bond;
}

/**
 * The side America comes in on now, or null. The Entente's road: the
 * submarine war or the note (Sea.americaCan), or the early liner under a hard
 * president. The Central road: the blockade takes all goods and stops
 * American ships, no submarine war, and Berlin's friendship.
 */
export function americaSide(gw: GreatWar): GwSide | null {
  const s = gw.s;
  const n = gw.nation("USA");
  if (n === null) return null;
  const bar = americaBar(gw);
  const early = americaEarly(gw) && n.readiness >= bar - EARLY_EASE;
  if (early || (americaCan(gw) && n.readiness >= bar)) return "entente";
  const fleet = fleetSide(gw);
  const blockaded = fleet !== null && s.blockade >= GW_SEA_MAX && s.uboat === 0;
  if (
    fleet !== null &&
    blockaded &&
    (bondOf(gw, "DEU", "USA") ?? 0) >= DEU_FRIEND &&
    warMonths(gw) >= US_MEDIATE_FROM &&
    isLongChapter(gw) &&
    wwRoll(s.seed, P_US_CENTRAL, s.chapter) % 100 < CENTRAL_ODDS
  ) {
    // The side the blockade falls on: the Central Powers in June's camps.
    return other(fleet);
  }
  return null;
}

/** The hard president makes the case each month after the early liner. */
function americaPrepares(gw: GreatWar): void {
  const n = gw.nation("USA");
  if (n === null || n.side !== null || ruledBySeat(gw, "USA")) return;
  if (!isLongChapter(gw) || !americaEarly(gw)) return;
  n.readiness = clampTo(n.readiness + EARLY_PUSH, 0, 100);
}

/** Seats fighting in the coalitions' war, who get America's card. */
function warSeats(gw: GreatWar) {
  return gw.s.seats.filter((x) => {
    const n = gw.nation(x.tag);
    return x.memoir === null && !x.regent && n !== null && fights(n) && n.side;
  });
}

/** The last House mission, by chapter; null none. */
function lastMission(gw: GreatWar): number | null {
  let last: number | null = null;
  for (const x of gw.s.news) {
    if (x.key === "us_mediation_offer") last = x.chapter;
  }
  return last;
}

/** Will America broker now? A neutral that wants no part of it, by its state. */
function americaBrokers(gw: GreatWar): boolean {
  const s = gw.s;
  const usa = gw.nation("USA");
  if (usa === null || usa.side !== null || usa.out) return false;
  if (ruledBySeat(gw, "USA")) return false;
  if (usa.ai !== "principled" && usa.ai !== "cautious") return false;
  if (!isLongChapter(gw) || warMonths(gw) < US_MEDIATE_FROM) return false;
  if (sideLead(gw, "central") === null || sideLead(gw, "entente") === null) {
    return false;
  }
  const sent = s.news.filter((x) => x.key === "us_mediation_offer").length;
  if (sent >= US_MEDIATE_MAX) return false;
  const last = lastMission(gw);
  if (last !== null && warMonths(gw) - warMonths(gw, last) < US_MEDIATE_EVERY) {
    return false;
  }
  return wwRoll(s.seed, P_US_MEDIATE, s.chapter) % 100 < US_MEDIATE_ODDS;
}

/**
 * Both sides' answers: each lead nobody plays judges it as talks of peace
 * (Peace.judgesTalks), America's guarantee eases it; every seat at war must
 * have taken it on its card.
 */
function missionAnswered(gw: GreatWar): void {
  const seats = warSeats(gw);
  const seatsYes = seats.every((x) => x.flags.includes(GW_US_MEDIATION_YES));
  for (const seat of gw.s.seats) {
    seat.flags = seat.flags.filter((f) => f !== GW_US_MEDIATION_YES);
  }
  const leadsYes = (["central", "entente"] as const).every((side) => {
    const lead = sideLead(gw, side);
    return (
      lead === null ||
      ruledBySeat(gw, lead.tag) ||
      judgesTalks(gw, lead, US_GUARANTEE)
    );
  });
  if (seatsYes && leadsYes) {
    news(gw, "us_mediation_peace", "USA");
    for (const seat of seats) reason(gw, seat, "us_mediation_peace");
    armistice(gw, "compromise", null);
    return;
  }
  news(gw, "us_mediation_refused", "USA");
  for (const seat of seats) reason(gw, seat, "us_mediation_refused");
}

/**
 * The House mission: offered, then answered as the next chapter closes when a
 * seat has a card to sign; at once among governments nobody plays.
 */
function houseMission(gw: GreatWar): void {
  const s = gw.s;
  const last = lastMission(gw);
  if (last === s.chapter - 1 && warSeats(gw).length > 0) {
    missionAnswered(gw);
    return;
  }
  if (!americaBrokers(gw)) return;
  news(gw, "us_mediation_offer", "USA");
  const seats = warSeats(gw);
  if (seats.length === 0) {
    missionAnswered(gw);
    return;
  }
  for (const seat of seats) {
    seat.scheduled.push({ scene: GW_US_MEDIATION, chapter: s.chapter + 1 });
  }
}

// ---- Austria-Hungary's own peace (R7) ----

/** War score at or under which Karl's ministers call the war lost. */
const KARL_LOST = -20;
/** Odds in 100 each month the state allows it; the Sixtus copy adds more. */
const KARL_ODDS = 10;
const SIXTUS_ODDS = 15;
const KARL_STREETS = 10;
/** Berlin's trust after it learns of it. */
const BERLIN_DISTRUST = -3;
/** What the watch on Vienna costs Germany's main front. */
export const VIENNA_WATCH = 10;
/**
 * ww222 HM: odds in 1000 a long chapter that a Karl already out of the war
 * by his own peace goes over to the Entente (HA's switchSide; R7, ~1%).
 */
export const KARL_SWITCH_PER_MIL = 15;
const P_KARL_SWITCH = idHash("gw_karl_switch");
/** Who Karl writes to, in order: through Sixtus to Paris, else to Rome. */
const KARL_WRITES: readonly GwTag[] = ["FRA", "ITA"];

/** An AI France or Italy weighs Karl's letter, never by a coin alone. */
function takesKarl(gw: GreatWar, to: GwTag): boolean {
  const s = gw.s;
  const roll = wwRoll(s.seed, P_KARL_ANSWER, s.chapter, idHash(to)) % 100;
  if (to === "ITA") return peaceWill(gw, "ITA", "AUH") >= 40 || roll < 25;
  // Paris wants Vienna out; Rome's promised lands stand in the way.
  const ita = gw.nation("ITA");
  const rome = ita !== null && fights(ita) && ita.side === "entente";
  return roll < (rome ? 35 : 70);
}

/** The addressee of Karl's letter, or null. */
function karlWritesTo(gw: GreatWar): GwTag | null {
  return (
    KARL_WRITES.find((t) => {
      const n = gw.nation(t);
      return n !== null && fights(n) && atWarWith(gw, "AUH", t);
    }) ?? null
  );
}

/** Will an AI Karl write now? */
function karlWrites(gw: GreatWar): boolean {
  const s = gw.s;
  const auh = gw.nation("AUH");
  if (auh === null || !fights(auh) || auh.side === null) return false;
  if (ruledBySeat(gw, "AUH") || auh.regime !== "karl") return false;
  if (!isLongChapter(gw)) return false;
  if (s.news.some((x) => x.key === "karl_peace_offered")) return false;
  // ww222 HM: a new reign starts calm (Regimes: unrest 0), so the streets
  // only add to the odds; the war lost is what makes him write.
  if (warScore(gw, auh.side) > KARL_LOST) return false;
  const odds =
    KARL_ODDS +
    (auh.unrest >= 2 ? KARL_STREETS : 0) +
    (s.secrets.includes("auh_sixtus_copy") ? SIXTUS_ODDS : 0);
  return wwRoll(s.seed, P_KARL, s.chapter) % 100 < odds;
}

/** Germany learns of it: distrust, and a watch on Vienna. */
function berlinAnswers(gw: GreatWar): void {
  const deu = gw.nation("DEU");
  if (deu === null || !fights(deu) || deu.side === null) return;
  deu.trust.AUH = clampTo((deu.trust.AUH ?? 0) + BERLIN_DISTRUST, -3, 3);
  const main = (["east", "west"] as const).find((t) =>
    gw.s.theatres.some((x) => x.id === t && x.open),
  );
  if (main !== undefined) easeStrain(gw, main, deu.side, VIENNA_WATCH);
  news(gw, "vienna_watch", "DEU", "AUH");
  for (const seat of seatsOf(gw, "DEU")) reason(gw, seat, "vienna_watch");
}

/**
 * The rest of the coalition follows the addressee's yes: a government nobody
 * plays makes its peace with Vienna too; a seat gets the pair-peace card.
 */
function othersFollow(gw: GreatWar): void {
  const auh = gw.nation("AUH");
  if (auh === null) return;
  for (const foe of [...auh.atWar]) {
    if (ruledBySeat(gw, foe)) {
      if (gw.s.pairNotes.some((x) => x.from === "AUH" && x.to === foe)) {
        continue;
      }
      gw.s.pairNotes.push({
        from: "AUH",
        to: foe,
        kind: "peace",
        chapter: gw.s.chapter,
      });
      for (const seat of seatsOf(gw, foe)) {
        seat.scheduled.push({
          scene: GW_PAIR_OFFER,
          chapter: gw.s.chapter + 1,
        });
      }
      continue;
    }
    pairPeace(gw, "AUH", foe, "AUH", "karl_peace");
  }
}

/** Karl's letter came back yes: Vienna leaves the war, Berlin hears of it. */
function karlPeace(gw: GreatWar, to: GwTag): void {
  if (atWarWith(gw, "AUH", to)) pairPeace(gw, "AUH", to, "AUH", "karl_peace");
  othersFollow(gw);
  berlinAnswers(gw);
}

/**
 * After his own peace an AI Karl may, very rarely, go over to the Entente
 * through Alignment.switchSide, while Germany still fights and no seat that
 * stands in the Entente is left out of it.
 */
function karlSwitch(gw: GreatWar): void {
  const s = gw.s;
  const auh = gw.nation("AUH");
  const deu = gw.nation("DEU");
  if (auh === null || auh.side !== "central" || auh.atWar.length > 0) return;
  if (ruledBySeat(gw, "AUH") || auh.regime !== "karl") return;
  if (deu === null || !fights(deu) || deu.side !== "central") return;
  if (!isLongChapter(gw) || !canSwitch(gw, "AUH")) return;
  const seat = s.seats.some(
    (x) =>
      x.memoir === null && !x.regent && gw.nation(x.tag)?.side === "entente",
  );
  if (seat) return;
  if (wwRoll(s.seed, P_KARL_SWITCH, s.chapter) % 1000 >= KARL_SWITCH_PER_MIL) {
    return;
  }
  switchSide(gw, "AUH", "entente");
}

/**
 * Karl's own peace. He writes once; a seat answers on the pair-peace card
 * (PairWar), and its yes is read here the chapter after; a government
 * nobody plays answers at once.
 */
function karlStep(gw: GreatWar): void {
  const s = gw.s;
  const offered = s.news.find((x) => x.key === "karl_peace_offered");
  if (offered !== undefined) {
    // A seat's yes on its card made the pair peace; the rest follow it.
    const to = offered.b;
    const done = s.news.some(
      (x) =>
        x.key === "pair_peace" &&
        x.chapter >= offered.chapter &&
        x.a === "AUH" &&
        x.b === to,
    );
    const followed = s.news.some((x) => x.key === "vienna_watch");
    if (done && !followed && to !== null) {
      othersFollow(gw);
      berlinAnswers(gw);
    } else if (followed) {
      karlSwitch(gw);
    }
    return;
  }
  if (!karlWrites(gw)) return;
  const to = karlWritesTo(gw);
  if (to === null) return;
  news(gw, "karl_peace_offered", "AUH", to);
  if (ruledBySeat(gw, to)) {
    s.pairNotes.push({ from: "AUH", to, kind: "peace", chapter: s.chapter });
    for (const seat of seatsOf(gw, to)) {
      seat.scheduled.push({ scene: GW_PAIR_OFFER, chapter: s.chapter + 1 });
    }
    return;
  }
  if (takesKarl(gw, to)) karlPeace(gw, to);
  else news(gw, "karl_peace_refused", to, "AUH");
}

// ---- The step ----

/** Chapter step (appended to GW_CHAPTER_STEPS): America and Vienna. */
export function neutralRoadsStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.warChapter === null || s.armistice !== null) return;
  americaPrepares(gw);
  houseMission(gw);
  if (s.armistice !== null) return;
  karlStep(gw);
}
