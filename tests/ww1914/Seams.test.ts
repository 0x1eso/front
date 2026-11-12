import {
  GW_SECRETS,
  GW_WORLD_FLAGS,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwPack, gwPackOverlaps } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { flag } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { crisisStep } from "@openfront/engine/ww1914/Crises";
import { dealDesk } from "@openfront/engine/ww1914/Desk";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { openLetter } from "@openfront/engine/ww1914/People";
import { worldFlagsStep } from "@openfront/engine/ww1914/WorldFlags";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FOUNDATION_CONTENT } from "./foundationFixture";
import { gwRunner, playChapter, view } from "./util";

const lang = (f: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/lang", `${f}.json`),
      "utf8",
    ),
  );

afterEach(() => {
  useGwContent(null);
  vi.restoreAllMocks();
});

async function start(gameID = "GWSEAM"): Promise<GreatWar> {
  const { runner } = await gwRunner({}, gameID);
  return runner.game.greatWar()!;
}

const flags = (gw: GreatWar) => gw.s.seats[0].flags;

function battle(
  gw: GreatWar,
  theatre: "east" | "west",
  by: "central" | "entente",
  result: "advance" | "repelled" | "stalemate",
): void {
  gw.s.battles.push({
    theatre,
    chapter: gw.s.chapter,
    result,
    by,
    lost: [0, 0],
    line: 1,
    luck: 0,
  });
}

describe("the world's flags (scene plan §1)", () => {
  test("the chain raises the ultimatum, then Austria's war", async () => {
    const gw = await start();
    gw.s.chain = { topic: "balkan", step: 2, hold: 0, short: false };
    worldFlagsStep(gw);
    expect(flags(gw)).not.toContain("w_ultimatum_out");
    gw.s.chain.step = 3;
    worldFlagsStep(gw);
    expect(flags(gw)).toContain("w_ultimatum_out");
    gw.s.chain.step = 4;
    gw.s.temp = 4;
    worldFlagsStep(gw);
    expect(flags(gw)).not.toContain("w_aut_at_war");
    gw.s.temp = 5;
    worldFlagsStep(gw);
    expect(flags(gw)).toContain("w_aut_at_war");
  });

  test("Russia's mobilisation is the flag, and differs by the game", async () => {
    const gw = await start();
    gw.nation("RUS")!.mob = 1;
    worldFlagsStep(gw);
    expect(flags(gw)).toContain("w_rus_partial");
    expect(flags(gw)).not.toContain("w_rus_general");
    gw.nation("RUS")!.mob = 2;
    worldFlagsStep(gw);
    expect(flags(gw)).toContain("w_rus_general");

    const reachedBy = async (id: string) => {
      const g = await start(id);
      g.s.temp = 7;
      for (let i = 0; i < 12 && g.s.warChapter === null; i++) {
        if (g.nation("RUS")!.mob > 0) return g.s.chapter;
        g.s.temp = 7;
        crisisStep(g);
        g.s.chapter++;
      }
      return g.s.chapter;
    };
    const ids = [
      "GWR1",
      "GWR2",
      "GWR3",
      "GWR4",
      "GWR5",
      "GWR6",
      "GWR7",
      "GWR8",
    ];
    const when = await Promise.all(ids.map(reachedBy));
    expect(new Set(when).size).toBeGreaterThan(1);
  });

  test("the first battles raise Tannenberg, the east broken, the Marne", async () => {
    const gw = await start();
    gw.s.warChapter = gw.s.chapter;
    gw.s.plan = "west";
    battle(gw, "east", "entente", "repelled");
    battle(gw, "west", "central", "advance");
    worldFlagsStep(gw);
    expect(flags(gw)).toContain("w_tannenberg");
    expect(flags(gw)).not.toContain("w_marne_stopped");
    battle(gw, "west", "central", "stalemate");
    battle(gw, "east", "entente", "advance");
    worldFlagsStep(gw);
    expect(flags(gw)).toContain("w_marne_stopped");
    expect(flags(gw)).toContain("w_bad_luck_east");
  });

  test("past the opening of the war a battle raises nothing", async () => {
    const gw = await start();
    gw.s.warChapter = gw.s.chapter - 3;
    gw.s.plan = "west";
    battle(gw, "east", "central", "advance");
    battle(gw, "west", "central", "stalemate");
    worldFlagsStep(gw);
    expect(flags(gw)).not.toContain("w_tannenberg");
    expect(flags(gw)).not.toContain("w_marne_stopped");
  });

  test("an east-first war has no Marne to stop", async () => {
    const gw = await start();
    gw.s.warChapter = gw.s.chapter;
    gw.s.plan = "east";
    battle(gw, "west", "entente", "advance");
    worldFlagsStep(gw);
    expect(flags(gw)).not.toContain("w_marne_stopped");
  });

  test("the content check knows them, and a scene can wait on one", () => {
    const s: GwScene = {
      ...FOUNDATION_CONTENT.scenes.find((x) => x.id === "fx_envoy")!,
      when: flag("w_tannenberg"),
    };
    const problems = (outside: readonly string[]) =>
      gwContentProblems([s], GW_CONTENT.people, outside).filter((p) =>
        p.includes("w_tannenberg"),
      );
    expect(problems([])).toHaveLength(1);
    expect(problems(GW_WORLD_FLAGS)).toEqual([]);
  });
});

describe("the four secrets of the plan", () => {
  // Plan §1 lets W's name win: rus_rail_early, ott_ships_late, rou_will_not_march.
  const FOUR = [
    "rus_rail_ahead",
    "ita_fra_understanding",
    "ott_fleet_late",
    "rou_treaty_dead",
  ] as const;

  test("are in the game's list with text in both languages", () => {
    for (const id of FOUR) {
      expect(GW_SECRETS).toContain(id);
      expect(lang("ko").gw.secret[id]).toBeTruthy();
      expect(lang("en").gw.secret[id]).toBeTruthy();
    }
  });

  test("each comes up in some games and not in others", async () => {
    const ids = Array.from({ length: 16 }, (_, i) => `GWS${i}`);
    const games = await Promise.all(ids.map((id) => start(id)));
    for (const id of FOUR) {
      const n = games.filter((g) => g.s.secrets.includes(id)).length;
      expect(n, id).toBeGreaterThan(0);
      expect(n, id).toBeLessThan(games.length);
    }
  });

  test("a scene that names a secret by another name is caught", () => {
    const base = FOUNDATION_CONTENT.scenes.find((x) => x.id === "fx_envoy")!;
    const s: GwScene = {
      ...base,
      when: { kind: "secret", id: "rus_rail_early" },
    };
    expect(gwContentProblems([s], GW_CONTENT.people)).toContain(
      "fx_envoy: secret rus_rail_early is not in GW_SECRETS",
    );
  });
});

describe("scenes name lines", () => {
  const base = FOUNDATION_CONTENT.scenes.find((x) => x.id === "fx_envoy")!;

  test("a number is refused, a name is checked", () => {
    const by = (when: GwScene["when"]) =>
      gwContentProblems([{ ...base, when }], GW_CONTENT.people).filter((p) =>
        p.includes("line"),
      );
    expect(by({ kind: "line", theatre: "west", min: 1 })).toEqual([
      "fx_envoy: name the line with world `front`, not a number",
    ]);
    expect(
      by(
        world({ is: "front", theatre: "west", from: "ardennes", to: "paris" }),
      ),
    ).toEqual(["fx_envoy: west has no line ardennes"]);
    expect(
      by(world({ is: "front", theatre: "west", from: "marne", to: "paris" })),
    ).toEqual([]);
  });
});

describe("the plan is what was signed", () => {
  test("a flag signs the plan and mobilises", async () => {
    const gw = await start();
    flags(gw).push("f_east_first");
    crisisStep(gw);
    expect(gw.s.plan).toBe("east");
    expect(gw.nation("DEU")!.mob).toBe(2);
  });

  test("the east first leaves Belgium out of it", async () => {
    const gw = await start();
    flags(gw).push("f_east_first");
    gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
    gw.s.temp = 9;
    crisisStep(gw);
    expect(gw.s.warChapter).not.toBeNull();
    expect(gw.nation("FRA")!.side).toBe("entente");
    expect(gw.nation("BEL")?.side ?? null).toBeNull();
  });
});

describe("mobilisation put off twice", () => {
  const wait = (gw: GreatWar, chapter: number) =>
    gw.s.seats[0].choices.push({
      scene: "deu_c_mobilise",
      pick: "wait_day",
      chapter,
      proxy: false,
    });
  const keys = (gw: GreatWar) => gw.s.seats[0].log.map((l) => l.key);

  test("once is only a day", async () => {
    const gw = await start();
    gw.s.chain = { topic: "balkan", step: 4, hold: 0, short: false };
    gw.s.temp = 7;
    wait(gw, 4);
    crisisStep(gw);
    expect(gw.s.warChapter).toBeNull();
    expect(gw.s.chain.step).toBe(5);
  });

  test("hot: France and Russia move first, nothing was signed", async () => {
    const gw = await start();
    gw.s.chain = { topic: "balkan", step: 4, hold: 1, short: false };
    gw.s.temp = 7;
    wait(gw, 4);
    wait(gw, 5);
    crisisStep(gw);
    expect(gw.s.warChapter).toBe(gw.s.chapter);
    expect(gw.s.plan).toBe("wait");
    expect(gw.nation("RUS")!.mob).toBe(2);
    expect(gw.nation("FRA")!.mob).toBe(2);
    expect(gw.nation("BEL")?.side ?? null).toBeNull();
    expect(keys(gw)).toContain("mob_late_war");
    const line = (id: string) => gw.s.theatres.find((t) => t.id === id)!;
    expect(line("west").progress).toBe(-1);
    expect(line("east").progress).toBe(-1);
    expect(gw.s.seats[0].memory.map((m) => m.key)).toContain("mob_first");
  });

  test("cooled: the crisis closes and the game goes on", async () => {
    const gw = await start();
    gw.s.chain = { topic: "balkan", step: 4, hold: 0, short: false };
    gw.s.temp = 5;
    wait(gw, 4);
    wait(gw, 5);
    crisisStep(gw);
    expect(gw.s.warChapter).toBeNull();
    expect(gw.s.chain).toBeNull();
    expect(gw.s.chains[gw.s.chains.length - 1].outcome).toBe("compromise");
    expect(gw.s.spark).not.toBeNull();
    expect(keys(gw)).toContain("mob_waited_out");
  });

  test("a signature after one wait is no waiting", async () => {
    const gw = await start();
    gw.s.chain = { topic: "balkan", step: 4, hold: 0, short: false };
    gw.s.temp = 7;
    wait(gw, 4);
    wait(gw, 5);
    flags(gw).push("f_west_plan");
    crisisStep(gw);
    expect(gw.s.plan).toBe("west");
    expect(keys(gw)).not.toContain("mob_late_war");
  });

  test("no end comes of it that the game can't play out", async () => {
    const { runner } = await gwRunner({}, "GWSEAM");
    const gw = runner.game.greatWar()!;
    gw.s.temp = 7;
    wait(gw, 0);
    wait(gw, 0);
    playChapter(runner);
    while (view(runner).ended === null) playChapter(runner);
    expect(gw.s.seats[0].memoir?.turns.map((t) => t.key)).toContain(
      "mob_first",
    );
  });
});

describe("the desk and the world's scenes", () => {
  test("a due scene comes past its `when`, cast by its subject", async () => {
    const { runner } = await gwRunner({}, "GWSEAM");
    const gw = runner.game.greatWar()!;
    const seat = gw.s.seats[0];
    const p = gw.person("deu_jagow")!;
    openLetter(gw, seat, p);
    seat.desk = [];
    seat.scheduled = [{ scene: "gw_letter", chapter: gw.s.chapter }];
    dealDesk(gw, seat);
    const card = seat.desk.find((c) => c.scene === "gw_letter");
    expect(card?.cast.who).toBe("deu_jagow");
    expect(flags(gw)).not.toContain("gw_world_called_only");
  });

  test("the letter's scene comes on its own when a letter is written", async () => {
    const { runner } = await gwRunner({}, "GWSEAM");
    const gw = runner.game.greatWar()!;
    const seat = gw.s.seats[0];
    openLetter(gw, seat, gw.person("deu_jagow")!);
    playChapter(runner);
    expect(seat.desk.some((c) => c.scene === "gw_letter")).toBe(true);
  });
});

describe("orders on people", () => {
  test("no office, no dismissal: nothing is paid", async () => {
    const gw = await start();
    const seat = gw.s.seats[0];
    const n = gw.nation("DEU")!;
    n.authority = 100;
    gw.person("deu_jagow")!.office = null;
    expect(
      applyGwOrder(gw, seat, { kind: "dismiss", person: "deu_jagow" }),
    ).toBe("no_person");
    expect(n.authority).toBe(100);
  });

  test("short of authority, refused; and the gone can't be appointed", async () => {
    const gw = await start();
    const seat = gw.s.seats[0];
    gw.nation("DEU")!.authority = 0;
    const o = { kind: "dismiss", person: "deu_jagow" } as const;
    expect(applyGwOrder(gw, seat, o)).toBe("no_authority");
    gw.person("deu_jagow")!.status = "fallen";
    expect(
      applyGwOrder(gw, seat, {
        kind: "appoint",
        person: "deu_jagow",
        office: "foreign",
      }),
    ).toBe("no_person");
  });
});

describe("pack shares", () => {
  const pack = (over: Partial<GwPack> = {}): GwPack => ({
    version: 1,
    scenes: {},
    people: {},
    ...over,
  });
  const scene = { title: "t", text: { base: "b" } };

  test("the country's shares join its pack", async () => {
    const files: Record<string, GwPack> = {
      "ww1914/ko/common.json": pack(),
      "ww1914/ko/DEU.json": pack({ scenes: { a: scene } }),
      "ww1914/ko/DEU.crisis.json": pack({
        scenes: { b: scene },
        reasons: { c_r: "line" },
      }),
      "ww1914/ko/DEU.war.json": pack({ scenes: { c: scene } }),
      "ww1914/ko/DEU.people.json": pack({ promises: { p: "promise" } }),
      "ww1914/ko/DEU.back.json": pack(),
      "ww1914/ko/DEU.peace.json": pack(),
      "ww1914/ko/GBR.people.json": pack(),
    };
    const got = await loadGwPack("DEU", async (p) => files[p]);
    expect(Object.keys(got.scenes).sort()).toEqual(["a", "b", "c"]);
    expect(got.reasons?.c_r).toBe("line");
    expect(got.promises?.p).toBe("promise");
  });

  test("a share not written yet is skipped, a broken one is refused", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const get = (bad: unknown) => async (p: string) => {
      if (p.endsWith("DEU.war.json")) throw new Error("404");
      if (p.endsWith("DEU.crisis.json")) return bad;
      if (p.includes("people")) throw new Error("404");
      return pack();
    };
    await expect(loadGwPack("DEU", get(pack()))).resolves.toBeDefined();
    await expect(loadGwPack("DEU", get({ version: 2 }))).rejects.toThrow();
  });

  test("the main files stay required, and countries with no shares ask only for the casts", async () => {
    const asked: string[] = [];
    await loadGwPack("ITA", async (p) => {
      asked.push(p);
      return pack();
    });
    expect(asked).toEqual([
      "ww1914/ko/common.json",
      "ww1914/ko/ITA.json",
      "ww1914/ko/common.war.json",
      "ww1914/ko/common.people.json",
      "ww1914/ko/common.dip.json",
      "ww1914/ko/common.neutral.json",
      "ww1914/ko/common.world.json",
      "ww1914/ko/common.frame.json",
      "ww1914/ko/common.budget.json",
      "ww1914/ko/common.laws.json",
      "ww1914/ko/common.ruler.json",
      "ww1914/ko/common.dict.json",
      "ww1914/ko/common.acts.json",
      "ww1914/ko/common.table.json",
      "ww1914/ko/common.house.json",
      // The common shares added since: the 통치 tab's powers (ww169), the
      // ladder and its filler rows, the sea (ww180) and the capitals (ww188); the
      // peace years, the ruled land, the home front and the aftermath (ww190).
      "ww1914/ko/common.powers.json",
      "ww1914/ko/common.ladder.json",
      "ww1914/ko/common.filler.json",
      "ww1914/ko/common.sea.json",
      "ww1914/ko/common.capital.json",
      "ww1914/ko/common.years.json",
      "ww1914/ko/common.rule.json",
      "ww1914/ko/common.homefront.json",
      "ww1914/ko/common.after.json",
      "ww1914/ko/DEU.cast.json",
      "ww1914/ko/GBR.people.json",
      "ww1914/ko/AUH.people.json",
      "ww1914/ko/RUS.people.json",
      "ww1914/ko/RUS.kin.json",
      "ww1914/ko/FRA.people.json",
    ]);
    await expect(
      loadGwPack("DEU", async () => {
        throw new Error("404");
      }),
    ).rejects.toThrow();
  });

  test("an id in two packs is found before it is lost", () => {
    const a = pack({ scenes: { x: scene }, reasons: { r: "1" } });
    const b = pack({ scenes: { x: scene, y: scene }, reasons: { r: "2" } });
    expect(gwPackOverlaps([a, b])).toEqual(["scene x", "reason r"]);
  });
});
