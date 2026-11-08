// The S2 rows against their scenes and packs (ww158): plots, weaknesses, asks
// and the dossier's papers, per nation. A plot ends by itself (no `end` in its
// scenes), its signs and warning can come again (no `once`), a court or army
// plot is the only fatal kind, no file names the head or his family, and an
// ask's scene answers it.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import {
  gwContentProblems,
  gwSceneEffects,
} from "@openfront/engine-api/ww1914/SceneCheck";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { flag, setFlag } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  GwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { DEU_HOUSE } from "@openfront/engine-lib/ww1914/content/house/houses";
import { answerAsk } from "@openfront/engine-lib/ww1914/content/house/kit";
import { gwDossierScenes } from "@openfront/engine-lib/ww1914/content/scenes/dossier";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import {
  dossierIds,
  dossierTags,
  GW_NO_FILE,
  GW_PLOT_SIGNS,
  houseCalledScenes,
} from "@openfront/engine-lib/ww1914/HouseRows";
import { GW_SEAT_PERSON } from "@openfront/engine/ww1914/Tables";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const res = (p: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources", p), "utf8"),
  );

/** What a country's S2 rows need of its scenes and pack; empty when all is there. */
export function s2Problems(c: GwContent, tag: GwTag, pack: GwPack): string[] {
  const out: string[] = [];
  const scene = (id: string) => c.scenes.find((s) => s.id === id);
  const text = (id: string, need: readonly string[] = []) => {
    const t = pack.scenes[id];
    if (t === undefined) return out.push(`${id}: no text`);
    if (t.brief === undefined) out.push(`${id}: no brief`);
    for (const k of need) {
      if (t.opt?.[k] === undefined && t.text[k] === undefined) {
        out.push(`${id}: no ${k}`);
      }
    }
  };
  const written = (id: string): GwScene | undefined => {
    const s = scene(id);
    if (s === undefined) {
      out.push(`${id}: not written`);
      return undefined;
    }
    if (s.scheduledOnly !== true) out.push(`${id}: not scheduledOnly`);
    if (!s.nation.includes(tag)) out.push(`${id}: not ${tag}'s`);
    text(id);
    return s;
  };
  const people = new Set([
    ...c.people.map((p) => p.id),
    ...Object.keys(pack.people),
  ]);
  const factions = new Set((c.factions ?? []).map((f) => f.id));

  for (const r of (c.plots ?? []).filter((x) => x.tag === tag)) {
    if (pack.plots?.[r.id] === undefined) out.push(`${r.id}: no plot name`);
    if (pack.reasons?.[`plot_${r.id}_end`] === undefined) {
      out.push(`${r.id}: no reasons.plot_${r.id}_end`);
    }
    if (r.steps.length < 2) out.push(`${r.id}: fewer than 2 steps`);
    if (r.plot.signs.length < GW_PLOT_SIGNS) out.push(`${r.id}: too few signs`);
    const ats = r.steps.map((s) => s.at);
    if (ats.some((a, i) => i > 0 && a <= ats[i - 1])) {
      out.push(`${r.id}: steps out of order`);
    }
    if (r.fatal !== (r.plot.end === "removed")) {
      out.push(`${r.id}: only a court or army plot (end removed) is fatal`);
    }
    for (const f of r.plot.by) {
      if (!factions.has(f)) out.push(`${r.id}: no faction ${f}`);
    }
    const ids = [
      ...r.steps.map((s) => s.scene),
      ...r.plot.signs.map((s) => s.scene),
      r.plot.warn,
    ];
    for (const id of ids) {
      const s = written(id);
      if (s === undefined) continue;
      if (s.once === true) out.push(`${id}: once (a new round needs it again)`);
      if (gwSceneEffects(s).some((e) => e.kind === "end")) {
        out.push(`${id}: ends the game itself (the plot does that)`);
      }
    }
  }

  const head = (GW_SEAT_PERSON[tag] ?? []).map((x) => x.person);
  for (const w of (c.weak ?? []).filter((x) =>
    x.person.startsWith(`${tag.toLowerCase()}_`),
  )) {
    if (!people.has(w.person)) out.push(`${w.person}: no such person`);
    if (GW_NO_FILE.includes(w.person) || head.includes(w.person)) {
      out.push(`${w.person}: the head or his family is never in a file`);
    }
    if (w.weak.length < 1 || w.weak.length > 3) {
      out.push(`${w.person}: 1 to 3 weaknesses`);
    }
    for (const k of w.weak) {
      if (k.odds < 0 || k.odds > 100) out.push(`${w.person}: odds ${k.odds}`);
      if (pack.weak?.[w.person]?.[k.id] === undefined) {
        out.push(`${w.person}: no weak line for ${k.id}`);
      }
    }
  }

  for (const a of (c.asks ?? []).filter((x) => x.tag === tag)) {
    if (pack.asks?.[a.id] === undefined) out.push(`${a.id}: no ask name`);
    if (a.from === tag) out.push(`${a.id}: asks itself`);
    if (a.kind === "law") {
      const law = GW_LAWS.find((l) => l.id === a.law);
      if (law === undefined || law.tag !== tag) {
        out.push(`${a.id}: no ${tag} law ${a.law}`);
      }
    }
    const s = written(a.scene);
    if (s === undefined) continue;
    if (a.conference === true && s.big !== true) {
      out.push(`${a.scene}: a conference is a big scene`);
    }
    const answers = gwSceneEffects(s).filter(
      (e) => e.kind === "world" && e.of.do === "ask" && e.of.id === a.id,
    );
    if (answers.length === 0) out.push(`${a.scene}: never answers ${a.id}`);
  }

  if (dossierTags(c).includes(tag)) {
    if (pack.acts?.[dossierIds.act(tag)] === undefined) {
      out.push(`${dossierIds.act(tag)}: no act text`);
    }
    text(dossierIds.report(tag), ["base", "found"]);
    text(dossierIds.unasked(tag));
    text(dossierIds.caught(tag), ["base", "own_up", "deny"]);
    text(dossierIds.scandal(tag));
  }
  return out;
}

describe("the S2 rows", () => {
  test.each(["DEU", "GBR", "AUH", "RUS"] as const)(
    "%s's plots, files and asks have their scenes and text",
    async (tag) => {
      const pack = await loadGwPack(tag, async (p) => res(p));
      expect(s2Problems(GW_CONTENT, tag, pack)).toEqual([]);
    },
  );

  test("the check finds what a lane left out", () => {
    const wire = (id: string, more: Partial<GwScene> = {}): GwScene => ({
      id,
      nation: ["DEU"],
      kind: "wire",
      scheduledOnly: true,
      salience: 5,
      tags: [],
      cast: {},
      variants: [{ id: "base" }],
      ...more,
    });
    const c: GwContent = {
      ...GW_CONTENT,
      scenes: [
        wire("t_s1"),
        wire("t_s2", { once: true }),
        wire("t_w"),
        wire("t_1"),
        wire("t_2", {
          kind: "proposal",
          options: [
            { id: "go", tell: [], effects: [{ kind: "end", ending: "x" }] },
          ],
        }),
        wire("t_ask", {
          kind: "proposal",
          options: [{ id: "x", tell: [], effects: [setFlag("f")] }],
        }),
      ],
      plots: [
        {
          id: "t_pl",
          tag: "DEU",
          regimes: ["empire"],
          from: "1914-01",
          feeds: [],
          steps: [
            { at: 3, scene: "t_1" },
            { at: 6, scene: "t_2" },
          ],
          rest: 6,
          fatal: true,
          plot: {
            by: ["t_none"],
            signs: [
              { at: 1, scene: "t_s1", via: "paper" },
              { at: 2, scene: "t_s2", via: "talk" },
            ],
            warn: "t_w",
            end: "gbr_table",
          },
        },
      ],
      weak: [{ person: "deu_heir", weak: [{ id: "debts", odds: 50 }] }],
      asks: [
        {
          id: "t_a",
          tag: "DEU",
          from: "AUH",
          kind: "loan",
          when: { kind: "chapter", min: 1 },
          scene: "t_ask",
          keep: flag("f"),
          chapters: 3,
          conference: true,
        },
      ],
    };
    const pack: GwPack = { version: 1, scenes: {}, people: {} };
    const got = s2Problems(c, "DEU", pack).join("\n");
    for (const want of [
      "t_pl: no plot name",
      "t_pl: only a court or army plot",
      "t_pl: no faction t_none",
      "t_s2: once",
      "t_2: ends the game itself",
      "deu_heir: the head or his family",
      "t_ask: a conference is a big scene",
      "t_ask: never answers t_a",
    ]) {
      expect(got).toContain(want);
    }
    // An answer is found where the scene gives one.
    const ok = s2Problems(
      {
        ...c,
        scenes: c.scenes.map((s) =>
          s.id === "t_ask"
            ? {
                ...s,
                big: true,
                options: [
                  { id: "y", tell: [], effects: [answerAsk("t_a", true)] },
                ],
              }
            : s,
        ),
      },
      "DEU",
      pack,
    ).join("\n");
    expect(ok).not.toContain("never answers");
    expect(ok).not.toContain("big scene");
  });

  test("the dossier's papers pass the content check, called by the rows", () => {
    const rows = {
      houses: [DEU_HOUSE],
      weak: [
        { person: "deu_tirpitz", weak: [{ id: "debts" as const, odds: 50 }] },
      ],
    };
    const scenes = gwDossierScenes(rows);
    expect(scenes.map((s) => s.id)).toEqual([
      "gw_df_deu",
      "gw_du_deu",
      "gw_dc_deu",
      "gw_dx_deu",
    ]);
    expect(
      gwContentProblems(scenes, GW_CONTENT.people, houseCalledScenes(rows)),
    ).toEqual([]);
  });
});
