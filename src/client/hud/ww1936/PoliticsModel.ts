// World War 1936 P3 (spec §21): what the politics and diplomacy drawers,
// the player panel's actions, the event cards, the news ticker, the band
// and the dials show, as plain data and text from the politics view. No
// Lit here: the screens render it and the tests read it. The screens never
// evaluate a condition (spec §10.1): what may be started or taken comes
// from the update's cards and decisions; the diplomacy buttons' blocks are
// the engine-lib judgements (PoliticsRules) over the view's state.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  COUNTRIES,
  CountryTag,
  isCountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { ID_CIVIL } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  LAW_KINDS,
  LawKind,
  LawValue,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  SHIP_CLASSES,
  type ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type {
  Effect,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  ADVISOR_COST,
  ADVISOR_SLOTS,
  AdvisorSlot,
  DECISION_CATEGORIES,
  DecisionCategory,
  DecisionDef,
  DRIFT_KEYS,
  EventPicture,
  FactionKey,
  factionKeyOf,
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
  IDEOLOGIES,
  Ideology,
  SLOT_BRANCHES,
  TraitDef,
  WAR_GOAL_TYPES,
  WarGoalType,
  WW_COST,
  WW_CRISIS_DAYS,
  WW_FOREVER,
  WW_NAP_BREAK_DAYS,
  WW_PP_BASE_MILLI,
  WW_STAT_KEYS,
  WwEventCard,
  WwPolDetail,
  WwPolSummary,
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { DeclareWarBlock } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  DescLine,
  describeCondition,
  describeEffects,
  describeStats,
} from "@openfront/engine-lib/ww1936/Describe";
import { fogCountLabel } from "@openfront/engine-lib/ww1936/IntelRules";
import { historicalAiActive } from "@openfront/engine-lib/ww1936/Pace";
import {
  costWith,
  factionGate,
  guaranteeGate,
  justifyCost,
  justifyDays,
  justifyGate,
  stabilityEffects,
  tensionFor,
  warSupportEffects,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { shipNameKey } from "@openfront/engine-lib/ww1936/ShipNames";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import type { WwPoliticsView } from "../../view/WwPoliticsView";
import {
  blockText,
  branchName,
  buildingName,
  equipmentName,
  lawClosesDeals,
  lawKindName,
  lawLadder,
  lawName,
  lawPoliticsOf,
  liveWarDays,
  resourceName,
} from "./EconomyModel";
import { occupationParams } from "./EndgameNames";
import type { FogModel } from "./FogModel";
import {
  countryName,
  dateLabel,
  DECLARE_BLOCK_KEYS,
  enemiesOf,
  factionName,
  factionOfId,
  isCapitulated,
  isKoreanUi,
  liveFactions,
  today,
  translateCountryParams,
  wwActive,
  type WwGame,
  wwSeconds,
} from "./WorldWarModel";

/** What the politics screens read from the game (a fake in tests). */
export type PolGame = WwGame &
  Partial<Pick<GameView, "wwEconomy" | "wwLand" | "config" | "wwEndgame">>;

export interface PoliticsModelInput {
  game: PolGame;
  view: WwPoliticsView;
  /** My smallID. */
  me: number;
}

/** My country's politics input; null for a spectator, or with the mode off. */
export function politicsInput(game: PolGame): PoliticsModelInput | null {
  if (game.worldWarScenario() === null) return null;
  const view = game.wwPolitics?.() ?? null;
  const me = game.myPlayer();
  if (view === null || me === null) return null;
  return { game, view, me: me.smallID() };
}

/** My country can still act: alive and not capitulated (the engine refuses the rest, "dead"). */
export function canAct(i: PoliticsModelInput): boolean {
  const me = i.game.myPlayer();
  // P5 pre-flight §0-1: an exile still acts.
  return me !== null && wwActive(i.game, i.me);
}

// ---- Numbers ----

const MINUS = "−";
const STAT_INDEX = new Map<WwStatKey, number>(
  WW_STAT_KEYS.map((k, n) => [k, n]),
);

/** A stat of my country's detail (the sum of every source); 0 without one. */
export function statOf(d: WwPolDetail | null, key: WwStatKey): number {
  return d?.stats[STAT_INDEX.get(key)!] ?? 0;
}

function statsOf(d: WwPolDetail | null): WwStats {
  const s = emptyStats();
  if (d !== null) WW_STAT_KEYS.forEach((k, n) => (s[k] = d.stats[n] ?? 0));
  return s;
}

/** Whole percent of a bp value, rounded down (the colours compare the same bp). */
export function pctOf(bp: number): number {
  return Math.floor(bp / 100);
}

/** "+3%", "−6%", "+0.5%": a signed percent of a bp value, at most one decimal. */
export function signedPctText(bp: number): string {
  const v = Math.round(bp / 10) / 10;
  const abs = Math.abs(v);
  const s = Number.isInteger(abs) ? `${abs}` : abs.toFixed(1);
  if (v < 0) return `${MINUS}${s}%`;
  return v > 0 ? `+${s}%` : "0%";
}

/** Political power in whole points ("132", "−4"). */
export function ppText(milli: number): string {
  const v = Math.trunc(milli / 1000);
  return v < 0 ? `${MINUS}${-v}` : `${v}`;
}

/** A day's gain with one decimal and its sign ("+2.3"). */
export function gainText(milli: number): string {
  const v = Math.round(milli / 100) / 10;
  const s = Math.abs(v).toFixed(1);
  return v < 0 ? `${MINUS}${s}` : `+${s}`;
}

/** Spec §21.1: under 50% orange, under 30% red. */
export type Tone = "ok" | "warn" | "bad";
export function toneOf(bp: number): Tone {
  return bp < 3000 ? "bad" : bp < 5000 ? "warn" : "ok";
}
export const TONE_CLASS: Readonly<Record<Tone, string>> = {
  ok: "text-white",
  warn: "text-orange-300",
  bad: "text-red-400",
};
export const TONE_BAR_CLASS: Readonly<Record<Tone, string>> = {
  ok: "bg-emerald-400",
  warn: "bg-orange-400",
  bad: "bg-red-500",
};

/** The 4 ideology colours (IDEOLOGIES order): the pie, the dots, the faction lines. */
export const IDEOLOGY_COLORS: readonly string[] = [
  "#3b82f6",
  "#dc2626",
  "#78716c",
  "#d4d4d4",
];

// ---- Names ----

function tagOf(game: WwGame, id: number): CountryTag | null {
  return game.worldWarScenario()?.tagOfSmallId(id) ?? null;
}

/** A country by smallID in the UI language; "" for none. */
export function nameOf(game: WwGame, id: number): string {
  const tag = tagOf(game, id);
  return tag === null ? "" : countryName(tag);
}

export function flagUrl(tag: CountryTag): string {
  return assetUrl(`flags/${COUNTRIES[tag].flag}.svg`);
}

export function ideologyName(i: number | Ideology): string {
  const id = typeof i === "number" ? IDEOLOGIES[i] : i;
  return translateText(`ww1936.ideology.${id}`);
}

/** A person by id (its nameKey), or a title card ("title:<id>"); "None" for nobody. */
export function personName(id: string): string {
  if (id.startsWith("title:")) {
    return translateText(`ww1936.title.${id.slice("title:".length)}`);
  }
  const p = id === "" ? undefined : CONTENT.personIdx.get(id);
  return p === undefined
    ? translateText("ww1936.pol.none")
    : translateText(p.nameKey);
}

/** Spec §5.3: the country's own government name, else the generic one. */
export function governmentName(tag: CountryTag, ruling: number): string {
  const ideo = IDEOLOGIES[ruling];
  const def = CONTENT.countryIdx.get(tag);
  return def?.govNames?.includes(ideo)
    ? translateText(`ww1936.gov.${tag}.${ideo}`)
    : translateText(`ww1936.gov.generic.${ideo}`);
}

export const traitName = (t: string) => translateText(`ww1936.trait.adv_${t}`);
export const spiritName = (id: string) => translateText(`ww1936.spirit.${id}`);
export const spiritDesc = (id: string) =>
  translateText(`ww1936.spirit_desc.${id}`);
export const decisionName = (id: string) =>
  translateText(`ww1936.decision.${id}`);
export const decisionDesc = (id: string) =>
  translateText(`ww1936.decision_desc.${id}`);
export const focusName = (id: string) => translateText(`ww1936.focus.${id}`);
export const eventTitle = (id: string) =>
  translateText(`ww1936.event_title.${id}`);
export const eventDesc = (id: string) =>
  translateText(`ww1936.event_desc.${id}`);
export const optionName = (event: string, option: string) =>
  translateText(`ww1936.event_opt.${event}.${option}`);
export const wargoalName = (t: string) => translateText(`ww1936.wargoal.${t}`);
export const slotName = (s: AdvisorSlot) =>
  translateText(`ww1936.advisor_slot.${s}`);
export const groupName = (id: string) =>
  translateText(`ww1936.pol.group.${id}`);
const tplName = (id: string) => translateText(`ww1936.tpl.${id}`);
const generalIdName = (id: string) => translateText(`ww1936.general.${id}`);
const reserveName = (k: string) => translateText(`ww1936.reserve.${k}`);
const treatyName = (kind: string) =>
  translateText(`ww1936.diplo.treaty.${kind}`);

/** A faction by index or key, P0's name for the starting three. */
function factionText(game: WwGame, f: number | string): string {
  const key: FactionKey =
    typeof f === "number" ? factionKeyOf(f) : (f as FactionKey);
  return factionName(key, game);
}

/** A world news line (spec §12.7): `ww1936.news.<id>` with its params named. */
export function newsText(
  game: WwGame,
  id: string,
  params: Record<string, string | number>,
): string {
  return translateText(`ww1936.news.${id}`, {
    ...politicsParams(params, game),
    ...shipNewsParams(game, params),
    ...occupationParams(game, params),
  });
}

/**
 * P4 (lane N2, ww1936_ship_sunk_named): a ship by class, name list owner
 * and nameIdx — its class text and its name ("No. n" when numbered) — and
 * the strategic region by id.
 */
function shipNewsParams(
  game: WwGame,
  params: Record<string, string | number>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const { cls, nameIdx, nameTag, sr } = params;
  if (
    typeof cls === "string" &&
    (SHIP_CLASSES as readonly string[]).includes(cls)
  ) {
    out.cls = translateText(`ww1936.ship_class.${cls}`);
    if (typeof nameIdx === "number") {
      const key =
        typeof nameTag === "string" && isCountryTag(nameTag)
          ? shipNameKey(nameTag, cls as ShipClass, nameIdx)
          : null;
      out.ship =
        key !== null
          ? translateText(`ww1936.ship.${key}`)
          : translateText("ww1936.navy.ship_numbered", {
              n: Math.max(0, -nameIdx),
            });
    }
  }
  if (typeof sr === "number") {
    const r = game.worldWarScenario()?.sr(sr);
    out.sr = r === undefined ? "" : isKoreanUi() ? r.nameKo : r.name;
  }
  return out;
}

/** The country a news item or a notice is about (its first "…Tag" param). */
export function newsTag(
  params: Record<string, string | number>,
): CountryTag | null {
  for (const k of ["countryTag", "aTag", "targetTag", "bTag"]) {
    const v = params[k];
    if (typeof v === "string" && isCountryTag(v)) return v;
  }
  return null;
}

/**
 * Plan decision 5: the P3 notices (spec §21.8's 16 and the plan's 3), all
 * MessageType.WORLD_WAR; EventsDisplay names their content ids
 * (politicsParams). The engine sends them through WwPolitics.message, which
 * adds the "events_display." prefix.
 */
export const POLITICS_NOTICES: ReadonlySet<string> = new Set([
  "events_display.ww1936_focus_done",
  "events_display.ww1936_focus_queue_failed",
  "events_display.ww1936_advisor_left",
  "events_display.ww1936_government_changed",
  "events_display.ww1936_leader_changed",
  "events_display.ww1936_faction_joined",
  "events_display.ww1936_faction_left",
  "events_display.ww1936_faction_leader",
  "events_display.ww1936_treaty",
  "events_display.ww1936_treaty_ended",
  "events_display.ww1936_justify_started",
  "events_display.ww1936_justified_against",
  "events_display.ww1936_election",
  "events_display.ww1936_decision",
  "events_display.ww1936_mission_done",
  "events_display.ww1936_mission_failed",
  "events_display.ww1936_event_auto_chosen",
  "events_display.ww1936_war_goal_expired",
  "events_display.ww1936_annexed",
]);

/**
 * Controller ruling R3: the params of a P3 notice or news item as text —
 * "…Tag" countries (translateCountryParams) and the content ids (focus,
 * event + option, decision, person, faction, ideology, treaty kind).
 */
export function politicsParams(
  params: Record<string, string | number>,
  game?: WwGame,
): Record<string, string | number> {
  const out = translateCountryParams(params);
  const s = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : null;
  const focus = s("focus");
  if (focus !== null) out.focus = focusName(focus);
  const decision = s("decision");
  if (decision !== null) out.decision = decisionName(decision);
  const event = s("event");
  if (event !== null) {
    out.event = eventTitle(event);
    const option = s("option");
    if (option !== null) out.option = optionName(event, option);
  }
  const person = s("person");
  if (person !== null) out.person = personName(person);
  const faction = params.faction;
  if (faction !== undefined && game !== undefined) {
    out.faction = factionText(game, faction);
  }
  const ideology = params.ideology;
  if (ideology !== undefined) {
    const n =
      typeof ideology === "number"
        ? ideology
        : IDEOLOGIES.indexOf(ideology as Ideology);
    if (n >= 0 && n < IDEOLOGIES.length) out.ideology = ideologyName(n);
  }
  const kind = s("kind");
  if (kind !== null) out.kind = treatyName(kind);
  return out;
}

// ---- The explain lines (spec §20.4, the T9 key table's conventions) ----

const FX = "ww1936.fx.";
const COND = "ww1936.cond.";
/** Bookkeeping effects the player lists leave out (the strings exist). */
const HIDDEN_FX = new Set([
  "ww1936.fx.set_flag",
  "ww1936.fx.clear_flag",
  "ww1936.fx.set_gflag",
  "ww1936.fx.clear_gflag",
]);
/** Optional params an absent value reads as (the key table's rule). */
const ZERO_PARAMS = [
  "days",
  "free",
  "core",
  "suspend",
  "postponeDays",
  "recruitablePct",
  "amount",
];
const NONE_PARAMS = [
  "goal",
  "units",
  "to",
  "name",
  "branch",
  "tech",
  "general",
  "group",
];

/**
 * A selector as a describe line carries it (Describe.selectorCode for the
 * object forms; "self", "from" and "target" as written) as text.
 */
export function selectorText(code: string): string {
  if (code === "@self" || code === "self") {
    return translateText("ww1936.pol.sel.self");
  }
  if (code === "@from" || code === "from") {
    return translateText("ww1936.pol.sel.from");
  }
  if (code === "@target" || code === "target") {
    return translateText("ww1936.pol.sel.target");
  }
  if (code === "all") return translateText("ww1936.pol.sel.all");
  if (code.startsWith("@leader:")) {
    return translateText("ww1936.pol.sel.leader_of", {
      who: selectorText(code.slice("@leader:".length)),
    });
  }
  if (code.startsWith("@owner:")) {
    return translateText("ww1936.pol.sel.owner_of", {
      group: groupName(code.slice("@owner:".length)),
    });
  }
  return isCountryTag(code) ? countryName(code) : code;
}

/** A region pick code (Describe.pickCode) as text. */
export function pickText(code: string): string {
  if (code === "capital") return translateText("ww1936.pol.pick.capital");
  const colon = code.indexOf(":");
  const head = colon < 0 ? code : code.slice(0, colon);
  const rest = colon < 0 ? "" : code.slice(colon + 1);
  switch (head) {
    case "group":
      return translateText("ww1936.pol.pick.group", {
        group: groupName(rest),
      });
    case "best": {
      const [n, of] = rest.split(":");
      return of === undefined
        ? translateText("ww1936.pol.pick.best", { n: Number(n) })
        : translateText("ww1936.pol.pick.best_of", {
            n: Number(n),
            group: groupName(of),
          });
    }
    case "core":
      return translateText("ww1936.pol.pick.core", { n: Number(rest) });
    case "border": {
      const at = rest.lastIndexOf(":");
      const who = rest.slice(0, at);
      const n = Number(rest.slice(at + 1));
      return who === "threat"
        ? translateText("ww1936.pol.pick.border_threat", { n })
        : translateText("ww1936.pol.pick.border", {
            n,
            who: selectorText(who),
          });
    }
    case "acquired":
      return translateText("ww1936.pol.pick.acquired", { n: Number(rest) });
    case "coastal":
      return translateText("ww1936.pol.pick.coastal", { n: Number(rest) });
    case "resources":
      return translateText("ww1936.pol.pick.resources", { n: Number(rest) });
    case "regions":
      return translateText("ww1936.pol.pick.regions", {
        n: rest === "" ? 0 : rest.split(",").length,
      });
  }
  return code;
}

function idText(kind: string, id: string): string {
  switch (kind) {
    case "add_spirit":
    case "remove_spirit":
    case "has_spirit":
      return spiritName(id);
    case "fire_event":
      return eventTitle(id);
    case "news":
      return translateText(`ww1936.news.${id}`);
    case "unlock_decision":
    case "lock_decision":
    case "take_decision":
    case "decision_taken":
      return decisionName(id);
    case "focus_done":
    case "focus_in_progress":
      return focusName(id);
  }
  return id;
}

function ideologyParam(v: string): string {
  if (v === "ruling") return translateText("ww1936.pol.ideo_ruling");
  if (v === "largest_other") {
    return translateText("ww1936.pol.ideo_largest_other");
  }
  return IDEOLOGIES.includes(v as Ideology) ? ideologyName(v as Ideology) : v;
}

/** One param of a describe line as text (the T9 key table's rules). */
function paramText(
  kind: string,
  k: string,
  v: string | number,
  params: Record<string, string | number>,
): string | number {
  if (typeof v === "number") return v;
  switch (k) {
    case "on":
    case "of":
    case "vs":
    case "target":
      return selectorText(v);
    case "where":
      return pickText(v);
    case "from":
    case "to":
      if (kind === "move_buildings") return pickText(v);
      if (kind === "swap_spirit") return spiritName(v);
      return selectorText(v);
    case "tag":
      return isCountryTag(v) ? countryName(v) : v;
    case "id":
      return idText(kind, v);
    case "person":
      return personName(v);
    case "trait":
      return traitName(v);
    case "ideology":
      return ideologyParam(v);
    case "law":
      return lawKindName(v as LawKind);
    case "value":
      return kind === "law" || kind === "law_ge" || kind === "set_law"
        ? translateText(`ww1936.law.${params.law}.${v}`)
        : v;
    case "building":
      return buildingName(v as never);
    case "res":
      return resourceName(v as never);
    case "tech":
      return translateText(`ww1936.tech.${v}`);
    case "type":
      return kind === "war_goal" ? wargoalName(v) : equipmentName(v as never);
    case "goal":
      return wargoalName(v);
    case "branch":
      return branchName(v as never);
    case "key":
      return kind === "reserve" ? reserveName(v) : v;
    case "template":
      return tplName(v);
    case "general":
      return generalIdName(v);
    case "group":
      return groupName(v);
    case "name":
      return translateText(`ww1936.faction_name.${v}`, { country: "" });
    case "date":
      return dateLabel(dayOfDate(v));
  }
  return v;
}

/**
 * One explain line (Describe) as text, its codes turned into names; a line
 * about another country starts with "‹who›: ". Effects and conditions read
 * the key table's defaults for their absent optional params; a stat line
 * has only its value. The one renderer of the politics and focus screens.
 */
export function lineText(l: DescLine): string {
  const kind = l.key.slice(l.key.lastIndexOf(".") + 1);
  const stat = l.key.startsWith("ww1936.stat.");
  const p: Record<string, string | number> = {};
  if (!stat) {
    for (const k of ZERO_PARAMS) p[k] = 0;
    for (const k of NONE_PARAMS) p[k] = "none";
  }
  for (const [k, v] of Object.entries(l.params)) {
    if (k === "who") continue;
    p[k] = paramText(kind, k, v, l.params);
  }
  let text: string;
  if (l.key.startsWith(FX)) text = translateText(`ww1936.fx.${kind}`, p);
  else if (l.key.startsWith(COND)) {
    text = translateText(`ww1936.cond.${kind}`, p);
  } else text = translateText(`ww1936.stat.${kind}`, p);
  const who = l.params.who;
  if (typeof who === "string" && who !== "@self" && who !== "self" && !stat) {
    return (
      translateText("ww1936.pol.who_prefix", { who: selectorText(who) }) + text
    );
  }
  return text;
}

export interface TextLine {
  text: string;
  depth: number;
}

/** The effects a player reads (bookkeeping lines left out). */
export function effectLines(
  effects: readonly Effect[] | undefined,
): TextLine[] {
  if (effects === undefined) return [];
  return describeEffects(effects)
    .filter((l) => !HIDDEN_FX.has(l.key))
    .map((l) => ({ text: lineText(l), depth: l.depth }));
}

/** One line per non-zero stat. */
export function statLines(s: Partial<WwStats>): string[] {
  return describeStats(s).map(lineText);
}

// ---- The top band (spec §21.1) ----

export interface BandPolitics {
  pp: string;
  gain: string;
  stabPct: number;
  wsPct: number;
  wtPct: number;
  stabTone: Tone;
  wsTone: Tone;
  ppLabel: string;
  stabLabel: string;
  wsLabel: string;
  wtLabel: string;
}

/** Null for a spectator, before my country's first politics update, and once it is gone. */
export function bandStats(i: PoliticsModelInput): BandPolitics | null {
  const s = i.view.summary(i.me);
  if (s === null || !canAct(i)) return null;
  const gain = gainText(i.view.detail(i.me)?.ppGainMilli ?? 0);
  const pp = ppText(s.ppMilli);
  const wtBp = i.view.global?.wtBp ?? 0;
  return {
    pp,
    gain,
    stabPct: pctOf(s.stabBp),
    wsPct: pctOf(s.wsBp),
    wtPct: pctOf(wtBp),
    stabTone: toneOf(s.stabBp),
    wsTone: toneOf(s.wsBp),
    ppLabel: translateText("ww1936.pol.band.pp", { pp, gain }),
    stabLabel: translateText("ww1936.pol.band.stability", {
      pct: pctOf(s.stabBp),
    }),
    wsLabel: translateText("ww1936.pol.band.war_support", {
      pct: pctOf(s.wsBp),
    }),
    wtLabel: translateText("ww1936.pol.band.tension", { pct: pctOf(wtBp) }),
  };
}

// ---- The dials (spec §21.2) ----

export interface PolDial {
  /** The ring, 0..1. */
  progress: number;
  /** 🎯: no focus running (it glows). */
  glow: boolean;
  /** 🏛: decisions I can take; 🌐: requests and events waiting. */
  badge: number;
  label: string;
  badgeLabel: string;
}

/** Days left of the running focus at today's speed (focusSpeedPct). */
function focusDaysLeft(d: WwPolDetail): number {
  if (d.focus === null) return 0;
  const perDay = Math.max(
    1,
    Math.floor((1000 * (100 + statOf(d, "focusSpeedPct"))) / 100),
  );
  return Math.ceil(
    Math.max(0, d.focus.daysMilli - d.focus.progressMilli) / perDay,
  );
}

export function focusDial(i: PoliticsModelInput): PolDial | null {
  const d = i.view.detail(i.me);
  if (d === null) return null;
  if (d.focus === null) {
    return {
      progress: 0,
      glow: true,
      badge: 0,
      label: translateText("ww1936.pol.dial.focus_idle"),
      badgeLabel: "",
    };
  }
  return {
    progress:
      d.focus.daysMilli <= 0
        ? 0
        : Math.min(1, d.focus.progressMilli / d.focus.daysMilli),
    glow: false,
    badge: 0,
    label: translateText("ww1936.pol.dial.focus_running", {
      focus: focusName(d.focus.id),
      days: focusDaysLeft(d),
    }),
    badgeLabel: "",
  };
}

/** Spec §21.2: the ring fills up to the price of a political advisor (150 PP). */
export const POLITICS_DIAL_CAP = ADVISOR_COST.political;

/** Decisions with at least one card I can take now. */
export function takeableDecisions(d: WwPolDetail): number {
  return new Set(d.decisions.filter((c) => c.state === 0).map((c) => c.id))
    .size;
}

export function politicsDial(i: PoliticsModelInput): PolDial | null {
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  if (s === null || d === null) return null;
  const n = takeableDecisions(d);
  const pp = Math.max(0, Math.trunc(s.ppMilli / 1000));
  return {
    progress: Math.min(1, pp / POLITICS_DIAL_CAP),
    glow: false,
    badge: n,
    label: translateText("ww1936.pol.dial.politics_label", {
      pp,
      cap: POLITICS_DIAL_CAP,
    }),
    badgeLabel: translateText("ww1936.pol.dial.decisions_badge", { n }),
  };
}

export function diplomacyDial(i: PoliticsModelInput): PolDial | null {
  const d = i.view.detail(i.me);
  if (d === null) return null;
  const j = d.justification;
  const waiting = d.pending.length;
  return {
    progress:
      j === null || j.totalDays <= 0
        ? 0
        : Math.min(1, j.progressDays / j.totalDays),
    glow: false,
    badge: waiting,
    label:
      j === null
        ? ""
        : translateText("ww1936.pol.dial.justify_label", {
            target: nameOf(i.game, j.on),
            days: Math.max(0, j.totalDays - j.progressDays),
          }),
    badgeLabel: translateText("ww1936.pol.dial.diplomacy_label", {
      n: waiting,
    }),
  };
}

// ---- Politics drawer: government (spec §21.4-1) ----

export interface PieSlice {
  ideology: number;
  name: string;
  pct: number;
  color: string;
  /** "▲ 0.05%p a day" / "▼ …"; null without a drift. */
  drift: string | null;
  driftUp: boolean;
}

export interface BarModel {
  pct: number;
  tone: Tone;
  base: string;
  lines: { label: string; value: string; negative: boolean }[];
  effects: string[];
}

export interface GovernmentTab {
  leader: string;
  government: string;
  ideology: string;
  rulingColor: string;
  pie: PieSlice[];
  /** A conic-gradient over the four ideologies. */
  pieGradient: string;
  election: string;
  /** Not a democracy: the regime crisis (spec §5.5); null for a democracy. */
  crisis: string | null;
  pp: string;
  ppSources: { label: string; values: string[] }[];
  stability: BarModel;
  warSupport: BarModel;
  surrender: string;
}

const SOURCE_KEYS = [
  "ww1936.pol.source.tech",
  "ww1936.pol.source.laws",
  "ww1936.pol.source.spirits",
  "ww1936.pol.source.advisors",
  "ww1936.pol.source.government",
  "ww1936.pol.source.leader",
  "ww1936.pol.source.dynamic",
  // P6 (plan decision 24): the depth systems' part.
  "ww1936.pol.source.depth",
] as const;

/** Share of my legal victory points someone else controls now (P0's gauge over P3's legal owners), %. */
export function lostVpPct(i: PoliticsModelInput): number {
  const s = i.game.worldWarScenario();
  if (s === null) return 0;
  let total = 0;
  let lost = 0;
  for (const r of s.landRegions) {
    if (i.view.legalOwner[r.id] !== i.me) continue;
    total += r.vp;
    if (i.game.ownerID(s.vpTile(r)) !== i.me) lost += r.vp;
  }
  return total <= 0 ? 0 : Math.floor((lost * 100) / total);
}

function bar(
  bp: number,
  baseBp: number,
  lines: readonly { key: string; bp: number }[],
  effects: string[],
): BarModel {
  return {
    pct: pctOf(bp),
    tone: toneOf(bp),
    base: translateText("ww1936.pol.gov.base", { pct: pctOf(baseBp) }),
    lines: lines.map((l) => ({
      label: translateText(l.key),
      value: signedPctText(l.bp),
      negative: l.bp < 0,
    })),
    effects,
  };
}

/** Spec §6.4: the surrender line's share from stability and from war support, %p. */
function surrenderParts(
  stabBp: number,
  wsBp: number,
): { st: number; ws: number } {
  return {
    ws: Math.max(-10, Math.min(10, Math.floor((wsBp - 5000) / 500))),
    st: Math.max(-5, Math.min(5, Math.floor((stabBp - 5000) / 1000))),
  };
}

export function governmentTab(i: PoliticsModelInput): GovernmentTab | null {
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  const tag = tagOf(i.game, i.me);
  if (s === null || d === null || tag === null) return null;
  const day = today(i.game);
  const pie: PieSlice[] = IDEOLOGIES.map((_, n) => {
    const drift = statOf(d, DRIFT_KEYS[n]);
    return {
      ideology: n,
      name: ideologyName(n),
      pct: pctOf(s.pop[n] ?? 0),
      color: IDEOLOGY_COLORS[n],
      drift:
        drift === 0
          ? null
          : translateText(
              drift > 0
                ? "ww1936.pol.gov.drift_up"
                : "ww1936.pol.gov.drift_down",
              { bp: (Math.abs(drift) / 100).toFixed(2) },
            ),
      driftUp: drift > 0,
    };
  });
  let at = 0;
  const stops = pie.map((p, n) => {
    const from = at;
    at += (s.pop[n] ?? 0) / 100;
    return `${p.color} ${from}% ${at}%`;
  });
  let election: string;
  let crisis: string | null = null;
  if (s.ruling === IDEO_DEM) {
    election =
      d.nextElectionDay >= day
        ? translateText("ww1936.pol.gov.next_election", {
            days: d.nextElectionDay - day,
          })
        : translateText("ww1936.pol.gov.elections_suspended");
  } else {
    election = translateText("ww1936.pol.gov.no_election");
    const worst = Math.max(0, ...d.crisisDays.filter((_, n) => n !== s.ruling));
    crisis =
      worst > 0
        ? translateText("ww1936.pol.gov.crisis", {
            days: Math.max(0, WW_CRISIS_DAYS - worst),
          })
        : translateText("ww1936.pol.gov.no_crisis");
  }
  const ppGain = STAT_INDEX.get("ppGainPct")!;
  const ppFlat = STAT_INDEX.get("ppMilli")!;
  const ppSources: GovernmentTab["ppSources"] = [
    {
      label: translateText("ww1936.pol.gov.pp_base"),
      values: [
        translateText("ww1936.pol.value_signed", {
          v: WW_PP_BASE_MILLI / 1000,
        }),
      ],
    },
  ];
  d.statParts.forEach((part, n) => {
    const values = statLines({
      ppGainPct: part[ppGain] ?? 0,
      ppMilli: part[ppFlat] ?? 0,
    });
    if (values.length > 0 && n < SOURCE_KEYS.length) {
      ppSources.push({ label: translateText(SOURCE_KEYS[n]), values });
    }
  });
  const sp = surrenderParts(s.stabBp, s.wsBp);
  const stabEffects = statLines(stabilityEffects(s.stabBp));
  if (sp.st !== 0) stabEffects.push(...statLines({ surrenderPp: sp.st }));
  const wsEffects = statLines(warSupportEffects(s.wsBp));
  if (sp.ws !== 0) wsEffects.push(...statLines({ surrenderPp: sp.ws }));
  return {
    leader: personName(s.leader),
    government: governmentName(tag, s.ruling),
    ideology: ideologyName(s.ruling),
    rulingColor: IDEOLOGY_COLORS[s.ruling],
    pie,
    pieGradient: `conic-gradient(${stops.join(", ")})`,
    election,
    crisis,
    pp: translateText("ww1936.pol.gov.pp_now", {
      pp: ppText(s.ppMilli),
      gain: gainText(d.ppGainMilli),
    }),
    ppSources,
    stability: bar(s.stabBp, d.stabBaseBp, d.stabLines, stabEffects),
    warSupport: bar(s.wsBp, d.wsBaseBp, d.wsLines, wsEffects),
    surrender: translateText("ww1936.pol.gov.surrender", {
      pct: s.surrenderPct,
      lost: lostVpPct(i),
    }),
  };
}

// ---- Politics drawer: advisors (spec §21.4-2, §8) ----

export interface AdvisorCandidate {
  id: string;
  name: string;
  traits: string[];
  effects: string[];
  costPp: number;
  cost: string;
  /** "Available from …" when its date is still to come. */
  from: string | null;
  until: string | null;
  /** Why "Hire" can't go now; null: it can. */
  block: string | null;
  /** "Hire" into an empty seat, "Replace" the one in it (the engine replaces). */
  action: string;
}

export interface AdvisorSeat {
  index: number;
  slot: AdvisorSlot;
  slotName: string;
  holder: {
    id: string;
    name: string;
    traits: string[];
    effects: string[];
    until: string | null;
  } | null;
  lockDays: number;
  locked: string | null;
  candidates: AdvisorCandidate[];
  candidatesLabel: string;
}

function traitsOf(id: string): TraitDef[] {
  const ids = id.startsWith("title:")
    ? [id.slice("title:".length)]
    : (CONTENT.personIdx.get(id)?.advisor?.traits ?? []);
  return ids
    .map((t) => CONTENT.traitIdx.get(t as TraitDef["id"]))
    .filter((t): t is TraitDef => t !== undefined);
}

/** A trait's effects: its stats, and a ruling-party drift (orator, party ideologue). */
function traitEffects(traits: TraitDef[], ruling: number): string[] {
  const out: string[] = [];
  for (const t of traits) {
    out.push(...statLines(t.stats));
    if (t.rulingDriftBp !== undefined && t.rulingDriftBp !== 0) {
      out.push(...statLines({ [DRIFT_KEYS[ruling]]: t.rulingDriftBp }));
    }
  }
  return out;
}

/** Which seat a candidate takes (spec §8.1): a person's slot, a title card's trait branch. */
export function fitsSlot(id: string, slot: AdvisorSlot): boolean {
  if (id.startsWith("title:")) {
    const t = CONTENT.traitIdx.get(id.slice("title:".length) as TraitDef["id"]);
    return t !== undefined && SLOT_BRANCHES[slot].includes(t.branch);
  }
  return CONTENT.personIdx.get(id)?.advisor?.slot === slot;
}

export function advisorTab(i: PoliticsModelInput): AdvisorSeat[] {
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  if (s === null || d === null) return [];
  const day = today(i.game);
  const costPct = statOf(d, "advisorCostPct");
  const seated = new Set(d.advisors.filter((a): a is string => a !== null));
  const untilText = (iso: string | undefined) =>
    iso === undefined
      ? null
      : translateText("ww1936.pol.adv.until", {
          date: dateLabel(dayOfDate(iso)),
        });
  return ADVISOR_SLOTS.map((slot, index) => {
    const held = d.advisors[index] ?? null;
    const lockDays = Math.max(0, (d.advisorLockUntil[index] ?? -1) - day);
    const costPp = costWith(ADVISOR_COST[slot], costPct);
    const candidates = d.candidates
      .filter((c) => !seated.has(c) && fitsSlot(c, slot))
      .map((c): AdvisorCandidate => {
        const p = CONTENT.personIdx.get(c);
        const traits = traitsOf(c);
        const fromDay = p?.from === undefined ? -1 : dayOfDate(p.from);
        return {
          id: c,
          name: personName(c),
          traits: traits.map((t) => traitName(t.id)),
          effects: traitEffects(traits, s.ruling),
          costPp,
          cost: translateText("ww1936.pol.adv.cost", { pp: costPp }),
          from:
            fromDay > day
              ? translateText("ww1936.pol.adv.from", {
                  date: dateLabel(fromDay),
                })
              : null,
          until: untilText(p?.until),
          block:
            lockDays > 0
              ? blockText("slot_locked")
              : s.ppMilli < costPp * 1000
                ? blockText("no_pp")
                : null,
          action:
            held === null
              ? translateText("ww1936.pol.adv.hire")
              : translateText("ww1936.pol.adv.replace"),
        };
      });
    const heldTraits = held === null ? [] : traitsOf(held);
    return {
      index,
      slot,
      slotName: slotName(slot),
      holder:
        held === null
          ? null
          : {
              id: held,
              name: personName(held),
              traits: heldTraits.map((t) => traitName(t.id)),
              effects: traitEffects(heldTraits, s.ruling),
              until: untilText(CONTENT.personIdx.get(held)?.until),
            },
      lockDays,
      locked:
        lockDays > 0
          ? translateText("ww1936.pol.adv.locked", { days: lockDays })
          : null,
      candidates,
      candidatesLabel: translateText("ww1936.pol.adv.candidates", {
        slot: slotName(slot),
      }),
    };
  });
}

// ---- Politics drawer: laws (spec §21.4-3, §7.2) ----

/**
 * Spec §7.2's war-support and tension lines of each gated law: the text of
 * PoliticsRules.lawBlock's gates (lawBlock still decides; a test checks the
 * two agree). `peace`: at war the step has no gate at all.
 */
export const LAW_GATES: Readonly<
  Partial<
    Record<
      LawValue,
      { ws: number; wt: number; needWar: boolean; peace: boolean }
    >
  >
> = {
  partial_mobilization: { ws: 3000, wt: 2500, needWar: false, peace: true },
  war_economy: { ws: 5000, wt: 5000, needWar: false, peace: true },
  total_mobilization: { ws: 7000, wt: 0, needWar: true, peace: false },
  extensive: { ws: 3000, wt: 2500, needWar: false, peace: false },
  service: { ws: 5000, wt: 5000, needWar: false, peace: false },
  all_adults: { ws: 7000, wt: 0, needWar: true, peace: false },
  scraping: { ws: 8000, wt: 0, needWar: true, peace: false },
};

export interface LawLine {
  ok: boolean;
  text: string;
}

export interface LawStepView {
  value: LawValue;
  name: string;
  state: "current" | "open" | "locked";
  cost: string;
  lines: LawLine[];
  /** A block the lines and the wait don't show (no PP, …); null: none. */
  reason: string | null;
  /** Setting it closes trade deals: two taps (P1). */
  closes: boolean;
}

export interface LawLadderView {
  kind: LawKind;
  name: string;
  wait: string | null;
  steps: LawStepView[];
}

/** The ✓/✗ lines of a step's conditions. */
export function lawLines(
  value: LawValue,
  ctx: { wsBp: number; wtBp: number; ruling: number; atWar: boolean },
): LawLine[] {
  const out: LawLine[] = [];
  const g = LAW_GATES[value];
  if (g !== undefined && !(g.peace && ctx.atWar)) {
    if (g.needWar) {
      out.push({
        ok: ctx.atWar,
        text: translateText("ww1936.pol.law.need_war"),
      });
    }
    out.push({
      ok: ctx.wsBp >= g.ws,
      text: translateText("ww1936.pol.law.need_ws", {
        need: g.ws / 100,
        now: pctOf(ctx.wsBp),
      }),
    });
    if (g.wt > 0 && ctx.ruling === IDEO_DEM && !ctx.atWar) {
      out.push({
        ok: ctx.wtBp >= g.wt,
        text: translateText("ww1936.pol.law.need_tension", {
          need: g.wt / 100,
          ideology: ideologyName(IDEO_DEM),
        }),
      });
    }
  }
  const fasCom = ctx.ruling === 1 || ctx.ruling === 2;
  if (
    (value === "free_trade" && fasCom) ||
    (value === "closed_economy" && !fasCom && !ctx.atWar)
  ) {
    out.push({ ok: false, text: blockText("law_ideology") });
  }
  return out;
}

/** Null before my country's economy data arrives. */
export function lawTab(i: PoliticsModelInput): LawLadderView[] | null {
  const econ = i.game.wwEconomy?.() ?? null;
  const detail = econ?.detail(i.me) ?? null;
  const summary = econ?.summary(i.me) ?? null;
  if (detail === null || summary === null) return null;
  const day = today(i.game);
  const warDays = liveWarDays(i.game, i.me);
  const pol = lawPoliticsOf(i.view, i.me);
  const ctx = {
    wsBp: pol.wsBp,
    wtBp: pol.wtBp,
    ruling: pol.ruling,
    atWar: warDays >= 0,
  };
  return LAW_KINDS.map((kind) => {
    const steps = lawLadder(detail, kind, day, warDays, pol);
    const wait = steps[0]?.cooldownDays ?? 0;
    return {
      kind,
      name: lawKindName(kind),
      wait:
        wait > 0 ? translateText("ww1936.pol.law.wait", { days: wait }) : null,
      steps: steps.map((st): LawStepView => {
        const state = st.current
          ? "current"
          : st.block === null
            ? "open"
            : "locked";
        const shown =
          st.block === null ||
          st.block === "law_cooldown" ||
          st.condition !== null;
        return {
          value: st.value,
          name: lawName(st.value),
          state,
          cost: translateText("ww1936.pol.law.cost", { pp: st.costPp }),
          lines: st.current ? [] : lawLines(st.value, ctx),
          reason: st.current || shown ? null : blockText(st.block!),
          closes:
            st.block === null &&
            lawClosesDeals(detail, summary, kind, st.value),
        };
      }),
    };
  });
}

/** The conscription law in force (the industry drawer's manpower tab). */
export function conscriptionLaw(game: PolGame, me: number): string | null {
  const d = game.wwEconomy?.()?.detail(me) ?? null;
  return d === null
    ? null
    : translateText("ww1936.pol.manpower.law", {
        law: lawName(d.laws.conscription),
      });
}

// ---- Politics drawer: spirits (spec §21.4-4) ----

export interface SpiritView {
  id: string;
  icon: string;
  name: string;
  desc: string;
  effects: string[];
  left: string;
}

export function spiritTab(i: PoliticsModelInput): SpiritView[] {
  const d = i.view.detail(i.me);
  if (d === null) return [];
  const day = today(i.game);
  return d.spirits
    .filter((x) => CONTENT.spiritIdx.get(x.id)?.hidden !== true)
    .map((x) => {
      const def = CONTENT.spiritIdx.get(x.id);
      const forever = x.untilDay < 0 || x.untilDay >= WW_FOREVER / 2;
      return {
        id: x.id,
        icon: assetUrl(`images/ww1936/focus/${def?.icon ?? "flag"}.svg`),
        name: spiritName(x.id),
        desc: spiritDesc(x.id),
        effects: def === undefined ? [] : statLines(def.stats),
        left: forever
          ? translateText("ww1936.pol.spirit.permanent")
          : translateText("ww1936.pol.spirit.left", {
              days: Math.max(0, x.untilDay - day),
            }),
      };
    });
}

// ---- Politics drawer: decisions (spec §21.4-5, §13) ----

export interface DecisionTarget {
  target: number;
  tag: CountryTag | null;
  name: string;
  state: number;
  reason: string | null;
}

export interface DecisionView {
  id: string;
  name: string;
  desc: string;
  cost: string | null;
  /** A mission's length ("90 days"); null for a plain decision. */
  duration: string | null;
  effects: TextLine[];
  targeted: boolean;
  /** Taking it can't be undone and costs dearly (a coup): two taps. */
  twoTap: boolean;
  /** Untargeted: its card's state (0 can take, 1 condition, 2 cost, 3 cooldown, 4 mission). */
  state: number;
  reason: string | null;
  /** The failing condition leaves, as text. */
  failing: string[];
  targets: DecisionTarget[];
}

export interface MissionView {
  id: string;
  target: number;
  name: string;
  targetName: string;
  progress: number;
  text: string;
}

export interface DecisionTab {
  missions: MissionView[];
  groups: {
    category: DecisionCategory;
    name: string;
    decisions: DecisionView[];
  }[];
}

function decisionDef(id: string): DecisionDef | null {
  const n = CONTENT.decisionIdx.get(id);
  return n === undefined ? null : CONTENT.decisions[n];
}

/** Spec §13.2: a coup (gen_coup_*) is a costly mission that can't be undone: two taps. */
export function decisionTwoTap(id: string): boolean {
  return id.startsWith("gen_coup_");
}

/**
 * What a decision costs: its PP (the engine's, with decisionCostPct) and
 * any equipment, manpower or army experience it also takes (spec §13.1).
 */
export function decisionCostText(id: string, costPp: number): string | null {
  const c = decisionDef(id)?.cost;
  const parts: string[] = [];
  if (costPp > 0) {
    parts.push(translateText("ww1936.pol.decision.cost", { pp: costPp }));
  }
  if (c?.equipment !== undefined) {
    const [type, count] = c.equipment;
    parts.push(`${equipmentName(type)} ${count.toLocaleString()}`);
  }
  if (c?.manpower !== undefined && c.manpower > 0) {
    parts.push(
      translateText("ww1936.fx.manpower", {
        amount: -c.manpower,
        recruitablePct: 0,
      }),
    );
  }
  if (c?.armyXp !== undefined && c.armyXp > 0) {
    parts.push(translateText("ww1936.fx.army_xp", { amount: -c.armyXp }));
  }
  return parts.length === 0 ? null : parts.join(" · ");
}

function decisionReason(
  state: number,
  cooldownUntil: number,
  day: number,
  mission: { endDay: number } | undefined,
): string | null {
  switch (state) {
    case 1:
      return translateText("ww1936.pol.decision.locked");
    case 2:
      return blockText("no_pp");
    case 3:
      return translateText("ww1936.pol.decision.cooldown", {
        days: Math.max(0, cooldownUntil - day),
      });
    case 4:
      return translateText("ww1936.pol.decision.mission", {
        days: Math.max(0, (mission?.endDay ?? day) - day),
      });
  }
  return null;
}

/** The failing `available` leaves of a decision (the engine numbers them as conditionLeaves). */
function failingLines(def: DecisionDef | null, failing: number[]): string[] {
  if (def === null || failing.length === 0) return [];
  const want = new Set(failing);
  return describeCondition(def.available)
    .filter((l) => l.leaf >= 0 && want.has(l.leaf))
    .map(lineText);
}

export function decisionTab(i: PoliticsModelInput): DecisionTab {
  const d = i.view.detail(i.me);
  if (d === null) return { missions: [], groups: [] };
  const day = today(i.game);
  const missions = d.missions.map((m) => ({
    id: m.id,
    target: m.target,
    name: decisionName(m.id),
    targetName: m.target > 0 ? nameOf(i.game, m.target) : "",
    progress:
      m.endDay <= m.startDay
        ? 1
        : Math.min(
            1,
            Math.max(0, (day - m.startDay) / (m.endDay - m.startDay)),
          ),
    text: translateText("ww1936.pol.decision.mission", {
      days: Math.max(0, m.endDay - day),
    }),
  }));
  const byId = new Map<string, DecisionView>();
  for (const c of d.decisions) {
    const def = decisionDef(c.id);
    const mission = d.missions.find(
      (m) => m.id === c.id && m.target === c.target,
    );
    let v = byId.get(c.id);
    if (v === undefined) {
      v = {
        id: c.id,
        name: decisionName(c.id),
        desc: decisionDesc(c.id),
        cost: decisionCostText(c.id, c.costPp),
        duration:
          def?.days === undefined
            ? null
            : translateText("ww1936.pol.days", { days: def.days }),
        effects: [
          ...effectLines(def?.effects),
          ...effectLines(def?.completeEffects),
        ].slice(0, 4),
        targeted: def?.target !== undefined,
        twoTap: decisionTwoTap(c.id),
        state: c.state,
        reason: null,
        failing: [],
        targets: [],
      };
      byId.set(c.id, v);
    }
    const reason = decisionReason(c.state, c.cooldownUntil, day, mission);
    if (v.targeted) {
      const tag = c.target > 0 ? tagOf(i.game, c.target) : null;
      v.targets.push({
        target: c.target,
        tag,
        name: tag === null ? "" : countryName(tag),
        state: c.state,
        reason:
          c.state === 1 ? (failingLines(def, c.failing)[0] ?? reason) : reason,
      });
    } else {
      v.state = c.state;
      v.failing = failingLines(def, c.failing);
      v.reason = c.state === 1 && v.failing.length > 0 ? null : reason;
    }
  }
  const groups = DECISION_CATEGORIES.map((category) => ({
    category,
    name: translateText(`ww1936.pol.decision.cat.${category}`),
    decisions: [...byId.values()].filter(
      (v) => decisionDef(v.id)?.category === category,
    ),
  })).filter((g) => g.decisions.length > 0);
  return { missions, groups };
}

// ---- Diplomacy drawer: factions (spec §21.5-1, §15) ----

export interface FactionView {
  key: FactionKey;
  name: string;
  leader: number;
  leaderName: string;
  ideology: string;
  ideologyColor: string;
  members: {
    id: number;
    tag: CountryTag;
    name: string;
    leader: boolean;
    /** Capitulated or gone (struck through). */
    out: boolean;
  }[];
  /** Not in a faction: asking to join this one (sent to its leader); null otherwise. */
  request: Gate | null;
}

export interface Gate {
  cost: string | null;
  /** The PP it costs (0: none), to see it was spent. */
  pp: number;
  block: string | null;
}

export interface FactionTab {
  mine: FactionView | null;
  amLeader: boolean;
  others: FactionView[];
  /** Not in a faction, a major: "Found a faction". */
  create: Gate | null;
  /** The leader's invite list: the unaligned countries. */
  invite: { id: number; tag: CountryTag; name: string; gate: Gate }[];
}

function factionView(
  i: PoliticsModelInput,
  f: { id: FactionKey; leader: number; members: number[] },
): FactionView {
  const ruling = i.view.summary(f.leader)?.ruling ?? -1;
  return {
    key: f.id,
    name: factionName(f.id, i.game),
    leader: f.leader,
    leaderName: f.leader > 0 ? nameOf(i.game, f.leader) : "",
    ideology: ruling < 0 ? "" : ideologyName(ruling),
    ideologyColor: ruling < 0 ? "#a3a3a3" : IDEOLOGY_COLORS[ruling],
    members: f.members
      .map((id) => ({ id, tag: tagOf(i.game, id) }))
      .filter((m): m is { id: number; tag: CountryTag } => m.tag !== null)
      .map((m) => ({
        id: m.id,
        tag: m.tag,
        name: countryName(m.tag),
        leader: m.id === f.leader,
        out: !wwActive(i.game, m.id),
      })),
    request: null,
  };
}

type LiveFaction = { id: FactionKey; leader: number; members: number[] };

/**
 * Spec §15.3's ideology rule: `country`'s government is the faction's (its
 * leader's), or a non-aligned one in a non-aligned or fascist faction, or
 * they fight a common enemy. Unknown governments are left to the engine.
 */
function fitsFaction(
  i: PoliticsModelInput,
  country: number,
  f: LiveFaction,
): boolean {
  const ruling = i.view.summary(country)?.ruling;
  const theirs = i.view.summary(f.leader)?.ruling;
  if (ruling === undefined || theirs === undefined || ruling === theirs) {
    return true;
  }
  if (ruling === IDEO_NEU && (theirs === IDEO_NEU || theirs === IDEO_FAS)) {
    return true;
  }
  const enemies = new Set(enemiesOf(i.game, country));
  return f.members.some((m) =>
    enemiesOf(i.game, m).some((e) => enemies.has(e)),
  );
}

/**
 * Spec §15.3: why `country` may not join faction `f` (an invite from its
 * leader or a request of its own); null: it may as far as the screens see.
 * `gov` is the side whose tension gate and spirit rules apply.
 */
function joinBlock(
  i: PoliticsModelInput,
  country: number,
  f: LiveFaction,
  gov: WwOrderBlock | null,
): WwOrderBlock | null {
  if (factionOfId(i.game, country) !== null) return "bad_target";
  if (gov !== null) return gov;
  const atWar = new Set(enemiesOf(i.game, country));
  if (f.members.some((m) => atWar.has(m))) return "faction_war";
  return fitsFaction(i, country, f) ? null : "faction_rule";
}

/** My spirits' rules (spec §9.1). */
function hasRule(d: WwPolDetail | null, rule: string): boolean {
  return (d?.spirits ?? []).some((x) =>
    (CONTENT.spiritIdx.get(x.id)?.rules ?? []).some((r) => r === rule),
  );
}

function ruleNumber(
  d: WwPolDetail | null,
  key: "guaranteeGatePct" | "factionGateMinusPp",
): number | null {
  for (const x of d?.spirits ?? []) {
    for (const r of CONTENT.spiritIdx.get(x.id)?.rules ?? []) {
      if (typeof r === "object" && key in r) {
        return (r as Record<string, number>)[key];
      }
    }
  }
  return null;
}

function diploCost(d: WwPolDetail | null, base: number): number {
  return costWith(base, statOf(d, "diploCostPct"));
}

function costGate(
  s: WwPolSummary | null,
  costPp: number,
  block: WwOrderBlock | null,
): Gate {
  return {
    cost: translateText("ww1936.pol.pp_amount", { pp: costPp }),
    pp: costPp,
    block:
      block !== null
        ? blockText(block)
        : (s?.ppMilli ?? 0) < costPp * 1000
          ? blockText("no_pp")
          : null,
  };
}

export function factionTab(i: PoliticsModelInput): FactionTab {
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  const all = liveFactions(i.game);
  const mineF = all.find((f) => f.members.includes(i.me)) ?? null;
  const mine = mineF === null ? null : factionView(i, mineF);
  const amLeader = mine !== null && mine.leader === i.me;
  const otherFactions = all.filter((f) => f !== mineF && f.members.length > 0);
  const gateOk = factionGate(
    s?.ruling ?? 3,
    i.view.global?.wtBp ?? 0,
    ruleNumber(d, "factionGateMinusPp") ?? 0,
  );
  const block: WwOrderBlock | null = hasRule(d, "no_faction")
    ? "faction_rule"
    : !gateOk
      ? "tension_gate"
      : null;
  const invite: FactionTab["invite"] = [];
  const sc = i.game.worldWarScenario();
  if (amLeader && sc !== null && mineF !== null) {
    for (const tag of sc.countries) {
      const id = sc.smallIdOf(tag);
      if (id === i.me || factionOfId(i.game, id) !== null) continue;
      if (!wwActive(i.game, id)) continue;
      invite.push({
        id,
        tag,
        name: countryName(tag),
        gate: costGate(
          s,
          diploCost(d, WW_COST.factionInvite),
          joinBlock(i, id, mineF, block),
        ),
      });
    }
    invite.sort((a, b) => a.name.localeCompare(b.name));
  }
  // Not in a faction: a request to each other faction, by its own rules.
  const others = otherFactions.map((f) => ({
    ...factionView(i, f),
    request:
      mine === null
        ? costGate(
            s,
            diploCost(d, WW_COST.factionRequest),
            joinBlock(i, i.me, f, block),
          )
        : null,
  }));
  const myTag = tagOf(i.game, i.me);
  return {
    mine,
    amLeader,
    others,
    // Spec §15.3: majors found factions (a focus flag may let a minor; the
    // screens can't see flags, so a minor's button stays hidden).
    create:
      mine === null && myTag !== null && COUNTRIES[myTag].major
        ? costGate(s, diploCost(d, WW_COST.factionCreate), block)
        : null,
    invite,
  };
}

// ---- Diplomacy drawer: wars and goals (spec §21.5-2, §14) ----

export interface WarGoalTab {
  wars: { id: number; tag: CountryTag; name: string }[];
  goals: string[];
  justification: {
    text: string;
    progress: number;
    blocked: string | null;
  } | null;
  against: string[];
}

export function warGoalTab(i: PoliticsModelInput): WarGoalTab {
  const d = i.view.detail(i.me);
  const day = today(i.game);
  const wars = enemiesOf(i.game, i.me)
    .map((id) => ({ id, tag: tagOf(i.game, id) }))
    .filter((w): w is { id: number; tag: CountryTag } => w.tag !== null)
    .map((w) => ({ ...w, name: countryName(w.tag) }));
  const goals = (d?.warGoals ?? []).map((g) =>
    translateText("ww1936.diplo.wars.goal_line", {
      target: nameOf(i.game, g.on),
      type: wargoalName(g.type),
      days: Math.max(0, g.untilDay - day),
    }),
  );
  const j = d?.justification ?? null;
  const against = (i.view.global?.justifying ?? [])
    .filter(([, on]) => on === i.me)
    .map(([by, , left]) =>
      translateText("ww1936.diplo.wars.against_line", {
        country: nameOf(i.game, by),
        days: Math.max(0, left),
      }),
    );
  return {
    wars,
    goals,
    justification:
      j === null
        ? null
        : {
            text: translateText("ww1936.diplo.wars.justify_line", {
              target: nameOf(i.game, j.on),
              type: wargoalName(j.type),
              done: j.progressDays,
              total: j.totalDays,
            }),
            progress:
              j.totalDays <= 0 ? 0 : Math.min(1, j.progressDays / j.totalDays),
            blocked: j.blocked
              ? translateText("ww1936.diplo.wars.justify_blocked")
              : null,
          },
    against,
  };
}

// ---- Diplomacy drawer: treaties (spec §21.5-3, §16) ----

export interface TreatyRow {
  id: number;
  tag: CountryTag | null;
  name: string;
  note: string | null;
  /** Ends it (two taps); null: I can't end it from here. */
  end: { order: WwOrder; block: string | null } | null;
}

export interface TreatyTab {
  given: TreatyRow[];
  received: TreatyRow[];
  naps: TreatyRow[];
  accessGiven: TreatyRow[];
  accessReceived: TreatyRow[];
}

/** Spec §16.2: days until a pact may be broken (0 for a 1936 pact). */
function napBreakIn(
  nap: readonly [number, number, number, boolean],
  day: number,
): number {
  return nap[3] ? 0 : Math.max(0, nap[2] + WW_NAP_BREAK_DAYS - day);
}

export function treatyTab(i: PoliticsModelInput): TreatyTab {
  const g = i.view.global;
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  const day = today(i.game);
  const row = (
    id: number,
    note: string | null,
    end: TreatyRow["end"],
  ): TreatyRow => {
    const tag = tagOf(i.game, id);
    return { id, tag, name: tag === null ? "" : countryName(tag), note, end };
  };
  const breakCost = diploCost(d, WW_COST.napBreak);
  return {
    given: (g?.guarantees ?? [])
      .filter(([by]) => by === i.me)
      .map(([, to]) =>
        row(to, null, {
          order: { kind: "guarantee_end", target: to },
          block: null,
        }),
      ),
    received: (g?.guarantees ?? [])
      .filter(([, to]) => to === i.me)
      .map(([by]) => row(by, null, null)),
    naps: (g?.naps ?? [])
      .filter(([a, b]) => a === i.me || b === i.me)
      .map((n) => {
        const other = n[0] === i.me ? n[1] : n[0];
        const wait = napBreakIn(n, day);
        return row(
          other,
          n[3]
            ? translateText("ww1936.diplo.treaties.nap_start")
            : wait > 0
              ? translateText("ww1936.diplo.treaties.nap_break_in", {
                  days: wait,
                })
              : null,
          {
            order: { kind: "nap_break", target: other },
            block:
              wait > 0
                ? blockText("nap_young")
                : (s?.ppMilli ?? 0) < breakCost * 1000
                  ? blockText("no_pp")
                  : null,
          },
        );
      }),
    accessGiven: (g?.access ?? [])
      .filter(([, from]) => from === i.me)
      .map(([by]) =>
        row(by, null, {
          order: { kind: "access_revoke", target: by },
          block: null,
        }),
      ),
    accessReceived: (g?.access ?? [])
      .filter(([by]) => by === i.me)
      .map(([, from]) => row(from, null, null)),
  };
}

// ---- Diplomacy drawer: the world (spec §21.5-4) ----

export interface WorldTab {
  wtBp: number;
  wtPct: number;
  /** Spec §14.4's thresholds, % (the bar's ticks). */
  ticks: readonly number[];
  top: { tag: CountryTag | null; name: string; pct: string }[];
  nextBeat: string | null;
  news: { tag: CountryTag | null; text: string }[];
}

export const TENSION_TICKS: readonly number[] = [25, 40, 50, 80];

export function worldTab(i: PoliticsModelInput): WorldTab {
  const g = i.view.global;
  const wtBp = g?.wtBp ?? 0;
  // As the engine's AI: it follows history until V-J Day. A fake without a
  // config counts as on.
  const config = i.game.config?.();
  const historical =
    config === undefined || historicalAiActive(config, today(i.game));
  const next = g?.nextBeatDay ?? -1;
  return {
    wtBp,
    wtPct: pctOf(wtBp),
    ticks: TENSION_TICKS,
    top: (g?.threat ?? []).slice(0, 5).map(([id, bp]) => {
      const tag = tagOf(i.game, id);
      return {
        tag,
        name: tag === null ? "" : countryName(tag),
        pct: signedPctText(bp).replace(/^\+/, ""),
      };
    }),
    nextBeat:
      historical && next >= 0
        ? translateText("ww1936.diplo.world.next_beat", {
            date: dateLabel(next),
          })
        : null,
    news: [...i.view.news].reverse().map((n) => ({
      tag: newsTag(n.params),
      text: newsText(i.game, n.id, n.params),
    })),
  };
}

// ---- The player panel's diplomacy (spec §21.5 last paragraph, §14.5) ----

export interface PlayerAction {
  /** data-ww-act: justify, declare, guarantee, … */
  id: string;
  label: string;
  cost: string | null;
  /** The PP it spends (0: none): the screen confirms a request by its spending. */
  costPp: number;
  block: string | null;
  twoTap: boolean;
  /** What it sends; "declare" is P0's declare_war intent; "justify" opens the goal picker. */
  order: WwOrder | "declare" | "justify";
  /**
   * What clears the block, beside its reason: a pact blocks war, and
   * breaking it (50 PP) comes first (HOI4: break, then declare with a goal).
   */
  fix: PlayerAction | null;
}

export interface PlayerActions {
  /** "Fascist government · leader · stability 62% · war support 45%". */
  info: string | null;
  /** "Relations +35": their view of me (spec §16.4's base, see relationBase). */
  relations: string | null;
  actions: PlayerAction[];
}

/**
 * Spec §16.4: the derived part of `of`'s opinion of `about` — same
 * ideology +20 (else −10), same faction +50, at war −100, a pact +10, a
 * guarantee it receives from `about` +20, −1 per 1% of tension `about`
 * made. The timed modifiers (improve relations, penalties) are not in the
 * screens' data.
 */
export function relationBase(
  i: PoliticsModelInput,
  of: number,
  about: number,
): number | null {
  const a = i.view.summary(of);
  const b = i.view.summary(about);
  if (a === null || b === null) return null;
  let v = a.ruling === b.ruling ? 20 : -10;
  const f = factionOfId(i.game, of);
  if (f !== null && f === factionOfId(i.game, about)) v += 50;
  if (enemiesOf(i.game, of).includes(about)) v -= 100;
  if (
    (i.view.global?.naps ?? []).some(
      ([x, y]) => (x === of && y === about) || (x === about && y === of),
    )
  ) {
    v += 10;
  }
  if (guaranteesIn(i, about, of)) v += 20;
  const threat =
    (i.view.global?.threat ?? []).find(([id]) => id === about)?.[1] ?? 0;
  v -= Math.floor(threat / 100);
  return Math.max(-100, Math.min(100, v));
}

function guaranteesIn(i: PoliticsModelInput, by: number, to: number): boolean {
  return (i.view.global?.guarantees ?? []).some(
    ([x, y]) => x === by && y === to,
  );
}

export interface DeclareButton {
  label: string;
  /** Why it can't go now (ww1936.declare.block.*); null: it can. */
  block: string | null;
  blockId: DeclareWarBlock | null;
}

function napWith(i: PoliticsModelInput, other: number) {
  return (i.view.global?.naps ?? []).find(
    ([a, b]) => (a === i.me && b === other) || (a === other && b === i.me),
  );
}

function guarantees(i: PoliticsModelInput, by: number, to: number): boolean {
  return (i.view.global?.guarantees ?? []).some(
    ([x, y]) => x === by && y === to,
  );
}

function isMajor(i: PoliticsModelInput, id: number): boolean {
  const tag = tagOf(i.game, id);
  return tag !== null && COUNTRIES[tag].major;
}

/** P0's reasons (Diplomacy.declareWarBlock) as the screens see them, then P3's. */
function declareBlockOf(
  i: PoliticsModelInput,
  other: number,
): DeclareWarBlock | null {
  const data = i.game.worldWarData();
  if (data === null || i.game.ticks() < data.prepEndTick) return "prep";
  if (other === i.me) return "self";
  // P5 (engine declareWarBlock): both play; an exile may be declared on.
  if (!wwActive(i.game, i.me) || !wwActive(i.game, other)) return "dead";
  const eg = i.game.wwEndgame?.() ?? null;
  if (
    (isCapitulated(i.game, i.me) && eg?.isExile(i.me) !== true) ||
    (isCapitulated(i.game, other) && eg?.isExile(other) !== true)
  ) {
    return "capitulated";
  }
  const f = factionOfId(i.game, i.me);
  if (f !== null && f === factionOfId(i.game, other)) return "faction";
  if (enemiesOf(i.game, i.me).includes(other)) return "at_war";
  // White peace (engine declareWarBlock): a truce holds a year.
  if ((eg?.truceUntil(i.me, other) ?? 0) > today(i.game)) {
    return "truce_active";
  }
  if (napWith(i, other) !== undefined) return "nap";
  if (guarantees(i, i.me, other)) return "guarantor";
  // P5 (spec §9.1, §10): a puppet fights its overlord's enemies only; an
  // exile declares nothing.
  const sub = eg?.subjectOf(i.me) ?? null;
  if (
    sub !== null &&
    (sub.level === "integrated" || sub.level === "puppet") &&
    !enemiesOf(i.game, sub.overlord).includes(other)
  ) {
    return "subject_restricted";
  }
  if (eg?.isExile(i.me) === true) return "exile";
  return null;
}

/**
 * Spec §14.5's button: "Declare war (war goal: conquest)" with a goal; a
 * democracy without one may not; anyone else may, with the penalty in the
 * label. Before my first politics update, P0's plain button. `engine` is
 * the engine's own answer (PlayerInteraction.canDeclareWar): it wins over
 * the view, which can be a tick behind; when it refuses and the view
 * knows no reason, the reason left is the spirit rule (isolation).
 */
export function declareButton(
  i: PoliticsModelInput,
  other: number,
  engine?: boolean,
): DeclareButton {
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  let block: DeclareWarBlock | null = declareBlockOf(i, other);
  const goal = d?.warGoals.find((g) => g.on === other) ?? null;
  let label = translateText("ww1936.declare.button");
  if (s !== null && goal !== null) {
    label = translateText("ww1936.diplo.act.declare_goal", {
      type: wargoalName(goal.type),
    });
  } else if (s !== null && s.ruling === IDEO_DEM) {
    block ??= "democracy_no_goal";
  } else if (s !== null) {
    const bp = tensionFor("declare_no_goal", isMajor(i, other), statsOf(d));
    label = translateText("ww1936.diplo.act.declare_no_goal", {
      tension: Math.round(bp / 100),
    });
  }
  if (engine === true) block = null;
  if (engine === false && block === null) block = "isolation";
  return {
    label,
    block: block === null ? null : translateText(DECLARE_BLOCK_KEYS[block]),
    blockId: block,
  };
}

export interface JustifyOption {
  type: WarGoalType;
  group: string;
  label: string;
  order: WwOrder;
  block: string | null;
}

/** Spec §14.3: one button per war goal (a claim per claimed group the target legally owns). */
export function justifyOptions(
  i: PoliticsModelInput,
  other: number,
): JustifyOption[] {
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  const stats = statsOf(d);
  const majorGuarantors = (i.view.global?.guarantees ?? []).filter(
    ([by, to]) => to === other && isMajor(i, by),
  ).length;
  const costPp = justifyCost(isMajor(i, other), stats);
  const days = justifyDays(stats, 0, majorGuarantors);
  const noPp = (s?.ppMilli ?? 0) < costPp * 1000 ? blockText("no_pp") : null;
  const myTag = tagOf(i.game, i.me);
  const claimed =
    CONTENT.claims
      .find((c) => c.tag === myTag)
      ?.groups.filter((gid) =>
        (CONTENT.groupIdx.get(gid)?.regions ?? []).some(
          (r) => i.view.legalOwner[r] === other,
        ),
      ) ?? [];
  const out: JustifyOption[] = [];
  for (const type of WAR_GOAL_TYPES) {
    for (const group of type === "claim" ? claimed : [""]) {
      const typeText =
        group === ""
          ? wargoalName(type)
          : `${wargoalName(type)} · ${groupName(group)}`;
      out.push({
        type,
        group,
        label: translateText("ww1936.diplo.act.justify_cost", {
          type: typeText,
          pp: costPp,
          days,
        }),
        order: { kind: "justify", target: other, goal: type, group },
        block: noPp,
      });
    }
  }
  return out;
}

/** Spec §14.3: the target is in a faction one of whose members is at war with me or my faction. */
function inEnemyFaction(i: PoliticsModelInput, other: number): boolean {
  const theirs = factionOfId(i.game, other);
  if (theirs === null) return false;
  const mine = factionOfId(i.game, i.me);
  const factions = liveFactions(i.game);
  const side = new Set<number>([i.me]);
  for (const f of factions) {
    if (mine !== null && f.id === mine) f.members.forEach((m) => side.add(m));
  }
  const enemies = new Set<number>();
  for (const s of side) for (const e of enemiesOf(i.game, s)) enemies.add(e);
  return factions.some(
    (f) => f.id === theirs && f.members.some((m) => enemies.has(m)),
  );
}

/** Party support and coups are targeted decisions (spec §16.5): their card for `other`. */
function targetedCard(d: WwPolDetail | null, prefix: string, other: number) {
  return (d?.decisions ?? []).find(
    (c) => c.target === other && c.id.startsWith(prefix),
  );
}

/** What the player panel's info line asks the fog (FogModel; a fake in tests). */
export type CountryFog = Pick<FogModel, "countryView" | "bandOf">;

/**
 * Spec §8.9's player-panel row (final review C I4): the country's
 * government and leader always; its stability and war support as ranges
 * at the rough and close civil bands (never past 100%), exact at the
 * exact band. Without a fog (the depth systems off): exact.
 */
function countryInfoLine(
  o: { ruling: number; leader: string; stabBp: number; wsBp: number },
  other: number,
  fog: CountryFog | undefined,
): string {
  const ideology = ideologyName(o.ruling);
  const leader = personName(o.leader);
  const seen = fog?.countryView(other).stability ?? "exact";
  if (seen === "hidden") {
    return translateText("ww1936.diplo.info_basic", { ideology, leader });
  }
  const pct = (bp: number): string | number => {
    if (seen === "exact" || fog === undefined) return pctOf(bp);
    const label = fogCountLabel(pctOf(bp), fog.bandOf(other, ID_CIVIL));
    const [lo, hi] = label.split("~");
    return hi === undefined ? label : `${lo}~${Math.min(100, Number(hi))}`;
  };
  return translateText("ww1936.diplo.info", {
    ideology,
    leader,
    stab: pct(o.stabBp),
    ws: pct(o.wsBp),
  });
}

export function playerActions(
  i: PoliticsModelInput,
  other: number,
  engineDeclare?: boolean,
  fog?: CountryFog,
): PlayerActions {
  const s = i.view.summary(i.me);
  const d = i.view.detail(i.me);
  const o = i.view.summary(other);
  const g = i.view.global;
  const day = today(i.game);
  const info = o === null ? null : countryInfoLine(o, other, fog);
  const rel = other === i.me ? null : relationBase(i, other, i.me);
  const relations =
    rel === null ? null : translateText("ww1936.diplo.relations", { n: rel });
  if (other === i.me || tagOf(i.game, other) === null) {
    return { info, relations, actions: [] };
  }
  const actions: PlayerAction[] = [];
  const myFaction = factionOfId(i.game, i.me);
  const theirFaction = factionOfId(i.game, other);
  const same = myFaction !== null && myFaction === theirFaction;
  const atWar = enemiesOf(i.game, i.me).includes(other);
  const nap = napWith(i, other);
  const iGuarantee = guarantees(i, i.me, other);
  const gate = (base: number, block: WwOrderBlock | null) =>
    costGate(s, diploCost(d, base), block);
  const push = (
    id: string,
    label: string,
    gt: Gate | null,
    order: PlayerAction["order"],
    twoTap = false,
  ) =>
    actions.push({
      id,
      label,
      cost: gt?.cost ?? null,
      costPp: gt?.pp ?? 0,
      block: gt?.block ?? null,
      twoTap,
      order,
      fix: null,
    });
  // Justify a war goal (spec §14.3): the goal picker shows cost and days.
  if (!atWar && !(d?.warGoals ?? []).some((w) => w.on === other)) {
    const j = justifyGate({
      ruling: s?.ruling ?? 3,
      wtBp: g?.wtBp ?? 0,
      targetThreatBp: (g?.threat ?? []).find(([id]) => id === other)?.[1] ?? 0,
      targetInEnemyFaction: inEnemyFaction(i, other),
      atWarWith: atWar,
      sameFaction: same,
      nap: nap !== undefined,
      iGuarantee,
      noJustifyRule: hasRule(d, "no_justify"),
      busy: (d?.justification ?? null) !== null,
    });
    push(
      "justify",
      translateText("ww1936.diplo.act.justify"),
      {
        cost: translateText("ww1936.pol.pp_amount", {
          pp: justifyCost(isMajor(i, other), statsOf(d)),
        }),
        pp: 0,
        block: j === null ? null : blockText(j),
      },
      "justify",
    );
  }
  // Breaking a pact (spec §16.2): beside the declare button when the pact
  // is what blocks war, else in the list.
  const napBreak: PlayerAction | null =
    nap === undefined
      ? null
      : {
          id: "nap_break",
          label: translateText("ww1936.diplo.act.nap_break"),
          ...(({ cost, pp, block }) => ({ cost, costPp: pp, block }))(
            gate(
              WW_COST.napBreak,
              napBreakIn(nap, day) > 0 ? "nap_young" : null,
            ),
          ),
          twoTap: true,
          order: { kind: "nap_break", target: other },
          fix: null,
        };
  // Declare war (P0's intent, spec §14.5's text).
  let napShown = false;
  if (!atWar && !same) {
    const b = declareButton(i, other, engineDeclare);
    const pactBlocks = napBreak !== null && b.blockId === "nap";
    napShown = pactBlocks;
    actions.push({
      id: "declare",
      label: b.label,
      cost: null,
      costPp: 0,
      block: b.block,
      twoTap: true,
      order: "declare",
      fix: pactBlocks ? napBreak : null,
    });
  }
  // Guarantee (spec §16.1).
  if (iGuarantee) {
    push(
      "guarantee_end",
      translateText("ww1936.diplo.act.guarantee_end"),
      null,
      { kind: "guarantee_end", target: other },
      true,
    );
  } else if (!same) {
    const justified = (g?.justifying ?? []).some(([, on]) => on === other);
    const mineOnThem =
      d?.justification?.on === other ||
      (d?.warGoals ?? []).some((w) => w.on === other);
    const block: WwOrderBlock | null =
      atWar || mineOnThem
        ? "bad_target"
        : !guaranteeGate(
              s?.ruling ?? 3,
              g?.wtBp ?? 0,
              justified,
              ruleNumber(d, "guaranteeGatePct") ?? 25,
            )
          ? "tension_gate"
          : null;
    push(
      "guarantee",
      translateText("ww1936.diplo.act.guarantee"),
      hasRule(d, "free_guarantees")
        ? costGate(s, 0, block)
        : gate(WW_COST.guarantee, block),
      { kind: "guarantee", target: other },
    );
  }
  // Non-aggression pact (spec §16.2).
  if (napBreak !== null) {
    if (!napShown) actions.push(napBreak);
  } else if (!same && !atWar) {
    push(
      "nap_offer",
      translateText("ww1936.diplo.act.nap_offer"),
      gate(WW_COST.nap, null),
      { kind: "nap_offer", target: other },
    );
  }
  // Military access (spec §16.3): a faction has it already.
  const access = g?.access ?? [];
  if (access.some(([by, from]) => by === other && from === i.me)) {
    push(
      "access_revoke",
      translateText("ww1936.diplo.act.access_revoke"),
      null,
      { kind: "access_revoke", target: other },
      true,
    );
  }
  if (
    !same &&
    !atWar &&
    !access.some(([by, from]) => by === i.me && from === other)
  ) {
    push(
      "access_ask",
      translateText("ww1936.diplo.act.access_ask"),
      gate(WW_COST.access, null),
      { kind: "access_ask", target: other },
    );
  }
  // Factions (spec §15.3).
  const ft = factionTab(i);
  if (ft.amLeader && theirFaction === null) {
    push(
      "faction_invite",
      translateText("ww1936.diplo.act.faction_invite"),
      ft.invite.find((x) => x.id === other)?.gate ??
        gate(WW_COST.factionInvite, "bad_target"),
      { kind: "faction_invite", target: other },
    );
  }
  if (myFaction === null && theirFaction !== null) {
    push(
      "faction_request",
      translateText("ww1936.diplo.act.faction_request"),
      ft.others.find((f) => f.key === theirFaction)?.request ?? null,
      { kind: "faction_request", target: other },
    );
  }
  // Relations (spec §16.4).
  if (!atWar) {
    push(
      "improve",
      translateText("ww1936.diplo.act.improve"),
      gate(WW_COST.improve, null),
      { kind: "improve_relations", target: other },
    );
  }
  // Party support and coups (spec §16.5: targeted decisions).
  const party = targetedCard(d, "gen_party_support_", other);
  if (party !== undefined && s !== null) {
    push(
      "support_party",
      translateText("ww1936.diplo.act.support_party", {
        ideology: ideologyName(s.ruling),
      }),
      {
        cost: decisionCostText(party.id, party.costPp),
        pp: party.costPp,
        block: decisionReason(party.state, party.cooldownUntil, day, undefined),
      },
      { kind: "decision_take", decision: party.id, target: other },
    );
  }
  const coup = targetedCard(d, "gen_coup_", other);
  if (coup !== undefined) {
    push(
      "coup",
      translateText("ww1936.diplo.act.coup"),
      {
        cost: decisionCostText(coup.id, coup.costPp),
        pp: coup.costPp,
        block: decisionReason(
          coup.state,
          coup.cooldownUntil,
          day,
          d?.missions.find((m) => m.id === coup.id && m.target === other),
        ),
      },
      { kind: "decision_take", decision: coup.id, target: other },
      true,
    );
  }
  return { info, relations, actions };
}

// ---- Event cards (spec §21.6, §12.5) ----

export interface EventOptionView {
  id: string;
  label: string;
  /** describeEffects' first two lines. */
  effects: string[];
  open: boolean;
  /** Spec §17.5: this option hands my country to someone; null: it doesn't. */
  annexWarning: string | null;
}

export interface EventCardView {
  uid: number;
  eventId: string;
  title: string;
  body: string;
  picture: EventPicture | null;
  pictureUrl: string | null;
  pictureAlt: string;
  from: CountryTag | null;
  fromText: string | null;
  options: EventOptionView[];
  secondsLeft: number;
  /** The time bar, 1..0. */
  fraction: number;
  seconds: string;
  defaultOption: string;
  defaultText: string;
}

/** A selector of an option's effect (`who`, `target`), resolved for this card's receiver. */
function resolveSelector(
  i: PoliticsModelInput,
  card: WwEventCard,
  sel: Selector,
): number {
  if (sel === "self") return i.me;
  if (sel === "from") return card.from;
  if (sel === "target") return card.target;
  if ("tag" in sel) return i.game.worldWarScenario()?.smallIdOf(sel.tag) ?? 0;
  if ("factionLeaderOf" in sel) {
    const key = factionOfId(
      i.game,
      resolveSelector(i, card, sel.factionLeaderOf),
    );
    return liveFactions(i.game).find((f) => f.id === key)?.leader ?? 0;
  }
  // P5 (plan decision 26): the subject's overlord, 0 if none.
  if ("overlordOf" in sel) {
    const of = resolveSelector(i, card, sel.overlordOf);
    return i.game.wwEndgame?.()?.subjectOf(of)?.overlord ?? 0;
  }
  const r = CONTENT.groupIdx.get(sel.ownerOf)?.regions[0];
  return r === undefined ? 0 : (i.view.legalOwner[r] ?? 0);
}

/** Who annexes the receiver if this option is taken: an `annex` (nested too) whose target is me. */
export function annexerOf(
  i: PoliticsModelInput,
  card: WwEventCard,
  effects: readonly Effect[],
): number | null {
  for (const e of effects) {
    if (e.kind === "annex" && resolveSelector(i, card, e.target) === i.me) {
      return resolveSelector(i, card, e.who ?? "self");
    }
    let nested: number | null = null;
    if (e.kind === "if") {
      nested = annexerOf(i, card, e.then) ?? annexerOf(i, card, e.else ?? []);
    } else if (e.kind === "random_list") {
      for (const o of e.options) nested ??= annexerOf(i, card, o.effects);
    }
    if (nested !== null) return nested;
  }
  return null;
}

export function eventCardModel(
  i: PoliticsModelInput,
  card: WwEventCard,
): EventCardView | null {
  const n = CONTENT.eventIdx.get(card.eventId);
  const def = n === undefined ? null : CONTENT.events[n];
  if (def === null) return null;
  const tick = i.game.ticks();
  const secondsLeft = Math.max(0, wwSeconds(i.game, card.deadlineTick - tick));
  const total = Math.max(1, card.deadlineTick - card.firedTick);
  const open = new Set(card.open);
  // Spec §12.5: at the deadline the human default wins over the AI's pick;
  // one that can't be picked by then gives way to the first that can.
  let fallback = def.humanDefault ?? card.aiOption;
  if (!open.has(fallback)) fallback = card.open[0] ?? card.aiOption;
  const fromTag =
    card.from > 0 && card.from !== i.me ? tagOf(i.game, card.from) : null;
  const pic = def.picture ?? null;
  return {
    uid: card.uid,
    eventId: card.eventId,
    title: eventTitle(def.id),
    body: eventDesc(def.id),
    picture: pic,
    pictureUrl:
      pic === null ? null : assetUrl(`images/ww1936/event/${pic}.svg`),
    pictureAlt: pic === null ? "" : translateText(`ww1936.eventui.pic.${pic}`),
    from: fromTag,
    fromText:
      fromTag === null
        ? null
        : translateText("ww1936.eventui.from", {
            country: countryName(fromTag),
          }),
    options: def.options.map((o) => {
      const by = annexerOf(i, card, o.effects);
      return {
        id: o.id,
        label: optionName(def.id, o.id),
        effects: effectLines(o.effects)
          .slice(0, 2)
          .map((l) => l.text),
        open: open.has(o.id),
        annexWarning:
          by === null
            ? null
            : translateText("ww1936.eventui.annex_warning", {
                country: nameOf(i.game, by),
              }),
      };
    }),
    secondsLeft,
    fraction: Math.min(1, Math.max(0, (card.deadlineTick - tick) / total)),
    seconds: translateText("ww1936.eventui.seconds", { s: secondsLeft }),
    defaultOption: fallback,
    defaultText: translateText("ww1936.eventui.default", {
      option: optionName(def.id, fallback),
    }),
  };
}
