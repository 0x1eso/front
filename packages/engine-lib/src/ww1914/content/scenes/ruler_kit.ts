import type { GwRulerSide } from "@openfront/engine-api/ww1914/GwRuler";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * The ruler's scenes are short and all of a kind: this keeps them to their
 * facts. The price an option shows is read from its effects, so nothing on a
 * card can be hidden by forgetting a `tell`.
 */
export const ruler = (
  side: GwRulerSide,
  delta: number,
  key: string,
): GwEffect => ({ kind: "ruler", side, delta, key });

export const low = (side: GwRulerSide, max: number): GwCond => ({
  kind: "ruler",
  side,
  max,
});
export const high = (side: GwRulerSide, min: number): GwCond => ({
  kind: "ruler",
  side,
  min,
});
export const rulerIs = (...of: string[]): GwCond => ({ kind: "ruler_is", of });
export const war: GwCond = world({ is: "war" });
export const date = (from: string, to: string): GwCond =>
  world({ is: "date", from, to });
export const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** The tell tokens of what will happen, in the order it was written. */
function tells(effects: readonly GwEffect[]): string[] {
  return effects.flatMap((e) => {
    switch (e.kind) {
      case "ruler":
        return [`${e.side}:${signed(e.delta)}`];
      case "gauge":
        return [`${e.gauge}:${signed(e.delta)}`];
      case "inst":
        return [`${e.inst}:${signed(e.delta)}`];
      case "audiences":
        return [`audiences:${signed(e.delta)}`];
      case "person_trust":
        return [`trust:${signed(e.delta)}`];
      default:
        return [];
    }
  });
}

export const opt = (
  id: string,
  effects: readonly GwEffect[] = [],
  when?: GwCond,
): GwOption => ({
  id,
  tell: tells(effects),
  effects: [...effects],
  ...(when === undefined ? {} : { when }),
});

type Base = Pick<GwScene, "id" | "nation" | "kind" | "cast"> &
  Partial<GwScene> & { when?: GwCond };

/** A scene of a ruler's life: dealt once unless it says otherwise, in the war. */
export const life = (s: Base): GwScene => ({
  salience: 5,
  tags: ["people", "tension_down"],
  once: true,
  variants: [v("base")],
  ...s,
});

/** Someone close: a called scene must never lack its cast, or the warning is lost. */
export const closeBy: GwCastRule = {
  any_of: [{ office: "court" }, { favourite: true }, { rival: true }],
};
export const seniorBy: GwCastRule = {
  any_of: [{ office: "chancellor" }, { office: "foreign" }, { rival: true }],
};

/** Called by a bottom of the card: only the rule deals it. */
export const called = (s: Base): GwScene =>
  life({
    salience: 9,
    tags: ["people"],
    once: false,
    cooldown: 0,
    scheduledOnly: true,
    ...s,
  });

type ReplyRest = Partial<Pick<GwReply, "when" | "gain" | "miss" | "reacts">>;

export const reply = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  next: string | null,
  effects: readonly GwEffect[] = [],
  rest: ReplyRest = {},
): GwReply => ({
  id,
  stance,
  kind,
  tell: tells(effects),
  effects: [...effects],
  next,
  ...rest,
});

/** A node with one line, or several whose last has no `when`. */
export const node = (
  replies: readonly GwReply[],
  says: readonly GwVariant[] = [v("base")],
): GwNode => ({ says: [...says], replies: [...replies] });

/** The person is called to the desk from the people screen. */
export const summons = (
  s: Pick<GwScene, "id" | "nation" | "nodes"> & {
    person: string;
    when?: GwCond;
    variants?: readonly GwVariant[];
  },
): GwScene => {
  const { person, variants, ...rest } = s;
  return life({
    kind: "talk",
    salience: 3,
    tags: ["people"],
    cast: { who: { person } },
    who: "who",
    start: "open",
    summon: true,
    variants: [...(variants ?? [v("base")])],
    ...rest,
  });
};
