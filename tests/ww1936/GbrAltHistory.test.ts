// Britain's royalist path: its shape, the forced annexation of a dominion on
// the real map, a human-played dominion refusing it, and the civil-war guard.
// The deep test map stands in for Britain in the guard test, as in UsaFascist.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { CIVIL_WAR_SLOTS } from "@openfront/engine-api/ww1936/Countries";
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { GBR_EVENTS } from "@openfront/engine-lib/ww1936/content/events/gbr";
import { GBR_FOCUSES } from "@openfront/engine-lib/ww1936/content/focus/gbr";
import { DOMINIONS } from "@openfront/engine-lib/ww1936/content/focus/gbr_royalist";
import { treePosIn } from "@openfront/engine-lib/ww1936/content/registry";
import {
  createGameRunner,
  type GameRunner,
} from "@openfront/engine/GameRunner";
import { subjectLine } from "@openfront/engine/ww1936/endgame/Subjects";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { focusFinished } from "@openfront/engine/ww1936/politics/Focus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, order, pol, step, wwGameStart, wwRunner } from "./util";

const byId = new Map(GBR_FOCUSES.map((f) => [f.id, f]));
const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);
const HUMAN2 = "HUMAN002";

async function gbrGame(second?: "AUS"): Promise<GameRunner> {
  usePoliticsContent(null);
  const humans = [{ clientID: HUMAN, country: "GBR" as const }];
  if (second) humans.push({ clientID: HUMAN2, country: second } as never);
  const r = await createGameRunner(
    wwGameStart({}, humans),
    undefined,
    await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  step(r, 50);
  // The path up to the hub is taken as done: the test is about the dominions.
  const p = pol(r.game);
  const c = p.country(p.idOfTag("GBR"))!;
  c.focusState[treePosIn(p.content, c.tree, "gbr_imperial_unity")!] = 1;
  return r;
}
const id = (r: GameRunner, tag: string) => pol(r.game).idOfTag(tag as never);
const me = (r: GameRunner) => pol(r.game).country(id(r, "GBR"))!;

function runFocus(r: GameRunner, focus: string) {
  const p = pol(r.game);
  const c = me(r);
  step(r, 1, [order(HUMAN, { kind: "focus_start", focus })]);
  expect(c.focus?.id, `${focus} started`).toBe(focus);
  let n = 0;
  while (!focusFinished(p, c, focus) && n++ < 2000) step(r);
  expect(focusFinished(p, c, focus), focus).toBe(true);
}

describe("GBR royalist path: the data", () => {
  it("opens at the refused abdication, seizes without a civil war, forces the dominions in order", () => {
    const abd = GBR_EVENTS.find((e) => e.id === "gbr_abdication")!;
    const b = abd.options.find((o) => o.id === "b")!;
    expect(b.effects).toContainEqual({ kind: "set_flag", flag: "kings_party" });
    expect(b.effects).toContainEqual({
      kind: "fire_event",
      id: "gbr_kings_party_settled",
      days: 30,
    });
    expect(byId.get("gbr_kings_friends")!.available).toEqual({
      kind: "flag",
      flag: "kings_party",
    });
    for (const fid of ["gbr_prorogue_parliament", "gbr_palace_dismissal"]) {
      const kinds = byId.get(fid)!.effects.map((e) => e.kind);
      expect(kinds[0]).toBe("set_government");
      expect(kinds).not.toContain("civil_war");
      expect(byId.get(fid)!.effects).toContainEqual({
        kind: "set_flag",
        flag: "gbr_regime_seized",
      });
    }
    expect(DOMINIONS.map((d) => d.tag)).toEqual([
      "NZL",
      "AUS",
      "ZAF",
      "CAN",
      "RAJ",
    ]);
    for (const [i, d] of DOMINIONS.entries()) {
      const annex = byId.get(`gbr_${d.key}_annex`)!;
      expect(JSON.stringify(annex.available)).toContain('"is_human"');
      expect(
        JSON.stringify(byId.get(`gbr_${d.key}_governor`)!.available),
      ).toContain('"is_human"');
      if (i > 0) {
        expect(
          JSON.stringify(byId.get(`gbr_${d.key}_governor`)!.available),
        ).toContain(`gbr_${DOMINIONS[i - 1].key}_annex`);
      }
    }
    // RAJ costs the most at every step.
    const raj = DOMINIONS[4];
    for (const d of DOMINIONS.slice(0, 4)) {
      expect(raj.unrestWindow).toBeGreaterThan(d.unrestWindow);
      expect(raj.unrestMtth).toBeLessThan(d.unrestMtth);
      expect(raj.stab[2]).toBeLessThan(d.stab[2]);
    }
  });
});

describe("GBR royalist path on the real map", () => {
  it("forces New Zealand in: governor, suspended parliament, annexation", async () => {
    const r = await gbrGame();
    const p = pol(r.game);
    const ww = r.game.worldWar()!;
    const eg = ww.endgame;
    const nzl = id(r, "NZL");
    const gbr = id(r, "GBR");
    const stab0 = me(r).stabBaseBp;
    expect(subjectLine(eg, nzl)!.autBp).toBe(6000);
    runFocus(r, "gbr_nzl_governor");
    expect(subjectLine(eg, nzl)!.autBp).toBeLessThan(6000);
    runFocus(r, "gbr_nzl_parliament");
    expect(subjectLine(eg, nzl)!.autBp).toBeLessThanOrEqual(2500);
    const men0 = ww.land.armyMen(gbr);
    runFocus(r, "gbr_nzl_annex");
    expect(eg.countryState(nzl)).toBe("gone");
    const auckland = 1306;
    expect(p.legalOwner[auckland]).toBe(gbr);
    // The land is the Crown's, but New Zealand still holds the core: it is administered.
    expect(eg.isAdministered(auckland)).toBe(true);
    expect(eg.hasCore(nzl, auckland)).toBe(true);
    expect(eg.hasCore(gbr, auckland)).toBe(false);
    expect(eg.resBp[auckland]).toBeGreaterThan(0);
    expect(ww.land.armyMen(gbr)).toBeGreaterThan(men0);
    expect(me(r).hasSpirit("gbr_nzl_crown_rule")).toBe(true);
    expect(me(r).hasFlag("gbr_nzl_annexed", 99999)).toBe(true);
    expect(me(r).stabBaseBp).toBeLessThan(stab0);
    // The unrest event is now live for Britain.
    const ev = GBR_EVENTS.find((e) => e.id === "gbr_nzl_unrest")!;
    expect(evalCondition(makeCtx(p, gbr, gbr, 0, 0), ev.trigger!)).toBe(true);
    // Australia is next in the order and is open now.
    const aus = byId.get("gbr_aus_governor")!;
    expect(evalCondition(makeCtx(p, gbr, gbr, 0, 0), aus.available!)).toBe(
      true,
    );
  }, 600_000);

  it("a human-played dominion cannot be forced; the order moves past it", async () => {
    const r = await gbrGame("AUS");
    const p = pol(r.game);
    const eg = r.game.worldWar()!.endgame;
    const gbr = id(r, "GBR");
    const aus = id(r, "AUS");
    const ctx = makeCtx(p, gbr, gbr, 0, 0);
    // New Zealand (an AI) is open; Australia (a human) is closed at every step.
    expect(evalCondition(ctx, byId.get("gbr_nzl_governor")!.available!)).toBe(
      true,
    );
    for (const s of ["governor", "parliament", "annex"]) {
      const f = byId.get(`gbr_aus_${s}`)!;
      expect(evalCondition(ctx, f.available!), s).toBe(false);
    }
    step(r, 1, [
      order(HUMAN, { kind: "focus_start", focus: "gbr_aus_governor" }),
    ]);
    expect(me(r).focus).toBeNull();
    // Even if the annexation's effects ran, the guard in them leaves Australia be.
    applyEffects(ctx, byId.get("gbr_aus_annex")!.effects);
    expect(eg.countryState(aus)).toBe("active");
    expect(p.legalOwner[1283]).toBe(aus);
    expect(me(r).hasFlag("gbr_aus_annexed", 99999)).toBe(false);
    // The order does not stall: South Africa follows Australia, and a human counts as dealt with.
    expect(evalCondition(ctx, byId.get("gbr_zaf_governor")!.available!)).toBe(
      true,
    );
  }, 600_000);
});

describe("GBR royalist path: the uprising's civil-war guard", () => {
  beforeEach(() => usePoliticsContent(depthFixture()));
  afterEach(() => usePoliticsContent(null));
  it("with the civil-war slots full, Britain stays royalist and the strife spirit is set", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ww = runner.game.worldWar()!;
    const us = DEEP.tag.GBR;
    const c = pol(runner.game).country(us)!;
    c.ruling = IDEO_FAS;
    c.flags.set("gbr_regime_seized", [0, -1]);
    for (const t of CIVIL_WAR_SLOTS) {
      ww.endgame.countryStateArr[ww.scenario.smallIdOf(t)] = CS_GONE;
    }
    const ev = GBR_EVENTS.find((e) => e.id === "gbr_democratic_uprising")!;
    const b = ev.options.find((o) => o.id === "b")!;
    applyEffects(makeCtx(pol(runner.game), us, us, 0, 0), b.effects);
    expect(c.ruling).toBe(IDEO_FAS);
    expect(c.hasSpirit("gen_civil_strife")).toBe(true);
  });
});
