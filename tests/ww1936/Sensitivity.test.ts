// World War 1936 P3 (plan Global Constraints, last line; spec §8.4, §19.1):
// the owner's and the host's sensitivity rules, checked on every content
// table and text. Passes on empty tables.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { JPN_DECISIONS } from "@openfront/engine-lib/ww1936/content/decisions/jpn";
import { JPN_EVENTS } from "@openfront/engine-lib/ww1936/content/events/jpn";
import { JPN_FOCUSES } from "@openfront/engine-lib/ww1936/content/focus/jpn";
import { PERSONS_JPN } from "@openfront/engine-lib/ww1936/content/persons/jpn";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { SPIRITS_JPN } from "@openfront/engine-lib/ww1936/content/spirits/jpn";
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

/** P5 additions (spec §18.1-2; Korean, English, Japanese romaji). */
const P5_BANNED = [
  /대동아\s*공영권/,
  /팔굉일우/,
  /황국/,
  /내선\s*일체/,
  /국가\s*총동원법/,
  /창씨\s*개명/,
  /가미카제/,
  /특공/,
  /위안소/,
  /위안부/,
  /강제\s*동원/,
  /강제\s*연행/,
  /강제\s*노동/,
  /학살/,
  /보복\s*처형/,
  /731/,
  /세균전/,
  /욱일/,
  /co-?prosperity sphere/i,
  /hakko ichiu/i,
  /kokutai/i,
  /naisen ittai/i,
  /national mobili[sz]ation law/i,
  /kamikaze/i,
  /tokko|tokkō/i,
  /comfort (women|station)/i,
  /forced (labou?r|mobili[sz]ation)/i,
  /massacre/i,
  /reprisal execution/i,
  /unit 731/i,
  /germ warfare/i,
  /rising sun/i,
  /ustaše|ustase|ustasha/i,
];
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
/** Plan decision 32: the groups only the peace and claim tables may name. */
const PEACE_ONLY_GROUPS = ["korea_north", "korea_south", "taiwan"];
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
    // P5 plan decision 32: the three groups of the peace and claim tables.
    for (const g of CONTENT.groups) {
      if (PEACE_ONLY_GROUPS.includes(g.id)) continue;
      expect(bad.test(g.id), g.id).toBe(false);
    }
    for (const e of CONTENT.events) expect(bad.test(e.id), e.id).toBe(false);
    for (const d of CONTENT.decisions) expect(bad.test(d.id), d.id).toBe(false);
    for (const f of CONTENT.focuses) expect(bad.test(f.id), f.id).toBe(false);
  });

  // ---- P5 (spec §18.1-2, plan decision 32, pre-flight §A U3) ----

  it("Japan's content names no Korean or Taiwanese region", () => {
    const korea = /"(korea_[a-z_]*|taiwan[a-z_]*)"/;
    const japanese = [
      ...JPN_FOCUSES,
      ...JPN_EVENTS,
      ...JPN_DECISIONS,
      ...SPIRITS_JPN,
      ...CONTENT.focuses.filter((x) => x.id.startsWith("jpn_")),
      ...CONTENT.events.filter((x) => x.id.startsWith("jpn_")),
      ...CONTENT.decisions.filter((x) => x.id.startsWith("jpn_")),
      ...CONTENT.spirits.filter((x) => x.id.startsWith("jpn_")),
    ];
    for (const x of japanese) {
      expect(korea.test(JSON.stringify(x)), x.id).toBe(false);
    }
  });

  it("the Korean and Taiwanese groups are used by the peace and claim tables only", () => {
    const named = new RegExp(`"(${PEACE_ONLY_GROUPS.join("|")})"`);
    const others: [string, unknown][] = [
      ["focuses", CONTENT.focuses],
      ["events", CONTENT.events],
      ["decisions", CONTENT.decisions],
      ["spirits", CONTENT.spirits],
      ["beats", CONTENT.beats],
      ["countries", CONTENT.countries],
      ["cores", CONTENT.cores],
      ["seeds", CONTENT.seeds],
      ["occupation", CONTENT.occupationDefaults],
      ["templates", CONTENT.templates],
    ];
    for (const [at, table] of others) {
      expect(named.test(JSON.stringify(table)), at).toBe(false);
    }
    // No Korean or Taiwanese country exists to free or to be.
    for (const t of COUNTRY_TAGS) {
      expect(/^(KOR|TWN|CHO|FOR)/.test(t), t).toBe(false);
    }
  });

  it("no content text holds a P5 banned word", () => {
    for (const lang of [en, ko]) {
      for (const [key, text] of p5Texts(lang)) {
        for (const w of P5_BANNED) expect(w.test(text), key).toBe(false);
      }
    }
  });

  it("Japan's persons are titles", () => {
    // P5 K2's table (P3's leaders.ts keeps its 1936-01-01 start leader).
    for (const p of PERSONS_JPN) {
      expect(
        p.id.startsWith("title") || p.nameKey.startsWith("ww1936.title."),
        p.id,
      ).toBe(true);
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
