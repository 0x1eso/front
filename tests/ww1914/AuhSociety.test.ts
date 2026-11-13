// ww208 W-AUH: Austria-Hungary's society content holds together: every bill
// text moves an axis, the factions have ideals, births and trees point at
// real rows, abilities and marks name AUH factions.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { gwLawStart } from "@openfront/engine-api/ww1914/GwLaw";
import { axesOf } from "@openfront/engine-api/ww1914/GwSociety";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { REICHSRAT_OPEN } from "@openfront/engine-lib/ww1914/content/house/houses";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { lawDraftable } from "@openfront/engine/ww1914/Laws";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { holds } from "@openfront/engine/ww1914/SceneRun";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { AUH_MARKS } from "../../src/client/hud/ww1914/marks/auh";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { GW_SIM_PROFILES, playRun } from "./sim/GwSim";

const c = gwContent();
const factions = (c.factions ?? []).filter((f) => f.tag === "AUH");
const factionIds = new Set(factions.map((f) => f.id));
const laws = GW_LAWS.filter((l) => l.tag === "AUH");

describe("ww208 AUH society content", () => {
  test("every AUH bill text pushes an axis of AUH's", () => {
    const own = new Set(axesOf("AUH"));
    for (const l of laws) {
      for (const d of l.draft) {
        const axes = Object.keys(d.axes ?? {});
        expect(axes.length, `${l.id}.${d.id}`).toBeGreaterThan(0);
        for (const a of axes) expect(own.has(a as never), a).toBe(true);
      }
    }
    const peace = laws.filter((l) => l.peace === true).map((l) => l.chapter);
    expect(new Set(peace)).toEqual(
      // ww211: the Diet's standing orders sit in the franchise chapter.
      new Set(["tax", "social", "land", "schools", "local", "franchise"]),
    );
  });

  test("factions have ideals; births and communities line up", () => {
    for (const f of factions) expect(f.ideals, f.id).toBeDefined();
    const comms = (c.society?.communities ?? []).filter((x) => x.tag === "AUH");
    const ids = new Set(comms.map((x) => x.id));
    expect(ids.size).toBe(comms.length);
    for (const a of axesOf("AUH")) {
      for (const side of [-1, 1]) {
        expect(
          comms.some((x) => x.ideal.axis === a && x.ideal.side === side),
          `${a} ${side}`,
        ).toBe(true);
      }
    }
    for (const b of (c.society?.births ?? []).filter((x) => x.tag === "AUH")) {
      const row = factions.find((f) => f.id === b.faction);
      expect(row?.start, b.faction).toBe("out");
      expect(ids.has(b.from), b.from).toBe(true);
    }
  });

  test("trees' law nodes are their exclusive laws; abilities and marks name AUH factions", () => {
    const trees = (c.utopia?.trees ?? []).filter((t) =>
      factionIds.has(t.faction),
    );
    expect(trees.length).toBeGreaterThan(5);
    for (const t of trees) {
      for (const [node, bend] of Object.entries(t.bend ?? {})) {
        if (bend.law === undefined) continue;
        const law = laws.find((l) => l.id === bend.law);
        expect(law?.exclusive, bend.law).toEqual({
          faction: t.faction,
          node,
        });
      }
    }
    const powers = (c.powers ?? []).filter((p) => p.ability !== undefined);
    for (const f of factions.filter((x) => x.ability !== undefined)) {
      const p = powers.find((x) => x.id === f.ability);
      expect(p?.ability?.faction, f.id).toBe(f.id);
    }
    for (const m of AUH_MARKS)
      expect(factionIds.has(m.faction), m.faction).toBe(true);
    const chambers = (c.houses ?? []).find((h) => h.tag === "AUH")!.chambers;
    for (const ch of chambers.filter((x) => x.elect !== undefined)) {
      expect(laws.some((l) => l.id === ch.elect!.postpone)).toBe(true);
    }
  });

  // ww211: a peace game: the Reichsrat can be called back (the council
  // votes it, the July weeks behind), and the bills keep coming after it.
  test("the Reichsrat reopens in peace, and a peace game keeps bringing bills", async () => {
    const map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const money = /_budget$|_credits_/;
    for (let i = 0; i < 30; i++) {
      let war = false;
      let opened = false;
      const brought = new Set<string>();
      const after = new Set<string>();
      let moving = new Set<string>();
      await playRun(
        map,
        `auh211-${i}`,
        "full",
        [],
        GW_SIM_PROFILES[1],
        "AUH",
        (gw) => {
          const seat = gw.s.seats[0];
          const n = gw.nation("AUH")!;
          war = war || n.atWar.length > 0 || gw.s.warChapter !== null;
          if (war) return;
          const now = new Set(
            n.laws
              .filter((x) => x.stage !== "idle" && x.stage !== "force")
              .filter((x) => !money.test(x.id))
              .map((x) => x.id),
          );
          for (const id of now) {
            if (moving.has(id)) continue;
            brought.add(id);
            if (opened) after.add(id);
          }
          moving = now;
          // The player calls the vote on a bill argued two chapters.
          for (const x of [...n.laws]) {
            if (money.test(x.id) || x.stage !== "persuade") continue;
            if (gw.s.chapter - x.since < 2) continue;
            applyGwOrder(gw, seat, {
              kind: "bill_vote",
              law: x.id,
              confidence: false,
            });
          }
          if (opened || !lawDraftable(gw, seat, "auh_reichsrat")) return;
          if (n.laws.filter((x) => now.has(x.id)).length >= 3) return;
          n.laws = n.laws.filter((x) => x.id !== "auh_reichsrat");
          n.laws.push({
            ...gwLawStart("auh_reichsrat"),
            stage: "persuade",
            since: gw.s.chapter - 1,
          });
          n.inst.council = 3;
          const order = {
            kind: "bill_vote",
            law: "auh_reichsrat",
            confidence: false,
          } as const;
          expect(applyGwOrder(gw, seat, order)).toBe(null);
          const st = n.laws.find((x) => x.id === "auh_reichsrat")!;
          expect(st.stage).toBe("force");
          expect(holds({ gw, seat, cast: {} }, REICHSRAT_OPEN)).toBe(true);
          opened = true;
        },
      );
      if (war) continue;
      expect(opened).toBe(true);
      expect(brought.size).toBeGreaterThanOrEqual(3);
      expect(after.size).toBeGreaterThanOrEqual(1);
      return;
    }
    throw new Error("no peace game in 30");
  }, 600_000);
});
