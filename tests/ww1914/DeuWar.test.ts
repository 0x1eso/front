import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import {
  GwCond,
  GwEffect,
  GwScene,
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { DEU_WAR_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/deu_war";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// The fragment joins DEU.json at merge, so this test reads it on its own.
const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/DEU.war.json"),
    "utf8",
  ),
);

/** Set by the other shares or by the world, not by this file. */
const OUTSIDE_FLAGS = [
  "f_east_first",
  "f_ottoman_signed",
  "f_tirpitz_command",
  "w_bad_luck_east",
  "w_summer_war",
  "w_marne_stopped",
  "w_tannenberg",
];
const OUTSIDE_MEMORY = [
  "broke_k_haase_promise",
  "k_beth_aims",
  "k_cambon_read",
  "k_conrad_cry",
  "k_conrad_winter",
  "k_delb_bread",
  "k_haase_belgium",
  "k_haase_second",
  "k_heir_west",
  "k_jagow_london",
  "k_jagow_poland",
  "k_kuhn_bonds",
  "k_kuhn_navy",
  "k_kuhn_rathenau",
  "k_lich_farewell",
  "k_muller_denmark",
  "k_muller_moltke",
  "k_pour_home",
  "k_tsch_galicia",
  "k_zimm_irish",
  "k_zimm_usa",
];

function condsOf(c: GwCond | undefined, out: GwCond[] = []): GwCond[] {
  if (c === undefined) return out;
  out.push(c);
  if (c.kind === "all" || c.kind === "any") {
    c.of.forEach((x) => condsOf(x, out));
  }
  if (c.kind === "not") condsOf(c.of, out);
  return out;
}

function effectsOf(s: GwScene): GwEffect[] {
  const out: GwEffect[] = [...(s.options ?? []).flatMap((o) => o.effects)];
  for (const n of Object.values(s.nodes ?? {})) {
    for (const r of n.replies) {
      out.push(...r.effects, ...(r.reacts ?? []).flatMap((x) => x.effects));
    }
  }
  return out;
}

function allConds(s: GwScene): GwCond[] {
  const list: (GwCond | undefined)[] = [
    s.when,
    ...s.variants.map((v) => v.when),
    ...(s.options ?? []).map((o) => o.when),
  ];
  for (const n of Object.values(s.nodes ?? {})) {
    list.push(...n.says.map((v) => v.when));
    for (const r of n.replies) {
      list.push(r.when, ...(r.reacts ?? []).map((x) => x.when));
    }
  }
  return list.flatMap((c) => condsOf(c));
}

describe("the war share of 독일 1914년", () => {
  const scenes = DEU_WAR_SCENES;

  test("the plan's counts", () => {
    expect(scenes.filter((s) => s.id.startsWith("deu_w_")).length).toBe(39);
    expect(scenes.filter((s) => s.id.startsWith("deu_t_")).length).toBe(30);
  });

  test("every scene passes its schema and the scene checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line, with no hole left unfilled", () => {
    const hole = /\{([a-z_0-9]+)(?:\.title)?\}/g;
    for (const s of scenes) {
      const t = pack.scenes[s.id];
      expect(t, s.id).toBeDefined();
      const lines: string[] = [];
      for (const v of s.variants) {
        expect(t.text[v.id], `${s.id}.${v.id}`).toBeDefined();
        lines.push(t.text[v.id]);
      }
      for (const o of s.options ?? []) {
        expect(t.opt?.[o.id], `${s.id}.${o.id}`).toBeDefined();
        lines.push(t.opt![o.id]);
        if (o.when !== undefined) {
          expect(t.why?.[o.id], `${s.id}.${o.id}`).toBeDefined();
        }
      }
      for (const [id, n] of Object.entries(s.nodes ?? {})) {
        const nt = t.nodes?.[id];
        for (const v of n.says) {
          expect(nt?.says[v.id], `${s.id}.${id}.${v.id}`).toBeDefined();
          lines.push(nt!.says[v.id]);
        }
        for (const r of n.replies) {
          expect(nt?.replies[r.id], `${s.id}.${id}.${r.id}`).toBeDefined();
          lines.push(nt!.replies[r.id]);
        }
      }
      for (const line of lines) {
        for (const m of line.matchAll(hole)) {
          if (m[1] === "date") continue;
          expect(Object.keys(s.cast), `${s.id}: ${m[0]}`).toContain(m[1]);
        }
      }
      if (s.summon === true) expect(t.topic, s.id).toBeDefined();
    }
  });

  test("flags, memories, people and reasons lead somewhere", () => {
    const people = new Set(GW_PEOPLE.map((p) => p.id));
    const flags = new Set(OUTSIDE_FLAGS);
    const memory = new Set(OUTSIDE_MEMORY);
    for (const s of scenes) {
      for (const e of effectsOf(s)) {
        if (e.kind === "flag") flags.add(e.flag);
        if (e.kind === "remember") memory.add(e.key);
        if (e.kind === "reason") {
          const reasons = (pack as { reasons?: Record<string, string> })
            .reasons;
          expect(reasons?.[e.key], e.key).toBeDefined();
        }
        if (
          "who" in e &&
          e.who !== undefined &&
          "person" in e.who &&
          !people.has(e.who.person)
        ) {
          throw new Error(`${s.id}: no person ${e.who.person}`);
        }
      }
    }
    const ids = new Set(scenes.map((s) => s.id));
    for (const s of scenes) {
      for (const c of allConds(s)) {
        if (c.kind === "flag") expect(flags.has(c.flag), c.flag).toBe(true);
        if (c.kind === "memory") expect(memory.has(c.key), c.key).toBe(true);
        if (c.kind === "seen") expect(ids.has(c.scene), c.scene).toBe(true);
      }
    }
  });

  test("the record card stands alone: no option, no talk, no price", () => {
    const record = scenes.find((s) => s.id === "deu_w_louvain_record")!;
    expect(record.options ?? []).toEqual([]);
    expect(record.nodes).toBeUndefined();
    for (const s of scenes) {
      if (s === record) continue;
      const lines = JSON.stringify(pack.scenes[s.id]);
      for (const place of ["루뱅", "디낭", "안덴", "타민"]) {
        expect(lines.includes(place), `${s.id}: ${place}`).toBe(false);
      }
    }
  });

  test("no two variants of a scene open alike", () => {
    const first = (t: string) => t.split(/(?<=[.!?…])\s/)[0].trim();
    for (const s of scenes) {
      const t = pack.scenes[s.id];
      const groups = [
        t.text,
        ...Object.values(t.nodes ?? {}).map((n) => n.says),
      ];
      for (const g of groups) {
        const firsts = Object.values(g).map(first);
        expect(new Set(firsts).size, s.id).toBe(firsts.length);
      }
    }
  });
});
