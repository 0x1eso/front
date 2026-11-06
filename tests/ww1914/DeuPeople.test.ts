import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { DEU_PEOPLE_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/deu_people";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/DEU.people.json"),
    "utf8",
  ),
);

// Keys the other shares write (plan §4-5, §7) and world flags (plan §1).
const OUTSIDE = new Set([
  "k_lich_unread",
  "k_jagow_doubt",
  "k_tirp_command",
  "k_lud_politics",
  "k_hind_victory",
  "k_falk_chief",
  "k_lich_grey",
  "w_tannenberg",
  "w_marne_stopped",
  "f_west_plan",
  "f_east_first",
]);

function conds(c: GwCond | undefined, out: GwCond[] = []): GwCond[] {
  if (c === undefined) return out;
  out.push(c);
  if (c.kind === "all" || c.kind === "any") c.of.forEach((x) => conds(x, out));
  if (c.kind === "not") conds(c.of, out);
  return out;
}

function effects(list: readonly GwEffect[], out: GwEffect[] = []): GwEffect[] {
  for (const e of list) {
    out.push(e);
    if (e.kind === "maybe") effects(e.then, out);
  }
  return out;
}

function allEffects(s: GwScene): GwEffect[] {
  const out: GwEffect[] = [];
  for (const o of s.options ?? []) effects(o.effects, out);
  for (const n of Object.values(s.nodes ?? {})) {
    for (const r of n.replies) {
      effects(r.effects, out);
      for (const x of r.reacts ?? []) effects(x.effects, out);
    }
  }
  return out;
}

function allConds(s: GwScene): GwCond[] {
  const out = conds(s.when);
  for (const v of s.variants) conds(v.when, out);
  for (const o of s.options ?? []) conds(o.when, out);
  for (const e of allEffects(s)) if (e.kind === "maybe") conds(e.when, out);
  for (const n of Object.values(s.nodes ?? {})) {
    for (const v of n.says) conds(v.when, out);
    for (const r of n.replies) {
      conds(r.when, out);
      for (const x of r.reacts ?? []) conds(x.when, out);
    }
  }
  return out;
}

/** Every line of text a scene holds, with where it sits. */
function lines(s: GwScene): [string, string][] {
  const t = pack.scenes[s.id];
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(t.text))
    out.push([`text.${k}`, v as string]);
  for (const [k, v] of Object.entries(t.opt ?? {}))
    out.push([`opt.${k}`, v as string]);
  for (const [k, n] of Object.entries<any>(t.nodes ?? {})) {
    for (const [i, v] of Object.entries(n.says))
      out.push([`${k}.says.${i}`, v as string]);
    for (const [i, v] of Object.entries(n.replies))
      out.push([`${k}.reply.${i}`, v as string]);
    for (const [p, by] of Object.entries<any>(n.saysBy ?? {})) {
      for (const [i, v] of Object.entries(by))
        out.push([`${k}.${p}.${i}`, v as string]);
    }
  }
  for (const r of Object.values<any>(t.voice ?? {})) {
    for (const [p, v] of Object.entries(r))
      out.push([`voice.${p}`, v as string]);
  }
  return out;
}

describe("the people share", () => {
  test("has its 13 scenes, 36 summons talks and 20 visits", () => {
    const talks = DEU_PEOPLE_SCENES.filter((s) => s.kind === "talk");
    expect(DEU_PEOPLE_SCENES.length - talks.length).toBe(13);
    expect(talks.filter((s) => s.summon === true).length).toBe(36);
    expect(talks.filter((s) => s.summon !== true).length).toBe(20);
  });

  test("every scene passes its schema and problems list", () => {
    for (const s of DEU_PEOPLE_SCENES) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the fragment holds every line, and nothing more", () => {
    const ids = DEU_PEOPLE_SCENES.map((s) => s.id).sort();
    expect(Object.keys(pack.scenes).sort()).toEqual(ids);
    for (const s of DEU_PEOPLE_SCENES) {
      const t = pack.scenes[s.id];
      for (const v of s.variants) expect(t.text[v.id], s.id).toBeDefined();
      for (const o of s.options ?? []) {
        expect(t.opt?.[o.id], `${s.id}.${o.id}`).toBeDefined();
        if (o.when !== undefined)
          expect(t.why?.[o.id], `${s.id}.${o.id}`).toBeDefined();
      }
      for (const [id, n] of Object.entries(s.nodes ?? {})) {
        for (const v of n.says)
          expect(t.nodes[id].says[v.id], `${s.id}.${id}`).toBeDefined();
        for (const r of n.replies) {
          expect(
            t.nodes[id].replies[r.id],
            `${s.id}.${id}.${r.id}`,
          ).toBeDefined();
          if (r.when !== undefined)
            expect(t.why?.[r.id], `${s.id}.${r.id}`).toBeDefined();
        }
      }
      if (s.summon === true) expect(t.topic, s.id).toBeDefined();
    }
  });

  test("references lead somewhere", () => {
    const flags = new Set<string>();
    const memories = new Set<string>();
    const ids = new Set(DEU_PEOPLE_SCENES.map((s) => s.id));
    const reasons = new Set(Object.keys(pack.reasons));
    const promises = new Set(Object.keys(pack.promises));
    const people = new Set(GW_PEOPLE.map((p) => p.id));
    for (const s of DEU_PEOPLE_SCENES) {
      for (const e of allEffects(s)) {
        if (e.kind === "flag") flags.add(e.flag);
        if (e.kind === "remember") memories.add(e.key);
        if (e.kind === "reason") expect(reasons.has(e.key), e.key).toBe(true);
        if (e.kind === "promise") expect(promises.has(e.key), e.key).toBe(true);
        if (e.kind === "schedule") expect(ids.has(e.scene), e.scene).toBe(true);
      }
      for (const r of Object.values(s.cast)) {
        if ("person" in r) expect(people.has(r.person), r.person).toBe(true);
      }
    }
    for (const s of DEU_PEOPLE_SCENES) {
      for (const c of allConds(s)) {
        if (c.kind === "flag" && !c.flag.startsWith("f_vac_")) {
          expect(
            flags.has(c.flag) || OUTSIDE.has(c.flag),
            `${s.id} ${c.flag}`,
          ).toBe(true);
        }
        if (c.kind === "memory" && !c.key.startsWith("succeeded_")) {
          expect(
            memories.has(c.key) || OUTSIDE.has(c.key),
            `${s.id} ${c.key}`,
          ).toBe(true);
        }
      }
    }
  });

  test("the plan's keys are all given", () => {
    const memories = new Set(
      DEU_PEOPLE_SCENES.flatMap(allEffects).flatMap((e) =>
        e.kind === "remember" ? [e.key] : [],
      ),
    );
    for (const k of [
      "k_beth_deadline",
      "k_beth_halt",
      "k_beth_countersign",
      "k_beth_aims",
      "k_delb_grain",
      "k_delb_bridge",
      "k_delb_enabling",
      "k_delb_franchise",
      "k_delb_bread",
      "k_kuhn_chest",
      "k_kuhn_ballin",
      "k_kuhn_loan",
      "k_kuhn_navy",
      "k_kuhn_rathenau",
      "k_kuhn_bonds",
      "k_muller_mood",
      "k_muller_cruise",
      "k_muller_tirpitz",
      "k_muller_george",
      "k_muller_moltke",
      "k_muller_denmark",
      "k_heir_dig",
      "k_heir_command",
      "k_heir_west",
      "k_haase_met",
      "k_haase_rally",
      "k_haase_promise",
      "k_haase_arrest",
      "k_haase_belgium",
      "k_haase_second",
      "k_hoyos_deadline",
      "k_cambon_read",
      "k_goschen_conf",
      "k_goschen_warn",
      "k_nicky_hague",
      "k_nicky_trust",
      "k_albert_letter",
      "k_enver_goeben",
      "k_conrad_cry",
      "k_conrad_winter",
    ]) {
      expect(memories.has(k), k).toBe(true);
    }
  });

  test("the style sheet's limits hold", () => {
    const banned =
      /리스크|이슈|시나리오|옵션|파트너|데드라인|핫라인|전략적|시스템|프로세스|컨트롤|메시지|여론조사|총력전|냉전|세계대전|대공황|프로파간다|침묵이 흐른다|공기가 무겁|시계 소리만|창밖을 본다|한숨을 쉰다|입술을 깨문다|잠시 말이 없다|당신/;
    for (const s of DEU_PEOPLE_SCENES) {
      for (const [where, t] of lines(s)) {
        const at = `${s.id}.${where}`;
        expect(t, at).not.toMatch(banned);
        if (where.includes(".reply."))
          expect(t.length, at).toBeLessThanOrEqual(30);
        else if (where.startsWith("opt."))
          expect(t.length, at).toBeLessThanOrEqual(80);
        else if (
          where.includes(".says.") ||
          /^[a-z_]+\.deu_/.test(where) ||
          where.startsWith("voice.")
        ) {
          expect(t.length, at).toBeLessThanOrEqual(120);
        }
      }
      for (const [k, v] of Object.entries<string>(
        pack.scenes[s.id].why ?? {},
      )) {
        expect(v.length, `${s.id}.why.${k}`).toBeLessThanOrEqual(25);
      }
    }
  });

  test("no atrocity is a button: nothing here prices or names one", () => {
    for (const s of DEU_PEOPLE_SCENES) {
      for (const [where, t] of lines(s)) {
        expect(t, `${s.id}.${where}`).not.toMatch(/학살|민간인|인질|루뱅|약탈/);
      }
    }
  });
});
