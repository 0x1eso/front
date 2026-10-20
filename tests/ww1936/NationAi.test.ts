import type { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { HISTORY } from "@openfront/engine-lib/ww1936/History";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import type { Execution, Game, Player } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import {
  byTag,
  HUMAN,
  MINI,
  stamped,
  step,
  stepTo,
  wwGameStart,
  WwHuman,
  wwRunner,
} from "./util";

/** Every player-on-player attack running now, as "ATT>DEF" tags. */
function attacks(g: Game): string[] {
  const ww = g.worldWar()!;
  const out: string[] = [];
  for (const p of g.allPlayers()) {
    for (const a of p.outgoingAttacks()) {
      const t = a.target();
      if (t.isPlayer()) {
        out.push(
          `${ww.tagOf(p.smallID())}>${ww.tagOf((t as Player).smallID())}`,
        );
      }
    }
  }
  return out;
}

interface Launch {
  /** "attack DEU>FRA" or "boat GBR>ITA". */
  what: string;
  /** Whether its owner could attack the target when it was launched. */
  atWar: boolean;
  /** When it was launched. */
  tick: number;
  /** The troops it asked for. */
  troops: number;
}

/**
 * From now on, every attack and boat a player launches at another player.
 * Launches the engine would refuse at init count too, so a try the AI should
 * not make shows up.
 */
function watchLaunches(g: Game): Launch[] {
  const ww = g.worldWar()!;
  const tag = (p: Player) => ww.tagOf(p.smallID());
  const out: Launch[] = [];
  const add = g.addExecution.bind(g);
  g.addExecution = (...execs: Execution[]) => {
    for (const e of execs) {
      let kind = "";
      let owner: Player | null = null;
      let target: Player | null = null;
      let troops = 0;
      if (e instanceof AttackExecution) {
        const a = e as unknown as {
          _owner: Player;
          _targetID: string | null;
          startTroops: number | null;
        };
        kind = "attack";
        owner = a._owner;
        troops = a.startTroops ?? 0;
        const id = a._targetID;
        if (id !== null && id !== g.terraNullius().id() && g.hasPlayer(id)) {
          target = g.player(id);
        }
      } else if (e instanceof TransportShipExecution) {
        const b = e as unknown as {
          attacker: Player;
          ref: TileRef;
          troops: number | null;
        };
        kind = "boat";
        owner = b.attacker;
        troops = b.troops ?? 0;
        const o = g.owner(b.ref);
        target = o.isPlayer() ? o : null;
      }
      if (owner !== null && target !== null) {
        out.push({
          what: `${kind} ${tag(owner)}>${tag(target)}`,
          atWar: owner.canAttackPlayer(target),
          tick: g.ticks(),
          troops,
        });
      }
    }
    add(...execs);
  };
  return out;
}

const atPeace = (launches: Launch[]) =>
  launches.filter((l) => !l.atWar).map((l) => l.what);

/** A nation's attack logic of its own, outside its NationExecution's turns. */
function aiOf(g: Game, p: Player): AiAttackBehavior {
  const random = new PseudoRandom(7);
  const emoji = new NationEmojiBehavior(random, g, p);
  const alliance = new NationAllianceBehavior(random, g, p, emoji);
  return new AiAttackBehavior(random, g, p, 0.5, 0.2, 0.1, alliance, emoji);
}

/** A runner on the test map with its own game id (so its own seeds). */
async function runnerWithId(
  gameID: string,
  config: Partial<GameConfig>,
  humans: WwHuman[],
) {
  const start = wwGameStart(config, humans);
  start.gameID = gameID;
  return createGameRunner(
    start,
    undefined,
    await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
}

/** A declared-on or declaring nation attacks within this many ticks. */
const WAR_ATTACK_TICKS = 300;

describe("nation AI in World War 1936 (spec 7.7)", () => {
  test("nations at peace attack nobody", async () => {
    const runner = await wwRunner({ historicalAi: false });
    for (let t = 0; t < 1500; t += 50) {
      step(runner, 50);
      expect(attacks(runner.game)).toEqual([]);
    }
  }, 60_000);

  test("a nation at war attacks its enemy and only its enemy", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    g.worldWar()!.setWar(deu.smallID(), pol.smallID(), g.ticks());
    const seen = new Set<string>();
    for (
      let t = 0;
      t < 3000 && !seen.has("DEU>POL") && !seen.has("POL>DEU");
      t += 20
    ) {
      step(runner, 20);
      for (const a of attacks(g)) seen.add(a);
    }
    expect(seen.has("DEU>POL") || seen.has("POL>DEU")).toBe(true);
    for (const a of seen) expect(["DEU>POL", "POL>DEU"]).toContain(a);
  }, 60_000);

  test("it skips a neutral neighbour and launches no boat at a neutral country", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS + 1);
    const [deu, fra, gbr, ita] = [
      byTag(g, "DEU"),
      byTag(g, "FRA"),
      byTag(g, "GBR"),
      byTag(g, "ITA"),
    ];
    // Strong enough that only the war decides.
    deu.addTroops(1_000_000);
    gbr.addTroops(1_000_000);
    const launches = watchLaunches(g);
    // At peace: neither France next door nor Italy across the sea.
    expect(aiOf(g, deu).sendAttack(fra)).toBe(false);
    expect(aiOf(g, gbr).sendAttack(ita)).toBe(false);
    expect(launches).toEqual([]);
    // At war, the same calls launch: an attack by land, a boat by sea.
    ww.setWar(deu.smallID(), fra.smallID(), g.ticks());
    ww.setWar(gbr.smallID(), ita.smallID(), g.ticks());
    expect(aiOf(g, deu).sendAttack(fra)).toBe(true);
    expect(aiOf(g, gbr).sendAttack(ita)).toBe(true);
    expect(launches.map((l) => l.what)).toEqual([
      "attack DEU>FRA",
      "boat GBR>ITA",
    ]);
  });

  test("a war over many minutes launches nothing at a country at peace", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    g.worldWar()!.setWar(deu.smallID(), pol.smallID(), g.ticks());
    const launches = watchLaunches(g);
    step(runner, 3000);
    expect(launches.some((l) => l.what === "attack DEU>POL")).toBe(true);
    expect(atPeace(launches)).toEqual([]);
  }, 60_000);

  test("a war that ended stops the direct attacks: retaliation, follow-up landing, strike", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS + 1);
    const [deu, pol, fra] = [byTag(g, "DEU"), byTag(g, "POL"), byTag(g, "FRA")];
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(deu.smallID(), fra.smallID(), g.ticks());
    // Poland attacks Germany, and a German boat has landed in France.
    const landing = [...fra.tiles()].find((t) =>
      g.neighbors(t).every((n) => g.owner(n) === fra),
    )!;
    g.addExecution(
      new AttackExecution(pol.troops() / 2, pol, deu.id()),
      new AttackExecution(1_000, deu, fra.id(), landing, false),
    );
    step(runner);
    expect(pol.outgoingAttacks().some((a) => a.target() === deu)).toBe(true);
    expect(deu.outgoingAttacks().some((a) => a.sourceTile() === landing)).toBe(
      true,
    );
    // Both wars end while the attacks run (as a capitulation ends them).
    ww.endWarsOf(pol.smallID());
    ww.endWarsOf(fra.smallID());
    deu.addTroops(1_000_000);
    const ai = aiOf(g, deu);
    const launches = watchLaunches(g);
    ai.followUpLandings();
    expect((ai as unknown as { retaliate(): boolean }).retaliate()).toBe(false);
    expect(ai.strike(pol)).toBe(false);
    expect(ai.strike(fra)).toBe(false);
    expect(launches).toEqual([]);
  });

  test("the mode plays Medium whatever the lobby asked", async () => {
    const g = (await wwRunner({ difficulty: Difficulty.Easy })).game;
    expect(g.config().gameConfig().difficulty).toBe(Difficulty.Medium);
  });

  test.each(["WWTEST01", "WWSEED03", "WWSEED05"])(
    "a nation declared on attacks the stronger declarer soon, even one that does nothing (%s)",
    async (gameID) => {
      const runner = await runnerWithId(gameID, { historicalAi: false }, [
        { clientID: HUMAN, country: "DEU" },
      ]);
      const g = runner.game;
      const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
      stepTo(runner, WW_PREP_TICKS + 1);
      const launches = watchLaunches(g);
      step(runner, 1, [
        stamped(HUMAN, { type: "declare_war", target: pol.id() }),
      ]);
      const declared = g.ticks();
      // Germany has the bigger army: no vanilla motive would attack it.
      expect(deu.troops()).toBeGreaterThan(pol.troops());
      while (
        g.ticks() < declared + WAR_ATTACK_TICKS &&
        !launches.some((l) => l.what === "attack POL>DEU")
      ) {
        step(runner);
      }
      expect(launches.some((l) => l.what === "attack POL>DEU")).toBe(true);
      expect(atPeace(launches)).toEqual([]);
    },
    60_000,
  );

  test("a nation the calendar sends to war attacks its target", async () => {
    // Poland is a human who does nothing: only Germany's own move counts.
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "POL" }]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    // Only "1 September 1939: Germany declares war on Poland", on day 1.
    const entry = HISTORY.findIndex(
      (e) => e.actor === "DEU" && e.target === "POL",
    );
    ww.setHistory(HISTORY.map((_, i) => [i === entry ? 1 : -1, false]));
    const launches = watchLaunches(g);
    stepTo(runner, dayStartTick(1, WW_PREP_TICKS) + 1);
    expect(ww.isAtWar(deu.smallID(), pol.smallID())).toBe(true);
    const declared = g.ticks() - 1;
    while (
      g.ticks() < declared + WAR_ATTACK_TICKS &&
      !launches.some((l) => l.what === "attack DEU>POL")
    ) {
      step(runner);
    }
    expect(launches.some((l) => l.what === "attack DEU>POL")).toBe(true);
    expect(atPeace(launches)).toEqual([]);
  }, 60_000);

  test("against a stronger enemy a nation sends its share of the two armies", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS + 1);
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    const ours = Math.floor(g.config().maxTroops(pol) * 0.9);
    pol.setTroops(ours);
    deu.setTroops(ours * 2);
    const launches = watchLaunches(g);
    aiOf(g, pol).maybeAttack();
    const attack = launches.find((l) => l.what === "attack POL>DEU");
    expect(attack).toBeDefined();
    // A third against twice our troops.
    expect(attack!.troops).toBeCloseTo(ours / 3, 0);

    // Against a weaker one, all above the reserve (as any attack).
    deu.setTroops(Math.floor(ours / 2));
    const before = launches.length;
    aiOf(g, pol).maybeAttack();
    const second = launches
      .slice(before)
      .find((l) => l.what === "attack POL>DEU");
    expect(second).toBeDefined();
    expect(second!.troops).toBeCloseTo(
      ours - g.config().maxTroops(pol) * 0.2,
      0,
    );
  });

  test("the hated-target strategy sizes a war enemy by the odds too", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS + 1);
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    const ours = Math.floor(g.config().maxTroops(pol) * 0.9);
    pol.setTroops(ours);
    deu.setTroops(ours * 2);
    // A relation on record (any; the war is what makes Germany hated).
    pol.updateRelation(deu, -1);
    const launches = watchLaunches(g);
    const ai = aiOf(g, pol) as unknown as {
      getAttackStrategies(
        friends: unknown[],
        enemies: unknown[],
      ): (() => boolean)[];
    };
    const hated = ai
      .getAttackStrategies([], [])
      .find((f) => f.name === "hated");
    expect(hated).toBeDefined();
    expect(hated!()).toBe(true);
    const attack = launches.find((l) => l.what === "attack POL>DEU");
    expect(attack).toBeDefined();
    // As the war motive sends it: a third against twice our troops, not
    // everything above the reserve.
    expect(attack!.troops).toBeCloseTo(ours / 3, 0);
  });
});
