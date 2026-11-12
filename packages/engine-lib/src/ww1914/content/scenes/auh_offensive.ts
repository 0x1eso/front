// Great War 1914 (ww173 phase B): AUH's scenes of its great offensives:
// the plan laid out (`auh_w_off_prep`), each round's result
// (`auh_w_off_result`), an enemy offensive met (`auh_w_off_defended`), the
// army's refusal (`auh_w_off_mutiny`). Owned by the AUH writer lane; shapes
// and conditions in /home/eser/dev/ww173-formatb.md. Text in
// resources/ww1914/ko/AUH.offensive.json.
//
// Nothing here names a date: the front, the method, the result and the state
// pick the body. The Tyrol plateau, the Isonzo valleys, the Piave, Gorlice,
// the Carpathian passes, Lutsk and the Isonzo battles are the flavour.
import type {
  GwOffMethod,
  GwOffResult,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAssumes } from "@openfront/engine-api/ww1914/GwAssumes";
import {
  all,
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  reason,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: GwScene["nation"] = ["AUH"];

const ITALY: GwTheatre[] = ["italy", "alps"];
const EAST: GwTheatre[] = ["east"];
const BALKAN: GwTheatre[] = ["balkan"];
const ROMANIA: GwTheatre[] = ["danube", "dobruja"];

const GAVE: GwOffResult[] = ["break", "bite"];
const HELD: GwOffResult[] = ["attrition", "repulsed"];

type OffAsk = { t?: GwTheatre[]; m?: GwOffMethod[]; r?: GwOffResult[] };

/**
 * The latest offensive, ours or the foe's, one leaf per thing asked: a body
 * that asks more is more specific and wins (SceneRun.specificity).
 */
function off(side: "ours" | "foe", p: OffAsk, ...more: GwCond[]): GwCond {
  const parts: GwCond[] = [];
  if (p.t) parts.push(world({ is: "offensive", side, theatre: p.t }));
  if (p.m) parts.push(world({ is: "offensive", side, method: p.m }));
  if (p.r) parts.push(world({ is: "offensive", side, result: p.r }));
  parts.push(...more);
  if (parts.length === 0) return world({ is: "offensive", side });
  return parts.length === 1 ? parts[0] : all(...parts);
}
const ours = (p: OffAsk, ...more: GwCond[]) => off("ours", p, ...more);
const foe = (p: OffAsk, ...more: GwCond[]) => off("foe", p, ...more);

const v = (id: string, when: GwCond): GwVariant => ({ id, when });
const base: GwVariant = { id: "base" };
/** ww187: the Italian line on the Isonzo, or on the Piave. */
const ISONZO: GwAssumes = { line: { italy: ["isonzo", "isonzo"] } };
const PIAVE: GwAssumes = { line: { italy: ["piave", "piave"] } };

const winter = world({ is: "month", of: [12, 1, 2, 3] });
const early = world({ is: "era", of: ["movement", "trenches"] });
const inWar = world({ is: "war" });
const russiaOut = world({ is: "out", tag: "RUS" });
const nationsLow: GwCond = { kind: "inst", inst: "nations", max: -1 };

/** The chief of staff brings them; the war minister when the chair is empty. */
const staff: Record<string, GwCastRule> = {
  cos: { any_of: [{ office: "chief_of_staff" }, { office: "war" }] },
};
const cos = role("cos");

const report = (id: string, variants: GwVariant[]): GwScene => ({
  id,
  nation: NATION,
  kind: "report",
  // Only the engine lays these (Offensives.callScene, GW_OFFENSIVE_CALLED).
  scheduledOnly: true,
  cast: staff,
  salience: 7,
  tags: ["war"],
  stamp: "confirmed",
  source: "staff",
  variants,
});

const gauge = (g: "morale" | "order", delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const nations = (delta: number): GwEffect => ({
  kind: "inst",
  inst: "nations",
  delta,
});
const opt = (id: string, tell: string[], effects: GwEffect[]): GwOption => ({
  id,
  tell,
  effects,
});

const SERBIA_IN = { fights: ["SRB"] } as const;

export const AUH_OFFENSIVE_SCENES: readonly GwScene[] = [
  // The plan laid out, the chapter after the seat signed it (round 0).
  report("auh_w_off_prep", [
    // ww187: each plan names the river the line stands on.
    { ...v("tyrol", ours({ t: ITALY, m: ["long"] })), assumes: ISONZO },
    { ...v("isonzo", ours({ t: ITALY, m: ["surprise"] })), assumes: ISONZO },
    { ...v("piave", ours({ t: ITALY, m: ["broad"] })), assumes: PIAVE },
    v("carpathians", ours({ t: EAST }, winter, early)),
    v("gorlice", ours({ t: EAST, m: ["long"] })),
    v("east_broad", ours({ t: EAST, m: ["broad"] })),
    v("east_storm", ours({ t: EAST, m: ["surprise"] })),
    v("serbia", ours({ t: BALKAN })),
    v("romania", ours({ t: ROMANIA })),
    base,
  ]),
  // Each round of our own offensive.
  report("auh_w_off_result", [
    v("italy_break", ours({ t: ITALY, r: ["break"] })),
    v("italy_bite", ours({ t: ITALY, r: ["bite"] })),
    v("italy_attrition", ours({ t: ITALY, r: ["attrition"] })),
    v("italy_repulsed", ours({ t: ITALY, r: ["repulsed"] })),
    v("east_break", ours({ t: EAST, r: ["break"] })),
    v("east_bite", ours({ t: EAST, r: ["bite"] })),
    v("east_attrition", ours({ t: EAST, r: ["attrition"] })),
    v("east_repulsed", ours({ t: EAST, r: ["repulsed"] })),
    v("break", ours({ r: ["break"] })),
    v("bite", ours({ r: ["bite"] })),
    v("attrition", ours({ r: ["attrition"] })),
    v("repulsed", ours({ r: ["repulsed"] })),
    base,
  ]),
  // Each round of an enemy offensive on our front.
  report("auh_w_off_defended", [
    v("lutsk", foe({ t: EAST, m: ["broad"], r: ["break"] })),
    v("east_broke", foe({ t: EAST, r: ["break"] })),
    v("east_gave", foe({ t: EAST, r: ["bite"] })),
    v("east_held", foe({ t: EAST, r: HELD })),
    v("italy_broke", foe({ t: ITALY, r: ["break"] })),
    v("isonzo_gave", foe({ t: ITALY, r: ["bite"] })),
    v("isonzo_held", foe({ t: ITALY, r: HELD })),
    // ww187 merge: the Serbian army is named, so Serbia is still in it
    // (ww188: it can give up while the Balkan front goes on).
    { ...v("serbia_gave", foe({ t: BALKAN, r: GAVE })), assumes: SERBIA_IN },
    { ...v("serbia_held", foe({ t: BALKAN, r: HELD })), assumes: SERBIA_IN },
    v("romania", foe({ t: ROMANIA })),
    v("gave", foe({ r: GAVE })),
    v("held", foe({ r: HELD })),
    base,
  ]),
  // Our repulsed army will not go again (strain at least 60, morale 2 or less).
  {
    id: "auh_w_off_mutiny",
    nation: NATION,
    kind: "proposal",
    scheduledOnly: true,
    cast: staff,
    salience: 8,
    tags: ["war", "tension_up"],
    variants: [
      v("returned", all(russiaOut, inWar)),
      v("regiments", all(nationsLow, inWar)),
      v("italy", ours({ t: ITALY })),
      v("east", ours({ t: EAST })),
      base,
    ],
    fallback: "courts",
    options: [
      opt(
        "courts",
        ["order:+1", "nations:-1"],
        [gauge("order", 1), nations(-1), reason("auh_off_mutiny_courts")],
      ),
      opt(
        "rest",
        ["morale:+1", "cos:-1"],
        [gauge("morale", 1), trustOf(cos, -1), reason("auh_off_mutiny_rest")],
      ),
      opt(
        "visit",
        ["nations:+1", "order:-1"],
        [nations(1), gauge("order", -1), reason("auh_off_mutiny_visit")],
      ),
    ],
  },
];
