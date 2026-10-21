// World War 1936 P5 lane O (spec §17.2): the AI's occupation laws and
// garrison armies. Germany is the only AI; Czechoslovakia is a human, on
// the end map's Czechoslovak island chain.
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  AI_CIVIL_COVER_PCT,
  AI_CIVIL_RES_BP,
  aiOccupationLaw,
} from "@openfront/engine/ww1936/endgame/AiOccupation";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  END_MAP,
  placeArmy,
  stepTo,
  type WwHuman,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const HUMANS: WwHuman[] = [{ clientID: "HUMANCSK", country: "CSK" }];
const CZECH = ["sudetenland", "prague", "slovakia", "kosice"].map(
  (n) => END.region[n],
);

async function aiGame() {
  const runner = await wwRunner({}, HUMANS, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  const deu = endId("DEU");
  clearLand(g);
  const ce = ww.economy.country(deu)!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
  for (const r of CZECH) ww.land.setController(r, deu, g.ticks());
  return { runner, g, ww, eg: ww.endgame, land: ww.land, deu };
}

function days(runner: Awaited<ReturnType<typeof aiGame>>["runner"], n: number) {
  const ww = runner.game.worldWar()!;
  stepTo(
    runner,
    dayStartTick(ww.day(runner.game.ticks()) + n, ww.prepEndTick()),
  );
}

describe("World War 1936 P5: the occupation AI", () => {
  it("picks a law from resistance, the table and the war", () => {
    const base = {
      avgResBp: 1000,
      coveragePct: 100,
      aggressor: false,
      atWar: false,
      historical: null,
    } as const;
    expect(aiOccupationLaw(base)).toBe("occ_military");
    expect(aiOccupationLaw({ ...base, aggressor: true, atWar: true })).toBe(
      "occ_martial",
    );
    expect(aiOccupationLaw({ ...base, historical: "occ_civil" })).toBe(
      "occ_civil",
    );
    // Heavy resistance with a short garrison overrides the table.
    expect(
      aiOccupationLaw({
        ...base,
        avgResBp: AI_CIVIL_RES_BP,
        coveragePct: AI_CIVIL_COVER_PCT - 1,
        historical: "occ_martial",
      }),
    ).toBe("occ_civil");
    expect(
      aiOccupationLaw({
        ...base,
        avgResBp: AI_CIVIL_RES_BP,
        coveragePct: AI_CIVIL_COVER_PCT,
      }),
    ).toBe("occ_military");
  });

  it("forms a garrison army from its weakest divisions", async () => {
    const { runner, g, eg, land, deu } = await aiGame();
    for (const r of CZECH) eg.resBp[r] = 6000;
    placeArmy(g, "DEU", END.region["prague"], 8);
    expect(
      land.armiesOf(deu).filter((a) => a.order.kind === "garrison"),
    ).toHaveLength(0);
    days(runner, 3);
    const garrisons = land
      .armiesOf(deu)
      .filter((a) => a.order.kind === "garrison");
    expect(garrisons.length).toBeGreaterThan(0);
    for (const a of garrisons)
      expect(a.divisions.length).toBeLessThanOrEqual(24);
  }, 60_000);

  it("switches to civil law under heavy resistance", async () => {
    const { runner, ww, eg, deu } = await aiGame();
    for (const r of CZECH) eg.resBp[r] = 9000;
    // No garrison at all: coverage is 0, resistance heavy.
    days(runner, 31);
    const admin = CZECH.filter((r) => eg.isAdministered(r));
    expect(admin.length).toBeGreaterThan(0);
    for (const r of admin) {
      expect(eg.occupationLawOf(deu, ww.politics.legalOwner[r] ?? 0)).toBe(
        "occ_civil",
      );
    }
  }, 60_000);
});
