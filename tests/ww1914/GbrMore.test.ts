import { GameType } from "@openfront/engine-api/game/GameTypes";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { seatEntry } from "@openfront/engine/ww1914/Ai";
import { GW_MANDATES } from "@openfront/engine/ww1914/Mandates";
import { holds } from "@openfront/engine/ww1914/SceneRun";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { order, seat } from "./util";

async function britain() {
  const { runner } = await wwRunnerCapture(
    { greatWar1914: true, gameType: GameType.Singleplayer },
    [{ clientID: HUMAN, country: "GBR" }],
  );
  step(runner, 2);
  const gw = runner.game.greatWar()!;
  return { runner, gw, st: gw.s.seats[0] };
}

describe("Britain, the replay share", () => {
  test("every talk's other opening is sound and has its own node", () => {
    const talks = gwContent().scenes.filter(
      (s) => s.nation.includes("GBR") && s.starts !== undefined,
    );
    expect(talks.length).toBeGreaterThan(40);
    for (const s of talks) {
      expect(gwSceneProblems(s), s.id).toEqual([]);
      for (const node of Object.values(s.starts!)) {
        expect(node, s.id).not.toBe(s.start);
      }
    }
  });

  test("a person who holds it against the seat refuses at the door", async () => {
    const { runner, gw } = await britain();
    gw.person("gbr_lloyd_george")!.trust = -1;
    order(runner, {
      kind: "summon",
      person: "gbr_lloyd_george",
      topic: "gbr_t_lg_budget",
    });
    const card = seat(runner).desk.find((c) => c.scene === "gbr_t_lg_budget")!;
    expect(card.node).toBe("shut_open");
  });

  test("a put-off entry vote comes back in months, not every chapter", async () => {
    const { gw, st } = await britain();
    gw.nation("BEL")!.side = "entente";
    const asks = () =>
      st.scheduled.filter((q) => q.scene === "gw_gbr_entry").length;
    st.seen.gw_gbr_entry = gw.s.chapter;
    seatEntry(gw);
    expect(asks()).toBe(0);
    gw.s.chapter += 4;
    seatEntry(gw);
    expect(asks()).toBe(1);
  });

  test("a Belgium never invaded isn't a mandate failed", async () => {
    const { gw, st } = await britain();
    const m = GW_MANDATES.GBR!.find((x) => x.id === "gbr_belgium_restored")!;
    const ctx = { gw, seat: st, cast: {} };
    expect(holds(ctx, m.met)).toBe(true);
    gw.nation("BEL")!.side = "entente";
    gw.s.theatres.find((t) => t.id === "west")!.line = 3;
    expect(holds(ctx, m.met)).toBe(false);
  });

  test("the late ultimatum goes once", () => {
    const late = gwContent().scenes.find((s) => s.id === "gbr_f_late_entry")!;
    const o = late.options!.find((x) => x.id === "ultimatum_first")!;
    expect(o.when).toEqual({
      kind: "not",
      of: { kind: "flag", flag: "f_late_ultimatum" },
    });
  });

  test("the retreat waits for an army that went west", () => {
    const retreat = gwContent().scenes.find((s) => s.id === "gbr_c_retreat")!;
    expect(JSON.stringify(retreat.when)).toContain('"scene":"gbr_c_bef"');
  });
});
