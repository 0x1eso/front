import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Player } from "@openfront/engine/game/Game";
import { byTag, stamped, step, stepTo, wwRunner } from "./util";

// Britain and France share the Allies; Germany is in neither's faction.
const HUMANS = [
  { clientID: "HUMANGBR", country: "GBR" as const },
  { clientID: "HUMANFRA", country: "FRA" as const },
  { clientID: "HUMANDEU", country: "DEU" as const },
];

/** The lobby's donation switches off: the mode turns them back on. */
const NO_DONATIONS = { donateGold: false, donateTroops: false };

describe("World War 1936 donations (spec §7.2)", () => {
  test("a faction member gives gold and troops to another; a neutral gives nothing", async () => {
    const runner = await wwRunner(NO_DONATIONS, HUMANS);
    const g = runner.game;
    expect(g.config().donateGold()).toBe(true);
    expect(g.config().donateTroops()).toBe(true);
    const [gbr, fra, deu] = (["GBR", "FRA", "DEU"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    expect(gbr.canDonateGold(fra)).toBe(true);
    expect(gbr.canDonateTroops(fra)).toBe(true);
    expect(deu.canDonateGold(fra)).toBe(false);
    expect(deu.canDonateTroops(fra)).toBe(false);

    const balance = (p: Player) => [p.gold(), p.troops()] as const;
    // Room under their troop caps (a donation fills up to it, no further).
    gbr.setTroops(Math.floor(g.config().maxTroops(gbr) / 2));
    fra.setTroops(Math.floor(g.config().maxTroops(fra) / 2));
    const fraGold = fra.gold();
    const gbrTroops = gbr.troops();
    // (A donor waits a cooldown between two donations to one recipient.)
    step(runner, 1, [
      stamped("HUMANGBR", {
        type: "donate_gold",
        recipient: fra.id(),
        gold: 1_000,
      }),
      stamped("HUMANFRA", {
        type: "donate_troops",
        recipient: gbr.id(),
        troops: 5_000,
      }),
    ]);
    step(runner);
    expect(fra.gold() - fraGold).toBeGreaterThanOrEqual(1_000n);
    expect(gbr.troops() - gbrTroops).toBeGreaterThanOrEqual(5_000);

    const [beforeGold, beforeTroops] = balance(fra);
    const [deuGold, deuTroops] = balance(deu);
    step(runner, 1, [
      stamped("HUMANDEU", {
        type: "donate_gold",
        recipient: fra.id(),
        gold: 1_000,
      }),
      stamped("HUMANDEU", {
        type: "donate_troops",
        recipient: fra.id(),
        troops: 5_000,
      }),
    ]);
    step(runner);
    // Germany keeps what it would have given (it only grew since).
    expect(deu.gold()).toBeGreaterThanOrEqual(deuGold);
    expect(deu.troops()).toBeGreaterThanOrEqual(deuTroops);
    // France got no more than its own income.
    const income = fra.gold() - beforeGold;
    expect(income).toBeLessThan(1_000n);
    expect(fra.troops() - beforeTroops).toBeLessThan(5_000);
  });

  test("a capitulated country neither donates nor builds", async () => {
    const runner = await wwRunner({}, HUMANS);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [gbr, fra, deu] = (["GBR", "FRA", "DEU"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    gbr.addGold(10_000_000n);
    const city = [...gbr.tiles()].find(
      (t) => gbr.canBuild(UnitType.City, t) !== false,
    )!;
    expect(city).toBeDefined();
    expect(gbr.canDonateGold(fra)).toBe(true);
    // Britain capitulates (its land still on its way to Germany).
    ww.setWar(deu.smallID(), gbr.smallID(), g.ticks());
    ww.addCapitulation(gbr.smallID(), deu.smallID(), g.ticks());
    expect(gbr.canBuild(UnitType.City, city)).toBe(false);
    expect(gbr.canDonateGold(fra)).toBe(false);
    expect(gbr.canDonateTroops(fra)).toBe(false);
    // Nor does a faction friend give to it.
    expect(fra.canDonateGold(gbr)).toBe(false);
    expect(fra.canDonateTroops(gbr)).toBe(false);
  });
});
