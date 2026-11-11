import {
  GW_FRONT_UP,
  GW_TEMP_MAX,
  GW_TOPICS,
  GwChainOutcome,
  GwSeatState,
  GwTheatre,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { ladderTargets, sendNote } from "./Ladder";
import { notedLately } from "./PairWar";
import { GW_MOBILISE, GW_NOTE_FLAGS, GW_PLAN_FLAGS } from "./Tables";
import { GW_GREAT, openWar } from "./Wars";
import {
  clampTo,
  isLongChapter,
  news,
  reason,
  ruledBySeat,
  seatsOf,
  turn,
} from "./World";

const P_CRISIS = idHash("gw_crisis");
const P_SPARK = idHash("gw_spark");

/** July's links, one a chapter. Scenes read them with world cond `chain`. */
export const GW_LINKS = [
  "shot",
  "vienna",
  "draft",
  "ultimatum",
  "local_war",
  "general",
] as const;
/** Links whose news names Serbia. */
const FAR_LINKS: readonly string[] = ["ultimatum", "local_war"];
/** A later spark runs the end of the same ladder. */
export const GW_SHORT_START = 3;

/** The delayed visit's shot: Vienna's week is one short, July keeps its days. */
const DELAYED_START = 2;

/** Vienna's seat has signed the war on Serbia (auh_c_war_serbia). */
const AUH_DECLARED = "f_auh_declared";
/** Vienna's seat has broken with Belgrade, or gone further. */
const AUH_GOING = [AUH_DECLARED, "f_auh_broke_off"];

/** Temperature a crisis needs to go on at its last two links. */
export const LOCAL_WAR_AT = 5;
const GENERAL_WAR_AT = 6;

/** Times mobilisation can be put off before the world stops waiting. */
const PUT_OFF_LIMIT = 2;
/** The fronts a side that mobilised first gains a step on. */
const FIRST_MOVER_FRONTS: readonly GwTheatre[] = ["west", "east"];

/** A topic's pressure that lights a crisis by itself. */
const SPARK_AT = 9;
/** The questions the powers would go to war over. */
const SPARK_TOPICS: readonly GwTopic[] = ["straits", "colonial", "balkan"];

/**
 * Who sends whom the note a later spark ends in (ww176), sender first, in
 * order of preference: the Balkan pair, the colonial rivals, the parties of
 * the Straits.
 */
const NOTE_PAIRS: Readonly<
  Partial<Record<GwTopic, readonly (readonly [GwTag, GwTag])[]>>
> = {
  balkan: [
    ["AUH", "SRB"],
    ["BGR", "SRB"],
    ["SRB", "BGR"],
  ],
  colonial: [
    ["DEU", "FRA"],
    ["FRA", "DEU"],
    ["DEU", "GBR"],
    ["GBR", "DEU"],
  ],
  straits: [
    ["RUS", "OTT"],
    ["OTT", "RUS"],
    ["GRC", "OTT"],
    ["OTT", "GRC"],
  ],
};

/** Calm crises in a row past the first that push the next spark a chapter on. */
const CALM_GAP_MAX = 3;

const TEMP_BY_OPENING = {
  sarajevo: 3,
  sarajevo_survived: 2,
  sarajevo_failed: 1,
  sarajevo_delayed: 3,
  no_sarajevo: 0,
} as const;

function heat(gw: GreatWar, delta: number): void {
  gw.s.temp = clampTo(gw.s.temp + delta, 0, GW_TEMP_MAX);
}

/** The opening's crisis, or the wait for a later spark. */
export function openFirstCrisis(gw: GreatWar): void {
  const s = gw.s;
  s.temp = TEMP_BY_OPENING[s.opening];
  if (s.opening === "no_sarajevo") {
    setSpark(gw, 6);
    return;
  }
  if (s.opening === "sarajevo_delayed") {
    // The shot comes two weeks late; the desk is quiet until then.
    s.spark = { topic: "balkan", chapter: 2 };
    return;
  }
  s.crisis = "balkan";
  s.chain = { topic: "balkan", step: 0, hold: 0, short: false };
}

/** A spark two to eight months on (design §2.6); `from` is the first chapter. */
function setSpark(gw: GreatWar, from: number): void {
  const s = gw.s;
  const n = s.chains.length;
  const topics = SPARK_TOPICS;
  const hottest = [...topics].sort((a, b) => s.pressure[b] - s.pressure[a]);
  const pick = wwRoll(s.seed, P_SPARK, n);
  // The world stays restless, but calm after calm lets the gap grow (ww176).
  let calm = 0;
  for (let i = n - 1; i >= 0 && s.chains[i].outcome !== "war"; i--) calm++;
  const later = Math.min(CALM_GAP_MAX, Math.max(0, calm - 1));
  s.spark = {
    topic: pick % 2 === 0 ? hottest[0] : topics[pick % 3],
    chapter: from + later + (wwRoll(s.seed, P_SPARK, n, 1) % 4),
  };
}

/**
 * How hot a later spark starts, read off the state (ww176), never off how
 * many crises came before: 2, and 1 each for the question long unsettled,
 * a great power's army fully on foot, and a great power in the streets.
 */
function sparkHeat(gw: GreatWar, topic: GwTopic): number {
  const s = gw.s;
  const great = s.nations.filter((n) => !n.out && GW_GREAT.includes(n.tag));
  let t = 2;
  if (s.pressure[topic] >= SPARK_AT) t++;
  if (great.some((n) => n.mob >= 2)) t++;
  if (great.some((n) => n.unrest >= 2)) t++;
  return t;
}

function light(gw: GreatWar, topic: GwTopic, short: boolean): void {
  const s = gw.s;
  s.spark = null;
  s.crisis = topic;
  s.chain = {
    topic,
    // A late shot skips Vienna's first week: the war still comes in summer.
    step: short ? GW_SHORT_START : DELAYED_START,
    hold: 0,
    short,
  };
  // July starts at 3; a later spark as hot as the world is (ww176).
  s.temp = Math.max(s.temp, short ? sparkHeat(gw, topic) : 3);
  news(gw, short ? `spark_${topic}` : "shot_fired");
  if (short) turn(gw, `spark_${topic}`);
}

/**
 * Closes the open crisis. Only `war` starts one. `quiet`: it closes into a
 * note (ww176), whose own news follows.
 */
export function closeChain(
  gw: GreatWar,
  outcome: GwChainOutcome,
  quiet = false,
): void {
  const s = gw.s;
  const c = s.chain;
  if (c === null) return;
  s.chains.push({ topic: c.topic, outcome, chapter: s.chapter });
  s.chain = null;
  s.crisis = null;
  if (!quiet) {
    news(gw, `crisis_${outcome}`);
    turn(gw, `crisis_${outcome}`);
  }
  if (outcome === "war") {
    openWar(gw);
    return;
  }
  // It cools, the grudge stays, and the next spark is on its way.
  s.temp = Math.floor(s.temp / 2);
  s.pressure[c.topic] += 2;
  setSpark(gw, s.chapter + 3);
}

/** How a character moves a crisis, by country; a seat moves it by its scenes. */
function moves(gw: GreatWar, link: number): number {
  const s = gw.s;
  const kind = (t: "AUH" | "RUS" | "GBR" | "FRA" | "DEU") =>
    ruledBySeat(gw, t) ? undefined : gw.nation(t)?.ai;
  let d = (wwRoll(s.seed, P_CRISIS, s.chapter) % 3) - 1;
  if (link === 1 && kind("AUH") === "hardline") d++;
  if (link === 1 && kind("AUH") === "cautious") d--;
  if (link === 2 && s.secrets.includes("srb_officers_plot")) d++;
  if (link === 3) d++;
  // A Berlin nobody plays writes the blank cheque unless it is afraid to.
  const berlin = kind("DEU");
  if (link === 2 && berlin !== undefined && berlin !== "cautious") d++;
  if (link === 5 && (berlin === "hardline" || berlin === "opportunist")) d++;
  // Vienna and Berlin both unplayed: nobody at the desk can hold them back.
  const vienna = kind("AUH");
  if (link === 4 && berlin !== undefined && vienna !== undefined) {
    if (vienna !== "cautious") d++;
  }
  if (link === 4 && kind("RUS") === "hardline") d++;
  if (link === 4 && kind("RUS") === "cautious") d--;
  if (link === 4 && kind("GBR") === "principled") d--;
  if (link === 5 && kind("FRA") === "hardline") d++;
  return d;
}

/** Petersburg keeps its own time: the hand on the table, the rails under it. */
function russiaStirs(gw: GreatWar, name: "draft" | "ultimatum"): void {
  const rus = gw.nation("RUS");
  // A Tsar at the desk signs for himself.
  if (rus === null || ruledBySeat(gw, "RUS")) return;
  const hard = rus.ai === "hardline";
  const rails = gw.s.secrets.includes("rus_rail_ahead");
  const stirs =
    name === "draft"
      ? hard && rails
      : hard || rails || gw.s.temp >= LOCAL_WAR_AT;
  if (stirs) rus.mob = Math.max(rus.mob, 1);
}

function runLink(gw: GreatWar): void {
  const s = gw.s;
  const c = s.chain!;
  const name = GW_LINKS[c.step];
  heat(gw, moves(gw, c.step));
  // Belgrade is in those two lines: another question has its own.
  const far = c.topic !== "balkan" && FAR_LINKS.includes(name);
  news(gw, far ? `link_${name}_far` : `link_${name}`);
  switch (name) {
    case "draft":
      russiaStirs(gw, name);
      break;
    case "ultimatum": {
      const auh = gw.nation("AUH");
      if (auh !== null) auh.mob = Math.max(auh.mob, 1);
      // A seat wrote July's note itself: its wording heats or cools the link
      // (that link only: a later spark has no Vienna note in it).
      for (const seat of c.short ? [] : s.seats) {
        for (const f of seat.flags) heat(gw, GW_NOTE_FLAGS[f] ?? 0);
      }
      russiaStirs(gw, name);
      break;
    }
    case "local_war": {
      if (s.aside) return closeChain(gw, "humiliation");
      // With Vienna at the desk its signature decides, not the temperature:
      // relations broken off, the declaration comes on next chapter's desk.
      // July's papers come once: a later spark runs on its temperature.
      const vienna = c.short ? undefined : seatsOf(gw, "AUH")[0];
      const going = AUH_GOING.some((f) => vienna?.flags.includes(f) === true);
      if (going) s.temp = Math.max(s.temp, LOCAL_WAR_AT);
      const held = vienna !== undefined && !going;
      if (held || s.temp < LOCAL_WAR_AT) return closeChain(gw, "compromise");
      const rus = gw.nation("RUS");
      if (rus !== null && !ruledBySeat(gw, "RUS")) {
        // What Russia really did: reports about it may say otherwise.
        const full = rus.ai === "hardline" || s.temp >= 7;
        rus.mob = Math.max(rus.mob, rus.ai === "cautious" ? 1 : full ? 2 : 1);
      }
      break;
    }
    case "general":
      if (s.aside) return closeChain(gw, "humiliation");
      if (c.short) return sparkNote(gw, c.topic);
      // Vienna never signed: there is no war for the others to join.
      if (seatsOf(gw, "AUH")[0]?.flags.includes(AUH_DECLARED) === false) {
        return closeChain(gw, "compromise");
      }
      return closeChain(gw, s.temp >= GENERAL_WAR_AT ? "war" : "compromise");
    default:
      break;
  }
  c.step++;
}

/**
 * A later spark's top link (ww176): hot enough, it ends in a note between the
 * topic's pair through the ladder (Ladder.sendNote), never in war itself. The
 * other side answers (a seat on its card), and war comes only if the note is
 * refused and the sender presses. An AI sends one note a year at most
 * (PairWar.notedLately); a seat's country sends only if no AI pair can.
 */
function sparkNote(gw: GreatWar, topic: GwTopic): void {
  const s = gw.s;
  if (s.temp < GENERAL_WAR_AT) return closeChain(gw, "compromise");
  const pairs = (NOTE_PAIRS[topic] ?? []).filter(
    ([from, to]) =>
      ladderTargets(gw, from).includes(to) &&
      (ruledBySeat(gw, from) || !notedLately(gw, from)),
  );
  const pair =
    pairs.find(([from]) => !ruledBySeat(gw, from)) ?? pairs[0] ?? null;
  if (pair === null) return closeChain(gw, "compromise");
  closeChain(gw, "compromise", true);
  sendNote(gw, pair[0], pair[1]);
  for (const seat of seatsOf(gw, pair[0])) reason(gw, seat, "ladder_sent");
}

/**
 * The day each mobilisation is first on the books, which a resumed game's
 * trains count from. Called as a chapter closes, for what its scenes ordered,
 * and as the next opens, for what the steps ordered on its date.
 */
export function stampMobilisation(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    if (n.mob >= 1) n.mobFrom ??= gw.s.day;
    if (n.mob >= 2) n.mobFull ??= gw.s.day;
  }
}

/** Scenes sign by flag: to the world that is the plan and the mobilisation. */
function readSignatures(gw: GreatWar): void {
  const s = gw.s;
  for (const seat of s.seats) {
    for (const flag of seat.flags) {
      const plan = GW_PLAN_FLAGS[flag];
      if (plan === undefined) continue;
      s.plan ??= plan;
      const n = gw.nation(seat.tag);
      if (n !== null) n.mob = 2;
    }
  }
}

function timesPutOff(seat: GwSeatState): number {
  const m = GW_MOBILISE[seat.tag];
  if (m === undefined) return 0;
  return seat.choices.filter((c) => c.scene === m.scene && c.pick === m.wait)
    .length;
}

/**
 * Mobilisation put off twice (scene plan §1): nobody brings the paper a third
 * time. If the crisis is still hot, France and Russia move first; no plan was
 * ever signed, so the seat's army waits at the frontier a step behind and
 * Belgium is left alone. If it has cooled, the waiting was the answer.
 */
function stopWaiting(gw: GreatWar, seat: GwSeatState): void {
  const s = gw.s;
  if (s.temp < GENERAL_WAR_AT) {
    turn(gw, "mob_waited_out");
    reason(gw, seat, "mob_waited_out");
    closeChain(gw, "compromise");
    return;
  }
  const row = GW_MOBILISE[seat.tag]!;
  for (const tag of row.first) {
    const n = gw.nation(tag);
    if (n !== null) n.mob = 2;
  }
  if (seat.tag === "DEU") s.plan = "wait";
  news(gw, row.news);
  turn(gw, row.news);
  reason(gw, seat, "mob_late_war");
  closeChain(gw, "war");
  const side = gw.nation(seat.tag)?.side ?? null;
  for (const t of s.theatres) {
    if (!t.open || !FIRST_MOVER_FRONTS.includes(t.id)) continue;
    const back = GW_FRONT_UP[t.id] === side ? -1 : 1;
    t.progress = clampTo(t.progress + back, -2, 2);
  }
}

/** Chapter step: pressure climbs, sparks light, the open crisis takes a link. */
export function crisisStep(gw: GreatWar): void {
  const s = gw.s;
  readSignatures(gw);
  if (s.warChapter !== null) return;
  if (isLongChapter(gw)) {
    for (const t of GW_TOPICS) s.pressure[t]++;
  }
  if (s.chain !== null) {
    // July's mobilisation papers only: a later spark ends in a note.
    const waited =
      s.plan === null && !s.chain.short
        ? s.seats.find((x) => timesPutOff(x) >= PUT_OFF_LIMIT)
        : undefined;
    if (waited !== undefined) {
      stopWaiting(gw, waited);
      return;
    }
    if (s.chain.hold > 0) {
      s.chain.hold--;
      return;
    }
    runLink(gw);
    return;
  }
  const next = s.chapter + 1;
  if (s.spark !== null && s.spark.chapter <= next) {
    light(gw, s.spark.topic, s.opening !== "sarajevo_delayed");
    return;
  }
  const over = SPARK_TOPICS.find((t) => s.pressure[t] >= SPARK_AT);
  if (over !== undefined && s.spark === null) light(gw, over, true);
}
