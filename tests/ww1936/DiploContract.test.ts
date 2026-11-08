// World War 1936 diplomacy (ww161 Design B), lane L0: the contract. The
// four orders and the peace offer's "come home" flag are appended and cross
// the zbin wire; the block reasons and the `diplomacy` auto domain are
// appended; the new state round-trips through the snapshot and moves the
// hash only when there is some; the orders reach WwEndgame.issue. No rule
// changes here: VanillaDigest and GW_DIGEST stay where they were.
import {
  DealItemSchema,
  IntentSchema,
  type WwOrder,
  WwOrderSchema,
} from "@openfront/engine-api/Schemas";
import {
  DEAL_ITEM_KINDS,
  DIPLO_NOTICES,
  DIPLO_ORDER_KINDS,
  noticeId,
  WW_COLLAB_MAX_REGIONS,
  WW_DEAL_MAX_ITEMS,
  WW_ULT_MAX_REGIONS,
} from "@openfront/engine-api/ww1936/DiploTypes";
import { WW_ORDER_BLOCKS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_AUTO_DOMAINS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  diploCooldownUntil,
  expireDiploTimers,
  setDiploCooldown,
} from "@openfront/engine/ww1936/endgame/DiploState";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { replacer } from "@openfront/shared/SharedUtil";
import {
  type ServerMessage,
  ServerMessageSchema,
} from "@openfront/shared/WireSchemas";
import {
  createGameWireContext,
  decodeServerMessage,
  encodeServerMessage,
} from "@openfront/shared/ZbinWire";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import {
  byTag,
  gameHash,
  HUMAN,
  order,
  step,
  stepTo,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";

withTestPolitics();

const wwOf = (r: GameRunner): WorldWar => r.game.worldWar()!;

const kindsOf = () =>
  WwOrderSchema.options.map((o) => (o.shape.kind as { value: string }).value);

/** One of each new order, and every item kind once. */
const ORDERS: WwOrder[] = [
  {
    kind: "deal_offer",
    to: 3,
    give: [
      { kind: "region", region: 12 },
      { kind: "equipment", key: 7, count: 500 },
      {
        kind: "lend_lease",
        item: "fuel",
        gen: 0,
        perMonth: 40,
        months: 6,
      },
      { kind: "licence", key: 3 },
      { kind: "licence", key: 90, ship: 2 },
      { kind: "promise", target: 5, group: "pol_corridor" },
    ],
    take: [
      { kind: "access" },
      { kind: "nap" },
      { kind: "guarantee" },
      { kind: "join_war", war: 4, target: 5 },
    ],
  },
  { kind: "deal_offer", to: 9, give: [], take: [] },
  { kind: "deal_reply", offer: 17, accept: true },
  { kind: "deal_reply", offer: 18, accept: false },
  { kind: "collab_create", target: 6, regions: [4, 8, 15] },
  { kind: "ultimatum", target: 2, regions: [30, 31] },
  { kind: "peace_offer", war: 2, target: 6, home: true },
  { kind: "peace_offer", war: 2, target: 6 },
];

describe("diplomacy L0: the lists", () => {
  test("the four orders are appended after the battle planner's (after template_auto), in DIPLO_ORDER_KINDS order", () => {
    const kinds = kindsOf();
    // ww162 release: the battle planner's nine came first, ending in
    // group_fallback; the diplomacy's four follow, and nothing after them.
    const at = kinds.indexOf("group_fallback");
    expect(at).toBe(kinds.indexOf("template_auto") + 9);
    expect(kinds.length).toBe(at + 1 + DIPLO_ORDER_KINDS.length);
    expect(kinds.slice(at + 1, at + 1 + DIPLO_ORDER_KINDS.length)).toEqual([
      ...DIPLO_ORDER_KINDS,
    ]);
    expect(DIPLO_ORDER_KINDS).toEqual([
      "deal_offer",
      "deal_reply",
      "collab_create",
      "ultimatum",
    ]);
  });

  test("the item union follows DEAL_ITEM_KINDS", () => {
    expect(
      DealItemSchema.options.map(
        (o) => (o.shape.kind as { value: string }).value,
      ),
    ).toEqual([...DEAL_ITEM_KINDS]);
  });

  test("the block reasons are appended after too_many_support", () => {
    const at = WW_ORDER_BLOCKS.indexOf("too_many_support");
    expect(WW_ORDER_BLOCKS.slice(at + 1, at + 21)).toEqual([
      "peace_puppet",
      "home_not_exile",
      "deal_empty",
      "deal_pending",
      "deal_cooldown",
      "deal_bad_item",
      "deal_no_offer",
      "deal_lapsed",
      "promise_bad_target",
      "ultimatum_gov",
      "ultimatum_relation",
      "ultimatum_cooldown",
      "ultimatum_bad_regions",
      "ultimatum_too_much",
      "collab_not_occupier",
      "collab_democracy",
      "collab_too_small",
      "collab_bad_region",
      "collab_no_slot",
      "collab_scripted",
    ]);
    expect(new Set(WW_ORDER_BLOCKS).size).toBe(WW_ORDER_BLOCKS.length);
  });

  test("the notices are full keys; noticeId drops the prefix", () => {
    for (const k of Object.values(DIPLO_NOTICES)) {
      expect(k.startsWith("events_display.ww1936_")).toBe(true);
    }
    expect(noticeId(DIPLO_NOTICES.dealAccepted)).toBe("ww1936_deal_accepted");
  });

  test("the diplomacy auto domain is appended after intel", () => {
    const at = WW_AUTO_DOMAINS.indexOf("intel");
    expect(WW_AUTO_DOMAINS[at + 1]).toBe("diplomacy");
  });
});

describe("diplomacy L0: the schema and the wire", () => {
  const ok = (o: unknown) => WwOrderSchema.safeParse(o).success;
  const region = (i: number) => ({ kind: "region", region: 10 + i });

  test("every new order parses; the caps hold", () => {
    for (const o of ORDERS) expect(ok(o)).toBe(true);
    const items = (n: number) => Array.from({ length: n }, (_, i) => region(i));
    expect(
      ok({
        kind: "deal_offer",
        to: 3,
        give: items(WW_DEAL_MAX_ITEMS),
        take: [],
      }),
    ).toBe(true);
    expect(
      ok({
        kind: "deal_offer",
        to: 3,
        give: items(WW_DEAL_MAX_ITEMS + 1),
        take: [],
      }),
    ).toBe(false);
    const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    expect(ok({ kind: "ultimatum", target: 2, regions: [] })).toBe(false);
    expect(
      ok({
        kind: "ultimatum",
        target: 2,
        regions: ids(WW_ULT_MAX_REGIONS + 1),
      }),
    ).toBe(false);
    expect(
      ok({
        kind: "collab_create",
        target: 2,
        regions: ids(WW_COLLAB_MAX_REGIONS),
      }),
    ).toBe(true);
    expect(
      ok({
        kind: "collab_create",
        target: 2,
        regions: ids(WW_COLLAB_MAX_REGIONS + 1),
      }),
    ).toBe(false);
    // An item kind that does not exist, a promise without a group.
    expect(
      ok({ kind: "deal_offer", to: 3, give: [{ kind: "manpower" }], take: [] }),
    ).toBe(false);
    expect(
      ok({
        kind: "deal_offer",
        to: 3,
        give: [{ kind: "promise", target: 5, group: "" }],
        take: [],
      }),
    ).toBe(false);
    expect(
      IntentSchema.safeParse({
        type: "ww_order",
        clientID: HUMAN,
        order: ORDERS[0],
      }).success,
    ).toBe(true);
  });

  test("the orders round-trip through zbin", () => {
    const PLAYERS = [{ clientID: "aB3dEf7h" }, { clientID: "Xk9mNp2q" }];
    const msg: ServerMessage = {
      type: "turn",
      turn: {
        turnNumber: 5,
        intents: ORDERS.map((o) => ({
          type: "ww_order" as const,
          clientID: PLAYERS[0].clientID,
          order: o,
        })),
      },
    };
    const decoded = decodeServerMessage(
      encodeServerMessage(msg, createGameWireContext(PLAYERS)),
      createGameWireContext(PLAYERS),
    );
    expect(decoded).toEqual(
      ServerMessageSchema.parse(JSON.parse(JSON.stringify(msg, replacer))),
    );
    expect(decoded).toEqual(msg);
  });
});

async function started() {
  const runner = await wwRunner({ historicalAi: false }, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = wwOf(runner);
  const deu = byTag(runner.game, "DEU").smallID();
  const pol = byTag(runner.game, "POL").smallID();
  return { runner, ww, eg: ww.endgame, deu, pol };
}

describe("diplomacy L0: state, snapshot and hash", () => {
  test("empty state leaves the snapshot and the hash as they were", async () => {
    const { eg } = await started();
    const snap = eg.snapshot();
    for (const k of [
      "deals",
      "ultimatums",
      "promises",
      "collabs",
      "diploCooldowns",
    ]) {
      expect(k in snap).toBe(false);
    }
    const h = eg.hash();
    expireDiploTimers(eg, 0);
    expect(eg.hash()).toBe(h);
  }, 60_000);

  test("each list moves the hash, survives a restore and continues exactly", async () => {
    const { runner, ww, eg, deu, pol } = await started();
    const tick = runner.game.ticks();
    const far = ww.day(tick) + 3000;
    const hashes = new Set([eg.hash()]);
    const moved = () => {
      const h = eg.hash();
      expect(hashes.has(h)).toBe(false);
      hashes.add(h);
    };
    const deal = ORDERS[0] as Extract<WwOrder, { kind: "deal_offer" }>;
    eg.deals.push({
      id: eg.nextOfferId++,
      from: deu,
      to: pol,
      give: deal.give,
      take: deal.take,
      sentTick: tick,
      deadlineTick: tick + 99_999,
    });
    moved();
    eg.ultimatums.push({
      id: eg.nextOfferId++,
      from: deu,
      to: pol,
      regions: [3, 5],
      sentTick: tick,
      deadlineTick: tick + 99_999,
    });
    moved();
    eg.promises.push({
      id: 1,
      war: 1,
      from: deu,
      to: pol,
      target: 4,
      group: "pol_corridor",
      regions: [7, 8],
    });
    moved();
    eg.collabs.push({ smallID: 9, creator: deu, origin: pol, sinceDay: 3 });
    moved();
    setDiploCooldown(eg, pol, deu, "deal_refused", far);
    moved();
    setDiploCooldown(eg, deu, pol, "ultimatum", far);
    setDiploCooldown(eg, deu, pol, "deal_refused", far + 1);
    expect(eg.diploCooldowns.map(([a, b, , k]) => [a, b, k])).toEqual(
      [
        [deu, pol, 0],
        [deu, pol, 1],
        [pol, deu, 0],
      ].sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]),
    );
    expect(diploCooldownUntil(eg, deu, pol, "deal_refused")).toBe(far + 1);
    expect(diploCooldownUntil(eg, deu, pol, "ai_deal")).toBe(-1);
    // A changed item field moves the hash too.
    const h = eg.hash();
    (eg.deals[0].give[1] as { count: number }).count = 501;
    expect(eg.hash()).not.toBe(h);

    const b = await wwRestore(runner, [{ clientID: HUMAN, country: "DEU" }]);
    const egB = wwOf(b).endgame;
    for (const k of [
      "deals",
      "ultimatums",
      "promises",
      "collabs",
      "diploCooldowns",
    ] as const) {
      expect(egB[k]).toEqual(eg[k]);
    }
    expect(egB.hash()).toBe(eg.hash());
    expect(gameHash(b)).toBe(gameHash(runner));
    for (let i = 0; i < 40; i++) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
    // The screens get the lists when they change.
    eg.takeData();
    eg.dirtyDiplo = true;
    const d = eg.takeData();
    expect(d?.deals?.map((x) => x.id)).toEqual(eg.deals.map((x) => x.id));
    // L4: the stand-in ultimatum lapsed while stepping (its regions are
    // not its target's), in both games alike.
    expect(d?.ultimatums?.map((x) => x.id)).toEqual(
      eg.ultimatums.map((x) => x.id),
    );
    expect(d?.diploCooldowns).toEqual(eg.diploCooldowns);
    // Timers run out by day.
    expireDiploTimers(eg, far + 5);
    expect(eg.diploCooldowns).toEqual([]);
  }, 120_000);

  test("the orders reach WwEndgame.issue (refused until their lanes fill them)", async () => {
    const { runner, ww, deu, pol } = await started();
    const blocks = ORDERS.filter((o) => o.kind !== "peace_offer").map((o) =>
      ww.endgame.issue(deu, o, runner.game.ticks()),
    );
    for (const b of blocks) {
      expect(b).not.toBeNull();
      expect(WW_ORDER_BLOCKS).toContain(b);
    }
    // "Come home" with terms is refused before its lane looks at it.
    expect(
      ww.endgame.issue(
        deu,
        {
          kind: "peace_offer",
          war: 1,
          target: pol,
          home: true,
          terms: { give: [], take: [], pay: 0, demand: 0, free: [] },
        },
        runner.game.ticks(),
      ),
    ).toBe("peace_bad_terms");
    // Through the order path, the human's order changes nothing.
    step(runner, 1, [
      order(HUMAN, { kind: "ultimatum", target: pol, regions: [3] }),
    ]);
    expect(ww.endgame.ultimatums).toEqual([]);
  }, 60_000);
});

describe("diplomacy L0: the digests that never move", () => {
  // VanillaDigest and GW_DIGEST as they stood when the diplomacy began
  // (w10-usa 7a5666889): every diplomacy lane is behind the 1936 mode and
  // only appends, so these pins must stay. Their own files run the games.
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  test("the vanilla pins are unchanged", () => {
    const src = read("VanillaDigest.test.ts");
    for (const pin of [
      "c330352312204618",
      "cc52cbbfd8b1a3bc",
      "a7dac00d9005a3ad",
      "7ab01036826a4a06",
      "dddf7fe292970133",
      "091085284bca29e0",
      "f6772eec62ac81ee",
    ]) {
      expect(src).toContain(`"${pin}"`);
    }
  });

  test("the Great War pin is unchanged", () => {
    expect(read("ww1914/GreatWarSnapshot.test.ts")).toContain(
      'const GW_DIGEST = "3447823a17b9a7d5";',
    );
  });
});
