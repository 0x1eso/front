import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwChoiceView,
  GwPromiseView,
} from "@openfront/engine-api/ww1914/GwView";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  dictIndex,
  dictLines,
  splitTerms,
} from "../../../src/client/hud/ww1914/GwDictModel";
import {
  GW_TABS,
  govWord,
  keyDecisions,
  promisesInOrder,
} from "../../../src/client/hud/ww1914/GwModel";
import {
  decisionLine,
  fileLine,
  promiseText,
} from "../../../src/client/hud/ww1914/GwText";

const pack: GwPack = {
  version: 1,
  scenes: {
    s1: {
      title: "티서의 편지",
      text: { base: "x" },
      opt: {
        go: "**{fm}에게 맡긴다.** 뒷말이다.",
        plain: "그냥 쓴 말이다. 뒷말이다.",
      },
    },
  },
  people: {
    deu_moltke: { name: "몰트케", lean: "군부", bio: "대 몰트케의 조카." },
    p1: { name: "폴", lean: "x" },
  },
  dict: {
    reichstag: { terms: ["제국의회"], text: "독일 의회.", tags: ["DEU"] },
    reichsrat: { terms: ["제국의회"], text: "빈의 의회.", tags: ["AUH"] },
    stavka: { terms: ["사령부"], text: "군 사령부." },
    plot: {
      terms: ["구치코프의 모의"],
      secret: "rus_palace_plot",
      text: "기차를 세우려는 모의.",
    },
    hand: {
      terms: ["검은 손"],
      text: "장교 결사의 이름.",
      more: [{ secret: "srb_officers_plot", text: "내각은 몰랐다." }],
    },
  },
};

describe("the dictionary", () => {
  test("a name or term is found once, at the start of a word", () => {
    const idx = dictIndex(pack, "DEU", []);
    const parts = splitTerms(
      "몰트케가 사령부로 갔다. 몰트케는 총사령부에 있다.",
      idx,
    );
    const refs = parts.filter((p) => p.ref !== null);
    expect(refs.map((p) => p.text)).toEqual(["몰트케", "사령부"]);
    expect(parts.map((p) => p.text).join("")).toBe(
      "몰트케가 사령부로 갔다. 몰트케는 총사령부에 있다.",
    );
  });

  test("one letter is no name", () => {
    const idx = dictIndex(pack, "DEU", []);
    expect(splitTerms("폴이 왔다", idx).every((p) => p.ref === null)).toBe(
      true,
    );
  });

  test("a longer word isn't the name it starts with", () => {
    const p2: GwPack = {
      ...pack,
      people: { auh_karl: { name: "카를", lean: "x" } },
      dict: { sign: { terms: ["부서"], text: "수상의 서명." } },
    };
    const idx = dictIndex(p2, "DEU", []);
    const refs = (t: string) =>
      splitTerms(t, idx).filter((p) => p.ref !== null);
    expect(refs("몰트케는 카를스바트로 갔다. 다리가 부서졌다.")).toEqual([]);
    expect(refs("카를이 부서를 거부했다.").map((p) => p.text)).toEqual([
      "카를",
      "부서",
    ]);
  });

  test("a name means the seat's own person, a title only its own court", () => {
    const people: GwPack["people"] = {
      deu_ebert: { name: "에베르트", lean: "x" },
      rus_evert: { name: "에베르트", lean: "x" },
      deu_empress: { name: "황후", lean: "x" },
      gbr_bertie: { name: "버티", lean: "x" },
      gbr_wilson: { name: "윌슨", lean: "x" },
      usa_wilson: { name: "윌슨", lean: "x" },
    };
    const p2 = { ...pack, people };
    const of = (tag: "DEU" | "RUS" | "GBR", t: string) =>
      splitTerms(t, dictIndex(p2, tag, []))[0].ref?.id;
    expect(of("DEU", "에베르트")).toBe("deu_ebert");
    expect(of("RUS", "에베르트")).toBe("rus_evert");
    expect(of("DEU", "황후")).toBe("deu_empress");
    expect(of("RUS", "황후")).toBeUndefined();
    expect(of("DEU", "버티면 된다")).toBeUndefined();
    expect(of("DEU", "윌슨")).toBe("usa_wilson");
    expect(of("GBR", "윌슨")).toBeUndefined();
  });

  test("the same word means the seat's own body", () => {
    const de = splitTerms("제국의회", dictIndex(pack, "DEU", []));
    const au = splitTerms("제국의회", dictIndex(pack, "AUH", []));
    expect(de[0].ref?.id).toBe("reichstag");
    expect(au[0].ref?.id).toBe("reichsrat");
  });

  test("a secret not found isn't there at all", () => {
    const text = "구치코프의 모의를 들었다.";
    const before = dictIndex(pack, "RUS", []);
    expect(splitTerms(text, before).every((p) => p.ref === null)).toBe(true);
    expect(dictLines(pack, "plot", [])).toEqual([]);
    const after = dictIndex(pack, "RUS", ["rus_palace_plot"]);
    expect(splitTerms(text, after)[0].ref?.id).toBe("plot");
    expect(dictLines(pack, "plot", ["rus_palace_plot"]).length).toBe(1);
  });

  test("a line tied to a secret waits for it", () => {
    expect(dictLines(pack, "hand", [])).toEqual(["장교 결사의 이름."]);
    expect(dictLines(pack, "hand", ["srb_officers_plot"])).toEqual([
      "장교 결사의 이름.",
      "내각은 몰랐다.",
    ]);
  });

  test("the real dictionary parses, and its secrets are the game's", () => {
    const file = path.join(
      __dirname,
      "../../../resources/ww1914/ko/common.dict.json",
    );
    const real = GwPackSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    expect(Object.keys(real.dict ?? {}).length).toBeGreaterThan(40);
    const secrets = (e: NonNullable<GwPack["dict"]>[string]) => [
      ...(e.secret === undefined ? [] : [e.secret]),
      ...(e.more ?? []).map((m) => m.secret),
    ];
    const ids = Object.values(real.dict ?? {}).flatMap(secrets);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+_[a-z_]+$/);
    }
    expect(GW_CONTENT.people.length).toBeGreaterThan(0);
  });
});

describe("the notebook", () => {
  const p = (key: string, due: string, kept = false, broken = false) =>
    ({ key, who: "x", due, kept, broken }) as GwPromiseView;

  test("open promises come first, the nearest on top", () => {
    const rows = promisesInOrder([
      p("kept", "1915-01-01", true),
      p("far", "1916-01-01"),
      p("near", "1915-03-01"),
      p("broke", "1915-02-01", false, true),
    ]);
    expect(rows.map((x) => x.key)).toEqual(["near", "far", "broke", "kept"]);
  });

  test("only the big decisions, the latest first", () => {
    const c = (scene: string, key: boolean) =>
      ({
        scene,
        pick: "go",
        date: "1914-07-05",
        proxy: false,
        key,
      }) as GwChoiceView;
    const rows = keyDecisions([c("a", true), c("b", false), c("c", true)]);
    expect(rows.map((x) => x.scene)).toEqual(["c", "a"]);
    const again = keyDecisions([c("a", true), c("c", true), c("a", true)]);
    expect(again.map((x) => x.scene)).toEqual(["a", "c"]);
  });

  test("a decision reads as its title and bold line, with the names in it", () => {
    const d = {
      scene: "s1",
      pick: "go",
      date: "1914-07-05",
      proxy: false,
      cast: { fm: "deu_moltke" },
    };
    expect(decisionLine(pack, d)).toEqual({
      title: "티서의 편지",
      pick: "몰트케에게 맡긴다.",
    });
    const plain = { ...d, pick: "plain" };
    expect(decisionLine(pack, plain).pick).toBe("그냥 쓴 말이다.");
  });

  test("the tab is on the drawer, and a threat has a word for each step", () => {
    expect(GW_TABS).toContain("notebook");
    const g = { id: "x", steps: 3, fatal: true, feeds: [] };
    expect([0, 1, 2, 3].map((step) => govWord({ ...g, step }))).toEqual([
      0, 1, 2, 3,
    ]);
  });
});

describe("the 서류철 (ww158)", () => {
  const p2: GwPack = {
    ...pack,
    weak: { deu_moltke: { debts: "몰트케의 빚 장부" } },
    asks: { t_ask: { name: "빈의 차관 요청" } },
  };
  const file = {
    uid: 1,
    who: "deu_moltke",
    weak: "debts" as const,
    stamp: "unconfirmed" as const,
    chapter: 3,
    used: 0,
    out: false,
    end: null,
  };

  test("a file reads as the pack writes it", () => {
    expect(fileLine(p2, file)).toBe("몰트케의 빚 장부");
  });

  test("a yes to an ally is listed by the ask's name", () => {
    const p: GwPromiseView = {
      key: "ask_t_ask",
      who: "deu_moltke",
      due: "1915-03-01",
      kept: false,
      broken: false,
    };
    expect(promiseText(p2, p)).toBe("빈의 차관 요청");
  });
});
