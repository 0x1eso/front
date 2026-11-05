// ww78 section 7 and 7B: with the designer off a major starts on real planes,
// real lines and real ships; a minor and a designer-on game stay as they were.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  EQUIP_KEYS,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { HUMAN, stepTo, wwGameStart } from "./util";

let files: MapFiles;
beforeAll(async () => {
  files = await loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
});

async function game(designer: boolean) {
  const runner = await createGameRunner(
    wwGameStart({ ww1936Designer: designer }, [
      { clientID: HUMAN, country: "DEU" },
    ]),
    undefined,
    files,
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  stepTo(runner, 3);
  const ww = runner.game.worldWar()!;
  return { runner, ww, d: ww.depth, idOf: (t: string) => ww.politics.idOfTag(t as never) };
}

const majors = ["DEU", "USA", "GBR", "FRA", "ITA", "JPN", "SUN"] as const;

describe("start planes", () => {
  test("a major's wings and stock hold catalogue planes, the ledger agrees", async () => {
    const { ww, idOf } = await game(false);
    for (const tag of majors) {
      const id = idOf(tag);
      const ce = ww.economy.country(id)!;
      const held = new Map<number, number>();
      for (const w of ww.air.wings.values()) {
        if (w.owner !== id) continue;
        expect(w.counts.every((n) => n === 0)).toBe(true);
        w.dcounts.forEach((n, s) => {
          const k = equipKey("plane_design", s + 1);
          if (n > 0) held.set(k, (held.get(k) ?? 0) + n);
        });
      }
      for (const [k, n] of held) expect(ce.planesDeployed[k]).toBe(n);
      for (const t of AIR_TYPES) {
        expect(ce.stock[equipKey(t, 1)]).toBe(0);
        expect(ce.planesDeployed[equipKey(t, 1)]).toBe(0);
      }
    }
  });

  test("a type whose first entry waits on a tech holds it, unmade until the tech", async () => {
    const { ww, d, idOf } = await game(false);
    const id = idOf("FRA");
    const ce = ww.economy.country(id)!;
    const c = d.country(id)!;
    const s = c.des.plane.find((x) => x?.def.hist === "fra_d376")!;
    expect(s.origin).toBe("received");
    expect(ce.researched.has("carrier_aviation")).toBe(false);
  });

  test("a major's plane and tank lines take the pick at no efficiency cost", async () => {
    const { ww, idOf } = await game(false);
    const ce = ww.economy.country(idOf("DEU"))!;
    const names = ce.lines.map((l) => EQUIP_KEYS[l.key][0]);
    expect(names).toContain("plane_design");
    expect(names).toContain("tank_design");
    expect(names).not.toContain("light_tank");
    expect(names).not.toContain("fighter");
    for (const l of ce.lines) expect(l.effBp).toBe(1000);
  });

  test("a minor, and any country with the designer on, keeps its static planes", async () => {
    const { ww, idOf } = await game(false);
    const pol = idOf("POL");
    const minor = [...ww.air.wings.values()].filter((w) => w.owner === pol);
    for (const w of minor) expect(w.dcounts.every((n) => n === 0)).toBe(true);
    const on = await game(true);
    const ce = on.ww.economy.country(on.idOf("DEU"))!;
    expect(ce.lines.map((l) => EQUIP_KEYS[l.key][0])).toContain("fighter");
    for (const w of on.ww.air.wings.values()) {
      expect(w.dcounts.every((n) => n === 0)).toBe(true);
    }
  });
});
