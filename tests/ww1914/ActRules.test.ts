// ww169 phase 0: no schedule pick is only words, and every act says what it did.
import type { GwAct } from "@openfront/engine-api/ww1914/GwActs";
import type { GwEffect, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_AGENDA_LEADS,
  GW_SUBJECT_BLOCS,
} from "@openfront/engine-lib/ww1914/ActRules";
import {
  GW_CONTENT,
  gwContent,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { rivalIds } from "@openfront/engine/ww1914/SceneRun";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner, order, seat } from "./util";

/** Effects that change nothing anyone plays against. */
const TEXT = new Set(["remember", "forget", "reason", "mood", "letter"]);
const TEXT_WORLD = new Set(["news", "thread"]);
/** What the act's desk note lists (SceneRun runEffect under `fx`). */
const NOTED = new Set([
  "gauge",
  "inst",
  "temp",
  "pressure",
  "trust",
  "person_trust",
  "pride",
  "feud",
  "opinion",
  "rumour",
  "censor",
  "ruler",
  "w:readiness",
  "w:reveal",
  "w:inspect",
  "w:report",
  "w:authority",
  "w:file",
  "w:faction",
  "w:stir",
  "w:calm",
]);

/**
 * The secret war's picks (ww173 spies and agents, ww180 the navy's ears and
 * propaganda) report on the 정보부 tab, which shows what each one did.
 */
const OWN_TAB = new Set(["w:spy", "w:naval", "w:agent", "w:prop"]);

function real(list: readonly GwEffect[] | undefined): boolean {
  return (list ?? []).some((e) => {
    if (e.kind === "maybe") return real(e.then);
    if (e.kind === "roll") return real(e.then) || real(e.otherwise);
    if (e.kind === "world") return !TEXT_WORLD.has(e.of.do);
    if (e.kind === "flag") return true;
    return !TEXT.has(e.kind);
  });
}

function kinds(list: readonly GwEffect[] | undefined, out: Set<string>) {
  for (const e of list ?? []) {
    if (e.kind === "maybe") kinds(e.then, out);
    else if (e.kind === "roll") {
      kinds(e.then, out);
      kinds(e.otherwise, out);
    } else out.add(e.kind === "world" ? `w:${e.of.do}` : e.kind);
  }
}

/** The pick itself moves something: its effects, an option's, or a rule's. */
function pickDoes(a: GwAct): boolean {
  if (real(a.effects)) return true;
  return (a.fields ?? []).some(
    (f) =>
      f.tones !== undefined ||
      f.id === "tone" ||
      (f.options ?? []).some(
        (o) =>
          real(o.effects) ||
          (f.id === "on" && GW_SUBJECT_BLOCS[o.id] !== undefined) ||
          (f.id === "agenda" && GW_AGENDA_LEADS[o.id] !== undefined),
      ),
  );
}

/** Or the paper it plays has an answer that moves something. */
function sceneDoes(s: GwScene | undefined): boolean {
  if (s === undefined) return false;
  if ((s.options ?? []).some((o) => real(o.effects))) return true;
  return Object.values(s.nodes ?? {}).some((n) =>
    n.replies.some((r) => real(r.effects)),
  );
}

describe("the schedule's content", () => {
  test("every act's success path moves something", () => {
    const scenes = new Map(gwContent().scenes.map((s) => [s.id, s]));
    const flat = (gwContent().acts ?? []).filter(
      (a) => !pickDoes(a) && !sceneDoes(scenes.get(a.scene)),
    );
    expect(flat.map((a) => a.id)).toEqual([]);
  });

  test("every speech subject and council agenda has a rule or effects", () => {
    const missing: string[] = [];
    for (const a of gwContent().acts ?? []) {
      for (const f of a.fields ?? []) {
        for (const o of f.options ?? []) {
          if (real(o.effects)) continue;
          if (a.kind === "speech" && f.id === "on" && !GW_SUBJECT_BLOCS[o.id]) {
            missing.push(`${a.id}.on.${o.id}`);
          }
          if (f.id === "agenda" && !GW_AGENDA_LEADS[o.id]) {
            missing.push(`${a.id}.agenda.${o.id}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("every effect a pick runs is one the desk note lists", () => {
    const used = new Set<string>();
    for (const a of gwContent().acts ?? []) {
      kinds(a.effects, used);
      for (const f of a.fields ?? []) {
        for (const o of f.options ?? []) kinds(o.effects, used);
      }
    }
    const silent = [...used].filter(
      (k) => !NOTED.has(k) && !TEXT.has(k) && !OWN_TAB.has(k) && k !== "flag",
    );
    expect(silent).toEqual([]);
  });
});

const SCENES: GwScene[] = [
  {
    id: "t_quiet",
    nation: ["DEU"],
    kind: "report",
    cast: {},
    salience: 5,
    tags: ["home"],
    variants: [{ id: "base" }],
    scheduledOnly: true,
  },
  {
    id: "t_pair",
    nation: ["DEU"],
    kind: "report",
    cast: { a: { picked: "pair" }, b: { picked: "pair", nth: 1 } },
    salience: 5,
    tags: ["home"],
    variants: [{ id: "base" }],
    scheduledOnly: true,
  },
  {
    id: "t_to_chan",
    nation: ["DEU"],
    kind: "report",
    cast: { chan: { office: "chancellor" } },
    salience: 5,
    tags: ["home"],
    variants: [{ id: "base" }],
    scheduledOnly: true,
  },
];

const ACTS: GwAct[] = [
  {
    id: "t_set_on",
    nation: ["DEU"],
    kind: "intrigue",
    scene: "t_pair",
    wait: 1,
    fields: [{ id: "pair", people: "cabinet", count: 2 }],
    effects: [{ kind: "feud", a: { role: "a" }, b: { role: "b" } }],
  },
  {
    id: "t_letter",
    nation: ["DEU"],
    kind: "letter",
    scene: "t_to_chan",
    wait: 1,
    fields: [{ id: "tone", tones: ["warm", "threat"] }],
  },
  {
    id: "t_speech",
    nation: ["DEU"],
    kind: "speech",
    scene: "t_quiet",
    wait: 1,
    fields: [{ id: "on", options: [{ id: "bread" }, { id: "war" }] }],
  },
  {
    id: "t_visit",
    nation: ["DEU"],
    kind: "visit",
    scene: "t_quiet",
    wait: 1,
    effects: [
      { kind: "gauge", gauge: "morale", delta: -1 },
      doWorld({ do: "stir", tag: "GBR", delta: 1 }),
    ],
  },
];

const fixture = () =>
  useGwContent({
    scenes: [...GW_CONTENT.scenes, ...SCENES],
    people: GW_CONTENT.people,
    acts: ACTS,
    aims: [],
  });

afterEach(() => useGwContent(null));

const state = (r: GameRunner) => r.game.greatWar()!.s.seats[0];
const linesOf = (r: GameRunner, act: string) =>
  state(r).log.filter((l) => l.act === act);
const fields = (r: GameRunner, act: string) =>
  seat(r).acts!.find((a) => a.id === act)!.fields;

describe("what a pick does by itself", () => {
  test("setting two ministers on each other makes them rivals, and says so", async () => {
    fixture();
    const { runner } = await gwRunner();
    const [a, b] = fields(runner, "t_set_on")[0].people;
    order(runner, { kind: "act", act: "t_set_on", picks: [a, b] });
    const gw = runner.game.greatWar()!;
    expect(rivalIds(gw, a)).toContain(b);
    expect(rivalIds(gw, b)).toContain(a);
    expect(linesOf(runner, "t_set_on")).toEqual([
      expect.objectContaining({ key: "fx_feud", who: a, what: b }),
    ]);
  });

  test("a letter's tone lands by the subject's temperament", async () => {
    fixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const chan = gw.s.people.find(
      (p) => p.office === "chancellor" && p.id.startsWith("deu_"),
    )!;
    chan.temperament = "anxious";
    chan.trust = 0;
    order(runner, { kind: "act", act: "t_letter", picks: ["warm"] });
    expect(chan.trust).toBe(1);
    expect(linesOf(runner, "t_letter")[0]).toMatchObject({
      key: "fx_person_up",
      who: chan.id,
    });
  });

  test("a speech's subject moves its bloc's word", async () => {
    fixture();
    const { runner } = await gwRunner();
    const was = state(runner).press.opinion.workers;
    order(runner, { kind: "act", act: "t_speech", picks: ["bread"] });
    expect(state(runner).press.opinion.workers).toBe(was + 1);
    expect(linesOf(runner, "t_speech")[0]).toMatchObject({
      key: "fx_opinion_up",
      what: "workers",
    });
  });

  test("an act's gauge move is a gauge line, and agitation abroad is told", async () => {
    fixture();
    const { runner } = await gwRunner();
    order(runner, { kind: "act", act: "t_visit", picks: [] });
    const s = state(runner);
    expect(s.lines.some((l) => l.key === "act_visit" && l.delta < 0)).toBe(
      true,
    );
    const keys = linesOf(runner, "t_visit").map((l) => l.key);
    expect(keys[0]).toBe("fx_gauge_morale_down");
    expect(["fx_stir", "fx_stir_answered"]).toContain(keys[1]);
  });
});
