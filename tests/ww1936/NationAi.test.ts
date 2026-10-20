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
import { HISTORY_BEATS } from "@openfront/engine-lib/ww1936/content/history";
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
  dropPact,
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

  // P2 (plan decision 7, spec §13.1, §14): a nation launches no tile attack
  // or boat in this mode; the land AI (Task 6) fights with armies.
  test("a nation at war launches no tile attack or boat", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    g.worldWar()!.setWar(deu.smallID(), pol.smallID(), g.ticks());
    const launches = watchLaunches(g);
    step(runner, 3000);
    expect(launches).toEqual([]);
    expect(attacks(g)).toEqual([]);
  }, 60_000);

  test("its attack logic skips a neutral neighbour and launches no boat at a neutral country", async () => {
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
    // At war, the same call launches an attack by land (refused at its init
    // in this mode, P2); boats are off in this mode since P2.
    ww.setWar(deu.smallID(), fra.smallID(), g.ticks());
    expect(aiOf(g, deu).sendAttack(fra)).toBe(true);
    expect(launches.map((l) => l.what)).toEqual(["attack DEU>FRA"]);
  });

  test("the mode plays Medium whatever the lobby asked", async () => {
    const g = (await wwRunner({ difficulty: Difficulty.Easy })).game;
    expect(g.config().gameConfig().difficulty).toBe(Difficulty.Medium);
  });

  test.each(["WWTEST01", "WWSEED03", "WWSEED05"])(
    "a nation declared on launches no tile attack (%s)",
    async (gameID) => {
      const runner = await runnerWithId(gameID, { historicalAi: false }, [
        { clientID: HUMAN, country: "DEU" },
      ]);
      const g = runner.game;
      const pol = byTag(g, "POL");
      dropPact(g, "DEU", "POL");
      stepTo(runner, WW_PREP_TICKS + 1);
      const launches = watchLaunches(g);
      step(runner, 1, [
        stamped(HUMAN, { type: "declare_war", target: pol.id() }),
      ]);
      step(runner, WAR_ATTACK_TICKS);
      expect(launches).toEqual([]);
    },
    60_000,
  );

  test("the calendar's war starts; no tile attack follows it", async () => {
    // Poland is a human who does nothing: only Germany's own move counts.
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "POL" }]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    // Only "1 September 1939: Germany declares war on Poland", on day 1
    // (P3: the calendar is politics' history beats, rolled on the first tick).
    step(runner);
    const entry = HISTORY_BEATS.findIndex(
      (b) =>
        b.actor === "DEU" && b.act.kind === "declare" && b.act.target === "POL",
    );
    ww.politics.beats = HISTORY_BEATS.map((_, i) => ({
      fireDay: 1,
      skipped: i !== entry,
      done: false,
    }));
    const launches = watchLaunches(g);
    stepTo(runner, dayStartTick(1, WW_PREP_TICKS) + 1);
    expect(ww.isAtWar(deu.smallID(), pol.smallID())).toBe(true);
    step(runner, WAR_ATTACK_TICKS);
    expect(launches).toEqual([]);
  }, 60_000);

  // The vanilla attack logic below is no longer called in this mode (plan
  // decision 26 leaves its war branches in place): its sizing still holds.
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
