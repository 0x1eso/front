// ww207 S0: the society's format. Shapes parse, the stubs refuse cleanly, and
// the strip's view reads the house as it stands. S1 and S2 write the rules'
// tests (Society.test.ts, design §11).
import { GwFactionStateSchema } from "@openfront/engine-api/ww1914/GwHouse";
import { GwOrderSchema } from "@openfront/engine-api/ww1914/GwOrders";
import {
  axesOf,
  gwSocietyStart,
  GwSocietyStateSchema,
} from "@openfront/engine-api/ww1914/GwSociety";
import { GwWorldEffectSchema } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { houseStep } from "@openfront/engine/ww1914/House";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { societyView } from "@openfront/engine/ww1914/Society";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

describe("ww207 society format", () => {
  test("the new shapes parse: orders, state, a gone faction, an axis push", () => {
    for (const o of [
      { kind: "node_open", faction: "deu_spd", node: "m1" },
      { kind: "faction_promote", faction: "deu_spd" },
      { kind: "faction_condemn", faction: "deu_spd" },
      { kind: "utopia_realise", faction: "deu_spd" },
      { kind: "utopia_choice", play: true },
    ]) {
      expect(GwOrderSchema.safeParse(o).success).toBe(true);
    }
    expect(GwSocietyStateSchema.parse(gwSocietyStart())).toEqual(
      gwSocietyStart(),
    );
    const gone = GwFactionStateSchema.safeParse({
      id: "deu_g_peace",
      status: "gone",
      strength: 0,
      heat: 0,
      step: 0,
      ignored: 0,
      held: -1,
      leader: null,
      since: 0,
      trend: 0,
      why: null,
      asking: null,
      asked: -9,
      deals: [],
      support: 0,
    });
    expect(gone.success).toBe(true);
    expect(
      GwWorldEffectSchema.safeParse({ do: "axis", axis: "force", delta: 1 })
        .success,
    ).toBe(true);
    expect(axesOf("DEU")).toEqual(["rule", "class", "force"]);
  });

  test("the elected chambers name their rule and a due month", () => {
    const elected = (gwContent().houses ?? []).flatMap((h) =>
      h.chambers.flatMap((c) => (c.elect === undefined ? [] : [c.elect])),
    );
    expect(elected.length).toBe(6);
    for (const e of elected) expect(e.due).toMatch(/^19[0-9]{2}-[01][0-9]$/);
  });

  test("the stubs refuse, and the strip reads the house by seats", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    houseStep(gw);
    const seat = gw.s.seats[0];
    expect(applyGwOrder(gw, seat, { kind: "utopia_choice", play: true })).toBe(
      "no_utopia",
    );
    const v = societyView(gw, seat)!;
    expect(v.axes.map((a) => a.axis)).toEqual(["rule", "class", "force"]);
    expect(v.factions.length).toBeGreaterThan(2);
    const seats = v.factions.map((f) => f.seats);
    expect(seats).toEqual([...seats].sort((a, b) => b - a));
    expect(seat.society).toBeUndefined();
  });
});
