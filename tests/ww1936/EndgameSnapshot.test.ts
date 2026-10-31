// World War 1936 P5 (plan Task 19, spec §21.5, Review Focus 1): the
// endgame's snapshot oracle. Game A plays to a moment; B is restored from
// A's snapshot at that tick; both run the same ticks. WorldWar.hash() and
// the game hash must agree every tick, endgame.snapshot() and the whole
// World War state (P0–P4 with it) every few ticks, and the full game
// snapshot and the live object graphs at both ends. Then: every field the
// oracle leaves out (DERIVED_FIELDS) is rebuilt from state, or is a
// screen's buffer that never reaches the state.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type PeaceDemand,
  WW_EXILE_ZERO_DAYS,
  WW_LL_LAND_DAYS,
  WW_LL_SEA_KM_PER_DAY,
  WW_PEACE_ROUND_TICKS,
  WW_TAKEOVER_CARD_TICKS,
  WW_UPRISING_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { EventDef } from "@openfront/engine-lib/ww1936/content/types";
import { lendLeaseSeaDays } from "@openfront/engine-lib/ww1936/EndgameRules";
import type { Game, Player } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import { submitDemands } from "@openfront/engine/ww1936/endgame/Conference";
import {
  formExile,
  offerTakeover,
} from "@openfront/engine/ww1936/endgame/Exile";
import { addWarScore } from "@openfront/engine/ww1936/endgame/Wars";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DERIVED_FIELDS, diffGraphs, diffSnapshots } from "../util/Snapshot";
import {
  clientOf,
  CONVOY,
  fleetAtSea,
  seaGame,
  war as seaWar,
  setNavalBase,
  TAGS,
} from "./convoyUtil";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { valueDiffs } from "./lockstep";
import { politicsFixture } from "./politicsFixture";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  clearLand,
  clearStartSetup,
  END_MAP,
  gameHash,
  order,
  placeArmy,
  step,
  stepTo,
  takeRegion,
  type WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

/** The test content's civil war (the Soviet Union rules communist in 1936). */
const CW_EVENT: EventDef = {
  id: "test_civil_war_fascist",
  kind: "country",
  options: [
    {
      id: "a",
      ai: { base: 1 },
      effects: [{ kind: "civil_war", ideology: "fascist" }],
    },
  ],
};

beforeEach(() =>
  usePoliticsContent(
    endgameFixture({ events: [...endgameFixture().events, CW_EVENT] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const R = END.region;
const id = (t: CountryTag) => endId(t);
const wwOf = (r: GameRunner): WorldWar => r.game.worldWar()!;

/** The World War state (P0–P5) as plain data, through JSON. */
const wwState = (r: GameRunner) =>
  JSON.parse(JSON.stringify(wwOf(r).snapshot()));
const egState = (r: GameRunner) =>
  JSON.parse(JSON.stringify(wwOf(r).endgame.snapshot()));

/**
 * B from A's snapshot now; both run `ticks` more, the same turns (none).
 * WorldWar.hash() and the game hash every tick, the endgame and World War
 * state every `every` ticks, the snapshot and graphs at both ends. Returns B.
 */
async function oracle(
  a: GameRunner,
  humans: WwHuman[],
  map: string,
  ticks: number,
  every = 25,
): Promise<GameRunner> {
  const b = await wwRestore(a, humans, map);
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  expect(egState(b)).toEqual(egState(a));
  for (let i = 1; i <= ticks; i++) {
    step(a);
    step(b);
    if (wwOf(a).hash() !== wwOf(b).hash() || gameHash(a) !== gameHash(b)) {
      throw new Error(
        `hash diverged ${i} tick(s) after restore:\n` +
          valueDiffs(wwState(a), wwState(b)).join("\n"),
      );
    }
    if (i % every === 0 || i === ticks) {
      const d = valueDiffs(wwState(a), wwState(b));
      if (d.length > 0) {
        throw new Error(
          `state diverged ${i} tick(s) after restore:\n${d.join("\n")}`,
        );
      }
    }
  }
  expect(egState(b)).toEqual(egState(a));
  expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual([]);
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  return b;
}

async function started(humans: WwHuman[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = wwOf(runner);
  return { runner, g: runner.game, ww, eg: ww.endgame };
}

const player = (g: Game, tag: CountryTag): Player => {
  const p = g.playerBySmallID(id(tag));
  if (!p.isPlayer()) throw new Error(`no ${tag}`);
  return p;
};

/** Through the first tick of the `n`-th next day. */
function days(runner: GameRunner, n: number): void {
  const ww = wwOf(runner);
  stepTo(
    runner,
    dayStartTick(ww.day(runner.game.ticks()) + n, ww.prepEndTick()),
  );
}

describe("World War 1936 P5: the endgame snapshot oracle (Review Focus 1)", () => {
  it("restoring mid-conference continues exactly", async () => {
    const humans: WwHuman[] = [
      { clientID: "HDEU", country: "DEU" },
      { clientID: "HSUN", country: "SUN" },
    ];
    const { runner: a, g, ww, eg } = await started(humans);
    // Germany and the Soviet Union beat Poland; Poland capitulates.
    ww.setWar(id("DEU"), id("POL"), g.ticks(), { kind: "declare" });
    const w = eg.warOfPair(id("DEU"), id("POL"));
    ww.setWar(id("SUN"), id("POL"), g.ticks(), { kind: "into", warId: w });
    addWarScore(eg, w, id("DEU"), 3000);
    addWarScore(eg, w, id("SUN"), 2000);
    ww.land.setController(R.warsaw, id("DEU"), g.ticks());
    ww.land.setController(R.krakow, id("SUN"), g.ticks());
    capitulate(g, ww, player(g, "POL"), g.ticks());
    const c = eg.conferences[eg.conferences.length - 1];
    expect(c.parts.filter((p) => p.human)).toHaveLength(2);
    // Round 1: Germany takes Warsaw, the Soviet Union passes; the round
    // closes on the next tick with Krakow still at stake.
    const sub = (t: CountryTag, d: PeaceDemand[] | null) =>
      expect(submitDemands(eg, id(t), c.id, d, g.ticks())).toBeNull();
    sub("DEU", [{ kind: "take", region: R.warsaw }]);
    sub("SUN", null);
    for (let i = 0; i < 5 && c.round === 1; i++) step(a);
    expect(c.round).toBe(2);
    expect(c.status).toBe(1);
    // Round 2: Germany's submission is in; the Soviet card waits for its
    // deadline (then its AI demands).
    sub("DEU", null);
    step(a, Math.floor(WW_PEACE_ROUND_TICKS / 2));
    expect(c.round).toBe(2);
    expect(c.subs.map((x) => x.id)).toEqual([id("DEU")]);
    // Through the deadline, rounds 3 and 4 (AI defaults) and the treaty.
    const b = await oracle(a, humans, END_MAP, 3 * WW_PEACE_ROUND_TICKS);
    expect(c.status).toBe(2);
    expect(wwOf(b).endgame.peaceLog).toEqual(eg.peaceLog);
  }, 120_000);

  it("restoring after a civil war spawn continues exactly", async () => {
    const { runner: a, g, ww, eg } = await started();
    const [sun, cw] = [id("SUN"), id("CW1")];
    ww.politics.queueEvent(CW_EVENT.id, sun, sun, 0, 0);
    ww.politics.flushEvents(g.ticks());
    expect(eg.countryState(cw)).toBe("active");
    // The tick after the split: the rebels' executions are attached.
    step(a);
    const b = await oracle(a, [], END_MAP, 300);
    expect(wwOf(b).endgame.countryState(cw)).toBe(eg.countryState(cw));
  }, 120_000);

  it("restoring after a takeover continues exactly", async () => {
    const humans: WwHuman[] = [{ clientID: "HFRA", country: "FRA" }];
    const { runner: a, g, ww, eg } = await started(humans);
    const [deu, fra, gbr] = [id("DEU"), id("FRA"), id("GBR")];
    // Germany fights France alone: France has no host, the human gets a card.
    ww.setWar(deu, fra, g.ticks(), { kind: "declare" });
    ww.addCapitulation(fra, deu, g.ticks());
    offerTakeover(eg, "HFRA", fra, g.ticks());
    const deadline = eg.takeoverCards[0].deadlineTick;
    // Before the deadline: the copy runs through it.
    stepTo(a, deadline - Math.floor(WW_TAKEOVER_CARD_TICKS / 3));
    expect(eg.takeoverCards).toHaveLength(1);
    await oracle(
      a,
      humans,
      END_MAP,
      Math.floor(WW_TAKEOVER_CARD_TICKS / 3) + 60,
    );
    expect(eg.takeoverCards).toEqual([]);
    expect(eg.controlledBy("HFRA")).toBe(gbr);
    // After it: the human plays Britain in the copy too.
    const b = await oracle(a, humans, END_MAP, 150);
    expect(wwOf(b).endgame.controlledBy("HFRA")).toBe(gbr);
    expect(b.game.playerByClientID("HFRA")?.smallID()).toBe(gbr);
  }, 120_000);

  it("restoring with lend-lease in transit continues exactly (by land)", async () => {
    const humans: WwHuman[] = [
      { clientID: "HITA", country: "ITA" },
      { clientID: "HPOL", country: "POL" },
    ];
    const { runner: a, g, ww, eg } = await started(humans);
    const [ita, pl, sun] = [id("ITA"), id("POL"), id("SUN")];
    clearLand(g);
    for (const x of [ita, pl])
      clearStartSetup(ww.economy, ww.economy.country(x)!);
    const INF1 = equipKey("infantry_equipment", 1);
    ww.economy.country(ita)!.stock[INF1] = 10_000;
    ww.setWar(pl, sun, g.ticks(), { kind: "declare" });
    step(a, 2, [
      order("HITA", {
        kind: "lend_lease",
        to: pl,
        item: "infantry_equipment",
        gen: 1,
        perMonth: 300,
      }),
    ]);
    expect(eg.lendLease).toHaveLength(1);
    // A few shipments on the road, none arrived yet.
    days(a, 4);
    expect(eg.inTransit.length).toBeGreaterThan(1);
    expect(eg.inTransit.every((t) => !t.sea)).toBe(true);
    const b = await oracle(a, humans, END_MAP, (WW_LL_LAND_DAYS + 4) * 8);
    expect(eg.lendLease[0].arrivedMonth).toBeGreaterThan(0);
    expect(wwOf(b).endgame.lendLease).toEqual(eg.lendLease);
  }, 120_000);

  it("restoring with lend-lease in transit continues exactly (by sea)", async () => {
    usePoliticsContent(politicsFixture());
    const sg = await seaGame();
    const { ww, navy, runner: a } = sg;
    const game = a.game;
    const eg = ww.endgame;
    const [gbrId, turId] = [TAG_ID.GBR, TAG_ID.TUR];
    clearLand(game);
    clearStartSetup(ww.economy, sg.ce("GBR"));
    clearStartSetup(ww.economy, sg.ce("TUR"));
    seaWar(sg, "SUN", "TUR");
    // A naval base on the Isthmus to land at; out of London only.
    setNavalBase(ww, REGION.isthmus, 1);
    setNavalBase(ww, REGION.malta, 0);
    // Italian submarines raid the Western Approaches: losses on the way.
    seaWar(sg, "ITA", "GBR");
    sg.ce("ITA").fuelMilli = 1_000_000_000;
    fleetAtSea(
      navy,
      TAG_ID.ITA,
      REGION.rome,
      [["ss", 2, 30]],
      ZONE.west,
      "raid",
      SR.approaches,
    );
    sg.ce("GBR").stock[equipKey("infantry_equipment", 1)] = 10_000;
    sg.ce("GBR").stock[CONVOY] = 20;
    expect(
      eg.issue(
        gbrId,
        {
          kind: "lend_lease",
          to: turId,
          item: "infantry_equipment",
          gen: 1,
          perMonth: 3_000,
        },
        game.ticks(),
      ),
    ).toBeNull();
    for (let i = 0; i < 40 && !eg.inTransit.some((t) => t.sea); i++) {
      step(a, 8);
    }
    const t = eg.inTransit.find((x) => x.sea);
    expect(t).toBeDefined();
    const humans = TAGS.map((country) => ({
      clientID: clientOf(country),
      country,
    }));
    const sail = lendLeaseSeaDays(4000, WW_LL_SEA_KM_PER_DAY);
    const b = await oracle(a, humans, SEA.map, (sail + 4) * 8);
    expect(eg.inTransit.includes(t!)).toBe(false);
    expect(wwOf(b).endgame.inTransit).toEqual(eg.inTransit);
  }, 120_000);

  it("restoring with an exile continues exactly", async () => {
    const { runner: a, g, ww, eg } = await started();
    const [deu, pl, ltu] = [id("DEU"), id("POL"), id("LTU")];
    clearLand(g);
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    ww.setWar(deu, ltu, g.ticks(), {
      kind: "into",
      warId: eg.warOfPair(deu, pl),
    });
    takeRegion(g, R.warsaw, "DEU");
    takeRegion(g, R.krakow, "DEU");
    ww.addCapitulation(pl, deu, g.ticks());
    expect(formExile(eg, pl, deu, g.ticks())).toBe(true);
    // Legitimacy at nothing: the zero-day count runs; restore half-way.
    eg.exiles[eg.exileIdx.get(pl)!].legitBp = 0;
    days(a, Math.floor(WW_EXILE_ZERO_DAYS / 2));
    const ex = eg.exiles[eg.exileIdx.get(pl)!];
    expect(ex.zeroDays).toBeGreaterThan(0);
    expect(ex.zeroDays).toBeLessThan(WW_EXILE_ZERO_DAYS);
    const b = await oracle(a, [], END_MAP, (WW_EXILE_ZERO_DAYS / 2 + 3) * 8);
    // The count ran out the same way in both.
    expect(eg.isExile(pl)).toBe(false);
    expect(wwOf(b).endgame.countryState(pl)).toBe(eg.countryState(pl));
  }, 120_000);

  it("restoring in an occupation uprising countdown continues exactly", async () => {
    const humans: WwHuman[] = [
      { clientID: "HDEU", country: "DEU" },
      { clientID: "HCSK", country: "CSK" },
    ];
    const { runner: a, g, ww, eg } = await started(humans);
    const [deu, csk] = [id("DEU"), id("CSK")];
    clearLand(g);
    const ce = ww.economy.country(deu)!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
    // Czechoslovakia in exile in London fights on; Germany holds Slovakia
    // with one worn division that is no garrison.
    eg.exiles.push({
      smallID: csk,
      host: id("GBR"),
      legitBp: 5000,
      sinceDay: ww.day(g.ticks()),
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: END.capital.CSK!,
    });
    eg.rebuildDerived();
    ww.setWar(deu, csk, g.ticks(), { kind: "declare" });
    ww.land.setController(R.slovakia, deu, g.ticks());
    const army = placeArmy(g, "DEU", R.slovakia, 1);
    ww.land.setMen(ww.land.divisions.rowOf(army.divisions[0]), 100);
    days(a, 1);
    eg.resBp[R.slovakia] = 9000;
    days(a, Math.floor(WW_UPRISING_DAYS / 2));
    expect(eg.uprDays[R.slovakia]).toBeGreaterThan(0);
    expect(ww.land.controller[R.slovakia]).toBe(deu);
    const b = await oracle(a, humans, END_MAP, (WW_UPRISING_DAYS / 2 + 3) * 8);
    // The uprising came in both: Slovakia is Czechoslovakia's again.
    expect(ww.land.controller[R.slovakia]).toBe(csk);
    expect(wwOf(b).land.controller[R.slovakia]).toBe(csk);
  }, 120_000);

  it("the capitulation baseline survives a restore and moves the hash", async () => {
    const { runner: a, ww, eg } = await started();
    const h0 = eg.hash();
    eg.setCapitulationBase(id("POL"), 21);
    expect(eg.hash()).not.toBe(h0);
    const b = await oracle(a, [], END_MAP, 30);
    expect(wwOf(b).endgame.capitulationBase(id("POL"))).toBe(
      eg.capitulationBase(id("POL")),
    );
    void ww;
  }, 120_000);

  it("the endgame hash matches across two runs", async () => {
    // Two games of one seed, AI everywhere, the same hand at the same tick
    // (a war that ends in a capitulation, a conference, an occupation).
    const run = async (): Promise<number[]> => {
      const { runner, g, ww } = await started();
      const out: number[] = [];
      for (let i = 0; i < 1500; i++) {
        if (i === 10) {
          ww.setWar(id("DEU"), id("CSK"), g.ticks(), { kind: "declare" });
        }
        if (i === 20) {
          ww.politics.queueEvent(CW_EVENT.id, id("SUN"), id("SUN"), 0, 0);
        }
        step(runner);
        out.push(ww.endgame.hash(), ww.hash(), gameHash(runner));
      }
      return out;
    };
    const x = await run();
    const y = await run();
    const first = x.findIndex((v, i) => v !== y[i]);
    expect(first).toBe(-1);
  }, 180_000);
});

describe("World War 1936 P5: derived endgame fields (Task 19 Step 2)", () => {
  /** The endgame's derived indexes: rebuildDerived (and the first query) makes them from state. */
  const REBUILT = [
    "humanOf",
    "warsOfIdx",
    "subjectIdx",
    "exileIdx",
    "adminByController",
    "adminSet",
    "adminCtrlOf",
    "adminDirty",
  ] as const;
  /** Screens' buffers: emptied by takeData, never read by the rules. */
  const SCREEN = [
    "endgameNews",
    "dirtyCountries",
    "dirtyWars",
    "dirtyConf",
    "dirtyPeaceLog",
    "dirtyCores",
    "dirtyOcc",
    "dirtySubjects",
    "dirtyExiles",
    "dirtyZones",
    "dirtyAid",
    "dirtyControllers",
    "dirtyTakeover",
    "firstData",
    // Negotiated peace: the judge rows' day and the rows last sent.
    "judgeDay",
    "judgeSent",
    // Peace on the current line: its rows' day and the rows last sent.
    "lineDay",
    "lineSent",
  ] as const;

  /** A game with some of every index: wars, an exile, subjects, a moved controller, administered regions. */
  async function rich() {
    const humans: WwHuman[] = [{ clientID: "HAUT", country: "POL" }];
    const s = await started(humans);
    const { g, ww, eg } = s;
    const [deu, pl, ltu, csk] = [id("DEU"), id("POL"), id("LTU"), id("CSK")];
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    ww.setWar(deu, ltu, g.ticks(), {
      kind: "into",
      warId: eg.warOfPair(deu, pl),
    });
    ww.setWar(deu, csk, g.ticks(), { kind: "declare" });
    for (const r of [R.warsaw, R.krakow, R.slovakia, R.prague]) {
      ww.land.setController(r, deu, g.ticks());
    }
    ww.addCapitulation(pl, deu, g.ticks());
    expect(formExile(eg, pl, deu, g.ticks())).toBe(true);
    eg.setControl("HAUT", id("AUT"));
    step(s.runner, 20);
    expect(eg.administeredOf(deu).length).toBeGreaterThan(0);
    expect(eg.exiles.length).toBeGreaterThan(0);
    expect(eg.warsOfIdx.size).toBeGreaterThan(0);
    return s;
  }

  it("every derived endgame field is rebuilt from state", async () => {
    const { runner, ww, eg } = await rich();
    const rec = eg as unknown as Record<string, unknown>;
    // Every endgame field the oracle leaves out is classified here.
    const derivedHere = Object.keys(eg).filter((k) => DERIVED_FIELDS.has(k));
    expect([...derivedHere].sort()).toEqual([...REBUILT, ...SCREEN].sort());
    const landRec = ww.land as unknown as Record<string, unknown>;
    expect(DERIVED_FIELDS.has("volunteerArmyCount")).toBe(true);
    // The indexes as the game built them.
    eg.isAdministered(1);
    const clone = (v: unknown): unknown =>
      v instanceof Map
        ? new Map([...v].map(([k, x]) => [k, clone(x)]))
        : v instanceof Set
          ? new Set(v)
          : ArrayBuffer.isView(v)
            ? (v as Int32Array).slice()
            : Array.isArray(v)
              ? v.map(clone)
              : v;
    const before = Object.fromEntries(REBUILT.map((k) => [k, clone(rec[k])]));
    const volunteers = landRec.volunteerArmyCount;
    for (const k of REBUILT) {
      // Broken on purpose: emptied, filled with junk, or flipped.
      const v = rec[k];
      if (v instanceof Map) {
        v.clear();
        v.set(999, [999] as never);
      } else if (v instanceof Set) {
        v.clear();
        v.add(999);
      } else if (v instanceof Int32Array) v.fill(7);
      else if (typeof v === "boolean") rec[k] = false;
    }
    landRec.volunteerArmyCount = 42;
    eg.rebuildDerived();
    ww.land.rebuildDerived();
    eg.isAdministered(1); // the administered list is built on first use
    for (const k of REBUILT) expect([k, rec[k]]).toEqual([k, before[k]]);
    expect(landRec.volunteerArmyCount).toBe(volunteers);
    // And the game goes on as a restored copy does.
    const b = await wwRestore(
      runner,
      [{ clientID: "HAUT", country: "POL" }],
      END_MAP,
    );
    for (let i = 0; i < 40; i++) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
  }, 120_000);

  it("the screens' buffers never reach the state", async () => {
    const humans: WwHuman[] = [{ clientID: "HAUT", country: "POL" }];
    const { runner: a, eg } = await rich();
    const b = await wwRestore(a, humans, END_MAP);
    const egB = wwOf(b).endgame;
    // Junk in every buffer of B (A keeps its own).
    const rec = egB as unknown as Record<string, unknown>;
    for (const k of SCREEN) {
      const v = rec[k];
      if (v instanceof Set) v.add(1).add(2).add(3);
      else if (Array.isArray(v)) v.push({ id: "junk", params: {} });
      else if (typeof v === "boolean") rec[k] = !v;
    }
    for (let i = 0; i < 40; i++) {
      step(a);
      step(b);
      expect(wwOf(b).hash()).toBe(wwOf(a).hash());
      expect(gameHash(b)).toBe(gameHash(a));
    }
    expect(egState(b)).toEqual(egState(a));
    expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual(
      [],
    );
    // takeData empties them every tick (the runner sends the updates).
    expect(egB.endgameNews).toEqual([]);
    expect(egB.dirtyCountries.size).toBe(0);
    expect(eg.dirtyCountries.size).toBe(0);
  }, 120_000);
});
