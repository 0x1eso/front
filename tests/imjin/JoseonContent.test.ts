// ww177 P6 (lane I6a): Joseon's scenes, war preparations and people. The
// data check runs on the Imjin registry; the engine check plays picks on
// the imjinmini map (1 Hanseong, 2 Chungju, 3 Busan (Japan's), 5 Pyongyang).
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import {
  WwConditionSchema,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { imjinContent } from "@openfront/engine-lib/imjin/Content";
import { pickFlag } from "@openfront/engine-lib/imjin/CourtScenes";
import {
  JOS_DECISIONS,
  JOS_EVENTS,
  JOS_MARK,
  JOS_NAMED,
  JOS_PERSONS,
  JOS_RESULTS,
  JOS_SPIRITS,
} from "@openfront/engine-lib/imjin/JoseonContent";
import { applyJosResult } from "@openfront/engine/imjin/JoseonPicks";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, step, wwRunner } from "../ww1936/util";

const LANG = path.join(__dirname, "..", "..", "resources", "lang");
const en = JSON.parse(fs.readFileSync(path.join(LANG, "en.json"), "utf8"));
const ko = JSON.parse(fs.readFileSync(path.join(LANG, "ko.json"), "utf8"));

function text(lang: unknown, key: string): string | undefined {
  let o: unknown = lang;
  for (const p of key.split(".")) {
    if (typeof o !== "object" || o === null) return undefined;
    o = (o as Record<string, unknown>)[p];
  }
  return typeof o === "string" ? o : undefined;
}

/** Every key in both languages, with no number in a scene (words, not numbers). */
function both(key: string, scene = false): void {
  for (const lang of [en, ko]) {
    const s = text(lang, key);
    expect(s, key).toBeTypeOf("string");
    if (scene) expect(s, key).not.toMatch(/[0-9]/);
  }
}

describe("Joseon's content", () => {
  test("scenes open by state, show no result before the pick, and every pick has a result", () => {
    const reg = imjinContent();
    const results = new Set(JOS_RESULTS.map((r) => r.flag));
    expect(JOS_EVENTS.length).toBeGreaterThanOrEqual(14);
    for (const e of JOS_EVENTS) {
      expect(reg.eventIdx.has(e.id)).toBe(true);
      expect(e.receivers).toEqual(["JOS"]);
      expect(e.date).toBeUndefined();
      expect(WwConditionSchema.safeParse(e.trigger).success, e.id).toBe(true);
      both(`ww1936.event_title.${e.id}`, true);
      both(`ww1936.event_desc.${e.id}`, true);
      for (const o of e.options) {
        expect(o.effects).toEqual([
          { kind: "set_flag", flag: pickFlag(e.id, o.id) },
        ]);
        expect(results.has(pickFlag(e.id, o.id)), `${e.id}.${o.id}`).toBe(true);
        both(`ww1936.event_opt.${e.id}.${o.id}`, true);
      }
    }
    for (const r of JOS_RESULTS) {
      for (const fx of r.effects ?? []) {
        expect(WwEffectSchema.safeParse(fx).success, r.flag).toBe(true);
      }
      if (r.lineKey !== undefined) both(r.lineKey, true);
    }
  });

  test("the war preparations, spirits and people are whole", () => {
    const reg = imjinContent();
    expect(JOS_DECISIONS.length).toBeGreaterThanOrEqual(15);
    for (const d of JOS_DECISIONS) {
      expect(reg.decisionIdx.has(d.id)).toBe(true);
      expect(d.for).toEqual(["JOS"]);
      for (const fx of [...(d.effects ?? []), ...(d.completeEffects ?? [])]) {
        expect(WwEffectSchema.safeParse(fx).success, d.id).toBe(true);
      }
      both(`ww1936.decision.${d.id}`);
      both(`ww1936.decision_desc.${d.id}`);
    }
    for (const s of JOS_SPIRITS) {
      expect(reg.spiritIdx.has(s.id)).toBe(true);
      both(`ww1936.spirit.${s.id}`);
      both(`ww1936.spirit_desc.${s.id}`);
    }
    expect(JOS_PERSONS.length + JOS_NAMED.length).toBeGreaterThanOrEqual(35);
    for (const p of JOS_PERSONS) {
      // merge 3: the registry's row adds the real dates (PersonDates).
      expect(reg.personIdx.get(p.id)).toMatchObject(p);
      expect(p.source.length).toBeGreaterThan(20);
      both(p.nameKey);
    }
    for (const p of JOS_NAMED) both(`imjin.person.${p.id}`);
  });
});

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

describe("Joseon's picks in the engine", () => {
  test("a pick is taken, applied and told; ships join at a held base", async () => {
    const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
    step(r, WW_PREP_TICKS + 2);
    const g = r.game;
    const ww = g.worldWar()!;
    const jm = ww.imjinJm!;
    const jos = byTag(g, "JOS").smallID();
    const jpn = byTag(g, "JPN").smallID();
    const c = ww.politics.country(jos)!;
    const embassy = JOS_EVENTS.find((e) => e.id === "imjin_jos_embassy")!;
    const ctx = () => makeCtx(ww.politics, jos, jos, 0, g.ticks());

    // The embassy comes home once Japan's muster shows, never before.
    expect(evalCondition(ctx(), embassy.trigger)).toBe(false);
    ww.politics.country(jpn)!.flags.set("imjin_jp_mustered", [0, -1]);
    expect(evalCondition(ctx(), embassy.trigger)).toBe(true);

    // Hwang Yun-gil heeded: the warning flag, a shaken court, Westerners up.
    const stab = c.stabBaseBp;
    const west = c.pop[IDEO_DEM];
    c.flags.set(pickFlag("imjin_jos_embassy", "a"), [0, -1]);
    jm.day(5, g.ticks());
    expect(c.flags.has(pickFlag("imjin_jos_embassy", "a"))).toBe(false);
    expect(c.flags.has(JOS_MARK.embassyHeard)).toBe(true);
    expect(c.flags.has(JOS_MARK.heed)).toBe(true);
    expect(c.stabBaseBp).toBe(stab - 300);
    expect(c.pop[IDEO_DEM]).toBeGreaterThan(west);

    // Japan's letter kept from Ming: its suspicion grows.
    const sus = jm.snapshot().suspicion;
    c.flags.set(pickFlag("imjin_jos_warn_ming", "b"), [0, -1]);
    jm.day(6, g.ticks());
    // (less the day's fade)
    expect(jm.snapshot().suspicion).toBeGreaterThan(sus + 500);

    // Ships: none on this map's bases (lost, untold); a held port takes them.
    const sea = ww.imjinWar!.st.sea;
    const fleets = sea.fleets.length;
    c.flags.set(JOS_MARK.panokseon, [0, -1]);
    jm.day(7, g.ticks());
    expect(c.flags.has(JOS_MARK.panokseon)).toBe(false);
    expect(sea.fleets.length).toBe(fleets);
    const ok = applyJosResult(
      ww,
      jos,
      {
        flag: "x",
        ships: { bases: ["Busan", "Pyongyang"], kinds: [["panokseon", 6]] },
      },
      g.ticks(),
    );
    expect(ok).toBe(true);
    expect(sea.fleets.length).toBe(fleets + 1);
    const f = sea.fleets[sea.fleets.length - 1];
    expect(f.owner).toBe(jos);
    expect(f.ships.length).toBe(6);
  });
});
