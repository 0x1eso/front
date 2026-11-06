import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import {
  GwScene,
  memory,
  remember,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { useGwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { beforeAll, describe, expect, test } from "vitest";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { MINI } from "../ww1936/util";
import {
  decision,
  node,
  reply,
  scene,
  talk,
  useScenes,
} from "./narrativeFixture";
import {
  formatReport,
  GW_SIM_DEFAULTS,
  GW_SIM_PROFILES,
  GwRunRecord,
  GwSimOptions,
  playRun,
  runSim,
  seenBefore,
} from "./sim/GwSim";

const OPTS: GwSimOptions = { ...GW_SIM_DEFAULTS, series: 9, label: "t" };

/** A content the tool knows nothing about, with one of everything to find. */
const content = (): GwScene[] => {
  const never = { kind: "temp", min: 99 } as const;
  const pool = Array.from({ length: 60 }, (_, i) =>
    decision(`pool_${i}`, {
      once: true,
      salience: 5,
      tags: [(["home", "war", "foreign"] as const)[i % 3]],
      variants: [{ id: "base" }],
    }),
  );
  return [
    scene("skeleton", {
      salience: 9,
      cooldown: 1,
      variants: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    }),
    scene("dead", { when: never }),
    scene("shut_body", {
      salience: 9,
      once: true,
      variants: [{ id: "never", when: never }, { id: "base" }],
    }),
    scene("orphan", { scheduledOnly: true }),
    talk("no_topic", "deu_cold", { open: node(reply("r")) }, { when: never }),
    talk("hoyos", "deu_cold", {
      open: node(reply("listen", { effects: [remember("heard")] })),
    }),
    decision("cheque", {
      salience: 9,
      once: true,
      options: [
        { id: "plain", tell: [], effects: [] },
        { id: "term", when: memory("heard"), tell: [], effects: [] },
      ],
    }),
    ...pool,
  ];
};

describe("the N-run report", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  const play = async (o: Partial<GwSimOptions> = {}) => {
    useScenes(content());
    return runSim(map, { ...OPTS, ...o });
  };

  test("repeats exactly", async () => {
    const a = await play({ series: 3, control: false });
    const b = await play({ series: 3, control: false });
    expect(a).toEqual(b);
  });

  test("the bot signs the chief of staff's papers through the war", async () => {
    useScenes(content());
    const game = await playRun(
      map,
      "GWPAPERS",
      "y1914",
      [],
      GW_SIM_PROFILES[0],
    );
    const again = await playRun(
      map,
      "GWPAPERS",
      "y1914",
      [],
      GW_SIM_PROFILES[0],
    );
    expect(again.papersSigned).toBe(game.papersSigned);
    expect(game.papersSigned > 0).toBe(game.chapters > 6);
  });

  test("names what never came, and why", async () => {
    const r = await play();
    const why = Object.fromEntries(r.unseen.map((u) => [u.id, u.why]));
    expect(why.dead).toContain("never eligible");
    expect(why.no_topic).toContain("topic never open");
    expect(why.orphan).toContain("nothing scheduled");
    expect(r.unseenBodies).toContain("shut_body.never");
    expect(r.unseenBodies).not.toContain("shut_body.base");
  });

  test("names what comes too often", async () => {
    const r = await play();
    expect(r.overused.map((s) => s.id)).toContain("skeleton");
    expect(r.overused.every((s) => s.share >= OPTS.overusedAt)).toBe(true);
    expect(r.overused.map((s) => s.id)).not.toContain("pool_0");
    const row = r.scenes.find((s) => s.id === "skeleton")!;
    expect(row.bodies).toBe("4/4");
  });

  test("the lobby list lowers what run 2 has already seen", async () => {
    const r = await play();
    expect(r.seenBefore.map((s) => s.run)).toEqual([2, 3]);
    expect(r.control).not.toBeNull();
    expect(r.seenBefore[0].bodies).toBeLessThan(r.control![0].bodies);
  });

  test("follows talks to the options they open", async () => {
    const r = await play();
    const link = r.links.find((l) => l.talk === "hoyos")!;
    expect(link).toMatchObject({ scene: "cheque", option: "term" });
    expect(link.talked).toBeGreaterThan(0);
    expect(link.opened).toBeGreaterThan(0);
    expect(link.opened).toBeLessThan(1);
  });

  test("the printed report has every section", async () => {
    const text = formatReport(await play({ series: 3 }));
    for (const word of [
      "Seen before",
      "Overused",
      "Unseen scenes",
      "Unseen bodies",
      "Talks that open options",
      "Scene frequency",
    ]) {
      expect(text).toContain(word);
    }
  });

  test("runs on the real content too", async () => {
    useGwContent(null);
    const r = await runSim(map, { ...OPTS, series: 1, control: false });
    expect(r.games).toBe(3);
    expect(Object.values(r.endings).reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe("the seen-before figure", () => {
  const run = (bodies: string[]) => ({ bodies }) as GwRunRecord;

  test("counts bodies against every earlier game of the series", () => {
    const s = seenBefore([
      [
        run(["a.x", "b.x"]),
        run(["a.x", "a.y", "c.x", "d.x"]),
        run(["b.x", "c.x", "e.x", "f.x"]),
      ],
    ]);
    expect(s).toEqual([
      { run: 2, bodies: 1 / 4, scenes: 1 / 3 },
      { run: 3, bodies: 2 / 4, scenes: 2 / 4 },
    ]);
  });
});
