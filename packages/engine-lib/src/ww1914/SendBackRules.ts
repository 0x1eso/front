// Great War 1914 ("다시 써 오시오"): what a paper is once rewritten. Pure, so the
// engine runs it and the view tells it the same. A direction eases the named
// cost by a step and takes a step off the paper's first gain: a rewrite is a
// different paper, not a better one. `firmer` does the reverse.
import type {
  GwBackDirection,
  GwPersonState,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwEffect,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";

type Numeric = Extract<GwEffect, { delta: number }>;

const hasDelta = (e: GwEffect): e is Numeric =>
  "delta" in e && typeof e.delta === "number";

/** Effects whose sign says good or bad for the seat. */
const COUNTED: readonly GwEffect["kind"][] = [
  "gauge",
  "inst",
  "trust",
  "person_trust",
  "opinion",
];

function isGain(e: GwEffect): boolean {
  return hasDelta(e) && COUNTED.includes(e.kind) && e.delta > 0;
}

function isCost(e: GwEffect): boolean {
  if (!hasDelta(e)) return false;
  if (e.kind === "temp" || e.kind === "pressure") return e.delta > 0;
  return COUNTED.includes(e.kind) && e.delta < 0;
}

/** The costs a direction eases. */
function eases(d: GwBackDirection, e: GwEffect): boolean {
  if (!isCost(e)) return false;
  switch (d) {
    case "cheaper":
      return e.kind === "gauge" && e.gauge === "money";
    case "gentler":
      return e.kind === "temp" || e.kind === "pressure" || e.kind === "trust";
    case "calmer":
      return (
        e.kind === "inst" ||
        e.kind === "opinion" ||
        (e.kind === "gauge" && (e.gauge === "order" || e.gauge === "morale"))
      );
    case "kinder":
      return e.kind === "person_trust";
    case "firmer":
      return false;
  }
}

function nested(e: GwEffect, f: (l: GwEffect[]) => GwEffect[]): GwEffect {
  if (e.kind === "maybe") return { ...e, then: f(e.then) };
  if (e.kind === "roll") {
    return e.otherwise === undefined
      ? { ...e, then: f(e.then) }
      : { ...e, then: f(e.then), otherwise: f(e.otherwise) };
  }
  return e;
}

function eased(list: readonly GwEffect[], d: GwBackDirection): GwEffect[] {
  return list.flatMap((e): GwEffect[] => {
    if (!hasDelta(e) || !eases(d, e)) {
      return [nested(e, (l) => eased(l, d))];
    }
    const delta = e.delta - Math.sign(e.delta);
    return delta === 0 ? [] : [{ ...e, delta }];
  });
}

/** Moves the first effect `pick` finds by `step`. */
function stepFirst(
  list: readonly GwEffect[],
  pick: (e: GwEffect) => boolean,
  step: number,
): GwEffect[] {
  const at = list.findIndex(pick);
  if (at < 0) return [...list];
  const e = list[at] as Numeric;
  const delta = e.delta + step;
  const rest = list.slice(at + 1);
  return [
    ...list.slice(0, at),
    ...(delta === 0 ? [] : [{ ...e, delta }]),
    ...rest,
  ];
}

function anyEased(list: readonly GwEffect[], d: GwBackDirection): boolean {
  return list.some(
    (e) =>
      eases(d, e) ||
      (e.kind === "maybe" && anyEased(e.then, d)) ||
      (e.kind === "roll" &&
        (anyEased(e.then, d) || anyEased(e.otherwise ?? [], d))),
  );
}

/** The option's effects as the rewritten paper has them. */
export function reworkEffects(
  list: readonly GwEffect[],
  d: GwBackDirection,
): GwEffect[] {
  if (d === "firmer") {
    const up = stepFirst(list, isGain, 1);
    const cost = up.find(isCost) as Numeric | undefined;
    return cost === undefined
      ? up
      : stepFirst(up, isCost, Math.sign(cost.delta));
  }
  if (!anyEased(list, d)) return [...list];
  return stepFirst(eased(list, d), isGain, -1);
}

/** What a tell calls an effect. */
function tellKey(e: GwEffect): string | null {
  switch (e.kind) {
    case "gauge":
      return e.gauge;
    case "inst":
      return e.inst;
    case "temp":
      return "temp";
    case "trust":
      return e.tag.toLowerCase();
    case "person_trust":
      return "role" in e.who ? e.who.role : null;
    default:
      return null;
  }
}

function sums(list: readonly GwEffect[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of list) {
    const k = tellKey(e);
    if (k !== null && hasDelta(e)) {
      out.set(k, (out.get(k) ?? 0) + e.delta);
    }
  }
  return out;
}

/** The option's tell after the rewrite: what moved shows as it now stands. */
export function reworkTell(
  o: Pick<GwOption, "tell" | "effects">,
  d: GwBackDirection,
): string[] {
  const was = sums(o.effects);
  const now = sums(reworkEffects(o.effects, d));
  return o.tell.flatMap((t) => {
    const [key, value] = t.split(":");
    if (value === undefined || !was.has(key)) return [t];
    const v = Number(value) + (now.get(key) ?? 0) - was.get(key)!;
    if (v === 0) return [];
    return [`${key}:${v > 0 ? "+" : ""}${v}`];
  });
}

/** The directions that would change this paper. */
export function backDirections(scene: GwScene): GwBackDirection[] {
  const opts = scene.options ?? [];
  const out: GwBackDirection[] = [];
  for (const d of ["cheaper", "gentler", "calmer", "kinder"] as const) {
    if (opts.some((o) => anyEased(o.effects, d))) out.push(d);
  }
  if (opts.some((o) => o.effects.some((e) => isGain(e) || isCost(e)))) {
    out.push("firmer");
  }
  return out;
}

/** Scene ids a system of its own answers for: a budget, a vote on a bill. */
const OWN_MACHINERY = /^gw_(bm|lv)_/;

/**
 * Whether the rule lets this paper go back at all. It is for what the seat's own
 * people drafted: a ruler's letter is his, and nobody here can rewrite it.
 */
export function backable(scene: GwScene): boolean {
  if (scene.noBack === true || scene.kind === "crisis") return false;
  if (scene.kind === "letter") return false;
  if (scene.kind === "talk" || (scene.options ?? []).length === 0) return false;
  if (OWN_MACHINERY.test(scene.id)) return false;
  return !(scene.options ?? []).some((o) => o.screen !== undefined);
}

/** Percent an author digs in instead of rewriting, by temperament. */
const GW_DIG_PCT: Readonly<Record<GwTemperament, number>> = {
  stubborn: 70,
  arrogant: 55,
  cold: 30,
  cunning: 25,
  anxious: 15,
  weary: 10,
};
/** Each paper of theirs sent back lately makes them less willing. */
const DIG_PER_RECENT = 15;
/** Pride from which, and trust at which, they dig in harder or give way. */
const DIG_PROUD = 4;
const DIG_MOVE = 20;

/** The chance `p` keeps the paper as it was. */
export function digPct(
  p: Pick<GwPersonState, "temperament" | "trust" | "pride">,
  recent: number,
): number {
  let pct = GW_DIG_PCT[p.temperament] + recent * DIG_PER_RECENT;
  if (p.pride >= DIG_PROUD) pct += DIG_MOVE;
  if (p.trust <= -1) pct += DIG_MOVE;
  if (p.trust >= 2) pct -= DIG_MOVE;
  return Math.max(5, Math.min(95, pct));
}
