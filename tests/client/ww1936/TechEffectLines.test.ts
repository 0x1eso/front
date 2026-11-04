// The research card's effect lines: every tech says what it does, by name,
// in Korean and English, and the named unlocks match the rule tables.
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  PLANE_BASE_DEFS,
  PLANE_MODULE_DEFS,
  SHIP_MODULE_DEFS,
  TANK_BASE_DEFS,
  TANK_MODULE_DEFS,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { PROJECT_DEFS } from "@openfront/engine-lib/ww1936/ProjectRules";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import fs from "fs";
import IntlMessageFormat from "intl-messageformat";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

let LANG: "en" | "ko" = "ko";
const flat = (o: unknown, p = "", out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === "string") out[p + k] = v;
    else flat(v, `${p}${k}.`, out);
  }
  return out;
};
const load = (code: string) =>
  flat(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `../../../resources/lang/${code}.json`),
        "utf8",
      ),
    ),
  );
const TEXT = { en: load("en"), ko: load("ko") };

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) => {
    const msg = TEXT[LANG][key];
    if (msg === undefined) return `<<${key}>>`;
    return new IntlMessageFormat(msg, LANG).format(params ?? {}) as string;
  },
}));

import { HIST_COUNTRIES } from "@openfront/engine-lib/ww1936/hist/Types";
import {
  CUT_EFFECTS,
  effectLines,
  histUnlockLines,
  leadLines,
  NO_EFFECT_KEY,
  ownEffectLines,
  TECH_RULE_LINES,
  techOpens,
  unlockLines,
} from "../../../src/client/hud/ww1936/TechEffectLines";

afterEach(() => {
  LANG = "ko";
});

const shown = WW_TECH_IDS.filter((id) => WW_TECHS[id].retired !== true);
const name = (id: string, lang: "en" | "ko" = LANG) =>
  TEXT[lang][`ww1936.tech.${id}`];

describe("every researchable tech says what it does", () => {
  for (const lang of ["ko", "en"] as const) {
    it(`has readable lines in ${lang}`, () => {
      LANG = lang;
      for (const id of shown) {
        const lines = effectLines(id);
        expect(lines.length, id).toBeGreaterThan(0);
        for (const l of lines) {
          expect(l, id).not.toMatch(/<<|ww1936\.|\{|\}|undefined|NaN/);
          expect(l.trim(), id).not.toBe("");
          // Short lines: one effect each, no joined runs.
          expect(l, id).not.toContain(" · ");
          expect(l.length, `${id}: ${l}`).toBeLessThanOrEqual(110);
        }
        expect(new Set(lines).size, id).toBe(lines.length);
      }
    });
  }

  it("a retired doctrine tech is not on the screens", () => {
    expect(shown.length).toBe(WW_TECH_IDS.length - 20);
  });

  it("the messages follow the Korean spacing rule", () => {
    for (const [k, v] of Object.entries(TEXT.ko)) {
      if (k.startsWith("ww1936.techfx.") || k.startsWith("ww1936.effect.")) {
        expect(v, k).not.toMatch(/\}[가-힣]/);
      }
    }
  });

  it("a tech with no effect of its own says so, and nothing else is untrue", () => {
    LANG = "ko";
    const none = shown.filter((id) => ownEffectLines(id).length === 0);
    for (const id of none) {
      expect(effectLines(id)[0], id).toBe(TEXT.ko[NO_EFFECT_KEY]);
    }
    for (const id of shown) {
      if (ownEffectLines(id).length > 0) {
        expect(effectLines(id), id).not.toContain(TEXT.ko[NO_EFFECT_KEY]);
      }
    }
  });
});

describe("w77: with the designer off every live tech does something", () => {
  // The designer's parts and the catalogue entries a tech gates do not count:
  // a tech with only those is empty for a minor and for any major without
  // an entry behind it. Stat effects, equipment, a ship class, units,
  // buildings, projects and rule lines do.
  const majors = [null, ...HIST_COUNTRIES];
  for (const lang of ["ko", "en"] as const) {
    it(`gives a minor and every major a line of its own in ${lang}`, () => {
      LANG = lang;
      const empty: string[] = [];
      for (const id of shown) {
        for (const country of majors) {
          const own = ownEffectLines(id, { designer: false, country });
          const hist = histUnlockLines(id, country);
          const real = own.filter((l) => !hist.includes(l));
          if (real.length === 0) empty.push(`${id}@${country ?? "minor"}`);
        }
      }
      expect(empty).toEqual([]);
    });
  }

  it("the new lines read right in both languages", () => {
    for (const lang of ["ko", "en"] as const) {
      LANG = lang;
      const one = (id: string) =>
        ownEffectLines(id as never, { designer: false, country: null });
      expect(one("mine_warfare_1").join("|")).toMatch(
        lang === "ko" ? /기뢰 부설.*소해/ : /mine laying.*sweeping/,
      );
      expect(one("naval_aa_1")[0]).toBe(
        lang === "ko" ? "함선 대공 화력 +15%" : "Ship anti-air +15%",
      );
      expect(one("snorkel")[0]).toBe(
        lang === "ko" ? "잠수함 피발견도 −10%" : "Submarine visibility −10%",
      );
      expect(one("armored_deck")[0]).toBe(
        lang === "ko" ? "함선이 받는 피해 −4%" : "Damage taken by ships −4%",
      );
      expect(one("amphibious_drive")[0]).toBe(
        lang === "ko" ? "상륙 준비 시간 −5%" : "Landing preparation time −5%",
      );
      expect(one("tank_gun_2")[0]).toBe(
        lang === "ko" ? "전차포 관통 +4%" : "Tank gun piercing +4%",
      );
      expect(one("fire_control_2")[0]).toBe(
        lang === "ko" ? "해전 함포 명중 +5%" : "Naval gun hit chance +5%",
      );
    }
  });
});

describe("the lines come from the rule tables", () => {
  const unlocksOf = (id: string) => unlockLines(id as never).join("\n");

  it("a tank module's tech lists its name", () => {
    LANG = "ko";
    for (const [id, m] of Object.entries(TANK_MODULE_DEFS)) {
      if (m.tech === undefined) continue;
      expect(unlocksOf(m.tech), `${m.tech} -> ${id}`).toContain(
        TEXT.ko[`ww1936.module.${id}`],
      );
    }
  });

  it("a tank chassis, ship module, plane module and airframe tech lists its name", () => {
    LANG = "en";
    for (const [id, b] of Object.entries(TANK_BASE_DEFS)) {
      expect(unlocksOf(b.tech), id).toContain(
        TEXT.en[`ww1936.base.tank.${id}`],
      );
    }
    for (const [id, m] of Object.entries(SHIP_MODULE_DEFS)) {
      if (m.tech === undefined) continue;
      expect(unlocksOf(m.tech), id).toContain(TEXT.en[`ww1936.module.${id}`]);
    }
    for (const [id, m] of Object.entries(PLANE_MODULE_DEFS)) {
      if (m.tech === undefined) continue;
      expect(unlocksOf(m.tech), id).toContain(TEXT.en[`ww1936.module.${id}`]);
    }
    for (const [id, b] of Object.entries(PLANE_BASE_DEFS)) {
      if (b.tech === undefined) continue;
      expect(unlocksOf(b.tech), id).toContain(
        TEXT.en[`ww1936.base.plane.${id}`],
      );
    }
  });

  it("a tech's declared designer part is on its lines", () => {
    LANG = "ko";
    for (const id of shown) {
      const d = WW_TECHS[id].design;
      if (d === undefined) continue;
      const key =
        d.part === "chassis"
          ? `ww1936.base.${d.designer}.${d.id}`
          : `ww1936.module.${d.id}`;
      expect(unlocksOf(id), id).toContain(TEXT.ko[key]);
    }
  });

  it("a rule line that names a building is its unlock: no second buildings line", () => {
    for (const lang of ["ko", "en"] as const) {
      LANG = lang;
      // Metal substitutes: the rule line carries the rates and the names.
      const lines = effectLines("metal_substitute_1");
      expect(
        lines.filter((l) => /합금 공장|alloy plant/i.test(l)),
      ).toHaveLength(1);
      expect(
        lines.some((l) =>
          l.startsWith(TEXT[lang]["ww1936.techfx.buildings"].split("{")[0]),
        ),
      ).toBe(false);
      // No tech's buildings line repeats a building its rule lines name.
      const prefix = TEXT[lang]["ww1936.techfx.buildings"].split("{")[0];
      for (const id of shown) {
        const buildingsLine = effectLines(id).find((l) => l.startsWith(prefix));
        if (buildingsLine === undefined) continue;
        for (const [rule] of TECH_RULE_LINES[id] ?? []) {
          const text = TEXT[lang][`ww1936.techfx.r_${rule}`].toLowerCase();
          for (const name of buildingsLine.slice(prefix.length).split(", ")) {
            expect(text, `${id}: ${name}`).not.toContain(name.toLowerCase());
          }
        }
      }
    }
  });

  it("special projects and buildings are named", () => {
    LANG = "ko";
    expect(unlocksOf("nuclear_physics")).toContain(
      TEXT.ko["ww1936.building.facility_nuclear"],
    );
    expect(unlocksOf("nuclear_physics")).toContain(
      TEXT.ko["ww1936.project.sp_atomic"],
    );
    for (const [p, d] of Object.entries(PROJECT_DEFS)) {
      for (const t of d.techs) {
        expect(unlocksOf(t), `${t} -> ${p}`).toContain(
          TEXT.ko[`ww1936.project.${p}`],
        );
      }
    }
    expect(unlocksOf("synthetic_oil_1")).toContain(
      TEXT.ko["ww1936.building.synthetic_refinery"],
    );
  });

  it("ship generations and equipment generations are named", () => {
    LANG = "ko";
    expect(unlocksOf("dd_3")).toBe(
      `${TEXT.ko["ww1936.ship_class.dd"]} ${TEXT.ko["ww1936.ship_gen.3"]} 건조 가능`,
    );
    expect(unlocksOf("medium_tank_2")).toContain(
      TEXT.ko["ww1936.equip.medium_tank"],
    );
    expect(unlocksOf("mountaineers")).toContain(
      TEXT.ko["ww1936.battalion.mountain"],
    );
  });

  it("a cut reads as a cut and a gain as a gain, for every tech", () => {
    for (const id of shown) {
      for (const [k, v] of Object.entries(WW_TECHS[id].effects)) {
        if (v === 0 || v === undefined) continue;
        expect(v < 0, `${id}.${k}`).toBe(CUT_EFFECTS.has(k));
      }
    }
  });

  it("the hard-coded rule table names real techs and real messages", () => {
    for (const [id, rules] of Object.entries(TECH_RULE_LINES)) {
      expect(WW_TECH_IDS as readonly string[]).toContain(id);
      for (const [r] of rules ?? []) {
        expect(TEXT.ko[`ww1936.techfx.r_${r}`], `${id}.${r}`).toBeDefined();
        expect(TEXT.en[`ww1936.techfx.r_${r}`], `${id}.${r}`).toBeDefined();
      }
    }
  });

  it("bonuses show real numbers", () => {
    LANG = "ko";
    expect(effectLines("tools_1")).toContain("효율 상한 +10%");
    expect(effectLines("logistics_2").join("|")).toContain("보급 소모 −5%");
    expect(effectLines("winter_gear_1").join("|")).toContain("25%");
  });

  it("what a tech opens is listed, short", () => {
    LANG = "ko";
    expect(techOpens("inf_eq_1")).toContain("inf_eq_2");
    const lines = leadLines("inf_eq_1");
    expect(lines.join("|")).toContain(name("inf_eq_2"));
    for (const id of shown) {
      expect(leadLines(id).length, id).toBeLessThanOrEqual(1);
    }
  });
});
