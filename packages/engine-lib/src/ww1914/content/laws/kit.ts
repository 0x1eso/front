import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  candid,
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwReply,
  GwVariant,
  moody,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwLawDraft, GwLawRow } from "../../LawRows";

/** Authoring words for the bill rows. */
export const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
export const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
export const men = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });
export const war: GwCond = world({ is: "war" });
export const since = (from: string): GwCond => world({ is: "date", from });
export const until = (to: string): GwCond => world({ is: "date", to });
export const low = (g: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
export const draft = (
  id: string,
  support: number,
  tell: string[],
  effects: GwEffect[] = [],
  when?: GwCond,
): GwLawDraft =>
  when === undefined
    ? { id, support, tell, effects }
    : { id, support, tell, effects, when };
export const isText = (law: string, text: string): GwCond =>
  world({ is: "law", id: law, of: ["force", "vote"], text });
export const office = (o: GwOffice): GwCastRule => ({ office: o });
export const person = (p: string): GwCastRule => ({ person: p });
export const either = (...rules: GwCastRule[]): GwCastRule => ({
  any_of: rules as Extract<GwCastRule, { any_of: unknown }>["any_of"],
});
/** Whoever is at hand when the office stands empty. */
export const held = (o: GwOffice): GwCastRule =>
  either(office(o), { favourite: true });

const who = role("who");
const reply = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  next: string | null,
  rest: Partial<GwReply> = {},
): GwReply => ({ id, stance, kind, tell: [], effects: [], next, ...rest });

export interface LawTalk {
  who: GwCastRule;
  /** How the seat asks, and how it leans on them. */
  ask: GwReply["stance"];
  push: GwReply["stance"];
  /** What they want for it: shown, and paid when it is taken. */
  tell: string[];
  price: GwEffect[];
  /** What it wins the bill. */
  wins: number;
  /** Tempers with a first line of their own (`open` says `<temper>`). */
  tempers?: GwTemperament[];
}

/**
 * The talk around a bill. Open: ask or lean. Ask, and they say how the count
 * really stands, straight only if they will; from there what they would want
 * for it. Leaning lands or it shuts them. Each node's lines are in the pack.
 */
export function lawTalk(law: string, t: LawTalk): GwLawRow["talk"] {
  const won = doWorld({ do: "law_support", law, delta: t.wins });
  const opening: GwVariant[] = [
    ...(t.tempers ?? []).map((m) => ({ id: m, when: moody(who, m) })),
    { id: "base" },
  ];
  const sour = world({ is: "law_count", id: law, max: -3 });
  const nodes: Record<string, GwNode> = {
    open: {
      says: opening,
      replies: [
        reply("ask", t.ask, "ask", "find", {
          reacts: [
            {
              when: { kind: "person_trust", who, max: -2 },
              next: "shut",
              effects: [],
            },
          ],
        }),
        reply("push", t.push, "push", "terms", {
          tell: ["trust:-1"],
          effects: [trustOf(who, -1)],
          miss: "shut",
        }),
        reply("leave", "warm", "leave", null),
      ],
    },
    find: {
      says: [
        { id: "straight", when: candid(who) },
        { id: "far", when: sour },
        { id: "base" },
      ],
      replies: [
        reply("trade", "frank", "deal", "terms"),
        reply("enough", "cold", "leave", null),
      ],
    },
    terms: {
      says: [{ id: "base" }],
      replies: [
        reply("take", "warm", "deal", null, {
          tell: [...t.tell, "support:+" + String(t.wins)],
          effects: [remember(`law_talk_${law}`), won, ...t.price],
        }),
        reply("no", "cold", "leave", null),
      ],
    },
    shut: { says: [{ id: "base" }], replies: [reply("end", "cold", "leave", null)] },
  };
  return { who: t.who, start: "open", nodes };
}
