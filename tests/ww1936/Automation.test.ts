// World War 1936: automation for a human's country (owner brief
// 2026-10-30). Five switches (production, research, training, air, navy) hand a
// domain to the AI routines on their own cadence; a manual order in a
// domain that is on hands it back with a notice; the switches are state
// (snapshot, restore, hash) and a takeover clears them; [자동 지휘] and
// "every army auto" ride on army_auto.
import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  WW_DAY_SPLIT,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_AUTO_DOMAINS,
  WW_PREP_TICKS,
  wwAutoBit,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { researchBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { aheadPct } from "@openfront/engine-lib/ww1936/EconomyRules";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { autoSet } from "@openfront/engine/ww1936/Automation";
import {
  AI_FALLBACK_AHEAD_PCT,
  aiInput,
  aiResearchOrder,
} from "@openfront/engine/ww1936/economy/AiEconomy";
import { removeLine } from "@openfront/engine/ww1936/economy/Production";
import { cancelResearch } from "@openfront/engine/ww1936/economy/ResearchRun";
import {
  byTag,
  gameHash,
  HUMAN,
  land,
  order,
  pol,
  step,
  stepTo,
  warAfterPrep,
  wwRestore,
  wwRunner,
  wwRunnerCapture,
  type WwHuman,
} from "./util";

const today = (g: Game) => g.worldWar()!.day(g.ticks());
/** Steps until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}
const B = "HUMAN002";
/** Every switch on. */
const ALL = (1 << WW_AUTO_DOMAINS.length) - 1;

async function human(
  humans: WwHuman[] = [{ clientID: HUMAN, country: "DEU" }],
) {
  const { runner, updates } = await wwRunnerCapture(
    { historicalAi: false },
    humans,
  );
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = g.worldWar()!;
  const deu = byTag(g, "DEU").smallID();
  return { runner, updates, g, ww, deu };
}

function setAuto(
  runner: GameRunner,
  domain: (typeof WW_AUTO_DOMAINS)[number],
  on: boolean,
  client = HUMAN,
): void {
  step(runner, 1, [order(client, { kind: "auto_set", domain, on })]);
}

const notices = (updates: GameUpdateViewData[], key: string) =>
  updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent] ?? [])
    .filter((m) => m.message === `events_display.${key}`);

function clearLines(g: Game, id: number): void {
  const econ = g.worldWar()!.economy;
  const ce = econ.country(id)!;
  for (const l of [...ce.lines]) removeLine(econ, ce, l.id);
}

function clearSlots(g: Game, id: number): void {
  const econ = g.worldWar()!.economy;
  const ce = econ.country(id)!;
  ce.slots.forEach((s, i) => {
    if (s !== null) cancelResearch(econ, ce, i);
  });
}

const filled = (g: Game, id: number) =>
  g
    .worldWar()!
    .economy.country(id)!
    .slots.filter((s) => s !== null).length;

describe("World War 1936 automation: the switches", () => {
  it("auto_set is a ww_order: five domains, an on/off, nothing else", () => {
    expect(WW_AUTO_DOMAINS).toEqual([
      "production",
      "research",
      "training",
      "air",
      "navy",
    ]);
    expect(
      WwOrderSchema.safeParse({ kind: "auto_set", domain: "air", on: true })
        .success,
    ).toBe(true);
    for (const bad of [
      { kind: "auto_set", domain: "laws", on: true },
      { kind: "auto_set", domain: "air" },
      { kind: "army_auto_all" },
    ]) {
      expect(WwOrderSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("production: the AI's line planner runs for the human while on, not when off", async () => {
    const { runner, g, ww, deu } = await human();
    const ce = ww.economy.country(deu)!;
    clearLines(g, deu);
    const d0 = today(g);
    finishDay(runner, d0 + 2);
    // Off (the default): the human's factories stay idle.
    expect(ww.autoMask(deu)).toBe(0);
    expect(ce.lines).toEqual([]);
    setAuto(runner, "production", true);
    expect(ww.autoOn(deu, "production")).toBe(true);
    finishDay(runner, d0 + 4);
    expect(ce.lines.length).toBeGreaterThan(0);
    expect(ce.totals.idleMil).toBe(0);
    // Off again: nothing replaces the lines taken away.
    setAuto(runner, "production", false);
    clearLines(g, deu);
    finishDay(runner, d0 + 14);
    expect(ce.lines).toEqual([]);
  }, 120_000);

  it("research: every free slot takes the AI's next tech while on, not when off", async () => {
    const { runner, g, ww, deu } = await human();
    clearSlots(g, deu);
    const d0 = today(g);
    finishDay(runner, d0 + 2);
    expect(filled(g, deu)).toBe(0);
    setAuto(runner, "research", true);
    finishDay(runner, d0 + 4);
    const ce = ww.economy.country(deu)!;
    expect(filled(g, deu)).toBe(ce.totals.slotCount);
    setAuto(runner, "research", false);
    clearSlots(g, deu);
    finishDay(runner, d0 + 14);
    expect(filled(g, deu)).toBe(0);
  }, 120_000);

  // Live report 2026-10-30 ("연구 칸 비었는데 연구 안하는데?"): the AI's
  // research waits for a tech's year (AI_MAX_AHEAD_PCT, at most
  // AI_FALLBACK_AHEAD_PCT early), so a human Germany with auto research on
  // that had done its 1936 techs sat with every slot empty for months
  // (on the test map: Nov 1936 to Mar 1937). The hand-over fills them.
  it("research: auto research fills every slot even when nothing is close to its year", async () => {
    const { runner, g, ww, deu } = await human();
    const fra = byTag(g, "FRA").smallID();
    const d0 = today(g);
    // Every tech of 1936 done: what is left is a year early or more.
    for (const id of [deu, fra]) {
      const ce = ww.economy.country(id)!;
      for (const t of WW_TECH_IDS) {
        if (WW_TECHS[t].year <= 1936 && WW_TECHS[t].retired !== true) {
          ce.addTech(t);
        }
      }
      clearSlots(g, id);
    }
    // Nothing the AI would start is left: every other tech is too early.
    const deuCe = ww.economy.country(deu)!;
    for (const t of WW_TECH_IDS) {
      if (WW_TECHS[t].retired === true || deuCe.researched.has(t)) continue;
      expect(aheadPct(WW_TECHS[t].year, d0 + 1)).toBeGreaterThan(
        AI_FALLBACK_AHEAD_PCT,
      );
    }
    setAuto(runner, "research", true);
    finishDay(runner, d0 + 1);
    expect(filled(g, deu)).toBe(deuCe.totals.slotCount);
    for (const s of deuCe.slots) {
      expect(WW_TECHS[s!.tech].year).toBeGreaterThan(1936);
    }
    // An AI country still waits for its techs' year (the AI's own balance,
    // left as it was: the pinned all-AI games do not move).
    expect(filled(g, fra)).toBe(0);
  }, 120_000);

  it("research: past the AI's own list, auto research takes any tech the country may start", async () => {
    const { runner, g, ww, deu } = await human();
    const ce = ww.economy.country(deu)!;
    const coastal = aiInput(ww.economy, ce, today(g), g.ticks()).coastal;
    const list = new Set(aiResearchOrder("DEU", coastal ?? true));
    for (const t of list) ce.addTech(t);
    clearSlots(g, deu);
    const startable = () =>
      WW_TECH_IDS.filter(
        (t) =>
          researchBlockOf(
            {
              researched: ce.researched,
              slots: ce.slots.map((x) => x?.tech ?? null),
              slotCount: ce.totals.slotCount,
            },
            t,
          ) === null,
      );
    const left = startable();
    expect(left.length).toBeGreaterThan(0);
    for (const t of left) expect(list.has(t)).toBe(false);
    setAuto(runner, "research", true);
    finishDay(runner, today(g) + 1);
    expect(filled(g, deu)).toBe(Math.min(ce.totals.slotCount, left.length));
    for (const s of ce.slots) {
      if (s !== null) expect(list.has(s.tech)).toBe(false);
    }
  }, 120_000);

  it("training: the AI trains the human's divisions while on, not when off", async () => {
    const { runner, g, ww, deu } = await human();
    const cl = land(g).country(deu)!;
    // Men and equipment for it (the 1936 stock holds no spare division).
    const ce = ww.economy.country(deu)!;
    ce.manpower += 1_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 10_000;
    const entries = () =>
      [
        ...cl.training.map((e) => e.id),
        ...cl.trainees.map((x) => x.entry),
      ].sort((a, b) => a - b);
    const d0 = today(g);
    // At peace the AI's land day comes every tenth day (AiLand).
    finishDay(runner, d0 + 11);
    expect(entries()).toEqual([]);
    setAuto(runner, "training", true);
    finishDay(runner, d0 + 22);
    const trained = entries();
    expect(trained.length).toBeGreaterThan(0);
    setAuto(runner, "training", false);
    finishDay(runner, d0 + 44);
    // Nothing new queued once it is off.
    for (const id of entries()) expect(trained).toContain(id);
  }, 120_000);

  it("air: the AI places the human's wings in every zone while on, not when off", async () => {
    const { runner, g, ww, deu } = await human();
    warAfterPrep(runner, HUMAN, "POL");
    const d0 = today(g);
    finishDay(runner, d0 + 6);
    expect(ww.air.deploymentsOf(deu)).toEqual([]);
    setAuto(runner, "air", true);
    finishDay(runner, d0 + 12);
    const placed = ww.air.deploymentsOf(deu);
    expect(placed.length).toBeGreaterThan(0);
    // The AI's own paradrops (raising paratroopers) stay out of it.
    expect(land(g).country(deu)!.training).toEqual([]);
    // Off: what is out stays, nothing new goes out or comes back.
    setAuto(runner, "air", false);
    const ids = placed.map((d) => d.id).sort((a, b) => a - b);
    for (const d of placed) {
      step(runner, 1, [order(HUMAN, { kind: "air_recall", sr: d.sr })]);
    }
    expect(ww.air.deploymentsOf(deu)).toEqual([]);
    finishDay(runner, d0 + 30);
    expect(ww.air.deploymentsOf(deu)).toEqual([]);
    expect(ids.length).toBeGreaterThan(0);
  }, 120_000);

  it("a manual order in a domain that is on switches it off, with a notice, and applies", async () => {
    const { runner, updates, g, ww, deu } = await human();
    for (const d of WW_AUTO_DOMAINS) setAuto(runner, d, true);
    expect(ww.autoMask(deu)).toBe(ALL);
    clearSlots(g, deu);
    // The human picks a tech themselves before the AI's next day.
    const ce = ww.economy.country(deu)!;
    const pick = WW_TECH_IDS.find(
      (t) =>
        researchBlockOf(
          {
            researched: ce.researched,
            slots: ce.slots.map((x) => x?.tech ?? null),
            slotCount: ce.totals.slotCount,
          },
          t,
        ) === null,
    )!;
    step(runner, 1, [order(HUMAN, { kind: "research", tech: pick })]);
    expect(ww.autoOn(deu, "research")).toBe(false);
    expect(ce.slots.some((s) => s?.tech === pick)).toBe(true);
    expect(notices(updates, "ww1936_auto_off_research")).toHaveLength(1);
    // The other domains stay with the AI.
    expect(ww.autoMask(deu)).toBe(ALL & ~wwAutoBit("research"));
    // A line order hands production back the same way.
    step(runner, 1, [
      order(HUMAN, { kind: "remove_line", line: ce.lines[0].id }),
    ]);
    expect(ww.autoOn(deu, "production")).toBe(false);
    expect(notices(updates, "ww1936_auto_off_production")).toHaveLength(1);
    // A domain that is off: no notice.
    step(runner, 1, [
      order(HUMAN, { kind: "remove_line", line: ce.lines[0].id }),
    ]);
    expect(notices(updates, "ww1936_auto_off_production")).toHaveLength(1);
    // An order of no domain (a law) leaves the switches alone.
    step(runner, 1, [
      order(HUMAN, {
        kind: "set_law",
        law: "economy",
        value: "early_mobilization",
      }),
    ]);
    expect(ww.autoMask(deu)).toBe(
      wwAutoBit("training") | wwAutoBit("air") | wwAutoBit("navy"),
    );
  }, 120_000);

  it("automation never declares war, joins a faction, picks a focus or spends political power", async () => {
    const off = await human();
    const on = await human();
    for (const d of WW_AUTO_DOMAINS) setAuto(on.runner, d, true);
    step(off.runner, WW_AUTO_DOMAINS.length);
    const d0 = today(on.g);
    for (let d = d0; d <= d0 + 60; d++) {
      finishDay(on.runner, d);
      finishDay(off.runner, d);
    }
    const deu = on.deu;
    const a = pol(on.g).country(deu)!;
    const b = pol(off.g).country(deu)!;
    expect(on.ww.autoMask(deu)).toBe(ALL);
    // The AI did run the human's economy...
    expect(gameHash(on.runner)).not.toBe(gameHash(off.runner));
    // ...but nothing of politics moved.
    expect(a.ppMilli).toBe(b.ppMilli);
    expect(a.focus).toEqual(b.focus);
    expect(on.ww.economy.country(deu)!.laws).toEqual(
      off.ww.economy.country(deu)!.laws,
    );
    expect(on.ww.enemiesOf(deu)).toEqual(off.ww.enemiesOf(deu));
    expect(on.ww.enemiesOf(deu)).toEqual([]);
    expect(on.ww.factionOf(deu)).toBe(off.ww.factionOf(deu));
    expect(on.ww.economy.country(deu)!.queue).toEqual(
      off.ww.economy.country(deu)!.queue,
    );
  }, 240_000);

  it("the order is the sender's own: another country's switches never move", async () => {
    const { runner, ww, g, deu } = await human([
      { clientID: HUMAN, country: "DEU" },
      { clientID: B, country: "POL" },
    ]);
    const pl = byTag(g, "POL").smallID();
    // A crafted order naming Poland still sets the sender's own (zod drops
    // the extra field; the order has no country).
    step(runner, 1, [
      order(HUMAN, {
        kind: "auto_set",
        domain: "production",
        on: true,
        smallID: pl,
      } as never),
    ]);
    expect(ww.autoOn(deu, "production")).toBe(true);
    expect(ww.autoMask(pl)).toBe(0);
    setAuto(runner, "air", true, B);
    expect(ww.autoMask(pl)).toBe(wwAutoBit("air"));
    expect(ww.autoMask(deu)).toBe(wwAutoBit("production"));
    // An AI country cannot take one (the judge asks for a human).
    const fra = byTag(g, "FRA").smallID();
    expect(autoSet(ww, fra, "research", true)).toBe("not_controlled");
    expect(ww.autoMask(fra)).toBe(0);
  }, 120_000);

  it("a takeover clears the switches of both countries; an AI country ignores any", async () => {
    const { ww, g, deu } = await human();
    const fra = byTag(g, "FRA").smallID();
    for (const d of WW_AUTO_DOMAINS) ww.setAuto(deu, d, true);
    // Set by hand on an AI country: the AI runs it all anyway.
    ww.setAuto(fra, "air", true);
    expect(ww.autoOn(fra, "air")).toBe(false);
    ww.endgame.setControl(HUMAN, fra);
    expect(ww.isHumanControlled(fra)).toBe(true);
    expect(ww.isHumanControlled(deu)).toBe(false);
    expect(ww.autoMask(fra)).toBe(0);
    expect(ww.autoMask(deu)).toBe(0);
    expect(ww.data().auto).toBeUndefined();
  }, 120_000);

  it("the lobby difficulty's handicap never reaches a human's automation", async () => {
    const easy = await wwRunner(
      { historicalAi: false, difficulty: Difficulty.Easy },
      [{ clientID: HUMAN, country: "DEU" }],
    );
    stepTo(easy, WW_PREP_TICKS + 1);
    const ww = easy.game.worldWar()!;
    const deu = byTag(easy.game, "DEU").smallID();
    const p = pol(easy.game);
    p.recomputeStats(deu);
    const off = { ...p.stats(deu) };
    for (const d of WW_AUTO_DOMAINS) ww.setAuto(deu, d, true);
    p.recomputeStats(deu);
    expect({ ...p.stats(deu) }).toEqual(off);
    expect(ww.aiLevel).toBe("easy");
  }, 120_000);

  it("snapshot and restore with the switches on stay in lockstep", async () => {
    const humans = [{ clientID: HUMAN, country: "DEU" as const }];
    const runner = await wwRunner({ historicalAi: false }, humans);
    stepTo(runner, WW_PREP_TICKS + 1);
    const g = runner.game;
    const deu = byTag(g, "DEU").smallID();
    for (const d of WW_AUTO_DOMAINS) setAuto(runner, d, true);
    // An auto army too.
    const a = land(g).armiesOf(deu)[0];
    step(runner, 1, [
      order(HUMAN, { kind: "army_auto", army: a.id, on: true }),
    ]);
    clearLines(g, deu);
    clearSlots(g, deu);
    stepTo(runner, g.ticks() + 40);
    const restored = await wwRestore(runner, humans);
    const ww2 = restored.game.worldWar()!;
    expect(ww2.autoMask(deu)).toBe(ALL);
    expect(ww2.data().auto).toEqual([{ smallID: deu, mask: ALL }]);
    expect(gameHash(restored)).toBe(gameHash(runner));
    // Twelve days, tick by tick: the AI's turns and reactions for the human.
    const end = g.ticks() + 12 * 30;
    while (g.ticks() < end) {
      step(runner);
      step(restored);
      expect(gameHash(restored)).toBe(gameHash(runner));
    }
    expect(g.worldWar()!.economy.country(deu)!.lines.length).toBeGreaterThan(0);
  }, 240_000);

  it("the switches are in the hash only while one is on", async () => {
    const { runner, ww, deu } = await human();
    const h0 = ww.hash();
    ww.setAuto(deu, "research", true);
    expect(ww.hash()).not.toBe(h0);
    ww.setAuto(deu, "research", false);
    expect(ww.hash()).toBe(h0);
    expect(ww.snapshot().auto).toBeUndefined();
    void runner;
  }, 120_000);
});

describe("World War 1936 automation: auto army command", () => {
  it("[자동 지휘] turns one army's auto on and off; army_auto_all does every army", async () => {
    const { runner, g, deu } = await human();
    const l = land(g);
    const armies = l.armiesOf(deu);
    expect(armies.length).toBeGreaterThan(1);
    const a = armies[0];
    step(runner, 1, [
      order(HUMAN, { kind: "army_auto", army: a.id, on: true }),
    ]);
    expect(a.auto).toBe(true);
    step(runner, 1, [
      order(HUMAN, { kind: "army_auto", army: a.id, on: false }),
    ]);
    expect(a.auto).toBe(false);
    step(runner, 1, [order(HUMAN, { kind: "army_auto_all", on: true })]);
    expect(l.armiesOf(deu).every((x) => x.auto)).toBe(true);
    step(runner, 1, [order(HUMAN, { kind: "army_auto_all", on: false })]);
    expect(l.armiesOf(deu).some((x) => x.auto)).toBe(false);
    // Another country's armies are not the sender's.
    const pl = byTag(g, "POL").smallID();
    expect(l.armiesOf(pl).some((x) => x.auto)).toBe(false);
  }, 120_000);

  it("a manual order to an auto army turns its auto off, with a notice", async () => {
    const { runner, updates, g, deu } = await human();
    const l = land(g);
    const a = l.armiesOf(deu)[0];
    step(runner, 1, [order(HUMAN, { kind: "army_auto_all", on: true })]);
    step(runner, 1, [order(HUMAN, { kind: "army_halt", army: a.id })]);
    expect(a.auto).toBe(false);
    const n = notices(updates, "ww1936_auto_army_off");
    expect(n).toHaveLength(1);
    expect(n[0].params).toEqual({ army: a.nameNo });
    // The other armies keep theirs; turning auto off by hand is no hand-over.
    expect(
      l
        .armiesOf(deu)
        .filter((x) => x.id !== a.id)
        .every((x) => x.auto),
    ).toBe(true);
    const b = l.armiesOf(deu).find((x) => x.id !== a.id)!;
    step(runner, 1, [
      order(HUMAN, { kind: "army_auto", army: b.id, on: false }),
    ]);
    expect(notices(updates, "ww1936_auto_army_off")).toHaveLength(1);
  }, 120_000);

  it("an auto army with no front at war gets one from the engine", async () => {
    const { runner, g, deu } = await human();
    warAfterPrep(runner, HUMAN, "POL");
    const l = land(g);
    const a = l.armiesOf(deu).find((x) => x.order.kind === "idle")!;
    expect(a.front).toEqual([]);
    step(runner, 1, [
      order(HUMAN, { kind: "army_auto", army: a.id, on: true }),
    ]);
    const d0 = today(g);
    finishDay(runner, d0 + 2);
    expect(["front", "plan", "move"]).toContain(a.order.kind);
    expect(a.auto).toBe(true);
  }, 120_000);
});
