// World War 1936 P3 (plan Global Constraints, last line; spec §8.4, §19.1):
// the owner's and the host's sensitivity rules, checked on every content
// table and text. Passes on empty tables.
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { contentTexts, en, keyIn, ko } from "./contentUtil";

/** Words that must not appear in any content text (en or ko): atrocities as content, colonial-rule events, banned symbols. */
// Owner decision 2026-10-31: the old sensitivity rules are abolished; only
// atrocity terms stay banned (no content may make an atrocity a mechanic).
const BANNED_WORDS_EN = [
  /holocaust/i,
  /kristallnacht/i,
  /nanking massacre|nanjing massacre/i,
  /final solution/i,
  /extermination/i,
  /comfort wom/i,
];
const BANNED_WORDS_KO = [
  /홀로코스트/,
  /수정의 밤/,
  /난징 대학살/,
  /최종 해결/,
  /절멸/,
  /강제 이주/,
  /위안부/,
];

/** P5 additions (spec §18.1-2; Korean, English, Japanese romaji). */
const P5_BANNED = [
  /위안소/,
  /위안부/,
  /강제\s*동원/,
  /강제\s*연행/,
  /강제\s*노동/,
  /학살/,
  /보복\s*처형/,
  /731/,
  /세균전/,
  /comfort (women|station)/i,
  /forced (labou?r|mobili[sz]ation)/i,
  /massacre/i,
  /reprisal execution/i,
  /unit 731/i,
  /germ warfare/i,
];
/** P6 additions (spec §24-5, content guidance 7). No bare /고문/: in Korean it is also "advisor" (顧問). */
const P6_BANNED = [
  /unit 731/i,
  /forced labou?r/i,
  /chemical weapon/i,
  /poison gas/i,
  /biological weapon/i,
  /torture/i,
  /화학\s*무기/,
  /독가스/,
  /생물\s*무기/,
];
/**
 * Real arms makers: none may name a state arsenal or a MIO (spec §24, decision
 * 34: the organisations are generic). Checked on the mio_* keys only: persons
 * such as an aircraft designer are a separate table.
 */
const ARMS_MAKERS = [
  /krupp/i,
  /크루프/,
  /mitsubishi/i,
  /미쓰비시/,
  /vickers/i,
  /비커스/,
  /rheinmetall/i,
  /라인메탈/,
  /škoda|skoda/i,
  /슈코다/,
  /ansaldo/i,
  /안살도/,
  /schneider/i,
  /슈나이더/,
  /nakajima/i,
  /나카지마/,
  /messerschmitt/i,
  /메서슈미트/,
  /kawasaki/i,
  /가와사키/,
  /henschel/i,
  /헨셸/,
  /junkers/i,
  /융커스/,
  /breda/i,
  /브레다/,
];
/** The P6 name groups of the arsenals and their trait trees. */
const MIO_KEY_GROUPS = [
  "mio_arch",
  "mio_family",
  "mio_trait",
  "mio_trait_desc",
] as const;
function mioTexts(json: unknown): [string, string][] {
  const out: [string, string][] = [];
  const walk = (o: unknown, at: string) => {
    if (typeof o === "string") out.push([at, o]);
    else if (typeof o === "object" && o !== null) {
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    }
  };
  const root = (json as { ww1936?: Record<string, unknown> }).ww1936 ?? {};
  for (const g of MIO_KEY_GROUPS) walk(root[g], `ww1936.${g}`);
  return out;
}
/** The namespaces P6 added (lane K5), checked whole for P6 banned words. */
const P6_NAME_GROUPS = [
  "ace",
  "agency_up",
  "agency_up_desc",
  "army_spirit",
  "army_spirit_cat",
  "army_spirit_desc",
  "base",
  "cf",
  "cf_desc",
  "codename",
  "dam",
  "design_name",
  "facility",
  "facility_desc",
  "faction_goal",
  "faction_goal_desc",
  "faction_rule",
  "faction_rule_desc",
  "fm_trait",
  "fm_trait_desc",
  "gd",
  "gd_desc",
  "intel_band",
  "intel_mission",
  "intel_mission_desc",
  "landmark",
  "medal",
  "mio_arch",
  "mio_family",
  "mio_trait",
  "mio_trait_desc",
  "module",
  "module_slot",
  "op",
  "op_desc",
  "pack",
  "project",
  "project_desc",
  "raid",
  "raid_desc",
  "role",
  "scientist",
  "subdoc",
  "subdoc_desc",
  "track",
] as const;
/** The content key groups P5's banned words are checked in. */
const P5_KEY_GROUPS = [
  "focus",
  "focus_desc",
  "event_title",
  "event_desc",
  "event_opt",
  "decision",
  "decision_desc",
  "spirit",
  "spirit_desc",
  "news",
  "person",
  "title",
  "gov",
  "group",
  "cw_name",
  "rename",
] as const;
function p5Texts(json: unknown): [string, string][] {
  const out: [string, string][] = [];
  const walk = (o: unknown, at: string) => {
    if (typeof o === "string") out.push([at, o]);
    else if (typeof o === "object" && o !== null) {
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    }
  };
  const root = (json as { ww1936?: Record<string, unknown> }).ww1936 ?? {};
  for (const g of P5_KEY_GROUPS) walk(root[g], `ww1936.${g}`);
  return out;
}
/** Spec §18.1, decisions.md: collaborationist governments, led by titles. */
const COLLABORATION = ["SVK", "HRV", "VIC", "RNG", "MEN", "BRM", "PHL"];
/** Their real heads, never on the name layer. */
const COLLABORATOR_NAMES = [
  /tiso|티소/i,
  /paveli|파벨리/i,
  /p[ée]tain|페탱/i,
  /laval|라발/i,
  /wang jingwei|왕징웨이|汪/i,
  /demchug|demchugdongrub|덕왕|德王/i,
  /ba maw|바모/i,
  /laurel|라우렐/i,
];

describe("content sensitivity", () => {
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

  // ---- P5 (spec §18.1-2, plan decision 32, pre-flight §A U3) ----

  it("no content text holds a P5 banned word", () => {
    for (const lang of [en, ko]) {
      for (const [key, text] of p5Texts(lang)) {
        for (const w of P5_BANNED) expect(w.test(text), key).toBe(false);
      }
    }
  });

  it("no content text holds a P6 banned word", () => {
    for (const lang of [en, ko]) {
      for (const [key, text] of p5Texts(lang)) {
        for (const w of P6_BANNED) expect(w.test(text), key).toBe(false);
      }
    }
  });

  it("no P6 name or text holds a P6 banned word", () => {
    // Every P6 namespace (the names, descriptions and codenames the content
    // tables point at), not only the content key groups.
    const root = (j: unknown) =>
      (j as { ww1936: Record<string, unknown> }).ww1936;
    for (const lang of [en, ko]) {
      const walk = (o: unknown, at: string) => {
        if (typeof o === "string") {
          for (const w of P6_BANNED) expect(w.test(o), at).toBe(false);
        } else if (typeof o === "object" && o !== null) {
          for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
        }
      };
      for (const g of P6_NAME_GROUPS) walk(root(lang)[g], `ww1936.${g}`);
    }
  });

  it("no arsenal or arsenal trait carries a real arms maker's name", () => {
    expect(mioTexts(en).length).toBeGreaterThan(50);
    for (const lang of [en, ko]) {
      for (const [key, text] of mioTexts(lang)) {
        for (const w of ARMS_MAKERS) expect(w.test(text), key).toBe(false);
      }
    }
  });

  it("collaborationist governments are led by titles", () => {
    for (const c of CONTENT.countries) {
      if (!COLLABORATION.includes(c.tag)) continue;
      for (const [ideo, id] of Object.entries(c.leaders)) {
        // The Philippines' own democratic government is its president.
        if (c.tag === "PHL" && ideo === "democratic") continue;
        expect(id?.startsWith("title:"), `${c.tag} ${ideo} ${id}`).toBe(true);
      }
      if (c.startLeader !== undefined && c.tag !== "PHL") {
        expect(c.startLeader.startsWith("title:"), c.tag).toBe(true);
      }
    }
    // The name layer's leader line (ww1936.leader.<TAG>) is an office too.
    for (const tag of COLLABORATION.filter((t) => t !== "PHL")) {
      for (const json of [en, ko]) {
        const text = keyIn(json, `ww1936.leader.${tag}`) ?? "";
        for (const n of COLLABORATOR_NAMES) {
          expect(n.test(text), `${tag} ${text}`).toBe(false);
        }
      }
    }
  });

  it("the helpers read the language files", () => {
    expect(keyIn(en, "ww1936.econ.block.no_pp")).toBe(
      "Not enough political power",
    );
  });
});
