// P4 Task 10 (lane AI): the air AI's pure plan (spec §17.3).
import { AIR_TYPES, AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { NAVAL_BEATS } from "@openfront/engine-lib/ww1936/NavalBeats";
import {
  AI_FIGHTER_HOME_PCT,
  aiAirDue,
  AiAirInput,
  aiAirPlan,
  AiAirZoneView,
  aiParadrops,
  aiParadropScore,
  isParaArmy,
} from "@openfront/engine/ww1936/air/AiAir";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import {
  clearLand,
  HUMAN,
  placeArmy,
  step,
  warAfterPrep,
  wwRunner,
} from "./util";

const reachAll = AIR_TYPES.map(() => true);

function zone(sr: number, over: Partial<AiAirZoneView> = {}): AiAirZoneView {
  return {
    sr,
    kind: "land",
    front: false,
    enemyDivisions: 0,
    enemyPlanes: 0,
    attacking: false,
    bombed: false,
    enemyFleet: false,
    convoyLoss: false,
    industry: 0,
    supPm: 500,
    encircled: false,
    lossPm: 0,
    reach: reachAll,
    beat: false,
    ...over,
  };
}

const planes = (p: Partial<Record<AirType, number>>) =>
  AIR_TYPES.map((t) => p[t] ?? 0);

function input(over: Partial<AiAirInput>): AiAirInput {
  return {
    smallID: 1,
    day: 100,
    atWar: true,
    planes: planes({}),
    zones: [],
    capitalSr: 0,
    current: [],
    ...over,
  };
}

const deploys = (orders: ReturnType<typeof aiAirPlan>) =>
  orders.flatMap((o) =>
    o.kind === "air_deploy"
      ? [`${o.sr}:${o.type}:${o.mission}=${o.count}`]
      : [],
  );

describe("the air AI's plan (spec §17.3)", () => {
  // Task 15: Britain keeps 70% of its fighters over London (Fighter
  // Command); the bombers still put 90% on the demands.
  test("a home reserve keeps that share of the fighters at the capital", () => {
    const orders = aiAirPlan(
      input({
        planes: planes({ fighter: 100, bomber: 100 }),
        capitalSr: 3,
        fighterHomePct: AI_FIGHTER_HOME_PCT.GBR,
        zones: [zone(1, { front: true, enemyDivisions: 9, attacking: true })],
      }),
    );
    expect(AI_FIGHTER_HOME_PCT.GBR).toBe(70);
    expect(deploys(orders)).toEqual([
      "1:fighter:air_superiority=30",
      "1:bomber:cas=90",
      "3:fighter:interception=70",
    ]);
  });

  test("fighters follow the front and keep 10% at the capital", () => {
    // 100 fighters: 90 over the fronts by their enemy divisions (weights
    // 1 + 9 and 1 + 19: 30 and 60), 10 intercept over the capital.
    const orders = aiAirPlan(
      input({
        planes: planes({ fighter: 100 }),
        capitalSr: 3,
        zones: [
          zone(1, { front: true, enemyDivisions: 9 }),
          zone(2, { front: true, enemyDivisions: 19 }),
          zone(3),
        ],
      }),
    );
    expect(deploys(orders)).toEqual([
      "1:fighter:air_superiority=30",
      "2:fighter:air_superiority=60",
      "3:fighter:interception=10",
    ]);
    // Enemy planes count a tenth: 50 over zone 1 make its weight 15.
    expect(
      deploys(
        aiAirPlan(
          input({
            planes: planes({ fighter: 100 }),
            capitalSr: 3,
            zones: [
              zone(1, { front: true, enemyDivisions: 9, enemyPlanes: 50 }),
              zone(2, { front: true, enemyDivisions: 19 }),
              zone(3),
            ],
          }),
        ),
      ),
    ).toEqual([
      "1:fighter:air_superiority=39",
      "2:fighter:air_superiority=51",
      "3:fighter:interception=10",
    ]);
    // Bombed regions get interceptors too; with no front at all the
    // fighters all guard the capital. Out of reach, no deployment.
    expect(
      deploys(
        aiAirPlan(
          input({
            planes: planes({ fighter: 50 }),
            capitalSr: 3,
            zones: [zone(3)],
          }),
        ),
      ),
    ).toEqual(["3:fighter:interception=50"]);
    // At peace: only the capital's tenth; what is out elsewhere comes home.
    expect(
      deploys(
        aiAirPlan(
          input({
            atWar: false,
            planes: planes({ fighter: 100 }),
            capitalSr: 3,
            zones: [zone(1), zone(3)],
            current: [
              {
                sr: 1,
                type: "fighter",
                mission: "air_superiority",
                count: 40,
              },
            ],
          }),
        ),
      ),
    ).toEqual(["1:fighter:air_superiority=0", "3:fighter:interception=10"]);
    expect(aiAirDue(1, 4, true)).toBe(true);
    expect(aiAirDue(1, 5, true)).toBe(false);
    expect(aiAirDue(1, 9, false)).toBe(true);
    expect(aiAirDue(1, 4, false)).toBe(false);
  });

  test("fighters give up a losing sky over a quiet front, not over an attack (Task 15)", () => {
    // Two quiet fronts (no attack of ours); zone 1 lost 20% in five days
    // under a 300‰ sky: its fighters go to zone 2. Over an attack, with the
    // sky at 400‰ or with 5% lost, they stay.
    const quiet = (lossPm: number, supPm: number, attacking = false) => [
      zone(1, { front: true, enemyDivisions: 4, lossPm, supPm, attacking }),
      zone(2, { front: true, enemyDivisions: 4 }),
    ];
    const plan = (zones: AiAirZoneView[]) =>
      deploys(aiAirPlan(input({ planes: planes({ fighter: 100 }), zones })));
    expect(plan(quiet(200, 300))).toEqual(["2:fighter:air_superiority=90"]);
    expect(plan(quiet(200, 400))).toEqual([
      "1:fighter:air_superiority=45",
      "2:fighter:air_superiority=45",
    ]);
    expect(plan(quiet(50, 300))).toEqual([
      "1:fighter:air_superiority=45",
      "2:fighter:air_superiority=45",
    ]);
    expect(plan(quiet(51, 300))).toEqual(["2:fighter:air_superiority=90"]);
    expect(plan(quiet(200, 300, true))).toEqual([
      "1:fighter:air_superiority=45",
      "2:fighter:air_superiority=45",
    ]);
  });

  test("bombers leave a zone with heavy losses", () => {
    // Close support over the two attacks; zone 1 lost 20% in five days
    // under a 150‰ sky: its bombers go to zone 2, its fighters stay.
    const z = (lossPm: number, supPm: number) => [
      zone(1, {
        front: true,
        attacking: true,
        enemyDivisions: 4,
        lossPm,
        supPm,
      }),
      zone(2, { front: true, attacking: true, enemyDivisions: 4 }),
    ];
    const current = [
      { sr: 1, type: "cas" as const, mission: "cas" as const, count: 45 },
      { sr: 2, type: "cas" as const, mission: "cas" as const, count: 45 },
    ];
    expect(
      deploys(
        aiAirPlan(
          input({
            planes: planes({ cas: 100, fighter: 20 }),
            zones: z(200, 150),
            current,
          }),
        ),
      ),
    ).toEqual([
      "1:fighter:air_superiority=9",
      "1:cas:cas=0",
      "2:fighter:air_superiority=9",
      "2:cas:cas=90",
    ]);
    // The same losses under a 200‰ sky or better: they stay (no order).
    expect(
      deploys(
        aiAirPlan(
          input({
            planes: planes({ cas: 100 }),
            zones: z(200, 200),
            current,
          }),
        ),
      ),
    ).toEqual([]);
    // Strategic bombers only where we hold 300‰ of the sky; tactical
    // bombers bomb industry only when no attack needs them.
    const industry = [
      zone(5, { industry: 40, supPm: 299 }),
      zone(6, { industry: 10, supPm: 300 }),
    ];
    expect(
      deploys(
        aiAirPlan(
          input({
            planes: planes({ strat_bomber: 20, bomber: 10 }),
            zones: industry,
          }),
        ),
      ),
    ).toEqual([
      "6:bomber:strategic_bombing=9",
      "6:strat_bomber:strategic_bombing=18",
    ]);
    // Naval bombers: spotted fleets (3) and convoy losses (2) in sea zones.
    expect(
      deploys(
        aiAirPlan(
          input({
            planes: planes({ naval_bomber: 50 }),
            zones: [
              zone(1001, { kind: "sea", enemyFleet: true }),
              zone(1002, { kind: "sea", convoyLoss: true }),
            ],
          }),
        ),
      ),
    ).toEqual([
      "1001:naval_bomber:naval_strike=27",
      "1002:naval_bomber:naval_patrol=18",
    ]);
  });
});

describe("the AI's paradrops (lane AI review; spec §14.10, §17.6)", () => {
  test("a target's score: empty cities, or a beat's target ×10", () => {
    expect(aiParadropScore({ vp: 21, divisions: 0, beat: false })).toBe(2600);
    expect(aiParadropScore({ vp: 21, divisions: 1, beat: false })).toBe(0);
    expect(aiParadropScore({ vp: 3, divisions: 1, beat: true })).toBe(2000);
  });

  test("a paratrooper army drops on an empty enemy city under its own sky", async () => {
    // ww1936sea: an AI Germany at war with a human Poland, the board
    // cleared; two paratrooper divisions in Berlin (an air base), the
    // transports in stock. The air AI takes the sky over the east, then
    // the paradrop planner drops on Warsaw (21 points, empty).
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "POL" }],
      SEA.map,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const land = ww.land;
    const deu = TAG_ID.DEU;
    const ce = ww.economy.country(deu)!;
    for (const t of [
      "mountaineers",
      "paratroopers",
      "transport_plane_1",
    ] as const) {
      ce.addTech(t);
    }
    const cl = land.country(deu)!;
    cl.armyXpMilli = 1_000_000_000;
    const tpl = cl.nextTemplateId;
    expect(
      land.issue(
        deu,
        {
          kind: "template_save",
          template: 0,
          base: 0,
          name: "",
          battalions: [
            "paratrooper",
            "paratrooper",
            "paratrooper",
            "paratrooper",
          ],
          support: [],
        },
        "ai",
      ),
    ).toBeNull();
    clearLand(g);
    const army = placeArmy(g, "DEU", REGION.berlin, 2, tpl);
    expect(isParaArmy(land, army)).toBe(true);
    ce.stock[equipKey("transport_plane", 1)] = 500;
    const drops: number[] = [];
    const issue = land.issue.bind(land);
    land.issue = (id, o, by) => {
      const r = issue(id, o, by);
      if (id === deu && o.kind === "paradrop" && r === null)
        drops.push(o.region);
      return r;
    };
    warAfterPrep(runner, HUMAN, "DEU");
    const end = dayStartTick(ww.day(g.ticks()) + 30, ww.prepEndTick());
    while (g.ticks() < end && drops.length === 0) step(runner);
    expect(drops).toEqual([REGION.warsaw]);
    expect(land.armies.get(army.id)?.order.kind).toBe("paradrop");
  }, 120_000);

  test("before a paradrop beat the AI raises a paratrooper force", async () => {
    const runner = await wwRunner({}, [], SEA.map);
    const g = runner.game;
    const ww = g.worldWar()!;
    const deu = TAG_ID.DEU;
    const ce = ww.economy.country(deu)!;
    ce.addTech("mountaineers");
    ce.addTech("paratroopers");
    const cl = ww.land.country(deu)!;
    cl.armyXpMilli = 1_000_000_000;
    // Crete, not skipped, no delay (the beats are rolled on the first tick).
    step(runner);
    const i = NAVAL_BEATS.findIndex((b) => b.id === "deu_crete");
    ww.navy.beats[i] = [ww.navy.beats[i][0], 0, false];
    const crete = dayOfDate("1941-05-20");
    const before = cl.templates.length;
    // Too early: nothing; within 240 days: a template, then the training.
    aiParadrops(ww.air, deu, crete - 300, false);
    expect(cl.templates.length).toBe(before);
    aiParadrops(ww.air, deu, crete - 200, false);
    expect(cl.templates.length).toBe(before + 1);
    const para = cl.templates[cl.templates.length - 1];
    expect(para.def.battalions).toEqual([
      "paratrooper",
      "paratrooper",
      "paratrooper",
      "paratrooper",
    ]);
    aiParadrops(ww.air, deu, crete - 199, false);
    const queued = cl.training.filter((e) => e.template === para.id);
    expect(queued.reduce((n, e) => n + e.remaining, 0)).toBe(3);
    // Once enough train, no more.
    aiParadrops(ww.air, deu, crete - 198, false);
    expect(cl.training.filter((e) => e.template === para.id).length).toBe(1);
  }, 120_000);
});
