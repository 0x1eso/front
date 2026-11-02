import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { DoctrineModel } from "../../../src/client/hud/ww1936/DoctrineModel";
import { doctrineGame } from "./DoctrineFixture";
import { detail } from "./EconomyFixture";
import { general, landDetail } from "./LandFixture";

const base = {
  details: [detail("DEU")],
  landDetails: [landDetail("DEU", { armyXpMilli: 150_000 })],
};
const zeros = () => new Array<number>(9).fill(0);

describe("DoctrineModel thought sliders (ww9 design §11)", () => {
  it("shows each service's three sliders with the actual position, the target and the days", () => {
    const target = zeros();
    const curMilli = zeros();
    target[0] = -4;
    curMilli[0] = -1_000;
    const m = new DoctrineModel(
      doctrineGame({ ...base, detail: { thought: { target, curMilli } } })
        .game as never,
    );
    expect(m.sliders(0).map((s) => s.id)).toEqual([
      "off_def",
      "mob_fire",
      "quant_qual",
    ]);
    expect(m.sliders(1)).toHaveLength(3);
    expect(m.sliders(2)).toHaveLength(3);
    const s = m.sliders(0)[0];
    expect(s).toMatchObject({ target: -4, notch: -1, moving: true });
    // 3000 milli at 100 a day.
    expect(s.days).toBe(30);
    // Offence is the left end: it shows the actual value and the target's.
    expect(s.left.lines[0].goal).not.toBe("");
    expect(s.left.star.lit).toBe(false);
    // Resting sliders show one value and no days.
    const rest = m.sliders(0)[1];
    expect(rest.moving).toBe(false);
    expect(rest.days).toBe(0);
    expect(rest.left.lines[0].goal).toBe("");
  });

  it("a star lights at nine notches, and a drag previews the target", () => {
    const curMilli = zeros();
    curMilli[1] = 9_000;
    const m = new DoctrineModel(
      doctrineGame({
        ...base,
        detail: { thought: { curMilli, target: [0, 9, 0, 0, 0, 0, 0, 0, 0] } },
      }).game as never,
    );
    const s = m.sliders(0)[1];
    expect(s.right.star.lit).toBe(true);
    expect(s.left.star.lit).toBe(false);
    const dragged = m.sliders(0, new Map([[1, 3]]))[1];
    expect(dragged.target).toBe(3);
    expect(dragged.moving).toBe(true);
    expect(dragged.days).toBe(60);
    expect(m.thoughtOrder(1, 3)).toEqual({
      kind: "thought_set",
      slider: "mob_fire",
      pos: 3,
    });
  });

  it("the dock ring shows only while a slider moves, and there is no badge", () => {
    const rest = new DoctrineModel(doctrineGame(base).game as never);
    expect(rest.thoughtDial()).toEqual({ moving: 0, progress: 0 });
    const target = zeros();
    target[4] = 5;
    const moving = new DoctrineModel(
      doctrineGame({ ...base, detail: { thought: { target } } }).game as never,
    ).thoughtDial()!;
    expect(moving.moving).toBe(1);
    expect(moving.progress).toBeGreaterThan(0);
    expect(Object.keys(moving).sort()).toEqual(["moving", "progress"]);
  });

  it("the band carries no command power chip", () => {
    const g = doctrineGame({
      ...base,
      summary: { energyPm: 920, atomicStock: 2 },
    });
    const b = new DoctrineModel(g.game as never).band()!;
    expect(b).not.toHaveProperty("cpText");
    expect(b.energyPct).toBe(92);
    expect(b.nukes).toBe(2);
    expect(b.congressPct).toBeNull();
    const full = new DoctrineModel(doctrineGame(base).game as never).band()!;
    expect(full.energyPct).toBeNull();
    expect(full.nukes).toBeNull();
  });
});

describe("DoctrineModel command screen (design §12)", () => {
  it("traits are paid in army or navy XP; marshals and spirits use the engine's rules", () => {
    const g = doctrineGame({
      details: [detail("DEU")],
      landDetails: [
        landDetail("DEU", {
          armyXpMilli: 150_000,
          generals: [
            general(1, { key: "bock", level: 3 }),
            general(2, {
              key: "kluge",
              level: 3,
              fm: true,
              fmTraits: 1,
              army: -1,
            }),
          ],
        }),
      ],
      detail: {
        doctrine: { xp: [150, 40, 7] },
        command: { medalCooldown: [[5, 40]] },
      },
    });
    const m = new DoctrineModel(g.game as never);
    const people = m.commandPeople();
    expect(people.map((p) => p.id)).toEqual([1]);
    const trickster = people[0].candidates.find((c) => c.trait === "trickster");
    expect(trickster).toEqual({ trait: "trickster", xp: 40, block: null });
    expect(m.fmTraitBlock(2, "fm_thorough")).toBe(null);
    expect(m.fmTraitBlock(1, "fm_thorough")).toBe("no_slot");
    expect(m.spiritBlock(0, 0)).toBe(null);
    expect(m.spiritBlock(0, 5)).toBe("bad_index");
    expect(m.medalRows().every((r) => r.days > 0)).toBe(true);
  });

  it("a trait the army cannot pay for says no_xp", () => {
    const g = doctrineGame({
      details: [detail("DEU")],
      landDetails: [
        landDetail("DEU", {
          generals: [general(1, { key: "bock", level: 3 })],
        }),
      ],
      detail: { doctrine: { xp: [10, 40, 7] } },
    });
    const c = new DoctrineModel(g.game as never)
      .commandPeople()[0]
      .candidates.find((x) => x.trait === "trickster");
    expect(c?.block).toBe("no_xp");
  });
});
