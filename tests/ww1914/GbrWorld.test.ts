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
import { GBR_WORLD_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gbr_world";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = GwPackSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko/GBR.world.json"),
      "utf8",
    ),
  ),
);

describe("Britain, the world share", () => {
  test("the plan's counts", () => {
    const of = (prefix: string) =>
      GBR_WORLD_SCENES.filter((s) => s.id.startsWith(prefix)).length;
    expect(of("gbr_f_")).toBe(26);
    expect(of("gbr_t_")).toBe(24);
    expect(of("gbr_v_")).toBe(5);
  });

  test("every scene passes the schema and the checks", () => {
    for (const s of GBR_WORLD_SCENES) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line", () => {
    expect(gwPackProblems(GBR_WORLD_SCENES, pack)).toEqual([]);
  });

  test("every talk has a deal, and a way to walk out", () => {
    for (const s of GBR_WORLD_SCENES.filter((x) => x.kind === "talk")) {
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

  test("all ten endings have a paragraph", () => {
    for (const id of [
      "gbr_end_master",
      "gbr_end_dear_win",
      "gbr_end_compromise",
      "gbr_end_neutral",
      "gbr_end_outside",
      "gbr_end_long_peace",
      "gbr_end_island",
      "gbr_end_fell",
      "gbr_end_other_hands",
      "gbr_end_deadline",
    ]) {
      expect(pack.endings?.[id], id).toBeTruthy();
    }
  });

  test("what a share leaves open is only what other shares write", () => {
    const left = gwContentProblems(GBR_WORLD_SCENES, GW_CONTENT.people).filter(
      (p) =>
        !/(flag|memory|seen) \S+ (is never|is no)/.test(p) &&
        // The crisis share's p_king_warn names it as `back`.
        p !== "gbr_v_stamfordham_note: scheduledOnly, and nothing schedules it",
    );
    expect(left).toEqual([]);
  });
});
