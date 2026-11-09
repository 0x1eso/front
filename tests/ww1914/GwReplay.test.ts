import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { gwReplayId } from "@openfront/engine-lib/ww1914/content/scenes/gw_replay";
import { GW_REPLAY_COUNTS } from "@openfront/engine-lib/ww1914/content/scenes/gw_replay_counts";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "fs";
import path from "path";

const disk = async (p: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources", p), "utf8"),
  );

describe("the common pass of bodies", () => {
  const scenes = gwContent().scenes;
  const entries = Object.entries(GW_REPLAY_COUNTS);

  test("every added body is drawn exactly when the body beside it is", () => {
    for (const [id, likes] of entries) {
      const s = scenes.find((x) => x.id === id)!;
      expect(s, id).toBeDefined();
      for (const [like, count] of Object.entries(likes)) {
        const sibling = s.variants.find((v) => v.id === like)!;
        for (let n = 1; n <= count; n++) {
          const v = s.variants.find((x) => x.id === gwReplayId(like, n))!;
          expect(v, `${id}.${like} ${n}`).toBeDefined();
          expect(v.when).toEqual(sibling.when);
        }
      }
    }
  });

  test("a scene's last body is still its own: nothing falls through to a new one", () => {
    for (const [id] of entries) {
      const s = scenes.find((x) => x.id === id)!;
      expect(s.variants[s.variants.length - 1].id).not.toMatch(/_r\d+$/);
    }
  });

  test("common text speaks to no seat in particular", async () => {
    const packs: GwPack[] = await Promise.all(
      (["DEU", "GBR", "AUH", "RUS", "FRA"] as const).map((t) => loadGwPack(t, disk)),
    );
    for (const pack of packs) {
      for (const [id, likes] of entries) {
        for (const [like, count] of Object.entries(likes)) {
          for (let n = 1; n <= count; n++) {
            const text = pack.scenes[id].text[gwReplayId(like, n)];
            expect(text, `${id}.${like} ${n}`).toBeTruthy();
            expect(text, `${id}.${like} ${n}`).not.toMatch(/폐하|각하|총리님/);
          }
        }
      }
    }
  });

  test("the written text has a body for it and no body without one", async () => {
    const pack = await loadGwPack("DEU", disk);
    for (const [id, likes] of entries) {
      const written = Object.keys(pack.scenes[id].text).filter((k) =>
        /_r\d+$/.test(k),
      );
      const counted = Object.values(likes).reduce((a, b) => a + b, 0);
      expect(written.length, id).toBe(counted);
    }
  });
});
