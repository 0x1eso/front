// Great War 1914 (ww190 §3): Austria-Hungary ruling land it holds, and its own
// land under foreign rule. Data only; the text is in
// resources/ww1914/ko/AUH.rule.json. Conditions and effects are S2's (Rule.ts).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldEffect } from "@openfront/engine-api/ww1914/WorldDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  card,
  gauge,
  inst,
  maybe,
  office,
  opinion,
  pick,
  trust,
  w,
} from "./auh_years";

const COS = office("chief_of_staff");
const FM = office("foreign");
const PM = office("chancellor");
const WAR = office("war");

type RuleCh = Omit<Extract<GwWorldEffect, { do: "rule" }>, "do" | "of">;
const rule = (of: GwTag, ch: RuleCh): GwEffect =>
  doWorld({ do: "rule", of, ...ch });
const rules = (of: GwTag, min?: number): GwCond =>
  w(min === undefined ? { is: "rule", of } : { is: "rule", of, min });
const taken = (from: GwTag, min: number): GwCond =>
  w({ is: "land_taken", from, min });
const resist = (of: GwTag, min: number): GwCond => w({ is: "resist", of, min });

/** The lands a ruled card can mean: each takes its own step. */
const LANDS: readonly GwTag[] = ["SRB", "MNE", "RUS", "ITA", "ROU", "ALB"];
const eachResisting = (ch: RuleCh): GwEffect[] =>
  LANDS.map((t) => maybe(resist(t, 2), rule(t, ch)));

const RULER: readonly GwScene[] = [
  card({
    id: "auh_oc_serbia",
    when: all(taken("SRB", 3), rules("SRB")),
    cast: { cos: COS, pm: PM },
    vs: [["hard", rules("SRB", 2)], ["base"]],
    picks: [
      pick("army", rule("SRB", { policy: "army", hard: 2 }), inst("army", 1)),
      pick("civil", rule("SRB", { policy: "civil", hard: 1 })),
      pick(
        "relief",
        rule("SRB", { policy: "civil", relief: true }),
        inst("nations", 1),
        inst("hungary", -1),
      ),
    ],
    salience: 7,
    tags: ["war", "home"],
    once: true,
  }),
  card({
    id: "auh_oc_poland",
    when: all(
      w({ is: "land_taken", from: "RUS", group: ["russian_poland"], min: 3 }),
      rules("RUS"),
    ),
    cast: { fm: FM, pm: PM },
    vs: [
      [
        "warsaw",
        w({ is: "land_taken", tag: "DEU", from: "RUS", place: ["warsaw"] }),
      ],
      ["base"],
    ],
    picks: [
      pick("army", rule("RUS", { policy: "army", hard: 1 }), inst("army", 1)),
      pick("civil", rule("RUS", { policy: "civil", hard: 1 })),
      pick(
        "kingdom",
        rule("RUS", { policy: "client", client: "poland" }),
        inst("nations", 1),
        trust("DEU", -1),
      ),
    ],
    salience: 7,
    tags: ["war", "foreign"],
    once: true,
  }),
  card({
    id: "auh_oc_italy",
    when: all(taken("ITA", 3), rules("ITA")),
    cast: { cos: COS, war: WAR },
    vs: [["hungry", { kind: "gauge", gauge: "bread", max: 1 }], ["base"]],
    picks: [
      pick(
        "harvest",
        rule("ITA", { policy: "army", hard: 2 }),
        gauge("bread", 1),
      ),
      pick("civil", rule("ITA", { policy: "civil", hard: 1 })),
      pick(
        "relief",
        rule("ITA", { policy: "civil", relief: true }),
        gauge("bread", -1),
      ),
    ],
    salience: 7,
    tags: ["war"],
    once: true,
  }),
  card({
    id: "auh_oc_requisition",
    when: rules("SRB", 1),
    cast: { war: WAR },
    vs: [["hungry", { kind: "gauge", gauge: "bread", max: 1 }], ["base"]],
    picks: [
      pick("more", rule("SRB", { hard: 1 }), gauge("bread", 1)),
      pick("seed", rule("SRB", { hard: -1 }), opinion("army", -1)),
    ],
    tags: ["war", "home"],
    cooldown: 4,
  }),
  card({
    id: "auh_oc_resistance",
    when: any(...LANDS.map((t) => resist(t, 2))),
    cast: { cos: COS },
    vs: [
      ["serbia", resist("SRB", 2)],
      ["montenegro", resist("MNE", 2)],
      ["base"],
    ],
    picks: [
      pick("hostages", ...eachResisting({ hard: 1 }), gauge("order", 1)),
      pick("amnesty", ...eachResisting({ hard: -1 }), opinion("army", -1)),
    ],
    salience: 7,
    tags: ["war", "tension_up"],
    cooldown: 4,
  }),
  card({
    id: "auh_oc_ukraine",
    when: all(
      w({ is: "land_taken", from: "RUS", group: ["ukraine"], min: 3 }),
      rules("RUS"),
    ),
    cast: { fm: FM, cos: COS },
    vs: [["client", w({ is: "rule", of: "RUS", client: "ukraine" })], ["base"]],
    picks: [
      pick(
        "hetman",
        rule("RUS", { policy: "client", client: "ukraine" }),
        trust("DEU", -1),
      ),
      pick(
        "grain",
        rule("RUS", { policy: "army", hard: 1 }),
        gauge("bread", 1),
      ),
    ],
    tags: ["war", "foreign"],
    once: true,
  }),
];

const RULED: readonly GwScene[] = [
  card({
    id: "auh_oc_ruled_galicia",
    when: w({ is: "ruled", by: "RUS" }),
    cast: { pm: PM, fm: FM },
    vs: [["hard", w({ is: "ruled", by: "RUS", min: 2 })], ["base"]],
    picks: [
      pick("protest", trust("RUS", -1), opinion("press", 1)),
      pick("purge", gauge("order", 1), inst("nations", -1)),
    ],
    tags: ["war", "home"],
    cooldown: 4,
  }),
  card({
    id: "auh_oc_ruled_exiles",
    when: w({ is: "ruled" }),
    cast: { pm: PM },
    vs: [["relief", w({ is: "relief" })], ["base"]],
    picks: [
      pick("parcels", gauge("money", -1), gauge("morale", 1)),
      pick("silence", gauge("morale", -1), inst("nations", -1)),
    ],
    tags: ["home"],
    cooldown: 4,
  }),
];

export const AUH_RULE_SCENES: readonly GwScene[] = [...RULER, ...RULED];
