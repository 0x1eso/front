// The lobby's preview is the engine's result: a Germany plan, built the way
// the client builds it, sent as the order, on the real map.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it, vi } from "vitest";
import { NodeGameMapLoader } from "../../perf/fullgame/NodeGameMapLoader";
import { byTag, HUMAN, land, step, wwGameStart } from "../../ww1936/util";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { oobModel, oobOrderOf } from "../../../src/client/hud/ww1936/PrepOob";

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../resources/maps",
  ),
);

describe("the preview equals the engine's result", () => {
  it("a Germany plan: an edited template, a new one, moved divisions, an army left empty", async () => {
    const runner = await createGameRunner(
      wwGameStart({}, [{ clientID: HUMAN, country: "DEU" }]),
      undefined,
      await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    step(runner, 2);
    const l = land(runner.game);
    const id = byTag(runner.game, "DEU").smallID();
    const cl = l.country(id)!;
    const plan = [
      {
        key: "infantry",
        name: "Mine",
        battalions: ["infantry", "infantry", "infantry", "artillery"],
        support: [],
      },
      {
        key: "new:1",
        name: "Light",
        battalions: ["infantry", "infantry", "infantry"],
        support: [],
      },
    ];
    const armies = [
      [
        { key: "infantry", count: 16 },
        { key: "mountain", count: 3 },
      ],
      [],
      [
        { key: "new:1", count: 24 },
        { key: "armored", count: 3 },
        { key: "cavalry", count: 2 },
      ],
    ];
    const m = oobModel("DEU", plan, armies)!;
    expect(m.problems).toEqual([]);
    const o = oobOrderOf(m, new Set(cl.templates.map((t) => t.key)));
    expect(typeof o).not.toBe("string");
    if (typeof o === "string") return;
    expect(l.issue(id, o.order as never)).toBeNull();
    // Each army, each template: the same numbers.
    m.armies.forEach((a, i) => {
      const army = l.armiesOf(id).find((x) => x.nameNo === a.nameNo);
      const have = new Map<string, number>();
      for (const d of army?.divisions ?? []) {
        const t = cl.template(l.divisions.template[l.divisions.rowOf(d)])!;
        const key = t.key || (t.def.name === "Light" ? "new:1" : "infantry");
        have.set(key, (have.get(key) ?? 0) + 1);
      }
      expect(army?.divisions.length ?? 0, `army ${i}`).toBe(a.fieldedTotal);
      m.templates.forEach((t, k) => {
        expect(have.get(t.key) ?? 0, `army ${i} ${t.key}`).toBe(a.fielded[k]);
      });
    });
    expect(l.armiesOf(id).reduce((n, a) => n + a.divisions.length, 0)).toBe(
      m.result.total,
    );
  }, 120_000);
});
