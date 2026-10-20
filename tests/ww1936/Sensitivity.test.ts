// World War 1936 P3 (plan Global Constraints, last line; spec §8.4, §19.1):
// the owner's and the host's sensitivity rules, checked on every content
// table and text. Passes on empty tables.
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  allEffectLists,
  BANNED_PERSON_IDS,
  contentTexts,
  en,
  keyIn,
  ko,
  walkEffects,
} from "./contentUtil";

/** Words that must not appear in any content text (en or ko): atrocities as content, colonial-rule events, banned symbols. */
const BANNED_WORDS_EN = [
  /holocaust/i,
  /kristallnacht/i,
  /nanking massacre|nanjing massacre/i,
  /final solution/i,
  /extermination/i,
  /deportation of/i,
  /swastika/i,
  /rising sun flag/i,
  /comfort wom/i,
  /government-general of (korea|chosen|taiwan)/i,
  /kamikaze/i,
];
const BANNED_WORDS_KO = [
  /홀로코스트/,
  /수정의 밤/,
  /난징 대학살/,
  /최종 해결/,
  /절멸/,
  /강제 이주/,
  /하켄크로이츠/,
  /욱일기/,
  /위안부/,
  /조선 총독/,
  /대만 총독/,
  /가미카제/,
];

const banned = new Set<string>(BANNED_PERSON_IDS);
const JAPAN_TITLE_FROM = "1936-02-26";

describe("content sensitivity", () => {
  it("no banned person is in the person table or a leader seat", () => {
    for (const p of CONTENT.persons) expect(banned.has(p.id), p.id).toBe(false);
    for (const c of CONTENT.countries) {
      for (const id of [c.startLeader, ...Object.values(c.leaders)]) {
        if (id !== undefined)
          expect(banned.has(id), `${c.tag} ${id}`).toBe(false);
      }
    }
  });

  it(`Japan's leaders after ${JAPAN_TITLE_FROM} are titles`, () => {
    const jpn = CONTENT.countryIdx.get("JPN");
    // startLeader (1936-01-01, before the date) may be a person.
    for (const id of Object.values(jpn?.leaders ?? {})) {
      expect(id?.startsWith("title:"), `JPN ${id}`).toBe(true);
    }
    for (const [at, list] of allEffectLists()) {
      walkEffects(list, (e) => {
        if (e.kind !== "set_leader" || e.person.startsWith("title:")) return;
        expect(CONTENT.personIdx.get(e.person)?.country, at).not.toBe("JPN");
      });
    }
  });

  it("no content text holds a banned word", () => {
    for (const [lang, json, words] of [
      ["en", en, BANNED_WORDS_EN],
      ["ko", ko, BANNED_WORDS_KO],
    ] as const) {
      for (const [key, text] of contentTexts(json)) {
        for (const w of words)
          expect(w.test(text), `${lang} ${key}`).toBe(false);
      }
    }
  });

  it("nothing is about Korea or Taiwan", () => {
    const bad = /korea|chosen|taiwan|formosa/;
    for (const g of CONTENT.groups) expect(bad.test(g.id), g.id).toBe(false);
    for (const e of CONTENT.events) expect(bad.test(e.id), e.id).toBe(false);
    for (const d of CONTENT.decisions) expect(bad.test(d.id), d.id).toBe(false);
    for (const f of CONTENT.focuses) expect(bad.test(f.id), f.id).toBe(false);
  });

  it("the helpers read the language files", () => {
    expect(keyIn(en, "ww1936.econ.block.no_pp")).toBe(
      "Not enough political power",
    );
  });
});
