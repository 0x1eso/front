// World War 1936 P5 (plan Task 12): the endgame screens' texts and the
// notification keys exist in en and ko with the same ICU arguments.
import {
  DEMAND_KINDS,
  MEMBER_STATES,
  OCCUPATION_LAWS,
  SUBJECT_LEVELS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import IntlMessageFormat from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { en, hasKey, keyIn, ko } from "./contentUtil";

const EVENTS = [
  "exiled",
  "exile_returned",
  "exile_ended",
  "conference_opened",
  "conference_round",
  "conference_result",
  "country_created",
  "subject_level",
  "autonomy_request",
  "occ_law",
  "garrison_short",
  "uprising",
  "ll_arrived",
  "volunteers_arrived",
  "volunteers_recalled",
  "captured",
  "takeover",
  "spectating",
  // Batch 21: lane S's notice; lane A's per-reason stop keys replaced
  // ll_blocked and ll_contract_stopped (no sender: deleted).
  "subject_restricted",
].map((k) => `events_display.ww1936_${k}`);

const LISTS: string[] = [
  ...DEMAND_KINDS.flatMap((k) => [
    `ww1936.demand.${k}`,
    `ww1936.peace.line.${k}`,
  ]),
  ...OCCUPATION_LAWS.flatMap((k) => [
    `ww1936.occ_law.${k}`,
    `ww1936.occ_law_desc.${k}`,
  ]),
  ...SUBJECT_LEVELS.map((k) => `ww1936.subject_level.${k}`),
  ...MEMBER_STATES.map((k) => `ww1936.member_state.${k}`),
  ...["spain", "spanish_republic", "serbia"].map((k) => `ww1936.rename.${k}`),
  ...[
    "peace_conference",
    "peace_treaty",
    "exiled",
    "exile_returned",
    "country_created",
    "uprising",
    "civil_war",
    "takeover",
  ].map((k) => `ww1936.news.news_${k}`),
];

const SCREEN = ["peace", "occ", "aid", "subject", "exile", "takeover", "war"];

const argNames = (text: string, lang: string): string[] => {
  const out = new Set<string>();
  const walk = (nodes: any[]): void => {
    for (const n of nodes) {
      if (n.type !== 0 && typeof n.value === "string") out.add(n.value);
      if (n.options) {
        for (const o of Object.values<any>(n.options)) walk(o.value);
      }
    }
  };
  walk(new IntlMessageFormat(text, lang).getAst() as any[]);
  return [...out].sort();
};

const screenKeys = (json: unknown): string[] => {
  const out: string[] = [];
  const walk = (o: unknown, at: string) => {
    if (typeof o === "string") out.push(at);
    else if (typeof o === "object" && o !== null) {
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    }
  };
  const root = json as Record<string, Record<string, unknown>>;
  for (const g of SCREEN) walk(root.ww1936[g], `ww1936.${g}`);
  return out;
};

describe("P5 endgame translations", () => {
  it("every list, screen and notification key has en and ko text", () => {
    const screen = screenKeys(en);
    expect(screen.length).toBeGreaterThan(150);
    for (const k of [...LISTS, ...screen, ...EVENTS]) {
      expect(hasKey(k), k).toBe(true);
    }
  });

  it("ko has no screen key that en lacks", () => {
    const enKeys = new Set(screenKeys(en));
    for (const k of screenKeys(ko)) expect(enKeys.has(k), k).toBe(true);
  });

  it("en and ko use the same ICU arguments", () => {
    const keys = [...LISTS, ...EVENTS, ...screenKeys(en)];
    for (const k of keys) {
      const e = keyIn(en, k);
      const o = keyIn(ko, k);
      expect(e, `en ${k}`).toBeDefined();
      expect(o, `ko ${k}`).toBeDefined();
      expect(argNames(o!, "ko"), k).toEqual(argNames(e!, "en"));
    }
  });

  it("the Korea zone text is neutral", () => {
    const t = keyIn(ko, "ww1936.occ.zone_korea")!;
    expect(t).toContain("분할 점령");
    expect(t).not.toMatch(/식민|침략|해방군/);
  });
});
