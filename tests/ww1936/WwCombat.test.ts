import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  coveragePermille,
  genBonusPct,
  wwCombatScales,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import type { Player } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { withWwCombat } from "@openfront/engine/ww1936/economy/Combat";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import { playerInfo, setup } from "../util/Setup";
import { byTag, clearStartSetup, HUMAN, step, stepTo, wwRunner } from "./util";

/** Runs through `p`'s processing on `day` (tick dayStart + smallID % 7). */
function throughDay(runner: GameRunner, p: Player, day: number): void {
  stepTo(runner, dayStartTick(day, WW_PREP_TICKS) + (p.smallID() % 7) + 1);
}

/**
 * No recruiting from now on (no manpower, no infantry equipment in
 * reserve), so the army and its field equipment change only by combat.
 */
function noRecruits(ce: CountryEconomy): void {
  ce.manpower = 0;
  EQUIP_KEYS.forEach(([t], k) => {
    if (t === "infantry_equipment") ce.stock[k] = 0;
  });
}

function stockOf(ce: CountryEconomy, type: EquipmentType): number[] {
  const out: number[] = [];
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    out.push(ce.stock[equipKey(type, g)]);
  }
  return out;
}

const HUMANS = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: "HUMAN002", country: "POL" as const },
];

/** Germany and Poland played by humans, without their starting lines. */
async function humansRunner(): Promise<GameRunner> {
  const runner = await wwRunner({}, HUMANS);
  const econ = runner.game.worldWar()!.economy;
  for (const h of HUMANS) {
    const p = byTag(runner.game, h.country);
    clearStartSetup(econ, econ.country(p.smallID())!);
  }
  return runner;
}

describe("the combat bridge (spec §6.5, §10)", () => {
  test("equipment coverage raises attack", async () => {
    const runner = await humansRunner();
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const deu = byTag(g, "DEU");
    const ce = econ.country(deu.smallID())!;
    // From the start stock: support 694‰ (3/3), guns 15/10, AT 8, AA 4,
    // trucks 555‰ (5 speed), light tanks 10/10.
    expect(econ.combatStats(deu.smallID())).toEqual({
      attackPct: 28,
      defensePct: 25,
      speedPct: 15,
    });
    noRecruits(ce);
    throughDay(runner, deu, 0);
    const before = econ.combatStats(deu.smallID());
    const men = econ.armyMen(deu);
    const guns = stockOf(ce, "artillery");
    const units = guns.reduce((a, b) => a + b, 0);
    const genSum = guns.reduce((a, n, i) => a + n * (i + 1), 0);
    const cov = coveragePermille(units, men, EQUIPMENT.artillery.needPer100k);
    const gen = genBonusPct(Math.floor((genSum * 100) / units));
    const school = 100 + ce.tech.gunBonusPct;
    const part = (x: number) =>
      Math.floor((x * cov * gen * school) / 10_000_000);
    // 3,000 guns cover 480,000 men fully.
    expect(cov).toBe(1000);
    expect(part(15)).toBe(15);
    for (let gn = 1; gn <= EQUIPMENT_GENS.artillery; gn++) {
      ce.stock[equipKey("artillery", gn)] = 0;
    }
    throughDay(runner, deu, 1);
    expect(econ.armyMen(deu)).toBe(men);
    expect(econ.combatStats(deu.smallID())).toEqual({
      attackPct: before.attackPct - part(15),
      defensePct: before.defensePct - part(10),
      speedPct: before.speedPct,
    });
  });

  test("combat losses take equipment with them", async () => {
    const runner = await humansRunner();
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const deu = byTag(g, "DEU");
    const ce = econ.country(deu.smallID())!;
    noRecruits(ce);
    throughDay(runner, deu, 0);
    const men = econ.armyMen(deu);
    const lost = Math.floor(men / 10);
    const field = ce.fieldInfUnits;
    const fieldGen = ce.fieldInfGenSum;
    const guns = ce.stock[equipKey("artillery", 1)];
    const support = ce.stock[equipKey("support_equipment", 1)];
    const fighters = ce.stock[equipKey("fighter", 1)];
    expect(men).toBe(480_000);
    // A tenth of the army falls (as AttackExecution reports it).
    econ.noteCombatLoss(deu.smallID(), lost);
    expect(deu.removeTroops(lost)).toBe(lost);
    expect(ce.lossMilli).toBe(lost * 1000);
    throughDay(runner, deu, 1);
    expect(ce.lossMilli).toBe(0);
    // Before the loss the army had `men`: a tenth of the field equipment,
    // half that share of the other ground equipment.
    const fLost = Math.floor((field * lost) / men);
    expect(ce.fieldInfUnits).toBe(field - fLost);
    expect(ce.fieldInfGenSum).toBe(
      fieldGen - Math.floor((fieldGen * fLost) / field),
    );
    expect(ce.stock[equipKey("artillery", 1)]).toBe(
      guns - Math.floor((guns * lost * 50) / (men * 100)),
    );
    expect(ce.fieldInfUnits).toBe(43_200);
    expect(ce.stock[equipKey("artillery", 1)]).toBe(2_850);
    expect(ce.stock[equipKey("support_equipment", 1)]).toBe(
      support - Math.floor(support / 20),
    );
    // Aircraft stay home.
    expect(ce.stock[equipKey("fighter", 1)]).toBe(fighters);
    expect(econ.armyMen(deu)).toBe(men - lost);
  });

  test("an attack's loss scales follow both sides", async () => {
    const runner = await humansRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    const base = { attackerLoss: 1, defenderLoss: 1, attackerSpeed: 1 };
    const s = wwCombatScales(
      ww.economy.combatStats(deu.smallID()),
      ww.economy.combatStats(pol.smallID()),
    );
    expect(withWwCombat(base, ww, deu, pol)).toEqual(s);
    // On top of the other modifiers.
    const other = { attackerLoss: 2, defenderLoss: 0.5, attackerSpeed: 1.5 };
    expect(withWwCombat(other, ww, deu, pol)).toEqual({
      attackerLoss: 2 * s.attackerLoss,
      defenderLoss: 0.5 * s.defenderLoss,
      attackerSpeed: 1.5 * s.attackerSpeed,
    });
    // Germany's equipment: it loses less than the 60% scale, Poland more.
    expect(s.attackerLoss).toBeLessThan(0.6);
    expect(s.defenderLoss).toBeGreaterThan(0.6);
    expect(s.attackerSpeed).toBe(1.15);
    // Nobody to fight, or the mode off: untouched.
    expect(withWwCombat(base, ww, deu, null)).toBe(base);
    expect(withWwCombat(base, null, deu, pol)).toBe(base);
    const vanilla = await setup("plains", { worldWar1936: false }, [
      playerInfo("a", PlayerType.Human),
      playerInfo("b", PlayerType.Human),
    ]);
    expect(vanilla.worldWar()).toBeNull();
    expect(
      withWwCombat(
        base,
        vanilla.worldWar(),
        vanilla.player("a"),
        vanilla.player("b"),
      ),
    ).toBe(base);
  });

  test("attacks report their losses", async () => {
    const runner = await humansRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    const sides = [deu, pol].map((p) => ww.economy.country(p.smallID())!);
    for (const ce of sides) noRecruits(ce);
    // Both processed on day 0, then the war.
    throughDay(runner, pol, 0);
    const field = sides.map((ce) => ce.fieldInfUnits);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    g.addExecution(new AttackExecution(100_000, deu, pol.id(), null));
    step(runner, 2);
    expect(
      deu.outgoingAttacks().filter((a) => a.target() === pol).length,
    ).toBeGreaterThan(0);
    // Both sides' men are noted as they fall...
    const noted = [false, false];
    for (let i = 0; i < 20; i++) {
      step(runner);
      sides.forEach((ce, k) => (noted[k] ||= ce.lossMilli > 0));
    }
    expect(noted).toEqual([true, true]);
    // ...and each day's processing takes field equipment with them.
    throughDay(runner, pol, ww.day(g.ticks()));
    sides.forEach((ce, k) => {
      expect(ce.fieldInfUnits).toBeLessThan(field[k]);
    });
  });

  test("two attacks that meet head-on cost both sides men and equipment", async () => {
    const runner = await humansRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    const [cd, cp] = [deu, pol].map((p) => ww.economy.country(p.smallID())!);
    throughDay(runner, pol, 0);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    g.addExecution(new AttackExecution(60_000, pol, deu.id(), null));
    step(runner);
    const [polAttack] = pol.outgoingAttacks();
    expect(polAttack.troops()).toBe(60_000);
    cd.lossMilli = 0;
    cp.lossMilli = 0;
    // Germany's answer meets Poland's attack (a few hundred of its men fall
    // conquering tiles first): about 60,000 men gone on each side, far more
    // than a tick's fighting over tiles.
    g.addExecution(new AttackExecution(100_000, deu, pol.id(), null));
    step(runner);
    expect(polAttack.isActive()).toBe(false);
    expect(cd.lossMilli).toBeGreaterThan(55_000_000);
    expect(cp.lossMilli).toBeGreaterThan(55_000_000);
  });
});
