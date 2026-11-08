import { IntentSchema } from "@openfront/engine-api/Schemas";
import {
  GW_ENDINGS,
  GW_LINES,
  GW_THEATRES,
  GW_WORLD_FLAGS,
  GwPersonDefSchema,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
import { GwOrderIntentSchema } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GwPackSchema,
  gwPackOverlaps,
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
import { TABLE_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/table";
import { craftCalledScenes } from "@openfront/engine-lib/ww1914/CraftRows";
import { gwEndingsOf } from "@openfront/engine-lib/ww1914/EndingRows";
import { gwRulerScenes } from "@openfront/engine-lib/ww1914/RulerRows";
import { gwOwnerOf, gwWorldOf } from "@openfront/engine-lib/ww1914/World1914";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  GW_PEOPLE_PACKS,
  loadGwPack,
} from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { FOUNDATION_CONTENT } from "./foundationFixture";

const ROOT = path.join(__dirname, "../..");
const res = (p: string) => path.join(ROOT, "resources", p);
const json = (p: string) => JSON.parse(fs.readFileSync(res(p), "utf8"));

/** The seats with their own writing. */
const SEATS = ["DEU", "GBR", "AUH", "RUS"] as const;
const scenesOf = (tag: string) =>
  GW_CONTENT.scenes.filter(
    (s) => s.nation === undefined || (s.nation as string[]).includes(tag),
  );

describe("content", () => {
  test("every scene and person passes its schema and the cross checks", () => {
    for (const s of GW_CONTENT.scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
    for (const p of GW_CONTENT.people) GwPersonDefSchema.parse(p);
    const ids = GW_CONTENT.scenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Parsing every scene takes a while on a busy machine.
  }, 60000);

  test.each(SEATS)(
    "%s's pack holds every line a scene can show",
    async (tag) => {
      const pack = await loadGwPack(tag, async (p) => json(p));
      for (const s of scenesOf(tag)) {
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
          for (const r of n.replies)
            expect(nt?.replies[r.id], id).toBeDefined();
        }
        if (s.summon === true) expect(t.topic, s.id).toBeDefined();
      }
      // Every seat can name everyone: a scene casts whoever holds the office.
      for (const p of GW_CONTENT.people) {
        expect(pack.people[p.id], p.id).toBeDefined();
      }
    },
  );

  test("no reference leads nowhere, no line is missing, no holes unfilled", async () => {
    const { scenes, people } = GW_CONTENT;
    // Set by the world's code: what its own scenes wait on, and scene plan §1.
    const outside = [
      "gw_world_called_only",
      ...GW_WORLD_FLAGS,
      ...gwRulerScenes(),
      ...TABLE_SCENES.map((x) => x.id),
      ...craftCalledScenes(GW_CONTENT),
    ];
    expect(gwContentProblems(scenes, people, outside)).toEqual([]);
    const lang = json("lang/en.json").gw.reason as Record<string, string>;
    for (const tag of SEATS) {
      const pack = await loadGwPack(tag, async (p) => json(p));
      expect(gwPackProblems(scenesOf(tag), pack, Object.keys(lang))).toEqual(
        [],
      );
    }
  });

  test.each(SEATS)("no id sits in two of %s's pack files", (tag) => {
    const files = fs
      .readdirSync(res("ww1914/ko"))
      .filter(
        (f) =>
          f.startsWith("common.") ||
          f.startsWith(`${tag}.`) ||
          GW_PEOPLE_PACKS.some((x) => f === `${x}.json`),
      );
    const packs = files.map((f) => {
      const pack = GwPackSchema.parse(json(`ww1914/ko/${f}`));
      // common.json's endings are a fallback a country's own text replaces.
      return f === "common.json" ? { ...pack, endings: {} } : pack;
    });
    expect(gwPackOverlaps(packs)).toEqual([]);
  });

  test("every ending has its paragraph, in the pack of the seat it closes", async () => {
    const written: Record<string, string> = {};
    for (const tag of SEATS) {
      const pack = await loadGwPack(tag, async (p) => json(p));
      for (const id of gwEndingsOf(tag)) {
        expect(pack.endings?.[id], `${tag}: ${id}`).toBeTruthy();
      }
      Object.assign(written, pack.endings);
    }
    for (const id of GW_ENDINGS) expect(written[id], id).toBeTruthy();
    for (const t of Object.values(written)) {
      expect(t.replace(/\{(date|casualties)\}/g, "")).not.toMatch(/[{}]/);
    }
  });

  test("every tell has its word and every ending its title", () => {
    const words = [json("lang/ko.json").gw, json("lang/en.json").gw];
    const tells = GW_CONTENT.scenes.flatMap((s) => [
      ...(s.options ?? []).flatMap((o) => o.tell),
      ...Object.values(s.nodes ?? {}).flatMap((n) =>
        n.replies.flatMap((r) => r.tell),
      ),
    ]);
    for (const lang of words) {
      for (const t of new Set(tells.map((x) => x.split(":")[0]))) {
        expect(lang.tell[t], t).toBeTruthy();
      }
      for (const id of GW_ENDINGS) expect(lang.ending[id], id).toBeTruthy();
    }
  });

  test("talks open decisions' options, and the check sees it", () => {
    expect(gwTalkLinks(FOUNDATION_CONTENT.scenes)).toContainEqual({
      talk: "fx_talk",
      key: "heard_chancellor",
      scene: "fx_envoy",
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
