// ww208 S2 (design ww207 §11 cases 4 and 5): a faction's ability is greyed,
// cools down and turns; a tree fills from the axes, its nodes open in order,
// realisation absorbs society (tempers 0, 불온 empty, rivals gone) and changes
// the regime; decision 1B: the player plays on as the head, or ends there; a
// forced revolution still ends the seat. Fixture content: C and W fill the
// real templates and trees.
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import { GW_NODE_PRICE } from "@openfront/engine-api/ww1914/GwSociety";
import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import type { GwFactionRow } from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwPowerRow } from "@openfront/engine-lib/ww1914/PowerRows";
import {
  GW_RULERS,
  type GwRulerRow,
} from "@openfront/engine-lib/ww1914/RulerRows";
import {
  GW_AFFINITY_AXIS,
  type GwNodeRow,
} from "@openfront/engine-lib/ww1914/UtopiaRows";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { factionOf, houseStep } from "@openfront/engine/ww1914/House";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { changeRegime } from "@openfront/engine/ww1914/Regimes";
import { rulerStep } from "@openfront/engine/ww1914/Ruler";
import { societyStep } from "@openfront/engine/ww1914/Society";
import {
  abilityView,
  treeView,
  utopiaStep,
} from "@openfront/engine/ww1914/Utopia";
import { moveGauge } from "@openfront/engine/ww1914/World";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const POWER = "deu_pw_test_unions";
const HEAD = "deu_test_head";

const affinity = (delta: number): GwEffect => ({
  kind: "world",
  of: { do: "affinity", id: "deu_spd", delta },
});

const node = (id: string, i: number): GwNodeRow => ({
  id,
  tier: (["moderate", "bold", "extreme"] as const)[Math.floor(i / 3)],
  kind: id === "b2" ? "ability" : "perk",
});

const ideals: Record<string, GwFactionRow["ideals"]> = {
  deu_spd: { rule: 1, class: 1, force: 1 },
  deu_cons: { rule: -1, class: -1, force: -1 },
};

const ability: GwPowerRow = {
  id: POWER,
  tag: "DEU",
  group: "factions",
  kind: "lawful",
  tags: ["ability"],
  effects: [affinity(7)],
  ability: {
    faction: "deu_spd",
    strong: [affinity(30)],
    turned: { effects: [affinity(-5)] },
  },
};

function fixture(): void {
  useGwContent({
    ...GW_CONTENT,
    // ww208 merge: the SPD's own ability row (W-DEU) gives way to the test's.
    factions: (GW_CONTENT.factions ?? []).map((f) => {
      if (ideals[f.id] === undefined) return f;
      const { ability: _own, ...rest } = f;
      void _own;
      return { ...rest, ideals: ideals[f.id] };
    }),
    powers: [
      ...(GW_CONTENT.powers ?? []).filter(
        (p) => p.ability?.faction !== "deu_spd",
      ),
      ability,
    ],
    utopia: {
      templates: [
        {
          id: "labour",
          nodes: ["m1", "m2", "m3", "b1", "b2", "b3", "x1", "x2", "x3"].map(
            node,
          ),
        },
      ],
      trees: [
        {
          faction: "deu_spd",
          template: "labour",
          utopia: "deu_social",
          regime: "republic",
          head: HEAD,
        },
      ],
    },
  });
}

const rulers = GW_RULERS.DEU as GwRulerRow[];

afterEach(() => {
  useGwContent(null);
  if (rulers[rulers.length - 1]?.id === HEAD) rulers.pop();
});

async function germany(): Promise<GreatWar> {
  fixture();
  const { runner } = await gwRunner();
  const gw = runner.game.greatWar()!;
  houseStep(gw);
  return gw;
}

/** Every node open and the axes at the SPD's ideals: ready to realise. */
function ripe(gw: GreatWar): void {
  const seat = gw.s.seats[0];
  const spd = factionOf(seat, "deu_spd")!;
  for (const id of ["m1", "m2", "m3", "b1", "b2", "b3", "x1", "x2", "x3"]) {
    spd.affinity = 100;
    expect(
      applyGwOrder(gw, seat, {
        kind: "node_open",
        faction: "deu_spd",
        node: id,
      }),
    ).toBeNull();
  }
  gw.nation("DEU")!.axes = { rule: 20, class: 20, force: 20 };
}

describe("ww208 S2 utopias", () => {
  test("an ability is greyed, asked, cools down, grows strong and turns", async () => {
    const gw = await germany();
    const seat = gw.s.seats[0];
    const spd = factionOf(seat, "deu_spd")!;
    spd.step = 0;
    spd.heat = 0;
    spd.affinity = 10;
    expect(abilityView(gw, seat, "deu_spd")?.why).toBe("ability_trust");
    spd.trust = 2;
    expect(abilityView(gw, seat, "deu_spd")).toMatchObject({
      power: POWER,
      ready: true,
      turned: false,
    });
    const ask: GwOrder = {
      kind: "power",
      id: POWER,
      target: null,
      picks: [],
      without: false,
      sound: false,
    };
    expect(applyGwOrder(gw, seat, ask)).toBeNull();
    expect(spd.affinity).toBe(17);
    expect(spd.trust).toBe(1);
    expect(abilityView(gw, seat, "deu_spd")?.why).toBe("used");
    expect(applyGwOrder(gw, seat, ask)).toBe("power_closed");
    // Cooled down, with its ability node open: the strong form.
    spd.ableAt = gw.s.chapter;
    spd.nodes = ["b2"];
    expect(applyGwOrder(gw, seat, ask)).toBeNull();
    expect(spd.affinity).toBe(47);
    // At temper 3 it turns, unasked.
    spd.ableAt = gw.s.chapter;
    spd.step = 3;
    utopiaStep(gw);
    expect(spd.affinity).toBeLessThan(47);
    expect(abilityView(gw, seat, "deu_spd")).toMatchObject({
      turned: true,
      why: "ability_turned",
    });
  });

  test("a tree fills from the axes and opens tier by tier", async () => {
    const gw = await germany();
    const seat = gw.s.seats[0];
    const spd = factionOf(seat, "deu_spd")!;
    gw.nation("DEU")!.axes = { rule: 20, class: 10, force: -20 };
    const before = spd.affinity ?? 0;
    utopiaStep(gw);
    // rule 2 and class 1 steps on its side; force against it counts nothing.
    expect(spd.affinity).toBe(before + 3 * GW_AFFINITY_AXIS);
    // Enough for a moderate node, not then for a bold one.
    spd.affinity = GW_NODE_PRICE.moderate + GW_NODE_PRICE.bold - 1;
    const open = (id: string) =>
      applyGwOrder(gw, seat, {
        kind: "node_open",
        faction: "deu_spd",
        node: id,
      });
    expect(open("b1")).toBe("node_shut");
    expect(open("m1")).toBeNull();
    expect(spd.affinity).toBe(GW_NODE_PRICE.bold - 1);
    expect(open("b1")).toBe("no_affinity");
    expect(open("m1")).toBe("no_node");
    const tree = treeView(gw, seat, "deu_spd")!;
    expect(tree.utopia).toBe("deu_social");
    expect(tree.nodes.find((n) => n.id === "m1")?.open).toBe(true);
    expect(tree.nodes.find((n) => n.id === "x1")?.why).toBe("node_shut");
    expect(tree.ready).toBe(false);
    expect(
      applyGwOrder(gw, seat, { kind: "utopia_realise", faction: "deu_spd" }),
    ).toBe("no_utopia");
  });

  test("realisation absorbs society and brings the regime; the player plays on as the head", async () => {
    const gw = await germany();
    rulers.push({
      ...rulers[0],
      id: HEAD,
      person: undefined,
      regimes: ["republic"],
      ends: undefined,
    });
    const seat = gw.s.seats[0];
    const n = gw.nation("DEU")!;
    const cons = factionOf(seat, "deu_cons")!;
    cons.step = 3;
    societyStep(gw);
    ripe(gw);
    expect(treeView(gw, seat, "deu_spd")?.ready).toBe(true);
    expect(
      applyGwOrder(gw, seat, { kind: "utopia_realise", faction: "deu_spd" }),
    ).toBeNull();
    expect(n.regime).toBe("republic");
    expect(n.unrest).toBe(0);
    expect(n.gauges.order).toBe(5);
    expect(cons.status).toBe("gone");
    expect(seat.house!.factions.every((f) => f.step === 0)).toBe(true);
    // ww208 merge: every community takes the winner's ideals.
    const spdIdeals = ideals.deu_spd!;
    expect(seat.society!.communities.length).toBeGreaterThan(0);
    for (const c of seat.society!.communities) {
      expect(c.ideal, c.id).toBeDefined();
      expect(spdIdeals[c.ideal!.axis], c.id).toBe(c.ideal!.side);
    }
    moveGauge(gw, "DEU", "order", -2, "order_hunger");
    expect(n.gauges.order).toBe(5);
    // The card waits: the Kaiser's end waits with it.
    rulerStep(gw);
    expect(gw.s.ended).toBeNull();
    expect(seat.society?.utopia).toMatchObject({
      faction: "deu_spd",
      regime: "republic",
      head: HEAD,
      choice: null,
    });
    expect(
      applyGwOrder(gw, seat, { kind: "utopia_choice", play: true }),
    ).toBeNull();
    rulerStep(gw);
    expect(gw.s.ended).toBeNull();
    expect(seat.ruler.id).toBe(HEAD);
    expect(seat.flags).toContain(`gw_head_${HEAD}`);
    expect(applyGwOrder(gw, seat, { kind: "utopia_choice", play: false })).toBe(
      "no_utopia",
    );
  });

  test("ending there is a winning end; a forced revolution still ends the seat", async () => {
    const gw = await germany();
    rulers.push({
      ...rulers[0],
      id: HEAD,
      person: undefined,
      regimes: ["republic"],
      ends: undefined,
    });
    ripe(gw);
    expect(
      applyGwOrder(gw, gw.s.seats[0], {
        kind: "utopia_realise",
        faction: "deu_spd",
      }),
    ).toBeNull();
    expect(
      applyGwOrder(gw, gw.s.seats[0], { kind: "utopia_choice", play: false }),
    ).toBeNull();
    expect(gw.s.ended).toBe("utopia_realised");

    const forced = await germany();
    changeRegime(forced, "DEU", "republic");
    rulerStep(forced);
    expect(forced.s.ended).toBe("deu_end_holland");
  });
});
