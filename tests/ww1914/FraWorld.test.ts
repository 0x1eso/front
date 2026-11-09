import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { FRA_WORLD_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/fra_world";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = GwPackSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko/FRA.world.json"),
      "utf8",
    ),
  ),
);

describe("France, the world share", () => {
  test("the plan's counts", () => {
    const of = (prefix: string) =>
      FRA_WORLD_SCENES.filter((s) => s.id.startsWith(prefix)).length;
    expect(of("fra_f_")).toBe(25);
    expect(of("fra_big_")).toBe(1);
    expect(of("fra_t_")).toBe(24);
    expect(of("fra_v_")).toBe(4);
    expect(FRA_WORLD_SCENES.every((s) => s.nation?.join() === "FRA")).toBe(
      true,
    );
  });

  test("every scene passes the schema and the checks", () => {
    for (const s of FRA_WORLD_SCENES) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line, and every scene has a brief", () => {
    expect(gwPackProblems(FRA_WORLD_SCENES, pack)).toEqual([]);
    for (const s of FRA_WORLD_SCENES) {
      expect(pack.scenes[s.id].brief, s.id).toBeTruthy();
    }
  });

  test("no option shows a price, and every talk has a deal and a way out", () => {
    for (const s of FRA_WORLD_SCENES) {
      for (const o of s.options ?? []) expect(o.tell, s.id).toEqual([]);
      for (const n of Object.values(s.nodes ?? {})) {
        for (const r of n.replies) expect(r.tell, s.id).toEqual([]);
      }
      if (s.kind !== "talk" || s.big === true) continue;
      const replies = Object.values(s.nodes ?? {}).flatMap((n) => n.replies);
      expect(
        replies.some((r) => r.kind === "deal"),
        s.id,
      ).toBe(true);
      expect(
        replies.some((r) => r.kind === "leave"),
        s.id,
      ).toBe(true);
    }
  });

  test("nobody calls the President 폐하, and he calls nobody 경", () => {
    const says = Object.values(pack.scenes).flatMap((t) =>
      Object.values(t.nodes ?? {}).flatMap((n) => Object.values(n.says)),
    );
    const replies = Object.values(pack.scenes).flatMap((t) => [
      ...Object.values(t.opt ?? {}),
      ...Object.values(t.nodes ?? {}).flatMap((n) => Object.values(n.replies)),
    ]);
    for (const t of says) expect(t).not.toMatch(/폐하/);
    for (const t of replies) expect(t).not.toMatch(/(^|\s)경[,.!? ]|폐하/);
  });

  test("what the share leaves open is only what other shares write", () => {
    const left = gwContentProblems(FRA_WORLD_SCENES, GW_CONTENT.people).filter(
      (p) => !/(flag|memory|seen|chose) \S+ (is never|is no)/.test(p),
    );
    expect(left).toEqual([]);
  });

  test("the common pass: France's own scenes stay off its desk, its variants have text", () => {
    const common = (f: string) =>
      GwPackSchema.parse(
        JSON.parse(
          fs.readFileSync(
            path.join(__dirname, `../../resources/ww1914/ko/${f}`),
            "utf8",
          ),
        ),
      );
    const byId = (id: string) => GW_CONTENT.scenes.find((s) => s.id === id)!;
    for (const id of [
      "gw_d_carve_ottoman",
      "gw_d_stockholm",
      "gw_d_fourteen",
      "gw_d_vienna_rumour",
      "gw_d_mecca_letters",
      "gw_d_palestine_word",
      "gw_d_new_front_ask",
      "gw_o_ita_london",
      "gw_o_grc_salonika",
      "gw_n_verdun",
      "gw_n_refusals",
    ]) {
      expect(byId(id).nation, id).not.toContain("FRA");
    }
    const dip = common("common.dip.json");
    const neutral = common("common.neutral.json");
    for (const [id, pack, variants] of [
      ["gw_d_ally_summit", dip, ["fra", "fra_chantilly"]],
      ["gw_d_papal_note", dip, ["fra"]],
      ["gw_d_peace_reply", dip, ["fra"]],
      ["gw_d_sounding", dip, ["fra_late"]],
      ["gw_o_ott_price", neutral, ["fra"]],
    ] as const) {
      const s = byId(id);
      expect(s.nation, id).toContain("FRA");
      expect(gwPackProblems([s], pack), id).toEqual([]);
      for (const v of variants) {
        expect(
          s.variants.map((x) => x.id),
          id,
        ).toContain(v);
      }
    }
    expect(dip.scenes.gw_d_peace_reply.optBy?.fra?.joint_answer).toBeTruthy();
    const dict = common("common.dict.json").dict ?? {};
    for (const k of ["union_sacree", "gqg", "chambre", "elysee", "carnet_b"]) {
      expect(dict[k], k).toBeDefined();
    }
  });
});
