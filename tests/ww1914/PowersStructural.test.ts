// ww171: an act beyond the law, or a harsh measure, does the structural thing
// its name says, in the system that should honour it: one per seat.
import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { budgetView, submitBudget } from "@openfront/engine/ww1914/Budget";
import { govEntry } from "@openfront/engine/ww1914/Government";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  factionOf,
  houseCounts,
  houseSits,
  houseStep,
  houseView,
} from "@openfront/engine/ww1914/House";
import { lawCanDecree } from "@openfront/engine/ww1914/Laws";
import { powerViews, takePower } from "@openfront/engine/ww1914/Powers";
import { holderOf } from "@openfront/engine/ww1914/SceneRun";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";

async function seated(tag: GwTag): Promise<GreatWar> {
  const { runner }: { runner: GameRunner } = await wwRunnerCapture(
    { greatWar1914: true, gameType: GameType.Singleplayer },
    [{ clientID: HUMAN, gwCountry: tag }],
  );
  step(runner, 2);
  const gw = runner.game.greatWar()!;
  // The mini map has no Austria-Hungary to seat: the seat plays it (as
  // AuhPlayed does).
  gw.s.seats[0].tag = tag;
  gw.nation(tag)!.authority = 100;
  // The house's factions come in at the first chapter step.
  houseStep(gw);
  return gw;
}

const use = (id: string, without = false) => ({
  id,
  target: null,
  picks: [],
  without,
  sound: false,
});

describe("acts that change the state's shape (ww171)", () => {
  test("RUS: an abolished Duma no longer votes; bills and the budget go by decree", async () => {
    const gw = await seated("RUS");
    const seat = gw.s.seats[0];
    expect(houseSits(gw, seat, "rus_victory")).toBe(true);
    // A resolution with no way round: only the house could carry it before.
    expect(lawCanDecree(gw, seat, "rus_victory")).toBe(false);
    expect(takePower(gw, seat, use("rus_pw_abolish_duma"))).toBeNull();
    expect(seat.flags).toContain("f_rus_duma_abolished");
    expect(houseCounts(gw, seat, "rus_victory", 0)).toEqual([]);
    expect(houseSits(gw, seat, "rus_victory")).toBe(false);
    expect(lawCanDecree(gw, seat, "rus_victory")).toBe(true);
    const h = houseView(gw, seat)!;
    expect(h.closed).toEqual(["duma", "council"]);
    expect(h.gone).toBe(true);
    expect(budgetView(gw, seat).body).toBeNull();
    expect(seat.log.map((l) => l.key)).toContain("rus_pw_abolish_decree");
  });

  test("DEU: the OHL signs for war and the army; a budget goes once without a vote", async () => {
    const gw = await seated("DEU");
    const seat = gw.s.seats[0];
    gw.nation("DEU")!.atWar = ["FRA"];
    expect(takePower(gw, seat, use("deu_pw_ohl", true))).toBeNull();
    expect(seat.flags).toContain("f_deu_ohl_rule");
    const views = powerViews(gw, seat);
    const peace = views.find((p) => p.id === "deu_pw_peace")!;
    expect(peace.needs).toMatchObject({
      office: "chief_of_staff",
      instead: "chancellor",
      signer: holderOf(gw, seat, "chief_of_staff")?.id ?? null,
    });
    // At home the Chancellor still signs.
    const siege = views.find((p) => p.id === "deu_pw_siege")!;
    expect(siege.needs.office).toBe("chancellor");
    expect(siege.needs.instead).toBeUndefined();

    const n = gw.nation("DEU")!;
    expect(budgetView(gw, seat).body).not.toBeNull();
    expect(takePower(gw, seat, use("deu_pw_nobudget"))).toBeNull();
    expect(budgetView(gw, seat).body).toBeNull();
    submitBudget(gw, n, n.budget.plan);
    expect(seat.flags).not.toContain("f_deu_no_budget");
    expect(seat.log.map((l) => l.key)).toContain("budget_by_decree");
    expect(budgetView(gw, seat).body).not.toBeNull();
  });

  test("GBR: a prorogued Parliament sits no more; Orders in Council carry every bill", async () => {
    const gw = await seated("GBR");
    const seat = gw.s.seats[0];
    govEntry(seat, "gbr_table").heat = 6;
    expect(lawCanDecree(gw, seat, "gbr_conscription")).toBe(false);
    expect(takePower(gw, seat, use("gbr_pw_prorogue"))).toBeNull();
    const keys = seat.log.map((l) => l.key);
    // The King may balk: then the House meets after all.
    expect(seat.flags.includes("f_gbr_prorogued")).toBe(
      !keys.includes("gbr_pw_b_prorogue_no"),
    );
    if (!seat.flags.includes("f_gbr_prorogued")) {
      seat.flags.push("f_gbr_prorogued");
    }
    expect(houseView(gw, seat)!.closed).toEqual(["commons", "lords"]);
    expect(houseSits(gw, seat, "gbr_conscription")).toBe(false);
    expect(lawCanDecree(gw, seat, "gbr_conscription")).toBe(true);
    expect(budgetView(gw, seat).body).toBeNull();
  });

  test("AUH: martial law hands the province's press to the army's censor", async () => {
    const gw = await seated("AUH");
    const seat = gw.s.seats[0];
    gw.nation("AUH")!.atWar = ["SRB"];
    seat.press.censor = 0;
    // Past the minister-president: the form gags the press the same way.
    expect(
      takePower(gw, seat, {
        ...use("auh_pw_martial", true),
        target: "bohemia",
      }),
    ).toBeNull();
    expect(seat.powers!.used.slice(-1)[0]).toMatchObject({
      id: "auh_pw_martial_b",
      end: "done",
    });
    expect(seat.press.censor).toBe(1);
  });

  test("FRA: a dissolution elects a new Chamber", async () => {
    const gw = await seated("FRA");
    const seat = gw.s.seats[0];
    const radicals = factionOf(seat, "fra_radicals")!;
    const was = radicals.strength;
    expect(was).toBeLessThan(4);
    // Past the premier and the Senate: the beyond form runs the election too.
    expect(takePower(gw, seat, use("fra_pw_dissolve", true))).toBeNull();
    expect(factionOf(seat, "fra_radicals")!.strength).toBe(was + 1);
    expect(seat.log.map((l) => l.key)).toContain("fra_pw_dissolve_elected");
  });
});
