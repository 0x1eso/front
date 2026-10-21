// World War 1936 P2 (plan Task 12 Step 1, P2 spec §16.5, Review Focus 2):
// the land war's snapshot oracle on the test map. Human Germany declares
// on Poland, trains, attacks Krakow and then Warsaw with every army and
// drops paratroopers; four days in, Warsaw falls by hand the evening before
// Poland's gauge fills, so it capitulates. A copy is restored at each moment —
// mid-battle, mid-retreat, mid-spread, mid-day, with divisions in
// training, mid-capitulation-spread, paratroopers preparing — and runs
// 600 ticks beside the game: the hash every tick, the snapshot every 25.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { MOVE_RETREAT } from "@openfront/engine-api/ww1936/LandTypes";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import { transferCountryUnits } from "@openfront/engine/ww1936/land/PoliticsBridge";
import {
  SPREAD_BATTLE,
  SPREAD_CAPITULATION,
  SPREAD_CAPTURE,
} from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { type Moment, runLockstep } from "./lockstep";
import {
  byTag,
  dropPact,
  HUMAN,
  land,
  MINI,
  order,
  placeArmy,
  stamped,
  stepTo,
  takeRegion,
  wwGameStart,
  wwRunner,
} from "./util";

const PARA = "Fallschirmjäger";
const ids = (g: Game) => ({
  deu: byTag(g, "DEU").smallID(),
  pol: byTag(g, "POL").smallID(),
});
const kOf = (g: Game) => {
  const ww = g.worldWar()!;
  return g.ticks() - dayStartTick(ww.day(g.ticks()), ww.prepEndTick());
};
/** The day Germany's war on Poland began; -1 at peace. */
function warDay(g: Game): number {
  const ww = g.worldWar()!;
  const { deu } = ids(g);
  const since = ww.earliestWarTick(deu);
  return since === null ? -1 : ww.day(since);
}
const isPara = (g: Game, armyId: number) => {
  const l = land(g);
  const a = l.armies.get(armyId)!;
  const r = l.divisions.rowOf(a.divisions[0] ?? -1);
  return (
    r >= 0 && l.templateOf(a.owner, l.divisions.template[r])?.def.name === PARA
  );
};

/** Germany's turn: the declaration, training, and once a day the attacks. */
function germany(g: Game): StampedIntent[] {
  const ww = g.worldWar()!;
  const l = land(g);
  const t = g.ticks();
  const { deu, pol } = ids(g);
  if (t === WW_PREP_TICKS + 1) {
    return [
      stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
    ];
  }
  if (t === WW_PREP_TICKS + 5) {
    // P4 (lane A2): a paradrop needs our superiority over the target's
    // zone: fighters over Krakow's and Warsaw's.
    const srs = [...new Set([7, 6].map((r) => ww.scenario.regionSr(r)))].filter(
      (sr) => sr > 0,
    );
    return [
      order(HUMAN, {
        kind: "train",
        template: 1,
        count: 3,
        army: 0,
        region: 0,
      }),
      ...srs.map((sr) =>
        order(HUMAN, {
          kind: "air_deploy",
          sr,
          type: "fighter",
          mission: "air_superiority",
          count: 100,
        }),
      ),
    ];
  }
  if (!ww.isAtWar(deu, pol) || kOf(g) !== 4) return [];
  const day = ww.day(t);
  // Krakow first, then Warsaw (the hand takes Warsaw four days in).
  const target = l.controller[7] !== deu ? 7 : 6;
  const out: StampedIntent[] = [];
  for (const a of l.armiesOf(deu)) {
    if (a.divisions.length === 0) continue;
    if (isPara(g, a.id)) {
      if (
        a.order.kind === "idle" &&
        a.paraLastDay < 0 &&
        day >= warDay(g) + 1
      ) {
        out.push(
          order(HUMAN, { kind: "paradrop", army: a.id, region: target }),
        );
      }
      continue;
    }
    const o = a.order;
    if (o.kind === "plan" && o.executing && o.targets.includes(target))
      continue;
    out.push(order(HUMAN, { kind: "army_attack", army: a.id, region: target }));
  }
  return out;
}

/**
 * The test's hand, alike on every copy: the pact goes before the war,
 * Germany gets paratroopers, and four days into the war Poland is made to
 * capitulate.
 */
function hand(g: Game): void {
  const t = g.ticks();
  const ww = g.worldWar()!;
  const l = land(g);
  const { deu, pol } = ids(g);
  if (t === 1) dropPact(g, "DEU", "POL");
  if (t === 2) {
    const cl = l.country(deu)!;
    l.econ.country(deu)!.addTech("paratroopers");
    const tpl = cl.nextTemplateId++;
    cl.templates.push({
      id: tpl,
      key: "",
      def: {
        name: PARA,
        battalions: Array(6).fill("paratrooper"),
        support: [],
      },
    });
    placeArmy(g, "DEU", 3, 2, tpl);
    // P4 (lane A2): the transports a drop needs.
    l.econ.country(deu)!.stock[equipKey("transport_plane", 1)] += 200;
  }
  if (!ww.isAtWar(deu, pol) || ww.isCapitulated(pol)) return;
  // Four days into the war Warsaw falls (as a won battle takes it) the
  // evening before Poland's gauge fills: Poland capitulates on the next
  // tick, the day's first, and Krakow's capitulation spread waits behind
  // Warsaw's capture spread (WorldWarSnapshot's "around a capitulation").
  if (t === dayStartTick(warDay(g) + 4, ww.prepEndTick())) {
    if (l.controller[6] !== deu) takeRegion(g, 6, "DEU");
    ww.setCapitulationGauge(pol, WW_CAPITULATION_DAYS - 1);
  }
}

function anySpread(g: Game, kinds: number[]): boolean {
  for (const s of land(g).spreads.values()) {
    if (kinds.includes(s.kind) && s.done > 0) return true;
  }
  return false;
}

const SPREAD = "(c) a battle's spread part-way";
const MOMENTS: Moment[] = [
  {
    name: "(a) a battle in its tenth round",
    when: (g) => [...land(g).battles.values()].some((b) => b.round === 10),
  },
  {
    name: "(b) a retreat",
    when: (g) => {
      const t = land(g).divisions;
      for (let r = 0; r < t.rows; r++) {
        if (t.id[r] !== 0 && t.mode[r] === MOVE_RETREAT) return true;
      }
      return false;
    },
  },
  {
    name: SPREAD,
    when: (g) => anySpread(g, [SPREAD_BATTLE, SPREAD_CAPTURE]),
  },
  {
    name: "(d) the third tick of a war day",
    when: (g) =>
      warDay(g) >= 0 &&
      g.worldWar()!.day(g.ticks()) >= warDay(g) + 2 &&
      kOf(g) === 3,
  },
  {
    name: "(e) divisions in training",
    when: (g) => land(g).country(ids(g).deu)!.trainees.length > 0,
  },
  {
    name: "(f) a capitulation's spread part-way",
    when: (g) =>
      g.worldWar()!.isCapitulated(ids(g).pol) &&
      anySpread(g, [SPREAD_CAPITULATION]),
  },
  {
    name: "(g) paratroopers preparing",
    when: (g) =>
      [...land(g).armies.values()].some((a) => a.order.kind === "paradrop"),
  },
];

describe("the land war restores exactly (P2 spec §16.5)", () => {
  test("restored at every moment of a war, the copies continue tick for tick", async () => {
    const files = await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    let derivedChecked = false;
    const rep = await runLockstep({
      start: wwGameStart({}, [{ clientID: HUMAN, country: "DEU" }]),
      files,
      until: 4500,
      window: 600,
      wwEvery: 1,
      fullEvery: 25,
      graphs: true,
      moments: MOMENTS,
      intents: germany,
      hand,
      // Restored derived fields are rebuilt: no spread orders at first,
      // and after the first stepSpread each one built equals the game's.
      onRestore: (name, _main, copy) => {
        if (name === SPREAD) expect(land(copy).spreadOrders.size).toBe(0);
      },
      afterTick: (name, age, main, copy) => {
        if (name !== SPREAD || age !== 1) return;
        const built = [...land(copy).spreadOrders];
        expect(built.length).toBeGreaterThan(0);
        for (const [region, tiles] of built) {
          expect(Array.from(tiles)).toEqual(
            Array.from(land(main).spreadOrders.get(region)!),
          );
        }
        derivedChecked = true;
      },
    });
    expect(rep.missed).toEqual([]);
    expect(rep.restores.map((r) => r.name).sort()).toEqual(
      MOMENTS.map((m) => m.name).sort(),
    );
    expect(derivedChecked).toBe(true);
  }, 600_000);
});

describe("the land's caches follow a division to a new owner (P3 spec §17.2 annexation)", () => {
  // Found by scripts/ww1936/det-sim.ts on the real map: Austria's
  // divisions went to Germany in the Anschluss keeping template id 1, and a
  // restored game, whose stats epochs had started over, read them with
  // Austria's numbers while the live game read Germany's.
  async function handedOver() {
    const runner = await wwRunner();
    stepTo(runner, WW_PREP_TICKS + 1);
    const g = runner.game;
    const l = land(g);
    const { deu, pol } = ids(g);
    const rows = [...l.rowsOf(pol)];
    expect(rows.length).toBeGreaterThan(0);
    return { g, l, deu, pol, rows };
  }
  const numbers = (l: ReturnType<typeof land>, rows: number[]) =>
    rows.map((r) => [
      l.orgMaxOf(r),
      l.flagsOf(r),
      l.baseStatsOf(r),
      l.statsOf(r),
    ]);

  test("the stats are the new owner's, whatever the two countries' stats epochs", async () => {
    const { l, deu, pol, rows } = await handedOver();
    // Every country's epoch starts over (as in a restored game), and
    // Poland's divisions are read: their entries carry Poland's first epoch.
    l.clearStatsCache();
    numbers(l, rows);
    transferCountryUnits(l, pol, deu, "transfer");
    expect(rows.every((r) => l.divisions.owner[r] === deu)).toBe(true);
    const cached = numbers(l, rows);
    l.clearStatsCache();
    expect(cached).toEqual(numbers(l, rows));
  });

  test("the rows by owner move with them", async () => {
    const { l, deu, pol, rows } = await handedOver();
    const before = [...l.rowsOf(deu)];
    transferCountryUnits(l, pol, deu, "transfer");
    expect(l.rowsOf(pol)).toEqual([]);
    expect([...l.rowsOf(deu)]).toEqual(
      [...before, ...rows].sort((a, b) => a - b),
    );
  });
});
