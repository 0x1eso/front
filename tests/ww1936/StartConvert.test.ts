// ww78 section 7 and 7B: with the designer off a major starts on real planes,
// real lines and real ships; a minor and a designer-on game stay as they were.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import { histSlotOf } from "@openfront/engine-lib/ww1936/hist/Slots";
import {
  START_FLEET_MAP,
  startLinePick,
  startShipPick,
} from "@openfront/engine-lib/ww1936/hist/StartShips";
import type { HistCountry } from "@openfront/engine-lib/ww1936/hist/Types";
import { START_NAVY } from "@openfront/engine-lib/ww1936/StartNavy";
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
import { HUMAN, stepTo, wwGameStart, wwRestore, wwRunner } from "./util";

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

describe("start ships", () => {
  test("the map's names are real 1936 ships and its entries the country's, of the class", () => {
    const known = new Set<string>();
    for (const d of START_NAVY) {
      for (const s of d.ships) if (s.name) known.add(s.name);
      for (const l of d.lines) for (const n of l.names) known.add(n);
    }
    for (const [tag, m] of Object.entries(START_FLEET_MAP)) {
      const prefix = `${tag.toLowerCase()}_`;
      for (const o of [m.exact, m.like]) {
        for (const [entry, names] of Object.entries(o)) {
          expect(histEntry(entry)?.country).toBe(tag);
          for (const n of names) expect(known).toContain(prefix + n);
        }
      }
    }
    for (const d of START_NAVY) {
      if (!(d.tag in START_FLEET_MAP)) continue;
      const c = d.tag as HistCountry;
      for (const s of d.ships) {
        const p = startShipPick(c, s.cls, s.gen, s.name ?? null);
        if (p !== null) expect(histEntry(p.entry)).toMatchObject({ cls: s.cls });
      }
      for (const l of d.lines) {
        const p = startLinePick(c, l.cls, l.gen, l.names[0] ?? null);
        if (p !== null) expect(histEntry(p.entry)).toMatchObject({ cls: l.cls });
      }
    }
  });

  test("mapped ships are generation 1 on the entry's slot, full on its numbers; the rest as they were", async () => {
    const { ww, idOf } = await game(false);
    const navy = ww.navy;
    const t = navy.ships;
    const id = idOf("GBR");
    let mapped = 0;
    let left = 0;
    for (let r = 0; r < t.rows; r++) {
      if (t.owner[r] !== id) continue;
      // (The sliders' first clock can add a few percent to the maximum.)
      expect(t.hp[r] * 100).toBeGreaterThan(navy.shipStatsOf(r).hpMilli * 90);
      if (t.design[r] > 0) {
        mapped++;
        expect(t.gen[r]).toBe(1);
      } else left++;
    }
    expect(mapped).toBeGreaterThan(190);
    expect(left).toBeLessThan(30);
    const pol = idOf("POL");
    for (let r = 0; r < t.rows; r++) {
      if (t.owner[r] === pol) expect(t.design[r]).toBe(0);
    }
  });

  test("a slip keeps the share of its first ship done and launches the real ship", async () => {
    const { ww, d, idOf } = await game(false);
    const id = idOf("FRA");
    const ce = ww.economy.country(id)!;
    const slot = histSlotOf("FRA", "fra_richelieu");
    const l = ce.navalLines.find((x) => x.design === slot)!;
    expect(l.gen).toBe(1);
    expect(SHIP_CLASSES[l.cls]).toBe("bb");
    const { navalLineCostMilli } =
      await import("@openfront/engine/ww1936/depth/Designs");
    const pct = Math.round((l.progress * 100) / navalLineCostMilli(d, id, l));
    expect(pct).toBe(10);
    expect(d.designSlot(id, "ship", slot)?.origin).toBe("received");
  });

  test("handing a ship over keeps its catalogue design", async () => {
    const { ww, d, idOf } = await game(false);
    const t = ww.navy.ships;
    const gbr = idOf("GBR");
    const to = idOf("FRA");
    const r = [...Array(t.rows).keys()].find(
      (x) => t.owner[x] === gbr && t.design[x] > 0 && t.cls[x] === 0,
    )!;
    const hist = d.designSlot(gbr, "ship", t.design[r])?.def.hist;
    const shipId = t.id[r];
    ww.navy.transferShip(shipId, to);
    const r2 = t.rowOf(shipId);
    expect(t.owner[r2]).toBe(to);
    expect(d.designSlot(to, "ship", t.design[r2])?.def.hist).toBe(hist);
  });

  test("a restored game has the same ships and the same hash", async () => {
    const humans = [{ clientID: HUMAN, country: "DEU" as const }];
    const a = await wwRunner({ ww1936Designer: false }, humans, "ww1936deep");
    stepTo(a, 3);
    const t = a.game.worldWar()!.navy.ships;
    expect(t.design.subarray(0, t.rows).some((x) => x > 0)).toBe(true);
    const b = await wwRestore(a, humans, "ww1936deep", {
      ww1936Designer: false,
    });
    const u = b.game.worldWar()!.navy.ships;
    expect([...u.design.subarray(0, u.rows)]).toEqual([
      ...t.design.subarray(0, t.rows),
    ]);
    expect(b.game.worldWar()!.hash()).toBe(a.game.worldWar()!.hash());
  });
});
