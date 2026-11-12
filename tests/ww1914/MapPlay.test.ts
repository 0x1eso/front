import { GW_ACT_KINDS } from "@openfront/engine-api/ww1914/GwActs";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import {
  actSpotsAt,
  GW_ACT_SPOTS,
} from "@openfront/engine-lib/ww1914/ActSpots";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  frontPlace,
  GW_BIG_SCENE_PLACES,
  GW_CAPITALS,
  sceneNear,
} from "@openfront/engine-lib/ww1914/PlaceRules";
import { describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat, view } from "./util";

const scene = (id: string) => gwContent().scenes.find((s) => s.id === id)!;

describe("places of papers", () => {
  test("every hand-placed scene is a scene", () => {
    for (const id of Object.keys(GW_BIG_SCENE_PLACES)) {
      expect(scene(id), id).toBeDefined();
    }
  });

  test("a capital is a place of its country or its land", () => {
    for (const [tag, place] of Object.entries(GW_CAPITALS)) {
      expect(GW_PLACES[place].id, tag).toBeGreaterThan(0);
    }
  });

  test("a front stands where its line is", () => {
    expect(frontPlace("west", 3)).toBe("ypres");
    expect(frontPlace("sea", 1)).toBe("heligoland");
  });

  test("a scene on a theatre falls to that front, the rest to their office", () => {
    const seat = { tag: "DEU", main: "west", lineOf: () => 3 } as const;
    const onFront = gwContent().scenes.find(
      (s) =>
        s.place === undefined &&
        s.when !== undefined &&
        JSON.stringify(s.when).includes('"theatre":"west"'),
    )!;
    expect(sceneNear(onFront, seat)).toBe("ypres");
    const quiet = { ...scene("gw_quiet_week"), cast: {} };
    expect(sceneNear(quiet, seat)).toBe("berlin");
    expect(sceneNear({ ...quiet, cast: { n: { office: "navy" } } }, seat)).toBe(
      "heligoland",
    );
  });
});

describe("the schedule on the map", () => {
  const acts = gwContent().acts ?? [];

  test("every spot is an entry, and its pick is a choice of it", () => {
    for (const s of GW_ACT_SPOTS) {
      const act = acts.find((a) => a.id === s.act);
      expect(act, s.act).toBeDefined();
      for (const [field, option] of Object.entries(s.pick ?? {})) {
        const f = act!.fields?.find((x) => x.id === field);
        const ids = f?.options?.map((o) => o.id);
        expect(ids, `${s.act}.${field}`).toContain(option);
      }
    }
  });

  test("every visit is somewhere", () => {
    const spots = new Set(GW_ACT_SPOTS.map((s) => s.act));
    expect(GW_ACT_KINDS).toContain("visit");
    const lost = acts.filter((a) => a.kind === "visit" && !spots.has(a.id));
    expect(lost.map((a) => a.id)).toEqual([]);
  });

  test("a place offers its own entries, its country's and its front's", () => {
    const here = actSpotsAt("verdun", "RUS", "west").map((s) => s.act);
    expect(here).toContain("deu_a_west");
    expect(here).toContain("deu_a_nicky");
    expect(here).not.toContain("deu_a_krupp");
  });
});

describe("a general sent to a front", () => {
  async function atWar() {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    gw.nation("DEU")!.side = "central";
    gw.nation("RUS")!.side = "entente";
    // Since ww171 a front's members are those at war (Wars.membersOf).
    gw.nation("DEU")!.atWar = ["RUS"];
    gw.nation("RUS")!.atWar = ["DEU"];
    const t = gw.s.theatres.find((x) => x.id === "east")!;
    t.open = true;
    t.since = gw.s.chapter;
    t.commander = null;
    gw.touch();
    return { runner, gw, t };
  }

  test("he takes the front and a slot goes", async () => {
    const { runner, gw, t } = await atWar();
    const before = seat(runner).actsLeft!;
    const person = seat(runner).world.generals![0];
    expect(person).toBeDefined();
    order(runner, { kind: "post", person, theatre: "east" });
    expect(t.commander).toBe(person);
    expect(seat(runner).actsLeft).toBe(before - 1);
    expect(gw.s.seats[0].log.map((l) => l.key)).toContain("post_sent");
  });

  test("the one he replaces takes it badly", async () => {
    const { runner, gw, t } = await atWar();
    gw.person("deu_mackensen")!.status = "active";
    gw.touch();
    const [first, second] = seat(runner).world.generals!;
    t.commander = first;
    const trust = gw.person(first)!.trust;
    order(runner, { kind: "post", person: second, theatre: "east" });
    expect(t.commander).toBe(second);
    expect(gw.person(first)!.trust).toBe(trust - 1);
  });

  test("a general the story hasn't named goes unnamed when replaced", async () => {
    const { runner, gw, t } = await atWar();
    const person = seat(runner).world.generals![0];
    t.commander = "deu_ludendorff";
    const trust = gw.person("deu_ludendorff")!.trust;
    order(runner, { kind: "post", person, theatre: "east" });
    expect(t.commander).toBe(person);
    expect(gw.person("deu_ludendorff")!.trust).toBe(trust);
    expect(gw.s.seats[0].log.map((l) => l.key)).not.toContain("post_relieved");
  });

  test("no front, no general, no slot: nothing moves", async () => {
    const { runner, gw, t } = await atWar();
    const person = seat(runner).world.generals![0];
    order(runner, { kind: "post", person, theatre: "palestine" });
    order(runner, { kind: "post", person: "deu_kaiser", theatre: "east" });
    expect(t.commander).toBeNull();
    // ww193: one time pool: the summons' share pays for a slot too.
    gw.s.seats[0].acts = 0;
    gw.s.seats[0].audiences = 0;
    order(runner, { kind: "post", person, theatre: "east" });
    expect(t.commander).toBeNull();
  });
});

describe("the mobilisation's date", () => {
  test("is kept in the game, for a resumed game's trains to count from", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const rus = gw.nation("RUS")!;
    const first = view(runner).date;
    rus.mob = 1;
    playChapter(runner);
    const row = () =>
      seat(runner).world.countries.find((c) => c.tag === "RUS")!;
    expect(row().mobFrom).toBe(first);
    const second = view(runner).date;
    rus.mob = 2;
    playChapter(runner);
    expect(row().mobFrom).toBe(first);
    expect(row().mobFull).toBe(second);
  });
});
