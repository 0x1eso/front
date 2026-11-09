import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwEffect,
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { GW_PEOPLE_COMMON } from "@openfront/engine-lib/ww1914/content/people_common";
import { FRA_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_fra";
import { RUS_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_rus";
import { FRA_CRISIS_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/fra_crisis";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// The fragment joins the French pack at merge, so this test reads it alone.
const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/FRA.crisis.json"),
    "utf8",
  ),
);

/** Keys the other French shares write, and the world's flags. */
const OUTSIDE = [
  "w_ultimatum_out",
  "w_marne_stopped",
  "k_cam_letters",
  "k_carnet_soft",
  "k_cle_paper",
  "k_mal_police",
  "k_pal_tsar",
];
/** Scenes of the other shares that this one reads. */
const OTHER_SHARES = ["fra_h_viviani_tired", "fra_h_vacant", "fra_h_bolo"];

const scenes = FRA_CRISIS_SCENES;
const effectsOf = (id: string): GwEffect[] =>
  JSON.parse(JSON.stringify(scenes.find((s) => s.id === id)));

describe("the crisis and 1914 share of 프랑스", () => {
  test("the plan's counts", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    expect(n("fra_c_")).toBe(26);
    expect(n("fra_big_")).toBe(3);
    expect(n("fra_t_")).toBe(24);
    expect(n("fra_v_")).toBe(6);
  });

  test("every scene passes its schema and its own checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the fragment holds every line, and every scene has a brief", () => {
    expect(gwPackProblems(scenes, pack)).toEqual([]);
    for (const s of scenes) expect(pack.scenes[s.id].brief, s.id).toBeTruthy();
  });

  test("no reference leads nowhere but to another share", () => {
    const left = gwContentProblems(
      scenes,
      [...GW_PEOPLE, ...GW_PEOPLE_COMMON, ...FRA_PEOPLE, ...RUS_PEOPLE],
      OUTSIDE,
    ).filter((p) => !OTHER_SHARES.some((x) => p.includes(x)));
    expect(left).toEqual([]);
  });

  test("no option or reply shows a result before the pick", () => {
    const tells = JSON.stringify(scenes).match(/"tell":\[[^\]]/g);
    expect(tells).toBeNull();
  });

  test("every talk can be left and has a deal", () => {
    for (const s of scenes.filter((x) => x.kind === "talk" && !x.big)) {
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

  test("sailing sets the sea, and every way off the ship clears it", () => {
    const trip = scenes.find((s) => s.id === "fra_c_trip")!;
    for (const o of trip.options!) {
      expect(JSON.stringify(o.effects), o.id).toContain('"flag":"f_at_sea"');
      expect(JSON.stringify(o.effects), o.id).toContain('"fra_big_sea"');
    }
    const sea = scenes.find((s) => s.id === "fra_big_sea")!;
    expect(sea.scheduledOnly).toBe(true);
    for (const r of sea.nodes!.n3.replies) {
      expect(r.effects, r.id).toContainEqual({
        kind: "unflag",
        flag: "f_at_sea",
      });
    }
  });

  test("mobilisation can be put off by a day, and the union is a regime", () => {
    const mob = scenes.find((s) => s.id === "fra_c_mobilise")!;
    expect(mob.options!.map((o) => o.id)).toContain("wait_day");
    expect(JSON.stringify(effectsOf("fra_c_union"))).toContain(
      '{"do":"regime","to":"fra_union"}',
    );
  });

  test("the Carnet B's arrests cost politics and name no harm", () => {
    const all = scenes
      .find((s) => s.id === "fra_c_carnet_b")!
      .options!.find((o) => o.id === "apply_all")!;
    expect(all.effects).toContainEqual({
      kind: "flag",
      flag: "f_carnet_b_used",
    });
    expect(pack.scenes.fra_c_carnet_b.opt?.apply_all).toBeTruthy();
  });

  test("every option a talk locks has a reason, and a real key", () => {
    for (const s of scenes) {
      for (const o of s.options ?? []) {
        if (o.when !== undefined) {
          expect(pack.scenes[s.id].why?.[o.id], `${s.id}.${o.id}`).toBeTruthy();
        }
      }
    }
  });
});
