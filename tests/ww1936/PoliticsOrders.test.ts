// World War 1936 P3 (spec §22.3, plan decisions 3, 11): the politics
// orders reach their lanes; P1's law order costs political power.
import type { PolOrder } from "@openfront/engine-api/Schemas";
import { POL_ORDER_KINDS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { lawBlock } from "@openfront/engine/ww1936/economy/LawsRun";
import { applyWwOrder } from "@openfront/engine/ww1936/economy/WwOrderExecution";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, order, pol, POL, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

/** One order of every politics kind, aimed at Poland (smallID 6). */
const ORDERS: Record<PolOrder["kind"], PolOrder> = {
  focus_start: { kind: "focus_start", focus: "gen_t_a" },
  focus_queue: { kind: "focus_queue", focus: "gen_t_b" },
  focus_cancel: { kind: "focus_cancel" },
  focus_unqueue: { kind: "focus_unqueue" },
  advisor_hire: {
    kind: "advisor_hire",
    slot: 0,
    advisor: "title:administrator",
  },
  advisor_fire: { kind: "advisor_fire", slot: 0 },
  decision_take: { kind: "decision_take", decision: "gen_t_rally", target: 0 },
  decision_cancel: {
    kind: "decision_cancel",
    decision: "gen_t_mission",
    target: 0,
  },
  event_choose: { kind: "event_choose", uid: 1, option: "a" },
  justify: { kind: "justify", target: 6, goal: "conquer", group: "" },
  justify_cancel: { kind: "justify_cancel" },
  guarantee: { kind: "guarantee", target: 6 },
  guarantee_end: { kind: "guarantee_end", target: 6 },
  nap_offer: { kind: "nap_offer", target: 6 },
  nap_break: { kind: "nap_break", target: 6 },
  access_ask: { kind: "access_ask", target: 6 },
  access_revoke: { kind: "access_revoke", target: 6 },
  faction_create: { kind: "faction_create" },
  faction_invite: { kind: "faction_invite", target: 6 },
  faction_request: { kind: "faction_request", target: 6 },
  faction_kick: { kind: "faction_kick", target: 6 },
  faction_leave: { kind: "faction_leave" },
  faction_dissolve: { kind: "faction_dissolve" },
  improve_relations: { kind: "improve_relations", target: 6 },
};

describe("politics orders", () => {
  it("every politics order reaches its lane", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      POL,
    );
    step(runner);
    const g = runner.game;
    const ww = g.worldWar()!;
    const deu = byTag(g, "DEU");
    expect(Object.keys(ORDERS)).toEqual([...POL_ORDER_KINDS]);
    for (const k of POL_ORDER_KINDS) {
      const block = applyWwOrder(
        g,
        ww.economy,
        deu,
        ORDERS[k],
        ww.day(g.ticks()),
      );
      expect(block, k).not.toBe("bad_index");
      expect(block, k).not.toBe("dead");
    }
    // The stubs' answers: each kind went to its own lane.
    const day = ww.day(g.ticks());
    const at = (k: PolOrder["kind"]) =>
      applyWwOrder(g, ww.economy, deu, ORDERS[k], day);
    expect(at("focus_start")).toBe("focus_unavailable");
    expect(at("focus_cancel")).toBe("focus_none");
    expect(at("advisor_hire")).toBe("advisor_unavailable");
    expect(at("decision_take")).toBe("decision_unavailable");
    expect(at("event_choose")).toBe("no_event");
    // Lane D: the 1934 pact refuses the justification; the loop above spent
    // the PP (guarantee, access, relations) and left the Axis (faction_leave),
    // so a neutral government now meets the 40% tension gate.
    expect(at("justify")).toBe("justify_blocked");
    expect(at("guarantee")).toBe("no_pp");
    expect(at("faction_create")).toBe("tension_gate");
    // The same through the intent, in the preparation minute too.
    const pp = pol(g).country(deu.smallID())!.ppMilli;
    step(runner, 1, [order(HUMAN, ORDERS.focus_start)]);
    expect(g.ticks()).toBeLessThan(WW_PREP_TICKS);
    expect(pol(g).country(deu.smallID())!.ppMilli).toBe(pp);
  });

  it("orders from a dead or capitulated country are refused with dead", async () => {
    const runner = await wwRunner({}, [], POL);
    stepTo(runner, WW_PREP_TICKS + 1);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pl] = [byTag(g, "DEU"), byTag(g, "POL")];
    ww.addCapitulation(pl.smallID(), deu.smallID(), g.ticks());
    for (const k of POL_ORDER_KINDS) {
      expect(
        applyWwOrder(g, ww.economy, pl, ORDERS[k], ww.day(g.ticks())),
        k,
      ).toBe("dead");
      expect(pol(g).issue(pl.smallID(), ORDERS[k], g.ticks()), k).toBe("dead");
    }
  });

  it("law changes cost PP and split the old law_condition", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      POL,
    );
    step(runner);
    const g = runner.game;
    const ww = g.worldWar()!;
    const gbr = byTag(g, "GBR");
    const ce = ww.economy.country(gbr.smallID())!;
    const c = pol(g).country(gbr.smallID())!;
    // Britain's 1936: 20% war support.
    c.wsBp = 2000;
    expect(lawBlock(ww.economy, ce, "conscription", "extensive", 0)).toBe(
      "law_ws",
    );
    // Peacetime all adults: a war is needed (P1's reason).
    expect(lawBlock(ww.economy, ce, "conscription", "all_adults", 0)).toBe(
      "law_condition",
    );
    c.wsBp = 3000;
    // 50 PP do not pay 100.
    expect(lawBlock(ww.economy, ce, "conscription", "extensive", 0)).toBe(
      "no_pp",
    );
    c.ppMilli = 150_000;
    step(runner, 1, [
      order(HUMAN, {
        kind: "set_law",
        law: "conscription",
        value: "extensive",
      }),
    ]);
    expect(ce.laws.conscription).toBe("extensive");
    expect(c.ppMilli).toBe(50_000);
  });
});
