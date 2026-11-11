// ww177 merge 3: every Imjin scene the four writing lanes wrote (court,
// Japan's politics, Joseon, Japan) is in one registry, has its words in
// both languages, and can be reached: by a trigger whose flags something
// sets, or fired by the engine.
import { IMJIN_CONTENT_PARTS } from "@openfront/engine-lib/imjin/Content";
import {
  IMJIN_FLAGS,
  IMJIN_GFLAGS,
} from "@openfront/engine-lib/imjin/CourtScenes";
import {
  JP_FLAG,
  JP_MARK,
  JP_SCENE,
} from "@openfront/engine-lib/imjin/JapanContent";
import { JOS_RESULTS } from "@openfront/engine-lib/imjin/JoseonContent";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const ROOT = path.join(__dirname, "..", "..");
const lang = (l: string) =>
  JSON.parse(
    fs.readFileSync(path.join(ROOT, "resources", "lang", `${l}.json`), "utf8"),
  );
const PACKS = [lang("en"), lang("ko")];
const has = (key: string) =>
  PACKS.every(
    (p) =>
      typeof key
        .split(".")
        .reduce<unknown>(
          (o, k) =>
            typeof o === "object" && o !== null
              ? (o as Record<string, unknown>)[k]
              : undefined,
          p,
        ) === "string",
  );

function sources(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) sources(p, out);
    else if (p.endsWith(".ts")) out.push(fs.readFileSync(p, "utf8"));
  }
  return out;
}

/** Every `flag` under a node of `kinds` in a content tree. */
function flagsOf(
  v: unknown,
  kinds: readonly string[],
  out = new Set<string>(),
): Set<string> {
  if (Array.isArray(v)) for (const x of v) flagsOf(x, kinds, out);
  else if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    if (kinds.includes(o.kind as string) && typeof o.flag === "string")
      out.add(o.flag);
    for (const x of Object.values(o)) flagsOf(x, kinds, out);
  }
  return out;
}

describe("the Imjin scenes as a whole (merge 3)", () => {
  const P = IMJIN_CONTENT_PARTS;
  const events = P.events.filter((e) => e.id.startsWith("imjin_"));
  const decisions = P.decisions.filter((d) => d.id.startsWith("imjin_"));

  test("one registry, no id twice, every word in both languages", () => {
    expect(events.length).toBeGreaterThanOrEqual(55);
    expect(new Set(P.events.map((e) => e.id)).size).toBe(P.events.length);
    expect(new Set(P.decisions.map((d) => d.id)).size).toBe(P.decisions.length);
    expect(new Set(P.persons.map((p) => p.id)).size).toBe(P.persons.length);
    for (const e of events) {
      expect(has(`ww1936.event_title.${e.id}`), e.id).toBe(true);
      expect(has(`ww1936.event_desc.${e.id}`), e.id).toBe(true);
      for (const o of e.options) {
        expect(has(`ww1936.event_opt.${e.id}.${o.id}`), `${e.id}.${o.id}`).toBe(
          true,
        );
      }
    }
    for (const d of decisions) {
      expect(has(`ww1936.decision.${d.id}`), d.id).toBe(true);
      expect(has(`ww1936.decision_desc.${d.id}`), d.id).toBe(true);
    }
  });

  test("every scene is reached: by a trigger on flags something sets, or by the engine", () => {
    const engine = sources(path.join(ROOT, "packages", "engine", "src")).join(
      "\n",
    );
    const set = flagsOf(
      [P.events.map((e) => e.options), P.decisions, JOS_RESULTS],
      ["set_flag", "set_gflag"],
    );
    // The engine sets these by their constants (JoseonMing, ImjinJapan).
    for (const f of [
      ...Object.values(IMJIN_FLAGS),
      ...Object.values(IMJIN_GFLAGS),
      ...Object.values(JP_FLAG),
      ...Object.values(JP_MARK),
    ])
      set.add(f);
    const fired = new Set<string>(Object.values(JP_SCENE));
    for (const e of events) {
      if (e.trigger === undefined) {
        expect(fired.has(e.id) || engine.includes(`"${e.id}"`), e.id).toBe(
          true,
        );
        continue;
      }
      for (const f of flagsOf(e.trigger, [
        "flag",
        "gflag",
        "days_since_flag_ge",
      ])) {
        expect(set.has(f), `${e.id}: ${f}`).toBe(true);
      }
    }
    for (const d of decisions) {
      for (const f of flagsOf(
        [d.visible, d.available],
        ["flag", "gflag", "days_since_flag_ge"],
      )) {
        expect(set.has(f), `${d.id}: ${f}`).toBe(true);
      }
    }
  });
});
