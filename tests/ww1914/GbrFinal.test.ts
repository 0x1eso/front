import { GameType } from "@openfront/engine-api/game/GameTypes";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { makeCard, placeCard } from "@openfront/engine/ww1914/Desk";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { holds } from "@openfront/engine/ww1914/SceneRun";
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
