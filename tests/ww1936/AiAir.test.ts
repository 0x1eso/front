// P4 Task 10 (lane AI): the air AI's pure plan (spec §17.3).
import { AIR_TYPES, AirType } from "@openfront/engine-api/ww1936/AirTypes";
import {
  aiAirDue,
  AiAirInput,
  aiAirPlan,
  AiAirZoneView,
} from "@openfront/engine/ww1936/air/AiAir";

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
