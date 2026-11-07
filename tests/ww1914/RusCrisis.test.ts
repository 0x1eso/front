import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { RUS_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_rus";
import { RUS_CRISIS_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/rus_crisis";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// The fragment joins the Russian pack at merge, so this test reads it alone.
const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/RUS.crisis.json"),
    "utf8",
  ),
);

/** Keys the other Russian shares write, and lane Y's world flags. */
const OUTSIDE = [
  "w_ultimatum_out",
  "w_aut_at_war",
  "w_tannenberg",
  "w_bad_luck_east",
  "f_rus_in_capital",
  "k_alex_friend",
  "k_alex_wire",
  "k_alek_kiev",
  "k_bark_berlin",
  "k_bark_credit",
  "k_bark_vodka",
  "k_danilov_nw",
  "k_ker_amnesty",
  "k_kriv_notready",
  "k_poli_books",
  "k_ras_wire",
  "k_rodz_session",
  "k_yan_letter",
];
/** Scenes of the other shares that this one reads. */
const OTHER_SHARES = [
  "seen rus_h_",
  "seen rus_w_",
  "rus_h_bloc",
  "rus_h_poland_charter",
  "rus_r_abdication",
  "rus_r_sturmer",
  "rus_w_command",
];
/** Britain's file holds him; it joins at merge. */
const OTHER_CASTS = ["gbr_buchanan"];

describe("the 1914 share of 러시아", () => {
  const scenes = RUS_CRISIS_SCENES;

  test("the plan's counts", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    expect(n("rus_c_")).toBe(28);
    expect(n("rus_t_")).toBe(24);
    expect(n("rus_v_")).toBe(6);
  });

  test("every scene passes its schema and its own checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the fragment holds every line", () => {
    expect(gwPackProblems(scenes, pack)).toEqual([]);
  });

  test("no reference leads nowhere but to another share", () => {
    const left = gwContentProblems(
      scenes,
      [...GW_PEOPLE, ...RUS_PEOPLE],
      OUTSIDE,
    ).filter(
      (p) =>
        !OTHER_SHARES.some((x) => p.includes(x)) &&
        !OTHER_CASTS.some((x) => p.includes(x)),
    );
    expect(left).toEqual([]);
  });

  test("every talk can be left and has a deal", () => {
    for (const s of scenes.filter((x) => x.kind === "talk")) {
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

  test("every option a talk locks has a reason, and a real key", () => {
    const written = new Set(
      scenes.flatMap(
        (s) => JSON.stringify(s).match(/"key":"k_[a-z_0-9]+"/g) ?? [],
      ),
    );
    expect(written.size).toBeGreaterThan(20);
    for (const s of scenes) {
      for (const o of s.options ?? []) {
        if (o.when !== undefined) {
          expect(pack.scenes[s.id].why?.[o.id], `${s.id}.${o.id}`).toBeTruthy();
        }
      }
    }
  });
});
