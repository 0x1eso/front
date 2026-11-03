// World War 1936 ww9 integration: on the real world1936 map, one seed, the
// thought sliders and the removal of command power run together: a human's
// drag drifts, the AI moves by situation, traits and medals come by
// themselves, a restored game keeps lockstep with sliders moving.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  GENERAL_TRAITS,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import { THOUGHT_DRIFT_MILLI } from "@openfront/engine-api/ww1936/ThoughtTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  NEW_GENERAL_TRAITS,
  traitSlots,
} from "@openfront/engine-lib/ww1936/CommandRules";
import { thoughtNotch } from "@openfront/engine-lib/ww1936/ThoughtRules";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  type GameRunner,
} from "@openfront/engine/GameRunner";
import { landRowOf } from "@openfront/engine/ww1936/depth/AiCommand";
import {
  startPosOf,
  thoughtStatsOf,
} from "@openfront/engine/ww1936/depth/Thought";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import { SAMPLES } from "./depthOrderSamples";
import { cloneFiles, worldFiles } from "./lockstep";
import { gameHash, order, step, stepTo, wwGameStart } from "./util";

const YEARS_DAYS = 1095;
const WHO = "HUMANITA";
const HUMANS = [{ clientID: WHO, country: "ITA" as const }];
const MAJORS = ["DEU", "SUN", "GBR", "FRA", "USA", "JPN", "ITA"] as const;

function maxBattleDaysOf(
  ww: NonNullable<ReturnType<GameRunner["game"]["worldWar"]>>,
  d: WwDepth,
): number {
  let most = 0;
  for (let id = 1; id < d.cap; id++) {
    for (const g of ww.land.country(id)?.generals ?? []) {
      most = Math.max(most, g.use[0] + g.use[1]);
    }
  }
  return most;
}

describe("thought sliders and no command power, together on world1936", () => {
  it("three game years", { timeout: 1_500_000 }, async () => {
    let cpInUpdates = 0;
    let depthUpdates = 0;
    const files = await worldFiles();
    const runner = await createGameRunner(
      wwGameStart({}, HUMANS),
      undefined,
      cloneFiles(files),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
        const u = gu.updates[GameUpdateType.WwDepth];
        if (u === undefined || u.length === 0) return;
        depthUpdates++;
        if (depthUpdates % 200 === 1 && JSON.stringify(u).includes("cpMilli")) {
          cpInUpdates++;
        }
      },
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const idOf = (t: string) => ww.scenario.smallIdOf(t as never);
    const ITA = idOf("ITA");
    const th = d.country(ITA)!.th;

    // Nations start at different positions, and their officer corps differ.
    const starts = MAJORS.map((t) => d.country(idOf(t))!.th.curMilli.join());
    expect(new Set(starts).size).toBe(MAJORS.length);
    const rows = new Set(MAJORS.map((t) => landRowOf(startPosOf(d, idOf(t)))));
    expect(rows.size).toBeGreaterThanOrEqual(3);

    // Command power: gone from state, the medal order refused, marshal PP only, traits not bought.
    expect(d.country(ITA)!.cmd).not.toHaveProperty("cpMilli");
    const tick = () => runner.game.ticks();
    expect(d.issue(ITA, SAMPLES.medal_award as never, tick())).toBe(
      "bad_index",
    );
    const cl = ww.land.country(ITA)!;
    for (const g of cl.generals) {
      expect(
        d.issue(
          ITA,
          {
            kind: "trait_assign",
            general: g.id,
            trait: "artillery_officer",
            admiral: false,
          },
          tick(),
        ),
      ).toBe("bad_index");
    }
    const pol = ww.politics.country(ITA)!;
    pol.ppMilli = 100_000;
    const fm = cl.generals.find((g) => g.army !== 0) ?? cl.generals[0];
    fm.level = 3;
    expect(
      d.issue(
        ITA,
        { kind: "promote_fm", general: fm.id, trait: "fm_thorough" },
        tick(),
      ),
    ).toBeNull();
    expect(pol.ppMilli).toBe(75_000);

    // A human drags off_def: the target jumps, the position does not.
    const from = th.curMilli[0];
    const other = th.target[1];
    step(runner, 1, [
      order(WHO, { kind: "thought_set", slider: "off_def", pos: 8 }),
    ]);
    expect(th.target[0]).toBe(8);
    expect(Math.abs(th.curMilli[0] - from)).toBeLessThanOrEqual(
      THOUGHT_DRIFT_MILLI,
    );

    const sent: { to: number; key: string; p: Record<string, unknown> }[] = [];
    const real = d.message.bind(d);
    d.message = (to, key, p = {}) => {
      sent.push({ to, key, p });
      real(to, key, p);
    };

    let maxStep = 0;
    let maxStatJump = 0;
    let arrivedDay = -1;
    let statChanges = 0;
    let statFollowed = 0;
    const firstDay = ww.day(tick());
    const stat0 = thoughtStatsOf(d, ITA).defensePct ?? 0;
    const aiMoves = new Map<string, number>(MAJORS.map((t) => [t, 0]));
    const aiStep = new Map<string, number>();
    const medals = new Set<number>();
    for (let day = firstDay; day < YEARS_DAYS; day++) {
      const before = th.curMilli[0];
      const statBefore = thoughtStatsOf(d, ITA).defensePct ?? 0;
      const ceBefore = ww.economy.country(ITA)!.stats.defensePct ?? 0;
      const targets = MAJORS.map((t) => [...d.country(idOf(t))!.th.target]);
      const cur = MAJORS.map((t) => [...d.country(idOf(t))!.th.curMilli]);
      stepTo(runner, dayStartTick(day + 1, ww.prepEndTick()));
      maxStep = Math.max(maxStep, Math.abs(th.curMilli[0] - before));
      const statNow = thoughtStatsOf(d, ITA).defensePct ?? 0;
      if (statNow !== statBefore) {
        statChanges++;
        maxStatJump = Math.max(maxStatJump, Math.abs(statNow - statBefore));
        const ce = ww.economy.country(ITA)!.stats.defensePct ?? 0;
        if (ce - ceBefore === statNow - statBefore) statFollowed++;
      }
      if (arrivedDay < 0 && th.curMilli[0] === 8000) arrivedDay = day;
      MAJORS.forEach((t, i) => {
        const c = d.country(idOf(t))!.th;
        if (c.target.some((v, s) => v !== targets[i][s])) {
          aiMoves.set(t, aiMoves.get(t)! + 1);
        }
        c.curMilli.forEach((v, s) => {
          const dm = Math.abs(v - cur[i][s]);
          aiStep.set(t, Math.max(aiStep.get(t) ?? 0, dm));
        });
      });
      for (const a of ww.land.armies.values()) {
        if (a.medal > 0) medals.add(a.id);
      }
    }

    // The drift: 0.1 a day, the stats follow it step by step.
    expect(maxStep).toBeGreaterThanOrEqual(THOUGHT_DRIFT_MILLI);
    expect(maxStep).toBeLessThanOrEqual(THOUGHT_DRIFT_MILLI * 2);
    expect(arrivedDay).toBeGreaterThan(firstDay);
    expect(thoughtNotch(th.curMilli[0])).toBe(8);
    expect(statChanges).toBeGreaterThan(3);
    expect(statFollowed).toBeGreaterThan(0);
    const stat1 = thoughtStatsOf(d, ITA).defensePct ?? 0;
    expect(Math.abs(stat1 - stat0)).toBeGreaterThan(maxStatJump * 2);
    // A human with the auto switch off is not moved.
    expect(th.target[1]).toBe(other);

    // The AI moves by situation, at the same speed.
    const movedAi = MAJORS.filter((t) => t !== "ITA" && aiMoves.get(t)! > 0);
    expect(movedAi.length).toBeGreaterThanOrEqual(4);
    expect(aiMoves.get("ITA")).toBe(0);

    // Automatic traits and medals, with the notice. Before the world war no
    // general reaches 60 battle days, so one is given them; the rule's own day runs.
    const heldOf = (traits: number) =>
      GENERAL_TRAITS.filter((t) => (traits & traitBit(t)) !== 0).length;
    const vet = MAJORS.flatMap(
      (t) => ww.land.country(idOf(t))?.generals ?? [],
    ).find((g) => !g.fm && heldOf(g.traits) < traitSlots(g.level))!;
    const naturalBattleDays = maxBattleDaysOf(ww, d);
    const vetTraits = heldOf(vet.traits);
    vet.use[0] = 600;
    stepTo(runner, dayStartTick(YEARS_DAYS + 1, ww.prepEndTick()));
    expect(heldOf(vet.traits)).toBe(vetTraits + 1);
    const autoTraits = sent.filter(
      (m) =>
        m.key === "ww1936_trait_unlocked" &&
        NEW_GENERAL_TRAITS[m.p.trait as keyof typeof NEW_GENERAL_TRAITS]
          ?.kind === "assign",
    );
    const medalNotes = sent.filter((m) => m.key === "ww1936_medal_auto");
    expect(autoTraits.length).toBeGreaterThan(0);
    expect(medalNotes.length).toBeGreaterThan(0);
    expect(typeof medalNotes[0].p.army).toBe("number");
    expect(cpInUpdates).toBe(0);
    expect(depthUpdates).toBeGreaterThan(0);

    // Snapshot and restore in lockstep, with sliders moving.
    const twin = await createGameRunnerFromSnapshot(
      wwGameStart({}, HUMANS),
      runner.snapshot(),
      undefined,
      cloneFiles(files),
      () => {},
    );
    expect(gameHash(twin)).toBe(gameHash(runner));
    const drag = order(WHO, {
      kind: "thought_set",
      slider: "off_def",
      pos: -8,
    });
    step(runner, 1, [drag]);
    step(twin, 1, [drag]);
    const lockTicks = 400;
    const notchesThen = th.curMilli[0];
    let judged = 0;
    for (let i = 0; i < lockTicks; i++) {
      const t0 = MAJORS.map((t) => d.country(idOf(t))!.th.target.join()).join();
      step(runner);
      step(twin);
      expect(gameHash(twin)).toBe(gameHash(runner));
      const t1 = MAJORS.map((t) => d.country(idOf(t))!.th.target.join()).join();
      if (t0 !== t1) judged++;
    }
    expect(th.curMilli[0]).toBeLessThan(notchesThen);
    const dt = twin.game.worldWar()!.depth;
    expect(dt.country(ITA)!.th).toEqual(th);

    console.log(
      "WW9-INT",
      JSON.stringify({
        days: YEARS_DAYS,
        date: ww.day(tick()),
        maxStep,
        arrivedDays: arrivedDay - firstDay,
        statChanges,
        statFollowed,
        maxStatJump,
        stat0,
        stat1,
        starts: Object.fromEntries(
          MAJORS.map((t, i) => [
            t,
            starts[i]
              .split(",")
              .map((x) => Number(x) / 1000)
              .join(" "),
          ]),
        ),
        rows: [...rows],
        aiMoves: Object.fromEntries(aiMoves),
        aiStep: Object.fromEntries(aiStep),
        ends: Object.fromEntries(
          MAJORS.map((t) => [t, d.country(idOf(t))!.th.target.join(" ")]),
        ),
        naturalBattleDays,
        autoTraits: autoTraits.length,
        medalNotes: medalNotes.length,
        medalArmies: medals.size,
        depthUpdates,
        cpInUpdates,
        judgedInLockstep: judged,
        lockTicks,
      }),
    );
  });
});
