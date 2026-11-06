import {
  GW_TEMP_MAX,
  GW_TOPICS,
  GwChainOutcome,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { openWar } from "./Wars";
import { clampTo, isLongChapter, news, turn } from "./World";

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
/** A later spark runs the end of the same ladder. */
export const GW_SHORT_START = 3;

/** Temperature a crisis needs to go on at its last two links. */
const LOCAL_WAR_AT = 5;
const GENERAL_WAR_AT = 6;

/** A topic's pressure that lights a crisis by itself. */
const SPARK_AT = 9;
/** The questions the powers would go to war over. */
const SPARK_TOPICS: readonly GwTopic[] = ["straits", "colonial", "balkan"];

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
  s.spark = {
    topic: pick % 2 === 0 ? hottest[0] : topics[pick % 3],
    chapter: from + (wwRoll(s.seed, P_SPARK, n, 1) % 4),
  };
}

function light(gw: GreatWar, topic: GwTopic, short: boolean): void {
  const s = gw.s;
  s.spark = null;
  s.crisis = topic;
  s.chain = {
    topic,
    // A late shot skips Vienna's first week: the war still comes in summer.
    step: short ? GW_SHORT_START : 1,
    hold: 0,
    short,
  };
  // Each crisis settled leaves the next one hotter.
  s.temp = Math.max(s.temp, short ? 3 + s.chains.length : 3);
  news(gw, short ? `spark_${topic}` : "shot_fired");
  turn(gw, `spark_${topic}`);
}

/** Closes the open crisis. Only `war` starts one. */
export function closeChain(gw: GreatWar, outcome: GwChainOutcome): void {
  const s = gw.s;
  const c = s.chain;
  if (c === null) return;
  s.chains.push({ topic: c.topic, outcome, chapter: s.chapter });
  s.chain = null;
  s.crisis = null;
  news(gw, `crisis_${outcome}`);
  turn(gw, `crisis_${outcome}`);
  if (outcome === "war") {
    openWar(gw);
    return;
  }
  // It cools, the grudge stays, and the next spark is on its way.
  s.temp = Math.floor(s.temp / 2);
  s.pressure[c.topic] += 2;
  setSpark(gw, s.chapter + 3);
}

/** How a character moves a crisis, by country. */
function moves(gw: GreatWar, link: number): number {
  const s = gw.s;
  const kind = (t: "AUH" | "RUS" | "GBR" | "FRA") => gw.nation(t)?.ai;
  let d = (wwRoll(s.seed, P_CRISIS, s.chapter) % 3) - 1;
  if (link === 1 && kind("AUH") === "hardline") d++;
  if (link === 1 && kind("AUH") === "cautious") d--;
  if (link === 2 && s.secrets.includes("srb_officers_plot")) d++;
  if (link === 3) d++;
  if (link === 4 && kind("RUS") === "hardline") d++;
  if (link === 4 && kind("RUS") === "cautious") d--;
  if (link === 4 && kind("GBR") === "principled") d--;
  if (link === 5 && kind("FRA") === "hardline") d++;
  return d;
}

function runLink(gw: GreatWar): void {
  const s = gw.s;
  const c = s.chain!;
  const name = GW_LINKS[c.step];
  heat(gw, moves(gw, c.step));
  news(gw, `link_${name}`);
  switch (name) {
    case "ultimatum": {
      const auh = gw.nation("AUH");
      if (auh !== null) auh.mob = Math.max(auh.mob, 1);
      break;
    }
    case "local_war": {
      if (s.aside) return closeChain(gw, "humiliation");
      if (s.temp < LOCAL_WAR_AT) return closeChain(gw, "compromise");
      const rus = gw.nation("RUS");
      if (rus !== null) {
        // What Russia really did: reports about it may say otherwise.
        const full = rus.ai === "hardline" || s.temp >= 7;
        rus.mob = Math.max(rus.mob, rus.ai === "cautious" ? 1 : full ? 2 : 1);
      }
      break;
    }
    case "general":
      if (s.aside) return closeChain(gw, "humiliation");
      return closeChain(gw, s.temp >= GENERAL_WAR_AT ? "war" : "compromise");
    default:
      break;
  }
  c.step++;
}

/** Chapter step: pressure climbs, sparks light, the open crisis takes a link. */
export function crisisStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.warChapter !== null) return;
  if (isLongChapter(gw)) {
    for (const t of GW_TOPICS) s.pressure[t]++;
  }
  if (s.chain !== null) {
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
