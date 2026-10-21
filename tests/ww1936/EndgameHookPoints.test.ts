// World War 1936 P5 (plan decision 38): the hook lines the foundation put
// into P0–P4 — what they do while the lanes' bodies are stubs.
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_SLOTS } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "@openfront/engine/game/Game";
import { declareWarBlock } from "@openfront/engine/ww1936/Diplomacy";
import { activateCountry } from "@openfront/engine/ww1936/endgame/Activate";
import { makeSubject } from "@openfront/engine/ww1936/endgame/Subjects";
import {
  joinBattle,
  modInputOf,
  stepBattles,
} from "@openfront/engine/ww1936/land/Battles";
import {
  transferArmyTo,
  transferDivisionsTo,
} from "@openfront/engine/ww1936/land/PoliticsBridge";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { decisionBlock } from "@openfront/engine/ww1936/politics/Decisions";
import {
  createFaction,
  joinBlock,
} from "@openfront/engine/ww1936/politics/Factions";
import { annexCountry } from "@openfront/engine/ww1936/politics/Territory";
import { vi } from "vitest";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  dropPact,
  END_MAP,
  placeArmy,
  step,
  stepTo,
  wwRunner,
} from "./util";

afterEach(() => usePoliticsContent(null));

const asPlayer = (g: Game, id: number): Player => {
  const p = g.playerBySmallID(id);
  if (!p.isPlayer()) throw new Error(`no player ${id}`);
  return p;
};

async function started(humans: { clientID: string; country: "POL" }[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { runner, g: runner.game, ww: runner.game.worldWar()! };
}

describe("World War 1936 P5: hook points", () => {
  beforeEach(() => usePoliticsContent(endgameFixture()));

  it("a puppet declares only on its overlord's enemies; an exile not at all", async () => {
    const { g, ww } = await started();
    const [deu, csk, pl, ltu] = ["DEU", "CSK", "POL", "LTU"].map((t) =>
      endId(t as "DEU"),
    );
    makeSubject(ww.endgame, csk, deu, "puppet", false, g.ticks());
    expect(ww.endgame.subjectOf(csk)!.level).toBe("puppet");
    const block = () =>
      declareWarBlock(g, ww, asPlayer(g, csk), asPlayer(g, ltu), g.ticks());
    expect(block()).toBe("subject_restricted");
    ww.setWar(deu, ltu, g.ticks(), { kind: "declare" });
    expect(block()).toBeNull();
    // The independence war is the exception (lane S).
    expect(
      declareWarBlock(
        g,
        ww,
        asPlayer(g, csk),
        asPlayer(g, deu),
        g.ticks(),
        false,
        {
          independence: true,
        },
      ),
    ).toBeNull();
    // An exile may be declared on, but declares nothing.
    ww.addCapitulation(pl, deu, g.ticks());
    ww.endgame.exiles.push({
      smallID: pl,
      host: endId("GBR"),
      legitBp: 5000,
      sinceDay: 0,
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: 6,
    });
    ww.endgame.rebuildDerived();
    dropPact(g, "DEU", "POL");
    expect(
      declareWarBlock(g, ww, asPlayer(g, pl), asPlayer(g, ltu), g.ticks()),
    ).toBe("exile");
    expect(
      declareWarBlock(g, ww, asPlayer(g, ltu), asPlayer(g, pl), g.ticks()),
    ).not.toBe("capitulated");
  });

  it("a woken slot's capital is its best region; its armies move by the bridge", async () => {
    const { g, ww } = await started();
    const [csk, svk] = [endId("CSK"), endId("SVK")];
    activateCountry(ww.endgame, "SVK", { regions: [15, 20] }, g.ticks());
    // Kosice (3 points) over Slovakia (2).
    expect(ww.capitalRegion(svk)).toBe(20);
    expect(ww.capitalRegion(csk)).toBe(14);
    clearLand(g);
    const ce = ww.economy.country(csk)!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 10_000;
    ce.manpower += 100_000;
    const a = placeArmy(g, "CSK", 14, 2);
    const ids = [...a.divisions];
    const moved = transferArmyTo(ww.land, a, svk)!;
    expect(moved.owner).toBe(svk);
    expect(moved.divisions).toEqual(ids);
    for (const id of ids) {
      expect(ww.land.divisions.owner[ww.land.divisions.rowOf(id)]).toBe(svk);
    }
    expect(ww.land.armies.has(a.id)).toBe(false);
    const back = transferDivisionsTo(ww.land, [ids[0]], csk, 7)!;
    expect(back.owner).toBe(csk);
    expect(back.nameNo).toBe(7);
    expect(back.divisions).toEqual([ids[0]]);
  });

  it("a volunteer army fights as its host and goes only where P5 lets it", async () => {
    const { ww } = await started();
    const l = ww.land;
    const [ita, pl] = [endId("ITA"), endId("POL")];
    const a = l.armiesOf(ita)[0];
    const row = l.divisions.rowOf(a.divisions[0]);
    expect(l.fightOwner(row)).toBe(ita);
    l.setVolunteerFor(a, pl);
    expect(l.fightOwner(row)).toBe(pl);
    expect(l.divisionSide(row)).toBe(l.sideOf(pl));
    // Its host's air cover and fuel in a battle.
    const air = vi.spyOn(l.hooks, "airPenaltyBp");
    const fuel = vi.spyOn(l.hooks, "fuelFactorPm");
    modInputOf(l, row, l.divisions.region[row], false);
    expect(air.mock.calls.map((c) => c[1])).toEqual([l.sideOf(pl)]);
    expect(fuel.mock.calls.every((c) => c[0] === pl)).toBe(true);
    air.mockRestore();
    fuel.mockRestore();
    // Lane A's rule (stub: nowhere).
    expect(l.canArmyEnter(a, 5)).toBe(false);
    l.setVolunteerFor(a, 0);
    expect(l.fightOwner(row)).toBe(ita);
    expect(l.canArmyEnter(a, 5)).toBe(true);
  });

  it("a battle keeps its equipment and casualty ledgers", async () => {
    const { runner, g, ww } = await started();
    const l = ww.land;
    const [deu, pl] = [endId("DEU"), endId("POL")];
    dropPact(g, "DEU", "POL");
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    step(runner);
    clearLand(g);
    for (const tag of ["DEU", "POL"] as const) {
      const ce = ww.economy.country(endId(tag))!;
      for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
      ce.manpower += 1_000_000;
    }
    const a = placeArmy(g, "DEU", 3, 3);
    placeArmy(g, "POL", 6, 1);
    for (const id of a.divisions) joinBattle(l, id, 6);
    for (let i = 0; i < 6 && l.battles.has(6); i++) stepBattles(l, g.ticks());
    const b = l.battles.get(6);
    expect(b).toBeDefined();
    expect(b!.capEq).toHaveLength(2 * GROUND_SLOTS);
    expect(b!.capEq!.some((x) => x > 0)).toBe(true);
    expect(b!.dmgBy!.map(([c]) => c).sort()).toEqual([deu, pl].sort());
    expect(b!.dmgBy!.every(([, men]) => men > 0)).toBe(true);
  });

  it("an annexed human's country is gone and its human spectates (no takeover yet)", async () => {
    const { g, ww } = await started([{ clientID: "HUMANPOL", country: "POL" }]);
    const [deu, pl] = [endId("DEU"), endId("POL")];
    annexCountry(ww.politics, deu, pl, "disband", false, g.ticks());
    expect(ww.endgame.countryState(pl)).toBe("gone");
    expect(ww.endgame.controlledBy("HUMANPOL")).toBe(0);
    expect(g.playerByClientID("HUMANPOL")).toBeNull();
  });
});

describe("World War 1936 P5: content flags the foundation reads", () => {
  it("a decision on dead countries targets the gone, never the living or the dormant", async () => {
    usePoliticsContent(
      endgameFixture({
        decisions: [
          {
            id: "t_restore",
            category: "political",
            for: "any",
            target: { among: { not: { kind: "exists" } }, dead: true },
            ai: { base: 0 },
          },
        ],
      }),
    );
    const { g, ww } = await started();
    const [deu, pl, svk, ltu] = ["DEU", "POL", "SVK", "LTU"].map((t) =>
      endId(t as "DEU"),
    );
    const pol = ww.politics;
    expect(decisionBlock(pol, deu, "t_restore", pl)).toBe("bad_target");
    expect(decisionBlock(pol, deu, "t_restore", svk)).toBe("bad_target");
    ww.addCapitulation(ltu, deu, g.ticks());
    expect(decisionBlock(pol, deu, "t_restore", ltu)).not.toBe("bad_target");
  });

  it("a faction for any ideology takes any government", async () => {
    for (const anyIdeology of [false, true]) {
      usePoliticsContent(
        endgameFixture({
          factionNames: [
            {
              id: "t_pact",
              creators: ["POL"],
              ...(anyIdeology ? { anyIdeology: true as const } : {}),
            },
          ],
        }),
      );
      const { g, ww } = await started();
      const pol = ww.politics;
      const [pl, ltu] = [endId("POL"), endId("LTU")];
      pol.country(pl)!.ruling = 0; // democratic
      pol.country(ltu)!.ruling = 2; // fascist
      const idx = createFaction(pol, pl, undefined, ww.day(g.ticks()));
      expect(pol.faction(idx)!.name).toBe("t_pact");
      const block = joinBlock(pol, ltu, idx);
      if (anyIdeology) {
        expect(block === null || block === "tension_gate", `${block}`).toBe(
          true,
        );
      } else expect(block).toBe("faction_rule");
    }
  });
});
