import type { TileRef } from "@openfront/engine-api/game/GameMap";
import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import type { Execution, Game, Player } from "@openfront/engine/game/Game";
import { byTag, step, stepTo, wwRunner } from "./util";

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
      if (e instanceof AttackExecution) {
        const a = e as unknown as { _owner: Player; _targetID: string | null };
        kind = "attack";
        owner = a._owner;
        const id = a._targetID;
        if (id !== null && id !== g.terraNullius().id() && g.hasPlayer(id)) {
          target = g.player(id);
        }
      } else if (e instanceof TransportShipExecution) {
        const b = e as unknown as { attacker: Player; ref: TileRef };
        kind = "boat";
        owner = b.attacker;
        const o = g.owner(b.ref);
        target = o.isPlayer() ? o : null;
      }
      if (owner !== null && target !== null) {
        out.push({
          what: `${kind} ${tag(owner)}>${tag(target)}`,
          atWar: owner.canAttackPlayer(target),
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

  test("on Hard, a war over many minutes launches nothing at a country at peace", async () => {
    const runner = await wwRunner({
      historicalAi: false,
      difficulty: Difficulty.Hard,
    });
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
    const runner = await wwRunner({
      historicalAi: false,
      difficulty: Difficulty.Hard,
    });
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
});
