import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { describe, expect, test } from "vitest";

const scene = (id: string) => GW_CONTENT.scenes.find((s) => s.id === id)!;
const opened = GW_CONTENT.scenes.filter((s) => s.starts?.b2 === "o2");

describe("Germany's second bodies and openings", () => {
  test("a good number of talks open another way", () => {
    expect(
      opened.filter((s) => s.id.startsWith("deu_")).length,
    ).toBeGreaterThan(40);
  });

  test("each opening hands on: a way on and a way out", () => {
    for (const s of opened) {
      expect(gwSceneProblems(s), s.id).toEqual([]);
      const replies = s.nodes!.o2.replies;
      expect(replies.length, s.id).toBeGreaterThanOrEqual(2);
      expect(
        replies.some((r) => r.kind === "leave"),
        s.id,
      ).toBe(true);
    }
  });

  test("a copied reply keeps what the first node's reply does", () => {
    const talk = scene("deu_t_beth_vienna");
    const first = talk.nodes![talk.start!].replies;
    for (const r of talk.nodes!.o2.replies) {
      expect(first.find((x) => x.id === r.id)).toEqual(r);
    }
  });

  test("a twin shares its variant's condition", () => {
    const ledger = scene("deu_f_ledger");
    const of = (id: string) => ledger.variants.find((v) => v.id === id)!;
    expect(of("thin2").when).toEqual(of("thin").when);
    expect(ledger.variants[ledger.variants.length - 1].when).toBeUndefined();
  });

  test("a talk of the trenches needs the war", () => {
    expect(JSON.stringify(scene("deu_t2_beth_reform").when)).toContain(
      '"is":"war"',
    );
  });
});
