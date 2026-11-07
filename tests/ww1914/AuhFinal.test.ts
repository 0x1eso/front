import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { describe, expect, it } from "vitest";

const scene = (id: string): GwScene => {
  const s = gwContent().scenes.find((x) => x.id === id);
  if (s === undefined) throw new Error(id);
  return s;
};

function leaves(c: GwCond | undefined): GwCond[] {
  if (c === undefined) return [];
  if (c.kind === "all" || c.kind === "any") return c.of.flatMap(leaves);
  return [c];
}
const asksWar = (s: GwScene) =>
  leaves(s.when).some((c) => c.kind === "world" && c.of.is === "war");

describe("Austria's last pass", () => {
  it("every second opening is a talk of its own that can end", () => {
    const talks = gwContent().scenes.filter(
      (s) => s.nation.includes("AUH") && s.starts !== undefined,
    );
    expect(talks.length).toBeGreaterThan(40);
    for (const s of talks) {
      expect(gwSceneProblems(s)).toEqual([]);
      for (const [variant, node] of Object.entries(s.starts ?? {})) {
        expect(s.variants.some((v) => v.id === variant)).toBe(true);
        expect(s.nodes?.[node]).toBeDefined();
      }
    }
  });

  it("a taken-over reply keeps its price", () => {
    const s = scene("auh_v_tisza_resign");
    const keep = s.nodes!.open.replies.find((r) => r.id === "keep")!;
    const again = s.nodes!.b2.replies.find((r) => r.id === "keep")!;
    expect(again.effects).toEqual(keep.effects);
    expect(again.tell).toEqual(keep.tell);
    expect(again.next).toBe("b2s");
  });

  it("the war's talks wait for a war", () => {
    for (const id of [
      "auh_t_zita_brothers",
      "auh_t_cz_king",
      "auh_h_nov_act",
    ]) {
      expect(asksWar(scene(id))).toBe(true);
    }
  });

  it("the empire can't dissolve before mid-1917", () => {
    const dated = leaves(scene("auh_k_new_form").when).filter(
      (c) => c.kind === "world" && c.of.is === "date",
    );
    expect(dated.length).toBe(1);
  });

  it("the funeral's voices belong to the shot", () => {
    const list = scene("auh_c_ischl_wire").voices?.court ?? [];
    expect(list[0].when).toEqual({ kind: "opening", of: ["sarajevo"] });
  });
});
