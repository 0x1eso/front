// ww173 C1-C2 (design ww173 §6): the secret war on fixed states. The
// offensives and the strain belong to other modules (S7b, S7a): here they are
// stood in for, with the shapes the interfaces fix.
import { GW_THEATRES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { learn } from "@openfront/engine/ww1914/Intel";
import {
  ladderAnswer,
  ladderStep,
  meansToStand,
} from "@openfront/engine/ww1914/Ladder";
import type { GwOffensiveView } from "@openfront/engine/ww1914/Offensives";
import {
  agentsTaken,
  believedStrain,
  decryptFor,
  expose,
  intelOf,
  planEdge,
  planOf,
  promiseCost,
  spiesStep,
  spyEffect,
  spyHolds,
} from "@openfront/engine/ww1914/Spies";
import { declareWar, openWar } from "@openfront/engine/ww1914/Wars";
import { worldView } from "@openfront/engine/ww1914/WorldView";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { gwRunner } from "./util";

const fake = vi.hoisted(() => ({
  offensives: [] as unknown[],
  strain: (_t: string, _tag: string): number => 0,
  seen: [] as unknown[][],
}));
vi.mock("@openfront/engine/ww1914/Offensives", async (orig) => ({
  ...(await orig<object>()),
  offensivesOf: () => fake.offensives,
  loudnessOf: () => 50,
  seenBy: () => [],
  markSeen: (...a: unknown[]) => void fake.seen.push(a),
}));
vi.mock("@openfront/engine/ww1914/Strain", async (orig) => ({
  ...(await orig<object>()),
  strainOf: (_g: unknown, t: string, tag: string) => fake.strain(t, tag),
}));

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];

/** The general war with Germany facing Russia in the east. */
function war(): void {
  openWar(gw);
  declareWar(gw, "DEU", "RUS", "test");
  declareWar(gw, "DEU", "FRA", "test");
  declareWar(gw, "DEU", "GBR", "test");
  expect(gw.nation("DEU")!.atWar).toContain("RUS");
}

const russianPrep: GwOffensiveView = {
  tag: "RUS",
  theatre: "east",
  from: 0,
  launch: null,
  method: "long",
  feint: false,
  quiet: false,
  round: 0,
};

beforeEach(async () => {
  fake.offensives = [];
  fake.strain = () => 0;
  fake.seen = [];
  ({ runner } = await gwRunner({}, "GWSPY1"));
  gw = runner.game.greatWar()!;
});

describe("the services", () => {
  test("start values and the heads of the services", () => {
    expect(intelOf(gw, "RUS")).toMatchObject({ crypt: 1, secure: 0 });
    expect(intelOf(gw, "FRA")).toMatchObject({ crypt: 2, secure: 1 });
    expect(intelOf(gw, "GBR")).toMatchObject({ crypt: 1, counter: 2 });
    const holder = (tag: string) =>
      gw.s.people.find(
        (p) => p.office === "intelligence" && p.id.startsWith(tag),
      )?.id;
    expect(holder("deu")).toBe("deu_nicolai");
    expect(holder("auh")).toBe("auh_urbanski");
    expect(holder("fra")).toBe("fra_dupont");
  });

  test("reading codes gives confirmed reports, spots preparation, and acting on it raises suspicion", () => {
    war();
    fake.offensives = [russianPrep];
    fake.strain = (t, tag) => (t === "east" && tag === "RUS" ? 70 : 0);
    const deu = intelOf(gw, "DEU");
    deu.crypt = 3;
    deu.reads = ["RUS"];
    spiesStep(gw);
    const mine = gw.s.reports.filter(
      (r) => r.smallID === st().smallID && r.source === "codes",
    );
    expect(mine).toContainEqual(
      expect.objectContaining({
        fact: "strain",
        tag: "RUS",
        theatre: "east",
        stamp: "confirmed",
        claim: 3,
      }),
    );
    expect(mine.some((r) => r.fact === "prep" && r.claim === 1)).toBe(true);
    expect(fake.seen).toContainEqual([gw, russianPrep, "DEU", true]);
    expect(believedStrain(gw, "DEU", "east", "RUS")).toBe(75);
    // The next chapter Germany's main effort goes east: Russia grows wary.
    gw.s.chapter += 1;
    st().alloc.main = "east";
    const rus = intelOf(gw, "RUS");
    spiesStep(gw);
    expect(rus.suspect.DEU ?? 0).toBeGreaterThanOrEqual(1);
    // Wary enough, it changes its codes and the reading stops.
    rus.suspect = { DEU: 7 };
    gw.s.chapter += 1;
    spiesStep(gw);
    expect(rus.secure).toBe(1);
    expect(gw.s.news.some((n) => n.key === "spy_codes_changed")).toBe(true);
  });

  test("the seat's view carries its reports, never the truth or another's service", () => {
    war();
    fake.strain = () => 10;
    learn(gw, "DEU", "strain", "RUS", "east", "agents", "lie");
    intelOf(gw, "RUS").crypt = 3;
    intelOf(gw, "RUS").net = { DEU: 2 };
    const v = worldView(gw, st());
    const east = v.fronts.find((f) => f.id === "east");
    expect(east?.foe).toMatchObject({ tag: "RUS", stamp: "unconfirmed" });
    expect(east!.foe!.word).not.toBe(0);
    const text = JSON.stringify(v);
    expect(text).not.toContain('"truth"');
    expect(text).not.toContain('"intel"');
    expect(text).not.toContain('"crypt"');
    expect(text).not.toContain('"net"');
    expect(v.reports.slice(-1)[0]?.corrected).toBeNull();
  });
});

describe("abroad", () => {
  test("exposure: the net is lost, trust falls, and a neutral turns", () => {
    war();
    const usa = gw.nation("USA")!;
    expect(usa.side).toBeNull();
    usa.lean = 0;
    usa.readiness = 20;
    intelOf(gw, "DEU").net = { USA: 2 };
    expect(spyHolds(gw, st(), "exposed")).toBe(false);
    expose(gw, "USA", "DEU");
    // The sender's seat can tell its men were named, whoever caught them.
    expect(spyHolds(gw, st(), "exposed")).toBe(true);
    expect(spyHolds(gw, st(), "exposed", "USA")).toBe(true);
    expect(spyHolds(gw, st(), "exposed", "GBR")).toBe(false);
    expect(intelOf(gw, "DEU").net.USA).toBeUndefined();
    expect(usa.trust.DEU).toBe(-1);
    expect(usa.lean).toBe(1);
    expect(usa.readiness).toBe(30);
    expect(gw.s.news.slice(-1)[0]).toMatchObject({
      key: "spy_exposed",
      a: "USA",
      b: "DEU",
    });
  });

  test("a double agent at counter 3 makes his sender's reports lie", () => {
    war();
    intelOf(gw, "DEU").counter = 3;
    intelOf(gw, "RUS").net = { DEU: 1 };
    agentsTaken(gw, "DEU", "RUS");
    expect(st().scheduled.slice(-1)[0]?.scene).toBe("gw_spy_caught");
    expect(spyHolds(gw, st(), "from", "RUS")).toBe(true);
    spyEffect(gw, st(), "double");
    expect(intelOf(gw, "DEU").turned).toEqual(["RUS"]);
    // Russia, nobody's seat, hears a lie about Germany's strain.
    intelOf(gw, "RUS").heard = [];
    spiesStep(gw);
    const heard = intelOf(gw, "RUS").heard.filter((h) => h.tag === "DEU");
    expect(heard.length).toBeGreaterThan(0);
    expect(heard.every((h) => h.claim !== 0)).toBe(true);
  });

  test("the Baltic codebook marks the seat that lost it", () => {
    expect(spyHolds(gw, st(), "codebook")).toBe(false);
    intelOf(gw, "DEU").marks.push("magdeburg");
    expect(spyHolds(gw, st(), "codebook")).toBe(true);
  });

  test("Britain's promise to Hussein weighs on France's Syria and Palestine at the table", () => {
    expect(promiseCost(gw, "FRA", "damascus")).toBe(0);
    intelOf(gw, "GBR").marks.push("hussein");
    expect(promiseCost(gw, "FRA", "damascus")).toBeGreaterThan(0);
    expect(promiseCost(gw, "FRA", "jerusalem")).toBeGreaterThan(0);
    expect(promiseCost(gw, "GBR", "damascus")).toBe(0);
    expect(promiseCost(gw, "FRA", "beirut")).toBeGreaterThan(0);
  });

  test("subversion waits for the state and comes once a year", () => {
    war();
    expect(spyHolds(gw, st(), "lenin")).toBe(false);
    const rus = gw.nation("RUS")!;
    rus.unrest = 3;
    expect(spyHolds(gw, st(), "lenin")).toBe(true);
    const low = rus.lowOrder;
    expect(spyHolds(gw, st(), "sealed")).toBe(false);
    spyEffect(gw, st(), "lenin");
    expect(spyHolds(gw, st(), "sealed")).toBe(true);
    expect(rus.lowOrder).toBe(low + 2);
    expect(intelOf(gw, "DEU").later).toContainEqual(
      expect.objectContaining({ what: "lenin_home" }),
    );
    expect(spyHolds(gw, st(), "lenin")).toBe(false);
    // Another the same year is closed.
    expect(spyHolds(gw, st(), "ireland")).toBe(false);
    gw.s.day += 366;
    expect(spyHolds(gw, st(), "ireland")).toBe(true);
  });
});

describe("in peace (ww178)", () => {
  /** No war yet: the services work on their rivals. */
  function peace(): void {
    gw.s.chapter += 1;
    expect(gw.s.warChapter).toBeNull();
    expect(gw.nation("DEU")!.atWar).toEqual([]);
  }
  const mine = (fact: string) =>
    gw.s.reports.filter((r) => r.smallID === st().smallID && r.fact === fact);

  test("a net in a rival reports its war plan, and the plan read pays in the war's first month", () => {
    peace();
    intelOf(gw, "DEU").net = { FRA: 2 };
    for (let i = 0; i < 4 && mine("plan").length === 0; i++) {
      gw.s.chapter += 1;
      spiesStep(gw);
    }
    const r = mine("plan")[0];
    expect(r).toMatchObject({ tag: "FRA", source: "agents", theatre: null });
    expect(r.truth).toBe(GW_THEATRES.indexOf(planOf(gw, "FRA")!));
    // France's service read Germany's plan in peace; the war comes west.
    intelOf(gw, "FRA").heard.push({
      fact: "plan",
      tag: "DEU",
      theatre: null,
      claim: GW_THEATRES.indexOf("west"),
      chapter: gw.s.chapter,
    });
    war();
    expect(planOf(gw, "DEU")).toBe("west");
    expect(planEdge(gw, "west", "entente")).toBeGreaterThan(0);
    expect(planEdge(gw, "west", "central")).toBeLessThan(0);
  });

  test("a read code tells the seat a note is a bluff; calling it raises suspicion", () => {
    peace();
    intelOf(gw, "DEU").crypt = 3;
    expect(intelOf(gw, "RUS").secure).toBe(0);
    // Find a note Russia would not press: a bluff, read as one.
    let found = false;
    for (let k = 0; k < 40 && !found; k++) {
      gw.s.ladders = [
        {
          from: "RUS",
          to: "DEU",
          step: "sent",
          opened: gw.s.chapter,
          chapter: gw.s.chapter,
        },
      ];
      spiesStep(gw);
      const r = mine("resolve").slice(-1)[0];
      expect(r).toMatchObject({ tag: "RUS", source: "codes" });
      expect(r.truth).toBe(meansToStand(gw, gw.s.ladders[0], "RUS"));
      if (r.stamp !== "unconfirmed") expect(r.claim).toBe(r.truth);
      found = r.truth === 0 && r.claim === 0 && r.chapter === gw.s.chapter;
      if (!found) gw.s.chapter += 1;
    }
    expect(found).toBe(true);
    // The note's card says it, with the stamp.
    expect(decryptFor(gw, st())).toMatchObject({ tag: "RUS", word: 0 });
    ladderAnswer(gw, st(), false);
    expect(intelOf(gw, "RUS").suspect.DEU).toBe(1);
    gw.s.chapter += 1;
    ladderStep(gw);
    expect(gw.s.ladders[0].step).toBe("backed_down");
  });

  test("a ring is caught in peace, and rolled up on mobilisation day", () => {
    peace();
    intelOf(gw, "DEU").counter = 2;
    intelOf(gw, "FRA").net = { DEU: 1 };
    const temp = gw.s.temp;
    for (let i = 0; i < 400 && intelOf(gw, "FRA").net.DEU !== undefined; i++) {
      gw.s.chapter += 1;
      spiesStep(gw);
    }
    expect(intelOf(gw, "FRA").net.DEU).toBeUndefined();
    expect(gw.s.news).toContainEqual(
      expect.objectContaining({ key: "spy_exposed", a: "DEU", b: "FRA" }),
    );
    expect(gw.s.temp).toBeGreaterThan(temp);
    expect(gw.nation("DEU")!.trust.FRA).toBeLessThan(0);
    // Kell's MI5: Britain mobilises and takes every German ring at once.
    expect(intelOf(gw, "GBR").counter).toBe(2);
    intelOf(gw, "DEU").net = { GBR: 2 };
    gw.nation("GBR")!.mob = 2;
    spiesStep(gw);
    expect(intelOf(gw, "DEU").net.GBR).toBeUndefined();
    expect(gw.s.news.slice(-1)[0]).toMatchObject({
      key: "spy_rolled_up",
      a: "GBR",
    });
  });

  test("what peace's services hold never reaches the seat's view", () => {
    peace();
    intelOf(gw, "DEU").crypt = 3;
    intelOf(gw, "DEU").net = { RUS: 2, FRA: 1 };
    intelOf(gw, "RUS").net = { DEU: 2 };
    intelOf(gw, "FRA").heard.push({
      fact: "plan",
      tag: "DEU",
      theatre: null,
      claim: 0,
      chapter: gw.s.chapter,
    });
    for (let i = 0; i < 3; i++) {
      gw.s.chapter += 1;
      spiesStep(gw);
    }
    const v = worldView(gw, st());
    expect(v.reports.length).toBeGreaterThan(0);
    const text = JSON.stringify(v);
    for (const hidden of [
      '"truth"',
      '"intel"',
      '"crypt"',
      '"heard"',
      '"suspect"',
      '"net"',
    ]) {
      expect(text).not.toContain(hidden);
    }
  });
});
