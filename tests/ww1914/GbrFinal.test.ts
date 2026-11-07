import { GameType } from "@openfront/engine-api/game/GameTypes";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { makeCard, placeCard } from "@openfront/engine/ww1914/Desk";
import { memoirOf } from "@openfront/engine/ww1914/Endings";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { castOf, holds, runEffect } from "@openfront/engine/ww1914/SceneRun";
import { worldView } from "@openfront/engine/ww1914/WorldView";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";

async function britain() {
  const { runner } = await wwRunnerCapture(
    { greatWar1914: true, gameType: GameType.Singleplayer },
    [{ clientID: HUMAN, country: "GBR" }],
  );
  step(runner, 2);
  const gw = runner.game.greatWar()!;
  return { runner, gw, st: gw.s.seats[0] };
}

const sceneOf = (id: string) => gwContent().scenes.find((s) => s.id === id)!;

describe("Britain, as played to the end", () => {
  test("in by the vote, nobody still asks whether to go in", async () => {
    const { gw, st } = await britain();
    st.desk = [];
    for (const id of [
      "gw_gbr_entry",
      "gbr_c_ultimatum",
      "gbr_f_neutral_line",
    ]) {
      placeCard(gw, st, makeCard(gw, st, sceneOf(id), "scheduled")!);
    }
    const card = st.desk.find((c) => c.scene === "gw_gbr_entry")!;
    expect(
      applyGwOrder(gw, st, { kind: "choose", card: card.uid, option: "force_it" }),
    ).toBe(null);
    expect(st.desk).toEqual([]);
  });

  test("the vacancy paper names nobody who has gone", async () => {
    const { gw, st } = await britain();
    gw.s.chapter = 20;
    const when = sceneOf("gbr_h_vacant").variants.find(
      (v) => v.id === "finance",
    )!.when!;
    const ctx = { gw, seat: st, cast: {} };
    gw.person("gbr_lloyd_george")!.office = null;
    gw.person("gbr_mckenna")!.office = null;
    expect(holds(ctx, when)).toBe(true);
    gw.person("gbr_bonar_law")!.status = "dead";
    expect(holds(ctx, when)).toBe(false);
  });

  test("a decision can't seat the dead", async () => {
    const { gw, st } = await britain();
    const law = gw.person("gbr_bonar_law")!;
    law.status = "dead";
    runEffect(
      { gw, seat: st, cast: {} },
      { kind: "appoint", who: { person: law.id }, office: "finance" },
    );
    expect(law.office).toBe(null);
  });

  test("no Ministry of Munitions to fill before the shells of 1915", async () => {
    const { gw, st } = await britain();
    expect(worldView(gw, st).candidates.munitions).toBeUndefined();
    gw.s.day += 365;
    expect(worldView(gw, st).candidates.munitions?.length).toBeGreaterThan(0);
  });

  test("the Unionists' letters come from a Unionist when Law has gone", async () => {
    const { gw, st } = await britain();
    gw.person("gbr_bonar_law")!.status = "dead";
    const cast = castOf(gw, st, sceneOf("gov_gbr_unionists_2"));
    expect(cast?.law).toBe("gbr_balfour");
  });

  test("Kitchener goes down with the Hampshire: dead, not retired", async () => {
    const { runner, gw, st } = await britain();
    st.seen.gbr_w_kitchener_lost = gw.s.chapter;
    st.ready = true;
    advanceChapter(gw, runner.game.ticks(), false);
    expect(gw.person("gbr_kitchener")!.status).toBe("dead");
  });

  test("the memoir says whose form of government changed", async () => {
    const { gw, st } = await britain();
    st.memory.push({
      key: "regime_republic@DEU",
      who: null,
      chapter: 3,
      weight: 0,
    });
    st.memory.push({ key: "other", who: null, chapter: 3, weight: 0 });
    const m = memoirOf(gw, st, "long_peace");
    expect(m.turns.filter((t) => t.key === "regime_republic")).toEqual([
      { key: "regime_republic", tag: "DEU", chapter: 3 },
    ]);
  });

  test("neutrality isn't priced while the ultimatum is still open", async () => {
    const { gw, st } = await britain();
    const when = sceneOf("gbr_f_neutral_line").when!;
    const ctx = { gw, seat: st, cast: {} };
    gw.s.chapter = 7;
    gw.nation("FRA")!.side = "entente";
    st.flags.push("f_stand_france");
    expect(holds(ctx, when)).toBe(false);
    st.flags.push("f_ult_lapsed");
    expect(holds(ctx, when)).toBe(true);
  });
});
