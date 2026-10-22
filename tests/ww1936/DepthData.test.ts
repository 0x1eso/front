// World War 1936 P6 (plan Task 1 Step 21, decisions 33, 34): the depth
// content tables (K5's). Passes on the empty tables; Phase B runs it again
// with the data. The name-key checks wait for K5's keys.
import {
  ARMY_SPIRITS,
  CODENAME_COUNT,
  DAMS,
  DOCTRINE_TRACKS,
  FM_TRAITS,
  GD_DOMAIN,
  GRAND_DOCTRINES,
  INTEL_MISSIONS,
  LANDMARKS,
  PLANE_BASES,
  PLANE_MODULES,
  SCIENTIST_SPECS,
  SHIP_MODULES,
  SPECIAL_PROJECTS,
  SUB_TRACK,
  SUBDOCTRINES,
  TANK_BASES,
  TANK_MODULES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { designBlock } from "@openfront/engine-lib/ww1936/DesignRules";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { hasKey } from "./contentUtil";

const DATE = /^19[34]\d-\d\d-\d\d$/;
const ALL_TECHS = new Set(WW_TECH_IDS);
const ALL_PROJECTS = (1 << SPECIAL_PROJECTS.length) - 1;
/** K5's keys are in the language files (Phase B): the name checks run. */
const K5_KEYS = hasKey("ww1936.gd.gd_mobile");

describe("depth data", () => {
  it("the nine <damId>_destroyed flags are declared (pre-flight §C5, review L3)", () => {
    expect(DAMS).toHaveLength(9);
    for (const d of DAMS) {
      expect(CONTENT.flagSet.has(`${d}_destroyed`), d).toBe(true);
      expect(CONTENT.flags, d).toContain(`${d}_destroyed`);
    }
  });

  it("start doctrines name doctrines of the right domain and track", () => {
    for (const s of CONTENT.startDoctrines) {
      s.gd.forEach((g, dom) => {
        if (g === null) return;
        expect(GRAND_DOCTRINES, s.tag).toContain(g);
        expect(GD_DOMAIN[GRAND_DOCTRINES.indexOf(g)], `${s.tag} ${g}`).toBe(
          dom,
        );
      });
      expect(s.sub.length).toBeLessThanOrEqual(9);
      s.sub.forEach((x, t) => {
        if (x === null) return;
        expect(SUBDOCTRINES, s.tag).toContain(x);
        expect(SUB_TRACK[SUBDOCTRINES.indexOf(x)], `${s.tag} ${x}`).toBe(t);
      });
    }
  });

  it("start field marshals are P2 generals (or titles) with an FM trait and dates", () => {
    const ids = new Set(GENERALS.map((g) => g.id));
    for (const f of CONTENT.startFieldMarshals) {
      expect(
        f.general.startsWith("title:") || ids.has(f.general),
        f.general,
      ).toBe(true);
      expect(FM_TRAITS, f.general).toContain(f.trait);
      for (const d of [f.from, f.until]) {
        if (d !== undefined) expect(d, f.general).toMatch(DATE);
      }
      expect(f.source.length, f.general).toBeGreaterThan(0);
    }
  });

  it("scientists: skill 1–5, a speciality, a date; agency starts dated", () => {
    for (const s of CONTENT.scientists) {
      expect(s.skill).toBeGreaterThanOrEqual(1);
      expect(s.skill).toBeLessThanOrEqual(5);
      expect(SCIENTIST_SPECS).toContain(s.spec);
      if (s.from !== undefined) expect(s.from).toMatch(DATE);
    }
    for (const a of CONTENT.agencyStarts) expect(a.date, a.tag).toMatch(DATE);
  });

  it("every AI design preset passes designBlock for a country with every tech and project", () => {
    const open = {
      techs: ALL_TECHS,
      projects: ALL_PROJECTS,
      treatyMember: false,
      treatyEscalated: false,
    };
    for (const p of CONTENT.aiDesignPresets) {
      expect(designBlock({ ...p.def, name: p.id }, open), p.id).toBeNull();
      if (p.from !== undefined) expect(p.from, p.id).toMatch(DATE);
    }
  });

  it("atomic targets are the target's 1936 land, never Korea or Taiwan", () => {
    const dir = path.join(__dirname, "../../resources/maps/world1936");
    const world = ScenarioIndex.fromFiles(
      JSON.parse(
        fs.readFileSync(path.join(dir, "scenario.json"), "utf8"),
      ) as ReadonlyScenarioData,
      new Uint8Array(fs.readFileSync(path.join(dir, "regions.bin"))),
    );
    const owner = world.ownerByRegion();
    for (const t of CONTENT.nukeTargets) {
      expect(t.notBefore).toMatch(DATE);
      for (const r of t.regions) {
        expect(world.tagOfSmallId(owner[r]), `${t.target} ${r}`).toBe(t.target);
        expect(CONTENT.noStrikeRegions.has(r), `${r}`).toBe(false);
      }
    }
  });

  it("no person-name field in the scientist, agency or design data (decision 34)", () => {
    const fields = (rows: readonly object[]) =>
      new Set(rows.flatMap((r) => Object.keys(r)));
    for (const k of fields(CONTENT.scientists)) {
      expect(["tag", "spec", "skill", "from"]).toContain(k);
    }
    for (const k of fields(CONTENT.agencyStarts)) {
      expect(["tag", "date"]).toContain(k);
    }
    expect(CONTENT.codenames).toBe(CODENAME_COUNT);
  });

  (K5_KEYS ? it : it.skip)(
    "codenames and every P6 id list have their name keys in en and ko",
    () => {
      const keys = [
        ...Array.from(
          { length: CODENAME_COUNT },
          (_, n) => `ww1936.codename.c${n}`,
        ),
        ...GRAND_DOCTRINES.map((g) => `ww1936.gd.${g}`),
        ...SUBDOCTRINES.map((s) => `ww1936.subdoc.${s}`),
        ...DOCTRINE_TRACKS.map((t) => `ww1936.track.${t}`),
        ...ARMY_SPIRITS.map((s) => `ww1936.army_spirit.${s}`),
        ...FM_TRAITS.map((t) => `ww1936.fm_trait.${t}`),
        ...[...TANK_MODULES, ...SHIP_MODULES, ...PLANE_MODULES].map(
          (m) => `ww1936.module.${m}`,
        ),
        ...TANK_BASES.map((b) => `ww1936.base.tank.${b}`),
        ...PLANE_BASES.map((b) => `ww1936.base.plane.${b}`),
        ...SCIENTIST_SPECS.map((s) => `ww1936.scientist.${s}`),
        ...INTEL_MISSIONS.map((m) => `ww1936.intel_mission.${m}`),
        ...LANDMARKS.map((l) => `ww1936.landmark.${l}`),
        ...DAMS.map((d) => `ww1936.dam.${d}`),
      ];
      expect(keys.filter((k) => !hasKey(k))).toEqual([]);
    },
  );
});
