// The Showa Restoration: the tree's shape and the road on the real world1936
// map with Japan as a human, driven by real orders. The focus only takes
// power; the old guard (jpn_service_revolt) and the Kwantung Army
// (jpn_kwantung_break) rise through events.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { CIVIL_WAR_SLOTS } from "@openfront/engine-api/ww1936/Countries";
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_FAS, IDEO_NEU } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  JPN_BRANCHES,
  JPN_FOCUSES,
} from "@openfront/engine-lib/ww1936/content/focus/jpn";
import { JPN_SHOWA_FOCUSES } from "@openfront/engine-lib/ww1936/content/focus/jpn_showa";
import { treePosIn } from "@openfront/engine-lib/ww1936/content/registry";
import { addPopularity } from "@openfront/engine-lib/ww1936/PoliticsRules";
import {
  createGameRunner,
  type GameRunner,
} from "@openfront/engine/GameRunner";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { openOptions } from "@openfront/engine/ww1936/politics/Events";
import { focusFinished } from "@openfront/engine/ww1936/politics/Focus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { HUMAN, order, pol, step, stepToDate, wwGameStart } from "./util";

afterEach(() => usePoliticsContent(null));

describe("Showa Restoration: the tree", () => {
  const byId = new Map(JPN_FOCUSES.map((f) => [f.id, f]));

  it("the tree: groups, forks, the door, the final focuses and what the last fork closes", () => {
    expect(JPN_SHOWA_FOCUSES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(JPN_SHOWA_FOCUSES.map((f) => f.group))).toEqual(
      new Set([
        "jpn_showa_plot",
        "jpn_showa_seizure",
        "jpn_showa_order",
        "jpn_showa_fate",
      ]),
    );
    for (const f of JPN_SHOWA_FOCUSES) {
      for (const e of f.exclusive ?? []) {
        expect(byId.get(e)?.exclusive, f.id).toContain(f.id);
      }
      for (const g of f.prereq ?? []) {
        for (const p of g) expect(byId.has(p), `${f.id} needs ${p}`).toBe(true);
      }
    }
    // Forks stay out of the historical AI's branch points.
    expect(JPN_BRANCHES.length).toBe(11);

    // ---
    expect(byId.get("jpn_young_officers")?.prereq).toEqual([
      ["jpn_kodoha_faction"],
    ]);
    expect(byId.get("jpn_kwantung_backing")?.prereq).toEqual([
      ["jpn_young_officers"],
      ["jpn_kwantung_autonomy"],
    ]);
    // The door is a long shot for the AI; the Control faction's road stays open.
    expect(byId.get("jpn_young_officers")?.ai?.base).toBe(1);
    expect(byId.get("jpn_control_faction")?.exclusive).toEqual([
      "jpn_kodoha_faction",
    ]);

    // ---
    for (const id of ["jpn_imperial_rule", "jpn_capital_rising"]) {
      const fx = byId.get(id)!.effects;
      expect(fx[0]).toEqual({ kind: "set_government", ideology: "fascist" });
      expect(fx.map((e) => e.kind)).not.toContain("civil_war");
      expect(fx).toContainEqual({
        kind: "set_flag",
        flag: "jpn_regime_seized",
      });
    }

    // ---
    const south = byId.get("jpn_strike_south")!;
    const hawaii = byId.get("jpn_hawaii_operation")!;
    expect(south.exclusive).toEqual(["jpn_strike_north"]);
    // The new fork's exclusive only separates its own two roads.
    expect(byId.get("jpn_northern_crusade")?.exclusive).toEqual([
      "jpn_washington_accord",
    ]);
    expect(byId.get("jpn_washington_accord")?.exclusive).toEqual([
      "jpn_northern_crusade",
    ]);
    expect(JSON.stringify(south.available)).toContain("jpn_northern_crusade");
    expect(JSON.stringify(south.available)).toContain("jpn_washington_accord");
    expect(JSON.stringify(hawaii.available)).toContain("jpn_washington_accord");
  });
});

// ---- The real world1936 map, Japan human, driven by real orders ----

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);
const REVOLT = "jpn_service_revolt";
const KWANTUNG = "jpn_kwantung_break";

async function jpnGame(): Promise<GameRunner> {
  usePoliticsContent(null);
  const runner = await createGameRunner(
    wwGameStart({}, [{ clientID: HUMAN, country: "JPN" }]),
    undefined,
    await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  stepToDate(runner, "1936-03-02");
  return runner;
}
const me = (r: GameRunner) => pol(r.game).country(pol(r.game).idOfTag("JPN"))!;
function mark(r: GameRunner, ids: string[]) {
  const p = pol(r.game);
  const c = me(r);
  for (const id of ids) c.focusState[treePosIn(p.content, c.tree, id)!] = 1;
}
let crisis = 0;
const cards = new WeakMap<GameRunner, Map<string, number[]>>();
/** Runs n ticks, noting each opposition card's uid. */
function run(r: GameRunner, n: number) {
  const seen = cards.get(r) ?? new Map<string, number[]>();
  cards.set(r, seen);
  for (let i = 0; i < n; i++) {
    step(r);
    for (const p of me(r).pending) {
      if (p.eventId === "gen_regime_crisis") crisis++;
      if (p.eventId !== REVOLT && p.eventId !== KWANTUNG) continue;
      const list = seen.get(p.eventId) ?? [];
      seen.set(p.eventId, list);
      if (!list.includes(p.uid)) list.push(p.uid);
    }
  }
}
const count = (r: GameRunner, id: string) => cards.get(r)?.get(id)?.length ?? 0;
function runFocus(r: GameRunner, id: string) {
  const c = me(r);
  const p = pol(r.game);
  step(r, 1, [order(HUMAN, { kind: "focus_start", focus: id })]);
  expect(c.focus?.id ?? id).toBe(id);
  let n = 0;
  while (!focusFinished(p, c, id) && n++ < 4000) run(r, 1);
  expect(focusFinished(p, c, id), id).toBe(true);
}
const civilWars = (r: GameRunner) => {
  const id = pol(r.game).idOfTag("JPN");
  return r.game
    .worldWar()!
    .endgame.wars.filter(
      (w) =>
        w.kind === "civil" &&
        w.sides.some((x) => x.members.some((m) => m.id === id)),
    );
};

const BASE_FIRST = ["jpn_kodoha_faction", "jpn_young_officers"];
const wars = (r: GameRunner) => r.game.worldWar()!;

describe("Showa Restoration on the real map", () => {
  it("the rising seizes power from Japan's neutral start, and the old guard splits the country", async () => {
    const r = await jpnGame();
    const c = me(r);
    expect(c.ruling).toBe(IDEO_NEU);
    mark(r, ["jpn_after_february"]);
    for (const f of [
      ...BASE_FIRST,
      "jpn_patriotic_leagues",
      "jpn_rising_route",
    ]) {
      runFocus(r, f);
    }
    // Weeks of a fascist lead above 60% before the seizure: the generic
    // regime crisis must not hand the country over, the focus does.
    expect(c.pop[IDEO_FAS]).toBeGreaterThanOrEqual(7000);
    expect(c.ruling).toBe(IDEO_NEU);
    runFocus(r, "jpn_capital_rising");
    expect(c.ruling).toBe(IDEO_FAS);
    expect(c.hasFlag("jpn_regime_seized", 0)).toBe(true);
    expect(c.hasSpirit("jpn_showa_restoration")).toBe(true);
    expect(civilWars(r)).toHaveLength(0); // the focus itself starts nothing
    // The seizure wakes the old establishment (the backlash).
    expect(c.pop[IDEO_NEU]).toBeGreaterThanOrEqual(2000);
    run(r, 4000);
    expect(count(r, REVOLT)).toBeGreaterThanOrEqual(1);
    expect(crisis).toBe(0);
    const w = civilWars(r);
    expect(w).toHaveLength(1);
    expect(c.ruling).toBe(IDEO_FAS);
    // The rebels rose at the navy yards (Hiroshima, Nagasaki) and hold land.
    const rebels = w[0].sides.flatMap((s) => s.members.map((m) => m.id));
    const owner = (reg: number) => pol(r.game).legalOwner[reg];
    expect(owner(757)).not.toBe(pol(r.game).idOfTag("JPN"));
    expect(rebels).toContain(owner(757));
  }, 600_000);

  it("the Kwantung Army breaks away with Manchukuo; a failed civil war leaves the regime standing", async () => {
    const r = await jpnGame();
    const c = me(r);
    const p = pol(r.game);
    const jpn = p.idOfTag("JPN");
    const mck = p.idOfTag("MCK");
    const eg = wars(r).endgame;
    expect(eg.subjectOf(mck)?.overlord).toBe(jpn);
    // The regime stands (set as the seizure leaves it), the old guard is quiet.
    mark(r, ["jpn_kwantung_autonomy"]);
    c.flags.set("jpn_regime_seized", [0, -1]);
    c.ruling = IDEO_FAS;
    addPopularity(c.pop, IDEO_NEU, -4000);
    c.stabBaseBp = 0; // not steady: the only option is the break
    let n = 0;
    while (count(r, KWANTUNG) === 0 && n++ < 6000) run(r, 1);
    const card = c.pending.find((x) => x.eventId === KWANTUNG);
    expect(card).toBeDefined();
    expect(openOptions(p, jpn, card!)).toEqual(["b"]);
    n = 0;
    while (c.pending.some((x) => x.eventId === KWANTUNG) && n++ < 6000) {
      run(r, 1);
    }
    run(r, 300);
    expect(eg.subjectOf(mck)).toBeNull();
    expect(p.legalOwner[666]).toBe(mck); // the leased territory goes with it
    expect(wars(r).isAtWar(jpn, mck)).toBe(true);
    expect(p.sameFaction(jpn, mck)).toBe(false);

    // Slots full: the old guard's civil war cannot start, the regime stays.
    for (const t of CIVIL_WAR_SLOTS) {
      eg.countryStateArr[wars(r).scenario.smallIdOf(t)] = CS_GONE;
    }
    addPopularity(c.pop, IDEO_NEU, 2500);
    c.stabBaseBp = 0;
    n = 0;
    while (count(r, REVOLT) === 0 && n++ < 9000) run(r, 1);
    expect(count(r, REVOLT)).toBeGreaterThanOrEqual(1);
    run(r, 4500); // the card times out onto the civil war, which cannot start
    expect(civilWars(r)).toHaveLength(0);
    expect(c.ruling).toBe(IDEO_FAS);
    expect(c.hasSpirit("gen_civil_strife")).toBe(true);
  }, 600_000);
});
