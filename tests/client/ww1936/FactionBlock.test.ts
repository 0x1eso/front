import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { WW_MAX_FACTIONS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  createBlock,
  factionTab,
  politicsInput,
} from "../../../src/client/hud/ww1936/PoliticsModel";
import { ID } from "./EconomyFixture";
import {
  fakePolGame,
  polDetail,
  PolOptions,
  polSummary,
  startFactions,
} from "./PoliticsFixture";

function outside() {
  const factions = startFactions();
  factions[0].members = [ID("DEU")];
  return factions;
}

function italy(o: Partial<PolOptions> = {}, ruling = 2, pp = 100_000) {
  const r = fakePolGame({
    me: "ITA",
    polSummaries: [
      polSummary("ITA", { ruling, ppMilli: pp }),
      polSummary("GBR", { ruling: 0, faction: 1 }),
      polSummary("DEU", { ruling: 2, faction: 0 }),
    ],
    polDetails: [polDetail("ITA")],
    global: { factions: outside(), wtBp: 5_000 },
    ...o,
  } as never);
  return r;
}

const create = (r: ReturnType<typeof italy>, game: object = r.game) =>
  factionTab(politicsInput(game as never)!).create!.block;

describe("faction create: the real reason", () => {
  it("no block: open", () => {
    expect(create(italy())).toBeNull();
  });

  it("already in a faction", () => {
    const factions = outside();
    factions[0].members = [ID("ITA")];
    const r = italy({
      polSummaries: [polSummary("ITA", { ruling: 2, faction: 0 })],
      global: { factions, wtBp: 5_000 },
    });
    expect(createBlock(politicsInput(r.game as never)!)!).toContain(
      "[ww1936.pol.fac.in_faction] faction=",
    );
  });

  it("a minor needs the focus first", () => {
    const r = fakePolGame({
      me: "POL",
      polSummaries: [polSummary("POL")],
      polDetails: [polDetail("POL")],
      global: { factions: startFactions(), wtBp: 5_000 },
    } as never);
    expect(create(r)).toBe("[ww1936.pol.fac.minor]");
  });

  it("the national spirit rule", () => {
    const r = italy({
      polDetails: [
        polDetail("ITA", {
          spirits: [{ id: "usa_isolation", untilDay: 9_999 }],
        }),
      ],
    } as never);
    expect(create(r)).toContain("[ww1936.pol.fac.no_faction]");
  });

  it("the US congress below 70% (the test map has no USA: ITA stands in)", () => {
    const r = italy();
    const sc = r.game.worldWarScenario();
    const asUsa = Object.create(sc, { tagOfSmallId: { value: () => "USA" } });
    const as = (congressBp: number) => ({
      ...r.game,
      worldWarScenario: () => asUsa,
      wwDepth: () => ({ congressBp, factionRulesData: [] }),
    });
    expect(create(r, as(3_200))).toBe(
      "[ww1936.pol.law.need_congress] need=70,now=32",
    );
    expect(create(r, as(7_000))).toBeNull();
  });

  it("the faction limit", () => {
    const factions = Array.from({ length: WW_MAX_FACTIONS }, (_, n) => ({
      ...startFactions()[0],
      idx: n,
      key: n < 3 ? startFactions()[n].key : `f${n}`,
      members: [],
    }));
    const r = italy({ global: { factions, wtBp: 5_000 } } as never);
    expect(create(r)).toBe(`[ww1936.pol.fac.max] max=${WW_MAX_FACTIONS}`);
  });

  it("the tension gate of a democracy, with the number", () => {
    const r = italy({ global: { factions: outside(), wtBp: 2_500 } }, 0);
    expect(create(r)).toBe("[ww1936.pol.fac.tension] need=40,now=25");
  });

  it("not enough political power", () => {
    expect(create(italy({}, 2, 12_000))).toBe(
      "[ww1936.pol.fac.pp] need=50,now=12",
    );
  });
});

describe("faction join: the real reason", () => {
  it("a democratic bloc does not take a fascist", () => {
    const t = factionTab(politicsInput(italy().game as never)!);
    const allies = t.others.find((f) => f.key === "allies")!;
    expect(allies.request!.block).toContain("[ww1936.pol.fac.ideology]");
    expect(t.others.find((f) => f.key === "axis")!.request!.block).toBeNull();
  });
});
