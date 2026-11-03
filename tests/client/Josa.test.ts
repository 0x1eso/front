import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { applyJosa } from "../../src/client/Josa";
import { translateText } from "../../src/client/Utils";

const ko: Record<string, unknown> = JSON.parse(
  readFileSync("resources/lang/ko.json", "utf8"),
);

function flat(o: Record<string, unknown>, p = ""): [string, string][] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === "string"
      ? [[p + k, v] as [string, string]]
      : flat(v as Record<string, unknown>, `${p}${k}.`),
  );
}

describe("applyJosa", () => {
  it("picks by the final sound of Hangul words", () => {
    expect(applyJosa("이탈리아이(가) 선전포고")).toBe("이탈리아가 선전포고");
    expect(applyJosa("독일이(가)")).toBe("독일이");
    expect(applyJosa("크롬을(를)")).toBe("크롬을");
    expect(applyJosa("철을(를)")).toBe("철을");
    expect(applyJosa("영국은(는)")).toBe("영국은");
    expect(applyJosa("소련은(는)")).toBe("소련은");
    expect(applyJosa("프랑스과(와) 영국")).toBe("프랑스와 영국");
    expect(applyJosa("독일과(와)")).toBe("독일과");
    expect(applyJosa("독일와(과)")).toBe("독일과");
  });

  it("(으)로: no final or ㄹ takes 로, any other final takes 으로", () => {
    expect(applyJosa("파리(으)로")).toBe("파리로");
    expect(applyJosa("서울(으)로")).toBe("서울로");
    expect(applyJosa("베를린(으)로")).toBe("베를린으로");
  });

  it("reads digits as Korean does", () => {
    expect(applyJosa("크롬 2을(를)")).toBe("크롬 2를");
    expect(applyJosa("정치력 40(으)로")).toBe("정치력 40으로");
    expect(applyJosa("1(으)로 7(으)로 8(으)로")).toBe("1로 7로 8로");
    expect(applyJosa("3(으)로 6(으)로 10(으)로 100(으)로 1000(으)로")).toBe(
      "3으로 6으로 10으로 100으로 1000으로",
    );
    expect(applyJosa("0은(는) 1은(는) 2은(는) 4은(는) 5은(는) 9은(는)")).toBe(
      "0은 1은 2는 4는 5는 9는",
    );
    expect(applyJosa("1,200이(가) 1,000이(가) 30이(가) 3.5이(가)")).toBe(
      "1,200이 1,000이 30이 3.5가",
    );
  });

  it("falls back for Latin letters and other endings", () => {
    expect(applyJosa("Paul을(를) Rome을(를) Kim을(를)")).toBe(
      "Paul을 Rome를 Kim을",
    );
    expect(applyJosa("[독일]이(가) 「영국」을(를) 40%이(가)")).toBe(
      "[독일]이 「영국」을 40%가",
    );
  });

  it("leaves a marker with no word before it", () => {
    expect(applyJosa("이(가) 있다")).toBe("이(가) 있다");
    expect(applyJosa("독일 이(가)")).toBe("독일 이(가)");
    expect(applyJosa("no marker")).toBe("no marker");
  });
});

describe("ko.json", () => {
  it("writes a particle after a placeholder only as a marker", () => {
    const bad = flat(ko).filter(([, v]) =>
      /\}(이|가|을|를|은|는|과|와|으로|로)(?!\()/.test(v),
    );
    // "}이후" style words are not particles: none exist today.
    expect(bad).toEqual([]);
  });
});

describe("translateText in Korean", () => {
  afterEach(() => {
    document.querySelector("lang-selector")?.remove();
    (translateText as any).langSelector = null;
    (translateText as any).formatterCache = new Map();
    (translateText as any).lastLang = null;
  });

  function setLang(lang: string, translations: Record<string, string>) {
    const el = document.createElement("lang-selector") as any;
    el.currentLang = lang;
    el.translations = translations;
    el.defaultTranslations = {};
    document.body.appendChild(el);
    (translateText as any).langSelector = null;
  }

  it("fits the particle to the substituted word", () => {
    setLang("ko", {
      "a.war": "{who}이(가) {target}에 선전포고했습니다",
      "a.res": "{res} {n}을(를) 얻었습니다",
      "a.pp": "정치력 {n}(으)로",
      "a.plain": "국가이(가)",
    });
    expect(
      translateText("a.war", { who: "이탈리아", target: "오스트리아" }),
    ).toBe("이탈리아가 오스트리아에 선전포고했습니다");
    expect(translateText("a.res", { res: "크롬", n: 2 })).toBe(
      "크롬 2를 얻었습니다",
    );
    expect(translateText("a.pp", { n: 40 })).toBe("정치력 40으로");
    expect(translateText("a.plain")).toBe("국가가");
  });

  it("does not touch other languages", () => {
    setLang("en", { "a.war": "{who}이(가) x" });
    expect(translateText("a.war", { who: "Italy" })).toBe("Italy이(가) x");
  });
});
