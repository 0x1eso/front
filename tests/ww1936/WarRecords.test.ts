// World War 1936 P5 (spec §4.2–§4.3, plan decision 8, Review Focus 5):
// every war pair belongs to exactly one war record.
import type { WarLink } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game } from "@openfront/engine/game/Game";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { joinFaction } from "@openfront/engine/ww1936/politics/Factions";
import { endWarBetween } from "@openfront/engine/ww1936/politics/Territory";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { dropPact, END_MAP, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

async function atWarStart(): Promise<{ g: Game; ww: WorldWar }> {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { g: runner.game, ww: runner.game.worldWar()! };
}

const player = (g: Game, id: number) => {
  const p = g.playerBySmallID(id);
  if (!p.isPlayer()) throw new Error(`no player ${id}`);
  return p;
};

/** Every pair of the war matrix has one record, with a and b on opposite sides. */
function checkPairs(ww: WorldWar): void {
  const eg = ww.endgame;
  const n = ww.scenario.countries.length;
  const pairs: string[] = [];
  for (let a = 1; a <= n; a++) {
    for (let b = a + 1; b <= n; b++) {
      if (!ww.isAtWar(a, b)) continue;
      pairs.push(`${a}-${b}`);
      const w = eg.war(eg.warOfPair(a, b));
      expect(w, `${a}-${b}`).not.toBeNull();
      expect(w!.ended).toBeNull();
      const sa = eg.sideIndex(w!, a);
      const sb = eg.sideIndex(w!, b);
      expect(sa, `${a}-${b}`).toBeGreaterThanOrEqual(0);
      expect(sb, `${a}-${b}`).toBeGreaterThanOrEqual(0);
      expect(sa).not.toBe(sb);
    }
  }
  const keys = [...eg.pairWar.keys()].map((k) => {
    const a = Math.floor(k / eg.size);
    return `${a}-${k % eg.size}`;
  });
  expect(keys.sort()).toEqual(pairs.sort());
}

describe("World War 1936 P5: war records", () => {
  it("a declaration creates a war with both sides", async () => {
    const { g, ww } = await atWarStart();
    dropPact(g, "DEU", "POL");
    const [deu, pl] = [endId("DEU"), endId("POL")];
    expect(declareWar(g, ww, player(g, deu), player(g, pl), g.ticks())).toEqual(
      [pl],
    );
    const eg = ww.endgame;
    expect(eg.wars).toHaveLength(1);
    const w = eg.wars[0];
    expect(w.kind).toBe("normal");
    expect(w.sides.map((s) => s.members.map((m) => m.id))).toEqual([
      [deu],
      [pl],
    ]);
    expect(w.sides.map((s) => s.leader)).toEqual([deu, pl]);
    expect(eg.warOfPair(pl, deu)).toBe(w.id);
    expect(eg.warsOf(deu)).toEqual([w.id]);
    checkPairs(ww);
  });

  it("faction members pulled in by a declaration join the same war", async () => {
    const { g, ww } = await atWarStart();
    const [deu, fra, gbr] = [endId("DEU"), endId("FRA"), endId("GBR")];
    expect(ww.sameFaction(fra, gbr)).toBe(true);
    declareWar(g, ww, player(g, deu), player(g, fra), g.ticks());
    expect(ww.isAtWar(deu, gbr)).toBe(true);
    const eg = ww.endgame;
    expect(eg.wars).toHaveLength(1);
    expect(eg.warOfPair(deu, gbr)).toBe(eg.warOfPair(deu, fra));
    expect(eg.wars[0].sides[1].members.map((m) => m.id)).toEqual([fra, gbr]);
    checkPairs(ww);
  });

  it("a join enters the target's oldest war on the other side", async () => {
    const { g, ww } = await atWarStart();
    const [deu, pl, csk, sun] = ["DEU", "POL", "CSK", "SUN"].map((t) =>
      endId(t as "DEU"),
    );
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    ww.setWar(deu, csk, g.ticks(), { kind: "declare" });
    const eg = ww.endgame;
    expect(eg.wars.map((w) => w.id)).toEqual([1, 2]);
    ww.setWar(sun, deu, g.ticks(), { kind: "into", warId: 0 });
    expect(eg.warOfPair(sun, deu)).toBe(1);
    expect(eg.wars[0].sides[1].members.map((m) => m.id)).toEqual([pl, sun]);
    checkPairs(ww);
  });

  it("every pair belongs to exactly one war (1,000 random declarations)", async () => {
    const { g, ww } = await atWarStart();
    const n = 10;
    let seed = 1936;
    const next = (m: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) % m;
    };
    for (let i = 0; i < 1000; i++) {
      const a = 1 + next(n);
      const b = 1 + next(n);
      const op = next(10);
      if (op < 6) {
        const wars = ww.endgame.wars;
        const link: WarLink =
          next(2) === 0 || wars.length === 0
            ? { kind: "declare" }
            : {
                kind: "into",
                warId: next(3) === 0 ? 0 : wars[next(wars.length)].id,
              };
        ww.setWar(a, b, g.ticks(), link);
      } else if (op < 9) {
        ww.endWar(a, b);
      } else if (next(5) === 0) {
        ww.endWarsOf(a);
      }
      checkPairs(ww);
    }
  });

  it("end_war marks a member left when it has no pair in that war", async () => {
    const { g, ww } = await atWarStart();
    const [deu, fra, gbr] = [endId("DEU"), endId("FRA"), endId("GBR")];
    declareWar(g, ww, player(g, deu), player(g, fra), g.ticks());
    const eg = ww.endgame;
    endWarBetween(ww.politics, deu, gbr, g.ticks());
    const w = eg.wars[0];
    expect(eg.member(w, gbr)!.state).toBe("left");
    expect(eg.member(w, fra)!.state).toBe("active");
    expect(eg.member(w, deu)!.state).toBe("active");
    checkPairs(ww);
  });

  it("a faction joining mid-war fights the other side", async () => {
    const { g, ww } = await atWarStart();
    const [deu, ita, fra, pl] = ["DEU", "ITA", "FRA", "POL"].map((t) =>
      endId(t as "DEU"),
    );
    declareWar(g, ww, player(g, deu), player(g, fra), g.ticks());
    const eg = ww.endgame;
    const war = eg.warOfPair(deu, fra);
    // Poland joins the Allies: at war with Germany, in that war, beside France.
    joinFaction(ww.politics, pl, ww.politics.factionIdx(fra), g.ticks());
    expect(ww.isAtWar(pl, deu)).toBe(true);
    expect(eg.warOfPair(pl, deu)).toBe(war);
    const w = eg.war(war)!;
    expect(eg.sideIndex(w, pl)).toBe(eg.sideIndex(w, fra));
    expect(ww.isAtWar(pl, ita)).toBe(ww.isAtWar(fra, ita));
    checkPairs(ww);
  });
});
