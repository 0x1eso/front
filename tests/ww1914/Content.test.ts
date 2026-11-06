import { IntentSchema } from "@openfront/engine-api/Schemas";
import {
  GW_LINES,
  GW_THEATRES,
  GwPersonDefSchema,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
import { GwOrderIntentSchema } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GwPackSchema,
  gwPackProblems,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  gwContentProblems,
  gwTalkLinks,
} from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { gwOwnerOf, gwWorldOf } from "@openfront/engine-lib/ww1914/World1914";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = path.join(__dirname, "../..");
const res = (p: string) => path.join(ROOT, "resources", p);
const json = (p: string) => JSON.parse(fs.readFileSync(res(p), "utf8"));

describe("content", () => {
  test("every scene and person passes its schema and the cross checks", () => {
    for (const s of GW_CONTENT.scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
    for (const p of GW_CONTENT.people) GwPersonDefSchema.parse(p);
    const ids = GW_CONTENT.scenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the pack holds every line a scene can show", async () => {
    const pack = await loadGwPack("DEU", async (p) => json(p));
    for (const s of GW_CONTENT.scenes) {
      const t = pack.scenes[s.id];
      expect(t, s.id).toBeDefined();
      for (const v of s.variants) expect(t.text[v.id], s.id).toBeDefined();
      for (const o of s.options ?? []) {
        expect(t.opt?.[o.id], `${s.id}.${o.id}`).toBeDefined();
        if (o.when !== undefined) {
          expect(t.why?.[o.id], `${s.id}.${o.id}`).toBeDefined();
        }
      }
      for (const [id, n] of Object.entries(s.nodes ?? {})) {
        const nt = t.nodes?.[id];
        for (const v of n.says) expect(nt?.says[v.id], id).toBeDefined();
        for (const r of n.replies) expect(nt?.replies[r.id], id).toBeDefined();
      }
      if (s.summon === true) expect(t.topic, s.id).toBeDefined();
    }
    for (const p of GW_CONTENT.people) {
      expect(pack.people[p.id], p.id).toBeDefined();
    }
  });

  test("no reference leads nowhere, no line is missing, no holes unfilled", async () => {
    const { scenes, people } = GW_CONTENT;
    // The world lane's scenes that only its code schedules.
    expect(gwContentProblems(scenes, people, ["gw_world_called_only"])).toEqual(
      [],
    );
    const pack = await loadGwPack("DEU", async (p) => json(p));
    const lang = json("lang/en.json").gw.reason as Record<string, string>;
    expect(gwPackProblems(scenes, pack, Object.keys(lang))).toEqual([]);
  });

  test("talks open decisions' options, and the check sees it", () => {
    expect(gwTalkLinks(GW_CONTENT.scenes)).toContainEqual({
      talk: "deu_sample_talk",
      key: "heard_chancellor",
      scene: "deu_sample_envoy",
      option: "term_limit",
    });
  });

  test("packs merge and a bad pack is refused", () => {
    const a = GwPackSchema.parse(json("ww1914/ko/common.json"));
    expect(mergeGwPacks([a]).version).toBe(1);
    expect(() => GwPackSchema.parse({ version: 2 })).toThrow();
  });

  test("the order goes through the intent schema", () => {
    const o = {
      type: "gw_order",
      order: { kind: "reply", card: 7, reply: "ask_vienna" },
    };
    expect(GwOrderIntentSchema.parse(o)).toEqual(o);
    expect(IntentSchema.parse(o)).toEqual(o);
  });

  test("every theatre has its lines; every country a flag", () => {
    for (const t of GW_THEATRES) {
      expect(GW_LINES[t].length).toBeGreaterThanOrEqual(4);
    }
    for (const tag of GW_TAGS) {
      const f = gwCountry(tag).flag;
      expect(fs.existsSync(res(`flags/${f}.svg`)), tag).toBe(true);
    }
  });
});

describe("owners1914 on the real map", () => {
  const data = ScenarioDataSchema.parse(json("maps/world1936/scenario.json"));
  const bin = fs.readFileSync(res("maps/world1936/regions.bin"));
  const index = ScenarioIndex.fromFiles(data, new Uint8Array(bin));

  test("every region has an owner, Germany and its neighbours first", () => {
    const world = gwWorldOf(index);
    for (const t of ["DEU", "AUH", "RUS", "FRA", "OTT", "SRB", "MNE"]) {
      expect(world.tags).toContain(t);
    }
    const owner = (nameKo: string) => {
      const r = data.regions.find((x) => x.nameKo === nameKo)!;
      return gwOwnerOf(r.id, r.owner);
    };
    expect(owner("모젤")).toBe("DEU");
    expect(owner("비엘코폴스카")).toBe("DEU");
    expect(owner("클라이페다")).toBe("DEU");
    expect(owner("르부프")).toBe("AUH");
    expect(owner("프라하")).toBe("AUH");
    expect(owner("사라예보")).toBe("AUH");
    expect(owner("베오그라드")).toBe("SRB");
    expect(owner("키시너우")).toBe("RUS");
    expect(owner("마조프셰")).toBe("RUS");
    expect(owner("카르스")).toBe("RUS");
  });
});
