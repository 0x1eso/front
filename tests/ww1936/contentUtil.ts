// World War 1936 P3: what the content tests share (plan Task 1 Step 15).
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import fs from "fs";
import path from "path";

const readLang = (name: string): unknown =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources/lang", name), "utf8"),
  );
export const en = readLang("en.json");
export const ko = readLang("ko.json");

export function keyIn(json: unknown, key: string): string | undefined {
  let o: unknown = json;
  for (const part of key.split(".")) {
    o = (o as Record<string, unknown> | undefined)?.[part];
  }
  return typeof o === "string" ? o : undefined;
}

/** The key has a text in both en.json and ko.json. */
export const hasKey = (key: string): boolean =>
  (keyIn(en, key) ?? "").length > 0 && (keyIn(ko, key) ?? "").length > 0;

/** Every effect, depth first (if / random_list children included). */
export function walkEffects(
  list: readonly Effect[],
  f: (e: Effect) => void,
): void {
  for (const e of list) {
    f(e);
    if (e.kind === "if") {
      walkEffects(e.then, f);
      walkEffects(e.else ?? [], f);
    }
    if (e.kind === "random_list") {
      for (const o of e.options) walkEffects(o.effects, f);
    }
  }
}

/** Every leaf condition. */
export function walkConds(
  c: Condition | undefined,
  f: (leaf: Condition) => void,
): void {
  if (c === undefined) return;
  if ("all" in c) c.all.forEach((x) => walkConds(x, f));
  else if ("any" in c) c.any.forEach((x) => walkConds(x, f));
  else if ("not" in c) walkConds(c.not, f);
  else f(c);
}

/** Every effect list of the whole content, with where it is. */
export function allEffectLists(): [string, readonly Effect[]][] {
  const out: [string, readonly Effect[]][] = [];
  for (const f of CONTENT.focuses) out.push([`focus ${f.id}`, f.effects]);
  for (const e of CONTENT.events) {
    for (const o of e.options) {
      out.push([`event ${e.id}.${o.id}`, o.effects]);
    }
  }
  for (const d of CONTENT.decisions) {
    out.push([`decision ${d.id}`, d.effects ?? []]);
    out.push([`decision ${d.id} complete`, d.completeEffects ?? []]);
    out.push([`decision ${d.id} fail`, d.failEffects ?? []]);
  }
  // P5 (P5 spec §17.6): a beat whose act is effects.
  for (const b of CONTENT.beats) {
    if (b.act.kind === "effects") out.push([`beat ${b.id}`, b.act.effects]);
  }
  return out;
}

/**
 * Every condition of the whole content, with where it is: available,
 * bypass, cancelIf, trigger, option.available, visible, target.among,
 * failIf, the AI mods, and the conditions of `if` effects.
 */
export function allConditions(): [string, Condition | undefined][] {
  const out: [string, Condition | undefined][] = [];
  const mods = (
    at: string,
    w: { mods?: readonly { if: Condition }[] } | undefined,
  ) => (w?.mods ?? []).forEach((m, i) => out.push([`${at} ai mod ${i}`, m.if]));
  for (const f of CONTENT.focuses) {
    out.push([`focus ${f.id} available`, f.available]);
    out.push([`focus ${f.id} bypass`, f.bypass]);
    out.push([`focus ${f.id} cancelIf`, f.cancelIf]);
    mods(`focus ${f.id}`, f.ai);
  }
  for (const e of CONTENT.events) {
    out.push([`event ${e.id} trigger`, e.trigger]);
    for (const o of e.options) {
      out.push([`event ${e.id}.${o.id} available`, o.available]);
      mods(`event ${e.id}.${o.id}`, o.ai);
    }
  }
  for (const d of CONTENT.decisions) {
    out.push([`decision ${d.id} visible`, d.visible]);
    out.push([`decision ${d.id} available`, d.available]);
    out.push([`decision ${d.id} among`, d.target?.among]);
    out.push([`decision ${d.id} failIf`, d.failIf]);
    mods(`decision ${d.id}`, d.ai);
  }
  // P5 (pre-flight §0-7): the beats' situations; the peace rows' conditions.
  for (const b of CONTENT.beats) out.push([`beat ${b.id} when`, b.when]);
  for (const r of CONTENT.peace) {
    out.push([`peace ${r.loser} when`, r.when]);
    r.lines.forEach((l, i) => out.push([`peace ${r.loser}.${i} when`, l.when]));
  }
  for (const [at, list] of allEffectLists()) {
    walkEffects(list, (e) => {
      if (e.kind === "if") out.push([`${at} if`, e.cond]);
    });
  }
  return out;
}

/**
 * Target counts (spec §19, §26.2; controller ruling R19): the trees are
 * exact, the rest minimums (Task 18's). Until Task 18 a table may still be
 * empty (0): the content lanes fill them.
 */
export const CONTENT_TARGETS = {
  generic: 31,
  DEU: 50,
  GBR: 48,
  SUN: 47,
  // P5 (P5 spec §18, pre-flight §0-12): the four new trees, 46 each.
  ITA: 47,
  JPN: 96,
  FRA: 47,
  USA: 46,
  events: 100,
  decisions: 36,
  spirits: 65,
  persons: 60,
  // P5 (P5 spec §17, §19.7): minimums of the endgame tables (K5's).
  peace: 14,
  p5Groups: 70,
  p5Beats: 40,
  dormant: 14,
} as const;

/** P6 (spec §11.1 table): each regional pack's own focuses (Phase A: K1–K4). */
export const PACK_TARGETS = {
  chn: 30,
  ccp: 22,
  chw: 20,
  spa: 28,
  pol: 22,
  tur: 20,
  bal: 30,
  nor: 26,
  lat: 26,
  dom: 24,
  new: 8,
} as const;

/** 0 (not filled yet) or at least the target (R19). */
export function emptyOrAtLeast(n: number, min: number): boolean {
  return n === 0 || n >= min;
}

/**
 * The events the engine fires itself (spec §5.4, §5.5, §12.6, §13.2, §14.3,
 * §15.5, §16.1; controller ruling R19): the generic ten, and every
 * <tag>_election_<year> (fired by the election rule).
 */
export const ENGINE_EVENTS = [
  "gen_election",
  "gen_regime_crisis",
  "gen_guarantee_called",
  "gen_call_to_arms",
  "gen_diplo_faction_invite",
  "gen_diplo_faction_request",
  "gen_diplo_nap",
  "gen_diplo_access",
  "gen_coup_done",
  "gen_justified_against",
  // P5 (P5 spec §9–§13, §20.8): the endgame's engine events.
  "gen_subject_upgrade",
  "gen_diplo_lend_lease",
  "gen_exile_formed",
  "gen_uprising",
  "gen_peace_conference",
  "gen_volunteers_arrive",
] as const;
export const ENGINE_EVENT_PATTERN = /^[a-z]{3}_election_\d{4}$/;

/** Never a person (titles only): convicted at Nuremberg/Tokyo or later trials, SS/Gestapo/NKVD heads, purge-trial leaders, Korea/Taiwan governors. */
export const BANNED_PERSON_IDS = [
  "goering",
  "ribbentrop",
  "keitel",
  "jodl",
  "neurath",
  "raeder",
  "doenitz",
  "funk",
  "speer",
  "sauckel",
  "seyss_inquart",
  "frank",
  "frick",
  "rosenberg",
  "streicher",
  "kaltenbrunner",
  "himmler",
  "heydrich",
  "goebbels",
  "hess",
  "schirach",
  "papen_convicted",
  "milch",
  "kesselring",
  "yagoda",
  "yezhov",
  "beria",
  "vyshinsky",
  "ulrikh",
  "antonescu",
  "minami",
  "koiso",
  "ugaki",
  "tojo",
  "hirota",
  "araki",
  "itagaki",
  "matsui",
  "muto",
  "doihara",
  "kimura",
  "hata",
  "oshima",
  "shiratori",
  "togo",
  "shimada",
  "kaya",
  "hiranuma",
  "konoe",
  "abe_nobuyuki",
  "yonai",
  "suzuki_kantaro",
  "kuniaki",
  "hasegawa_kiyoshi",
  "ando_rikichi",
] as const;

/** The content's key groups under ww1936 (the screens' keys are not content). */
export const CONTENT_KEY_GROUPS = [
  "focus",
  "focus_desc",
  "event_title",
  "event_desc",
  "event_opt",
  "news",
  "decision",
  "decision_desc",
  "spirit",
  "spirit_desc",
  "person",
  "title",
] as const;

/** Every text under the content key groups of one language file. */
export function contentTexts(json: unknown): [string, string][] {
  const out: [string, string][] = [];
  const walk = (o: unknown, at: string) => {
    if (typeof o === "string") out.push([at, o]);
    else if (typeof o === "object" && o !== null) {
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    }
  };
  const root = (json as { ww1936?: Record<string, unknown> }).ww1936 ?? {};
  for (const g of CONTENT_KEY_GROUPS) walk(root[g], `ww1936.${g}`);
  return out;
}
