// Great War 1914 (ww172): who can open a decision's option. A decision's
// option gated by a memory (`when: memory k`) opens once a talk `remember`s k.
// This reads the content once, generically: which talks write each key, what
// else each talk does, and which scenes read each key. The engine asks the
// talk from the decision (engine/ww1914/AskFirst.ts) and leaves out a talk
// whose keys nobody will read again.
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwContent } from "./content/Content";

/** What a talk leaves behind. */
export interface GwTalkWrites {
  /** Every key it can remember, in the order written. */
  keys: readonly string[];
  /** It can do more than remember a plain key: trust, flags, gauges, a card. */
  lasting: boolean;
}

/** Who reads a key. */
export interface GwKeyReads {
  /** Scenes with a `memory` condition on it anywhere. */
  scenes: readonly string[];
  /** Read outside the scenes: acts, powers, the house, the engine itself. */
  elsewhere: boolean;
}

export interface GwAskIndex {
  /** key -> the talks that can remember it, in content order. */
  writers: ReadonlyMap<string, readonly string[]>;
  /** talk id -> what it writes. Only talks that remember something. */
  talks: ReadonlyMap<string, GwTalkWrites>;
  readers: ReadonlyMap<string, GwKeyReads>;
}

/** Keys the engine reads by name (Authority, People, Powers). */
const ENGINE_READS = /^(v_|dismissed_|k_pw_said_)/;

/** Effects that leave nothing but the key: the rest last. */
const PASSING: readonly GwEffect["kind"][] = ["mood", "reason"];

/** A list of effects with `maybe` and `roll` opened up. */
function flat(list: readonly GwEffect[]): GwEffect[] {
  return list.flatMap((e) =>
    e.kind === "maybe"
      ? flat(e.then)
      : e.kind === "roll"
        ? flat([...e.then, ...(e.otherwise ?? [])])
        : [e],
  );
}

/** Every effect a talk's replies can run. */
export function gwTalkEffects(s: GwScene): GwEffect[] {
  return flat(
    Object.values(s.nodes ?? {}).flatMap((n) =>
      n.replies.flatMap((r) => [
        ...r.effects,
        ...(r.gain ?? []),
        ...(r.reacts ?? []).flatMap((x) => x.effects),
      ]),
    ),
  );
}

/** The memory keys a condition asks for, outside any `not`. */
export function gwMemoryKeys(c: GwCond): string[] {
  switch (c.kind) {
    case "all":
    case "any":
      return c.of.flatMap(gwMemoryKeys);
    case "memory":
      return [c.key];
    default:
      return [];
  }
}

/** Every `memory` key read anywhere under `v`. */
function readsIn(v: unknown, out: Set<string>): void {
  if (Array.isArray(v)) {
    for (const x of v) readsIn(x, out);
    return;
  }
  if (v === null || typeof v !== "object") return;
  const o = v as Record<string, unknown>;
  if (o.kind === "memory" && typeof o.key === "string") out.add(o.key);
  for (const x of Object.values(o)) readsIn(x, out);
}

function build(c: GwContent): GwAskIndex {
  const writers = new Map<string, string[]>();
  const talks = new Map<string, GwTalkWrites>();
  const readers = new Map<string, { scenes: string[]; elsewhere: boolean }>();
  const reader = (k: string) => {
    let r = readers.get(k);
    if (r === undefined) {
      r = { scenes: [], elsewhere: ENGINE_READS.test(k) };
      readers.set(k, r);
    }
    return r;
  };
  for (const s of c.scenes) {
    const keys = new Set<string>();
    readsIn(s, keys);
    for (const k of keys) reader(k).scenes.push(s.id);
    if (s.kind !== "talk") continue;
    const fx = gwTalkEffects(s);
    const written: string[] = [];
    for (const e of fx) {
      if (e.kind !== "remember" || written.includes(e.key)) continue;
      written.push(e.key);
      const list = writers.get(e.key) ?? [];
      list.push(s.id);
      writers.set(e.key, list);
    }
    if (written.length === 0) continue;
    const lasting =
      (s.after ?? []).length > 0 ||
      fx.some(
        (e) =>
          !PASSING.includes(e.kind) &&
          !(e.kind === "remember" && (e.weight ?? 0) === 0),
      );
    talks.set(s.id, { keys: written, lasting });
  }
  // Everything else in the content: what reads a key there reads it for good.
  for (const [field, v] of Object.entries(c)) {
    if (field === "scenes" || field === "people") continue;
    const keys = new Set<string>();
    readsIn(v, keys);
    for (const k of keys) reader(k).elsewhere = true;
  }
  return { writers, talks, readers };
}

const built = new WeakMap<GwContent, GwAskIndex>();

/** The index of `c`, built once per content object. */
export function gwAskIndex(c: GwContent): GwAskIndex {
  let i = built.get(c);
  if (i === undefined) {
    i = build(c);
    built.set(c, i);
  }
  return i;
}
