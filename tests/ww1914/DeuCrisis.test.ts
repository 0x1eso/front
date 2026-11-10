import { GW_TEMPERAMENTS } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import {
  GwCond,
  GwEffect,
  GwScene,
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { DEU_CRISIS_SCENES as SCENES } from "@openfront/engine-lib/ww1914/content/scenes/deu_crisis";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const file = path.join(__dirname, "../../resources/ww1914/ko/DEU.crisis.json");
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
// `reasons` and `promises` join the pack format with the narrative lane's merge.
const { reasons, promises, ...core } = raw;
const pack = GwPackSchema.parse(core);

const effectsOf = (s: GwScene): GwEffect[] => {
  const out: GwEffect[] = [];
  const add = (l: readonly GwEffect[]) => {
    for (const e of l) {
      out.push(e);
      if (e.kind === "maybe") add(e.then);
    }
  };
  for (const o of s.options ?? []) add(o.effects);
  for (const n of Object.values(s.nodes ?? {})) {
    for (const r of n.replies) {
      add(r.effects);
      for (const x of r.reacts ?? []) add(x.effects);
    }
  }
  return out;
};

const condsOf = (s: GwScene): GwCond[] => {
  const out: GwCond[] = [];
  const add = (c: GwCond | undefined) => {
    if (c === undefined) return;
    out.push(c);
    if (c.kind === "all" || c.kind === "any") c.of.forEach(add);
    if (c.kind === "not") add(c.of);
  };
  add(s.when);
  s.variants.forEach((v) => add(v.when));
  (s.options ?? []).forEach((o) => add(o.when));
  for (const n of Object.values(s.nodes ?? {})) {
    n.says.forEach((v) => add(v.when));
    for (const r of n.replies) {
      add(r.when);
      (r.reacts ?? []).forEach((x) => add(x.when));
    }
  }
  return out;
};

const talks = SCENES.filter((s) => s.kind === "talk");
const decks = SCENES.filter((s) => s.kind !== "talk");
const firstSentence = (t: string) => t.split(/(?<=[.!?…])\s/)[0].trim();

describe("the crisis share", () => {
  test("38 scenes and 30 talks, each checked", () => {
    expect(decks).toHaveLength(38);
    expect(talks).toHaveLength(30);
    for (const s of SCENES) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line", () => {
    for (const s of SCENES) {
      const t = pack.scenes[s.id];
      expect(t, s.id).toBeDefined();
      for (const v of s.variants) expect(t.text[v.id], s.id).toBeDefined();
      for (const o of s.options ?? []) {
        expect(t.opt?.[o.id], `${s.id}.${o.id}`).toBeDefined();
        if (o.when !== undefined) {
          expect(t.why?.[o.id], `${s.id}.${o.id}`).toBeDefined();
        }
      }
      for (const [id, n] of Object.entries(s.nodes ?? {})) {
        const nt = t.nodes?.[id];
        for (const v of n.says) expect(nt?.says[v.id], id).toBeDefined();
        for (const r of n.replies) expect(nt?.replies[r.id], id).toBeDefined();
      }
      if (s.summon === true) expect(t.topic, s.id).toBeDefined();
      for (const e of effectsOf(s)) {
        if (e.kind === "reason") expect(reasons[e.key], e.key).toBeDefined();
        if (e.kind === "promise") expect(promises[e.key], e.key).toBeDefined();
      }
    }
  });

  test("holes name a role of the scene", () => {
    for (const s of SCENES) {
      const roles = Object.keys(s.cast);
      const text = JSON.stringify(pack.scenes[s.id]);
      for (const m of text.matchAll(/\{([a-z_]+)(?:\.title)?\}/g)) {
        if (m[1] !== "date") expect(roles, `${s.id}: ${m[0]}`).toContain(m[1]);
      }
    }
  });

  test("whoever an effect or a condition names is in the scene", () => {
    for (const s of SCENES) {
      for (const x of [...effectsOf(s), ...condsOf(s)]) {
        const who = (x as { who?: { role?: string } }).who;
        if (who?.role !== undefined) {
          expect(Object.keys(s.cast), s.id).toContain(who.role);
        }
      }
    }
  });

  test("two variants of a scene never open alike", () => {
    for (const s of SCENES) {
      const t = pack.scenes[s.id];
      const bodies = [
        ...Object.values(t.text),
        ...Object.values(t.nodes ?? {}).flatMap((n) => Object.values(n.says)),
      ].map(firstSentence);
      expect(new Set(bodies).size, s.id).toBe(bodies.length);
    }
  });

  test("a voice belongs to a cast role and a real person", () => {
    const ids = new Set(GW_PEOPLE.map((p) => p.id));
    for (const s of SCENES) {
      for (const [role, by] of Object.entries(pack.scenes[s.id].voice ?? {})) {
        expect(s.cast[role], `${s.id}.${role}`).toBeDefined();
        for (const who of Object.keys(by)) {
          expect(ids.has(who), `${s.id}: ${who}`).toBe(true);
        }
      }
    }
  });

  test("every talk: all four kinds of reply at the door, and two moods", () => {
    for (const s of talks) {
      const open = s.nodes![s.start!];
      const kinds = new Set(open.replies.map((r) => r.kind));
      expect(kinds.has("leave"), s.id).toBe(true);
      expect(kinds.has("ask"), s.id).toBe(true);
      expect(kinds.size, s.id).toBeGreaterThanOrEqual(3);
      expect(open.says.length, s.id).toBeGreaterThanOrEqual(2);
      const nodes = Object.keys(s.nodes!).length;
      expect(nodes, s.id).toBeGreaterThanOrEqual(3);
      expect(nodes, s.id).toBeLessThanOrEqual(6);
      const temper = (c: GwCond | undefined) =>
        c !== undefined && JSON.stringify(c).includes('"temperament"');
      expect(
        open.says.some((v) => temper(v.when)),
        s.id,
      ).toBe(true);
    }
  });

  test("a temperament in a talk is one that person can have", () => {
    for (const s of talks) {
      const rule = s.cast.p as { person: string };
      const range = GW_PEOPLE.find((p) => p.id === rule.person)!.temperaments;
      for (const c of condsOf(s)) {
        if (c.kind !== "temperament") continue;
        for (const t of c.of) {
          expect(GW_TEMPERAMENTS).toContain(t);
          expect(range, `${s.id}: ${t}`).toContain(t);
        }
      }
    }
  });

  test("a key a decision here asks of this share's talks is written", () => {
    const written = new Set(
      SCENES.flatMap(effectsOf)
        .filter((e) => e.kind === "remember")
        .map((e) => (e as { key: string }).key),
    );
    const ours = /^k_(jagow|zimm|lich|pour|tsch)_/;
    const asked = decks
      .flatMap(condsOf)
      .filter((c) => c.kind === "memory" && ours.test(c.key))
      .map((c) => (c as { key: string }).key);
    for (const k of asked) expect(written, k).toContain(k);
  });

  test("a flag read here is set here, or is the war share's to read", () => {
    const set = new Set(
      SCENES.flatMap(effectsOf)
        .filter((e) => e.kind === "flag")
        .map((e) => (e as { flag: string }).flag),
    );
    for (const c of SCENES.flatMap(condsOf)) {
      if (c.kind === "flag") expect(set, c.flag).toContain(c.flag);
    }
    expect(set).toContain("f_west_plan");
    expect(set).toContain("f_east_first");
    expect(set).toContain("f_ottoman_signed");
  });

  test("a promise kept in a decision was made in a talk", () => {
    const made = new Set(Object.keys(promises));
    for (const e of SCENES.flatMap(effectsOf)) {
      // The war speech keeps a promise of the people share's talk.
      if (e.kind === "keep_promise" && e.key !== "k_haase_promise") {
        expect(made, e.key).toContain(e.key);
      }
    }
  });
});
