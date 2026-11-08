// P4 Task 10 (lane AI): the AI's air turn days and its paradrops (spec
// §14.10, §17.3, §17.6). The rest of the old air AI's tests went with the
// old daily air model; AiWings.test.ts tests the wing planner.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { NAVAL_BEATS } from "@openfront/engine-lib/ww1936/NavalBeats";
import {
  aiAirDue,
  aiParadrops,
  aiParadropScore,
  isParaArmy,
} from "@openfront/engine/ww1936/air/AiAir";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import {
  clearLand,
  HUMAN,
  placeArmy,
  step,
  warAfterPrep,
  wwRunner,
} from "./util";

test("the air AI's days: every 5 days at war, 10 at peace, by country", () => {
  expect(aiAirDue(1, 4, true)).toBe(true);
  expect(aiAirDue(1, 5, true)).toBe(false);
  expect(aiAirDue(1, 9, false)).toBe(true);
  expect(aiAirDue(1, 4, false)).toBe(false);
});

describe("the AI's paradrops (lane AI review; spec §14.10, §17.6)", () => {
  test("a target's score: empty cities, or a beat's target ×10", () => {
    expect(aiParadropScore({ vp: 21, divisions: 0, beat: false })).toBe(2600);
    expect(aiParadropScore({ vp: 21, divisions: 1, beat: false })).toBe(0);
    expect(aiParadropScore({ vp: 3, divisions: 1, beat: true })).toBe(2000);
  });

  test("a paratrooper army drops on an empty enemy city under its own sky", async () => {
    // ww1936sea: an AI Germany at war with a human Poland, the board
    // cleared; two paratrooper divisions in Berlin (an air base), the
    // transports in stock. The air AI takes the sky over the east, then
    // the paradrop planner drops on Warsaw (21 points, empty).
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "POL" }],
      SEA.map,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const land = ww.land;
    const deu = TAG_ID.DEU;
    const ce = ww.economy.country(deu)!;
    for (const t of [
      "mountaineers",
      "paratroopers",
      "transport_plane_1",
    ] as const) {
      ce.addTech(t);
    }
    const cl = land.country(deu)!;
    const tpl = cl.nextTemplateId;
    expect(
      land.issue(
        deu,
        {
          kind: "template_save",
          template: 0,
          base: 0,
          name: "",
          battalions: [
            "paratrooper",
            "paratrooper",
            "paratrooper",
            "paratrooper",
          ],
          support: [],
        },
        "ai",
      ),
    ).toBeNull();
    clearLand(g);
    const army = placeArmy(g, "DEU", REGION.berlin, 2, tpl);
    expect(isParaArmy(land, army)).toBe(true);
    ce.stock[equipKey("transport_plane", 1)] = 500;
    const drops: number[] = [];
    const issue = land.issue.bind(land);
    land.issue = (id, o, by) => {
      const r = issue(id, o, by);
      if (id === deu && o.kind === "paradrop" && r === null)
        drops.push(o.region);
      return r;
    };
    warAfterPrep(runner, HUMAN, "DEU");
    const end = dayStartTick(ww.day(g.ticks()) + 30, ww.prepEndTick());
    while (g.ticks() < end && drops.length === 0) step(runner);
    expect(drops).toEqual([REGION.warsaw]);
    expect(land.armies.get(army.id)?.order.kind).toBe("paradrop");
  }, 120_000);

  test("before a paradrop beat the AI raises a paratrooper force", async () => {
    const runner = await wwRunner({}, [], SEA.map);
    const g = runner.game;
    const ww = g.worldWar()!;
    const deu = TAG_ID.DEU;
    const ce = ww.economy.country(deu)!;
    ce.addTech("mountaineers");
    ce.addTech("paratroopers");
    const cl = ww.land.country(deu)!;
    // Crete, not skipped, no delay (the beats are rolled on the first tick).
    step(runner);
    const i = NAVAL_BEATS.findIndex((b) => b.id === "deu_crete");
    ww.navy.beats[i] = [ww.navy.beats[i][0], 0, false];
    const crete = dayOfDate("1941-05-20");
    const before = cl.templates.length;
    // Too early: nothing; within 240 days: a template, then the training.
    aiParadrops(ww.air, deu, crete - 300, false);
    expect(cl.templates.length).toBe(before);
    aiParadrops(ww.air, deu, crete - 200, false);
    expect(cl.templates.length).toBe(before + 1);
    const para = cl.templates[cl.templates.length - 1];
    expect(para.def.battalions).toEqual([
      "paratrooper",
      "paratrooper",
      "paratrooper",
      "paratrooper",
    ]);
    aiParadrops(ww.air, deu, crete - 199, false);
    const queued = cl.training.filter((e) => e.template === para.id);
    expect(queued.reduce((n, e) => n + e.remaining, 0)).toBe(3);
    // Once enough train, no more.
    aiParadrops(ww.air, deu, crete - 198, false);
    expect(cl.training.filter((e) => e.template === para.id).length).toBe(1);
  }, 120_000);
});
