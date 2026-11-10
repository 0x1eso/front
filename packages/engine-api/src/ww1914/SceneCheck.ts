// Great War 1914: what can be checked across all the scenes at once. A scene
// alone is checked by gwSceneProblems; a pack by gwPackProblems (GwPack.ts).
// Pure functions over content: the content test and the simulation report use
// them, the engine doesn't.
import {
  GW_LINES,
  GW_OFFICES,
  GW_SECRETS,
  type GwPersonDef,
} from "./GreatWarTypes";
import { GwCond, GwEffect, GwScene, GwWho } from "./SceneDsl";

function walkCond(c: GwCond | undefined, f: (x: GwCond) => void): void {
  if (c === undefined) return;
  f(c);
  if (c.kind === "all" || c.kind === "any") {
    for (const x of c.of) walkCond(x, f);
  }
  if (c.kind === "not") walkCond(c.of, f);
}

/** Every effect in a list, the nested ones (`maybe`, `roll`) included. */
export function walkEffects(
  list: readonly GwEffect[],
  f: (e: GwEffect) => void,
): void {
  for (const e of list) {
    f(e);
    if (e.kind === "maybe") walkEffects(e.then, f);
    if (e.kind === "roll") {
      walkEffects(e.then, f);
      walkEffects(e.otherwise ?? [], f);
    }
  }
}

/** All the effects a scene can run. */
export function gwSceneEffects(s: GwScene): GwEffect[] {
  const out: GwEffect[] = [];
  const add = (e: GwEffect) => out.push(e);
  for (const o of s.options ?? []) walkEffects(o.effects, add);
  for (const n of Object.values(s.nodes ?? {})) {
    for (const r of n.replies) {
      walkEffects(r.effects, add);
      walkEffects(r.gain ?? [], add);
      for (const x of r.reacts ?? []) walkEffects(x.effects, add);
    }
  }
  return out;
}

/** All the conditions a scene can ask. */
export function gwSceneConds(s: GwScene): GwCond[] {
  const out: GwCond[] = [];
  const add = (c: GwCond) => out.push(c);
  for (const a of s.after ?? []) walkCond(a.when, add);
  const onEffect = (e: GwEffect) => {
    if (e.kind === "maybe") walkCond(e.when, add);
    if (e.kind === "promise") walkCond(e.keep, add);
  };
  walkCond(s.when, add);
  for (const v of s.variants) walkCond(v.when, add);
  for (const list of Object.values(s.voices ?? {})) {
    for (const v of list) walkCond(v.when, add);
  }
  for (const o of s.options ?? []) walkCond(o.when, add);
  for (const n of Object.values(s.nodes ?? {})) {
    for (const v of n.says) walkCond(v.when, add);
    for (const r of n.replies) {
      walkCond(r.when, add);
      for (const x of r.reacts ?? []) walkCond(x.when, add);
    }
  }
  gwSceneEffects(s).forEach(onEffect);
  return out;
}

/** Memory keys the engine writes by itself; `kept_` and `broke_` + a promise. */
export const GW_ENGINE_MEMORY = [
  "talk_left",
  "talk_well",
  "talk_ill",
  ...GW_OFFICES.map((o) => `succeeded_${o}`),
  // A premier the head pressed into resigning (People.pressPremier).
  "premier_resigned",
  // What a signer said when sounded out (Powers.ts, ww169).
  "k_pw_said_yes",
  "k_pw_said_no",
] as const;

/**
 * Flags nothing sets any more but scenes still read, always false. f_pm_lg:
 * Asquith never hands the seat to Lloyd George (ww169, owner's 2B).
 */
export const GW_RETIRED_FLAGS: readonly string[] = ["f_pm_lg"];

/**
 * References that lead nowhere, across every scene. `outside` lists flags,
 * memory keys and scene ids set or called by code rather than by a scene.
 */
export function gwContentProblems(
  scenes: readonly GwScene[],
  people: readonly GwPersonDef[],
  outside: readonly string[] = [],
): string[] {
  const out: string[] = [];
  const ids = new Map(scenes.map((s) => [s.id, s]));
  const persons = new Set(people.map((p) => p.id));
  const flags = new Set<string>([...GW_RETIRED_FLAGS, ...outside]);
  const memories = new Set<string>([...GW_ENGINE_MEMORY, ...outside]);
  const called = new Set<string>(outside);
  const secrets = new Set<string>(GW_SECRETS);
  for (const s of scenes) {
    for (const e of gwSceneEffects(s)) {
      if (e.kind === "flag") flags.add(e.flag);
      if (e.kind === "remember") memories.add(e.key);
      // Government.ts keeps the day a threat was beaten.
      if (e.kind === "world" && e.of.do === "gov_beaten") {
        memories.add(`gov_held_${e.of.id}`);
      }
      if (e.kind === "promise") {
        memories.add(`kept_${e.key}`);
        memories.add(`broke_${e.key}`);
      }
      if (e.kind === "schedule") called.add(e.scene);
      if (e.kind === "promise" && e.back !== undefined) called.add(e.back);
    }
    for (const a of s.after ?? []) called.add(a.scene);
  }
  const person = (s: GwScene, w: GwWho | undefined) => {
    if (w !== undefined && "person" in w && !persons.has(w.person)) {
      out.push(`${s.id}: no person ${w.person}`);
    }
    if (w !== undefined && "role" in w && s.cast[w.role] === undefined) {
      if (w.role !== "who") out.push(`${s.id}: no role ${w.role}`);
    }
  };
  for (const s of scenes) {
    for (const rule of Object.values(s.cast)) {
      for (const r of "any_of" in rule ? rule.any_of : [rule]) {
        if ("person" in r) person(s, { person: r.person });
      }
    }
    for (const c of gwSceneConds(s)) {
      if ("who" in c) person(s, c.who);
      if (c.kind === "flag" && !flags.has(c.flag)) {
        out.push(`${s.id}: flag ${c.flag} is never set`);
      }
      if (c.kind === "memory" && !memories.has(c.key)) {
        out.push(`${s.id}: memory ${c.key} is never written`);
      }
      if (c.kind === "seen" && !ids.has(c.scene)) {
        out.push(`${s.id}: seen ${c.scene} is no scene`);
      }
      if (c.kind === "secret" && !secrets.has(c.id)) {
        out.push(`${s.id}: secret ${c.id} is not in GW_SECRETS`);
      }
      // Line numbers move when a front is laid out again; names don't.
      if (c.kind === "line") {
        out.push(`${s.id}: name the line with world \`front\`, not a number`);
      }
      if (c.kind === "world" && c.of.is === "front") {
        for (const name of [c.of.from, c.of.to]) {
          if (name !== undefined && !GW_LINES[c.of.theatre].includes(name)) {
            out.push(`${s.id}: ${c.of.theatre} has no line ${name}`);
          }
        }
      }
      if (c.kind === "chose") {
        const target = ids.get(c.scene);
        if (target === undefined) {
          out.push(`${s.id}: chose ${c.scene} is no scene`);
        } else if (c.pick !== undefined && !picksOf(target).includes(c.pick)) {
          out.push(`${s.id}: ${c.scene} has no pick ${c.pick}`);
        }
      }
    }
    for (const a of s.after ?? []) {
      if (ids.get(a.scene)?.silent !== true) {
        out.push(`${s.id}: after ${a.scene} is no silent card`);
      }
    }
    for (const e of gwSceneEffects(s)) {
      if ("who" in e) person(s, e.who);
      if (e.kind === "schedule" && !ids.has(e.scene)) {
        out.push(`${s.id}: schedule ${e.scene} is no scene`);
      }
      if (e.kind === "promise" && e.back !== undefined && !ids.has(e.back)) {
        out.push(`${s.id}: back ${e.back} is no scene`);
      }
    }
  }
  for (const s of scenes) {
    const byPromise = s.cast !== undefined && isCalled(s);
    const free =
      called.has(s.id) ||
      byPromise ||
      s.byAct === true ||
      s.prologue !== undefined;
    if (s.scheduledOnly === true && !free) {
      out.push(`${s.id}: scheduledOnly, and nothing schedules it`);
    }
  }
  return out;
}

function isCalled(s: GwScene): boolean {
  return Object.values(s.cast).some((r) => "called" in r);
}

function picksOf(s: GwScene): string[] {
  return [
    ...(s.options ?? []).map((o) => o.id),
    ...Object.values(s.nodes ?? {}).flatMap((n) => n.replies.map((r) => r.id)),
  ];
}

/** A talk that can open a decision's option (design §5.6). */
export interface GwTalkLink {
  talk: string;
  /** The memory key or flag that does it. */
  key: string;
  scene: string;
  option: string;
}

/** Every talk-to-option link in the content. */
export function gwTalkLinks(scenes: readonly GwScene[]): GwTalkLink[] {
  const setBy = new Map<string, string[]>();
  for (const s of scenes) {
    if (s.kind !== "talk") continue;
    for (const e of gwSceneEffects(s)) {
      const key =
        e.kind === "remember" ? e.key : e.kind === "flag" ? e.flag : null;
      if (key === null) continue;
      const talks = setBy.get(key) ?? [];
      if (!talks.includes(s.id)) talks.push(s.id);
      setBy.set(key, talks);
    }
  }
  const out: GwTalkLink[] = [];
  for (const s of scenes) {
    for (const o of s.options ?? []) {
      const keys: string[] = [];
      walkCond(o.when, (c) => {
        if (c.kind === "memory") keys.push(c.key);
        if (c.kind === "flag") keys.push(c.flag);
      });
      for (const key of keys) {
        for (const talk of setBy.get(key) ?? []) {
          out.push({ talk, key, scene: s.id, option: o.id });
        }
      }
    }
  }
  return out;
}
