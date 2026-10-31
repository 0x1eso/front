// World War 1936: the division preset library, the start templates built
// from it, the auto-add on unlock (cap, signature skip) and its snapshot.
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NG_HEAVY,
  WW_MAX_BATTALIONS,
  WW_MAX_TEMPLATES,
  WW_MAX_WIDTH,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { BATTALIONS } from "@openfront/engine-lib/ww1936/Battalions";
import { startTechs } from "@openfront/engine-lib/ww1936/EconomyStart";
import {
  landStartTechs,
  startTemplates,
} from "@openfront/engine-lib/ww1936/LandStart";
import {
  presetDef,
  presetStatus,
  TEMPLATE_PRESETS,
  upgradeDef,
} from "@openfront/engine-lib/ww1936/TemplatePresets";
import { templateBlock } from "@openfront/engine-lib/ww1936/TemplateStats";
import { autoAddPresets } from "@openfront/engine/ww1936/land/Presets";
import fs from "fs";
import path from "path";
import {
  byTag,
  clearStartSetup,
  gameHash,
  HUMAN,
  land,
  stepTo,
  wwRestore,
  wwRunnerCapture,
} from "./util";

const lang = (c: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../resources/lang/${c}.json`),
      "utf8",
    ),
  );
const ALL = new Set(WW_TECH_IDS);
const NONE = new Set<number>();

describe("template presets", () => {
  test("valid, within width and the cap, named in en and ko", () => {
    const en = lang("en").ww1936.tpl;
    const ko = lang("ko").ww1936.tpl;
    expect(TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(20);
    for (const x of TEMPLATE_PRESETS) {
      const d = presetDef(x);
      expect(templateBlock(d, ALL, Infinity)).toBeNull();
      expect(d.battalions.length).toBeLessThanOrEqual(WW_MAX_BATTALIONS);
      expect(
        d.battalions.reduce((w, b) => w + BATTALIONS[b].width, 0),
      ).toBeLessThanOrEqual(WW_MAX_WIDTH);
      expect(d.battalions).toContain(x.sig);
      expect([en[x.id], ko[x.id]]).toEqual([x.en, x.ko]);
    }
    expect(TEMPLATE_PRESETS.length).toBeLessThan(31);
    expect(WW_MAX_TEMPLATES).toBe(20);
  });

  test("lock reasons: techs, then a saved tank design", () => {
    const heavy = TEMPLATE_PRESETS.find(
      (x) => x.id === "pre_heavy_breakthrough",
    )!;
    const start = new Set(startTechs("DEU", 0));
    const st = presetStatus(heavy, start, NONE);
    expect(st.usable).toBe(false);
    expect(st.techs).toEqual(
      expect.arrayContaining(["medium_tank_1", "heavy_tank_1"]),
    );
    expect(st.designs).toEqual(["heavy_armor"]);
    const done = presetStatus(heavy, ALL, new Set([NG_HEAVY]));
    expect(done).toEqual({ usable: true, techs: [], designs: [] });
    expect(presetStatus(heavy, ALL, NONE).designs).toEqual(["heavy_armor"]);
  });

  test("[old -> new] swaps light armour and artillery", () => {
    const d = {
      name: "",
      battalions: ["light_armor", "artillery", "infantry"],
      support: [],
    } as never;
    expect(
      upgradeDef(d, new Set(["motorized_1", "artillery_1"]))!.battalions,
    ).toEqual(["light_armor", "mot_artillery", "infantry"]);
    expect(upgradeDef(d, ALL)!.battalions).toEqual([
      "medium_armor",
      "mot_artillery",
      "infantry",
    ]);
    expect(upgradeDef(d, new Set())).toBeNull();
  });

  test("every country starts with presets its start techs allow; USA and JPN get armor", () => {
    for (const tag of [
      "DEU",
      "ITA",
      "JPN",
      "GBR",
      "FRA",
      "USA",
      "SUN",
    ] as const) {
      const ts = startTemplates(tag, 4);
      expect(ts.length).toBeGreaterThanOrEqual(4);
      expect(ts.length).toBeLessThanOrEqual(6);
      const have = new Set([
        ...startTechs(tag, 0),
        ...landStartTechs(tag, true, 4),
      ]);
      for (const t of ts.filter((x) => x.key.startsWith("pre_")))
        expect(templateBlock(t.def, have, Infinity)).toBeNull();
    }
    for (const tag of ["USA", "JPN"] as const) {
      expect(
        startTemplates(tag, 4).some((t) =>
          t.def.battalions.includes("light_armor"),
        ),
      ).toBe(true);
    }
    for (const dev of [1, 2, 3, 4]) {
      const n = startTemplates("POL", dev).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});

async function germany() {
  const humans = [{ clientID: HUMAN, country: "DEU" as const }];
  const { runner } = await wwRunnerCapture({}, humans);
  stepTo(runner, WW_PREP_TICKS + 1);
  const l = land(runner.game);
  const id = byTag(runner.game, "DEU").smallID();
  const ce = l.econ.country(id)!;
  clearStartSetup(l.econ, ce);
  return { runner, humans, l, cl: l.country(id)!, ce };
}

describe("auto-add on unlock", () => {
  test("a finished tech adds its preset once; a used battalion type skips; the cap holds", async () => {
    const { l, cl, ce } = await germany();
    const keys = () => cl.templates.map((t) => t.key);
    autoAddPresets(l, cl);
    const start = cl.templates.length;
    expect(keys()).not.toContain("pre_medium_armored");
    ce.addTech("light_tank_2");
    ce.addTech("medium_tank_1");
    autoAddPresets(l, cl);
    expect(keys()).toContain("pre_medium_armored");
    // inf_tank_support also unlocked, but its medium_armor type is now used.
    expect(keys()).not.toContain("pre_inf_tank_support");
    expect(cl.templates.length).toBe(start + 1);
    autoAddPresets(l, cl);
    expect(cl.templates.length).toBe(start + 1);
    // A deleted template is not added again.
    cl.templates = cl.templates.filter((t) => t.key !== "pre_medium_armored");
    autoAddPresets(l, cl);
    expect(keys()).not.toContain("pre_medium_armored");
    // At the cap nothing joins (the preset is still marked seen).
    ce.addTech("anti_air_1");
    while (cl.templates.length < WW_MAX_TEMPLATES) {
      cl.templates.push({
        id: cl.nextTemplateId++,
        key: "",
        def: { name: "x", battalions: ["cavalry"], support: [] },
      });
    }
    ce.addTech("paratroopers");
    autoAddPresets(l, cl);
    expect(cl.templates.length).toBe(WW_MAX_TEMPLATES);
    expect(keys()).not.toContain("pre_airborne_div");
  });

  test("snapshot and restore keep templates and the seen mask", async () => {
    const { runner, humans, l, cl, ce } = await germany();
    ce.addTech("light_tank_2");
    ce.addTech("medium_tank_1");
    autoAddPresets(l, cl);
    expect(cl.presetSeen).not.toBe(0);
    const copy = await wwRestore(runner, humans);
    const c2 = land(copy.game).country(cl.smallID)!;
    expect(c2.templates.map((t) => [t.key, t.def.battalions.length])).toEqual(
      cl.templates.map((t) => [t.key, t.def.battalions.length]),
    );
    expect(c2.presetSeen).toBe(cl.presetSeen);
    expect(gameHash(copy)).toBe(gameHash(runner));
  });
});
