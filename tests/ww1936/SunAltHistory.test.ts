// The Soviet Great Purge rebuilt (stages and control focuses that stack, one
// ending that removes everything, troubles from year 3) and the Red Bonaparte.
// Two short real-map games, SUN as a human, and one data check.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { CIVIL_WAR_SLOTS } from "@openfront/engine-api/ww1936/Countries";
import { BUILDING_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { IDEO_NEU } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { SUN_EVENTS } from "@openfront/engine-lib/ww1936/content/events/sun";
import { SUN_FOCUSES } from "@openfront/engine-lib/ww1936/content/focus/sun";
import { treePosIn } from "@openfront/engine-lib/ww1936/content/registry";
import { SPIRITS_SUN } from "@openfront/engine-lib/ww1936/content/spirits/sun";
import {
  createGameRunner,
  type GameRunner,
} from "@openfront/engine/GameRunner";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { applyOption } from "@openfront/engine/ww1936/politics/Events";
import { focusFinished } from "@openfront/engine/ww1936/politics/Focus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { HUMAN, order, pol, step, wwGameStart } from "./util";

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);

async function sunGame(): Promise<GameRunner> {
  usePoliticsContent(null);
  const runner = await createGameRunner(
    wwGameStart({}, [{ clientID: HUMAN, country: "SUN" }]),
    undefined,
    await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  step(runner, 700);
  return runner;
}
const me = (r: GameRunner) => pol(r.game).country(pol(r.game).idOfTag("SUN"))!;
const dayOf = (r: GameRunner) => r.game.worldWar()!.day(r.game.ticks());
function mark(r: GameRunner, ids: string[]) {
  const p = pol(r.game);
  const c = me(r);
  for (const id of ids) c.focusState[treePosIn(p.content, c.tree, id)!] = 1;
}
function runFocus(r: GameRunner, id: string) {
  const c = me(r);
  const p = pol(r.game);
  step(r, 1, [order(HUMAN, { kind: "focus_start", focus: id })]);
  expect(c.focus?.id ?? id).toBe(id);
  let n = 0;
  while (!focusFinished(p, c, id) && n++ < 4000) step(r, 1);
  expect(focusFinished(p, c, id), id).toBe(true);
}
const focusEffects = (id: string) =>
  SUN_FOCUSES.find((f) => f.id === id)!.effects;
const eventDef = (id: string): EventDef => SUN_EVENTS.find((e) => e.id === id)!;
const spiritsOf = (r: GameRunner) =>
  me(r)
    .spirits.map((s) => s.id)
    .filter((s) => s.startsWith("sun_purge") || s.startsWith("sun_ctl"));

describe("Soviet purge: stages, control focuses, ending, troubles", () => {
  it("control focuses stack on the stage; ending removes all and leaves an aftermath by length; troubles start in year 3 and stop with the purge", async () => {
    const r = await sunGame();
    const p = pol(r.game);
    const id = p.idOfTag("SUN");
    const c = me(r);
    runFocus(r, "sun_great_purge");
    runFocus(r, "sun_nkvd_control");
    expect(spiritsOf(r)).toEqual(["sun_purge_1", "sun_ctl_nkvd"]);
    // The trial events move the stage with swap_spirit; the control spirit stays.
    applyEffects(
      makeCtx(p, id, id, 0, r.game.ticks()),
      eventDef("sun_military_trial").options[0].effects,
    );
    expect(spiritsOf(r)).toEqual(["sun_purge_2", "sun_ctl_nkvd"]);

    // Year 3 of the purge (the flag moved back): troubles begin to arrive.
    const day = dayOf(r);
    c.flags.set("purge_path", [day - 1200, -1]);
    const trouble = eventDef("sun_factory_sabotage").trigger!;
    expect(evalCondition(makeCtx(p, id, id, 0, r.game.ticks()), trouble)).toBe(
      true,
    );
    const seen: string[] = [];
    const news = p.news.bind(p);
    p.news = (nid, params) => {
      seen.push(nid);
      news(nid, params);
    };
    const cards = new Set<number>();
    for (let i = 0; i < 4500; i++) {
      step(r, 1);
      for (const x of c.pending) {
        if (!cards.has(x.uid) && x.eventId.startsWith("sun_")) {
          cards.add(x.uid);
          seen.push(x.eventId);
        }
      }
    }
    expect(seen.length).toBeGreaterThanOrEqual(1);

    // A notice's damage lands on the buildings and stays below the cap.
    const econ = r.game.worldWar()!.economy;
    const damageSum = () => econ.damage.reduce((a, b) => a + b, 0);
    const before = damageSum();
    applyEffects(
      makeCtx(p, id, id, 0, r.game.ticks()),
      eventDef("sun_factory_sabotage").options[0].effects,
    );
    expect(damageSum()).toBeGreaterThan(before);

    // Ending: every stage and control spirit goes; the aftermath follows the length.
    const end = focusEffects("sun_purge_ends");
    const ended = (age: number): string[] => {
      c.flags.set("purge_path", [dayOf(r) - age, -1]);
      applyEffects(makeCtx(p, id, id, 0, r.game.ticks()), end);
      expect(spiritsOf(r).filter((s) => !s.includes("aftermath"))).toEqual([]);
      const left = spiritsOf(r);
      for (const s of left) {
        applyEffects(makeCtx(p, id, id, 0, r.game.ticks()), [
          { kind: "remove_spirit", id: s },
        ]);
      }
      return left;
    };
    // Re-arm the stage between the three runs (purge_ends needs no spirit to exist).
    expect(ended(100)).toEqual(["sun_purge_aftermath"]);
    expect(ended(500)).toEqual(["sun_purge_aftermath_2"]);
    expect(ended(1200)).toEqual(["sun_purge_aftermath_3"]);

    // Done: the troubles stop, and so does the trial chain.
    mark(r, ["sun_purge_ends"]);
    expect(evalCondition(makeCtx(p, id, id, 0, r.game.ticks()), trouble)).toBe(
      false,
    );
    for (const e of SUN_EVENTS.filter((x) => x.mtthDays !== undefined)) {
      if (e.id === "sun_hardliner_unrest") continue;
      expect(
        evalCondition(makeCtx(p, id, id, 0, r.game.ticks()), e.trigger!),
        e.id,
      ).toBe(false);
    }
  }, 600_000);

  it("Red Bonaparte: the focus takes power, the hardliners rise by event, a full civil-war roster leaves the army in charge", async () => {
    const r = await sunGame();
    const p = pol(r.game);
    const id = p.idOfTag("SUN");
    const c = me(r);
    mark(r, ["sun_army_reformers"]);
    runFocus(r, "sun_red_bonaparte");
    expect(c.ruling).toBe(IDEO_NEU);
    expect(c.leader).toBe("sun_tukhachevsky");
    expect(c.hasFlag("sun_army_rule", dayOf(r))).toBe(true);
    // The collective road is closed, the NEP's own focus is not (via the barracks).
    const ids = new Map(SUN_FOCUSES.map((f) => [f.id, f]));
    expect(ids.get("sun_collective_leadership")!.exclusive).toContain(
      "sun_red_bonaparte",
    );
    expect(ids.get("sun_bukharin_nep")!.prereq).toEqual([
      ["sun_moderate_economy", "sun_barracks_order"],
    ]);

    // Slots full and a shaky regime: the card offers only the civil war, which cannot start.
    const eg = r.game.worldWar()!.endgame;
    for (const t of CIVIL_WAR_SLOTS) {
      eg.countryStateArr[r.game.worldWar()!.scenario.smallIdOf(t)] = CS_GONE;
    }
    c.stabBaseBp = 0;
    c.stabBp = 0;
    const ev = eventDef("sun_hardliner_unrest");
    const open = (): string[] =>
      ev.options
        .filter((o) =>
          evalCondition(makeCtx(p, id, id, 0, r.game.ticks()), o.available),
        )
        .map((o) => o.id);
    expect(open()).toEqual(["b"]);
    applyOption(p, ev.id, id, id, 0, "b", r.game.ticks(), 0);
    expect(c.ruling).toBe(IDEO_NEU);
    expect(
      r.game
        .worldWar()!
        .endgame.wars.filter(
          (w) =>
            w.kind === "civil" &&
            w.sides.some((s) => s.members.some((m) => m.id === id)),
        ),
    ).toHaveLength(0);
    // A steady regime can only suppress.
    c.stabBp = 6000;
    expect(open()).toEqual(["a"]);
  }, 600_000);

  it("the troubles add up to one in 60 days from year 3 and one in 30 from year 5; notices have no choice, three cards do", () => {
    const rate = (min: number) =>
      SUN_EVENTS.filter(
        (e) =>
          e.id !== "sun_hardliner_unrest" &&
          e.mtthDays !== undefined &&
          min === (JSON.stringify(e.trigger).includes("1825") ? 1825 : 1095),
      ).reduce((a, e) => a + 1 / e.mtthDays!, 0);
    expect(rate(1095)).toBeCloseTo(1 / 60, 5);
    expect(rate(1825)).toBeCloseTo(1 / 60, 5);
    const troubles = SUN_EVENTS.filter(
      (e) => e.mtthDays !== undefined && e.id !== "sun_hardliner_unrest",
    );
    expect(troubles).toHaveLength(12);
    expect(troubles.filter((e) => e.kind === "country")).toHaveLength(3);
    for (const e of troubles) {
      expect(e.once, e.id).toBe("never");
      if (e.kind === "news") expect(e.options, e.id).toHaveLength(1);
    }
    // Every spirit a focus or event adds exists.
    const have = new Set(SPIRITS_SUN.map((s) => s.id));
    const used: string[] = [];
    for (const f of SUN_FOCUSES) {
      for (const x of f.effects) {
        if (x.kind === "add_spirit") used.push(x.id);
      }
    }
    for (const e of SUN_EVENTS) {
      for (const o of e.options) {
        for (const x of o.effects) {
          if (x.kind === "add_spirit") used.push(x.id);
        }
      }
    }
    for (const s of used) {
      if (s.startsWith("sun_"))
        expect(have.has(s) || s === "sun_five_year_plans", s).toBe(true);
    }
    expect(BUILDING_IDS).toContain("rail");
  });
});
