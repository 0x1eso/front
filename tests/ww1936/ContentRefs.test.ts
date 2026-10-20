// World War 1936 P3 (spec §20.2; plan Task 1 Step 15): every reference in
// the content's effects and conditions names something that exists. Passes
// on empty tables.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { LAW_LADDERS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  Condition,
  RegionPick,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import fs from "fs";
import path from "path";
import {
  allConditions,
  allEffectLists,
  hasKey,
  walkConds,
  walkEffects,
} from "./contentUtil";

const generals = new Set(GENERALS.map((g) => g.id));
const templates = new Set([
  ...CONTENT.templates.map((t) => t.id),
  ...COUNTRY_TAGS.flatMap((t) =>
    [1, 2, 3, 4, 5].flatMap((dev) => startTemplates(t, dev).map((x) => x.key)),
  ),
]);
const factionNames = new Set(CONTENT.factionNames.map((f) => f.id));

/** A person id, or a titled card / titled leader ("title:<id>"). */
const personOk = (id: string) =>
  id.startsWith("title:") || CONTENT.personIdx.has(id);

function selectorRefs(
  s: Selector | undefined,
  out: string[],
  at: string,
): void {
  if (s === undefined || typeof s === "string") return;
  if ("factionLeaderOf" in s) selectorRefs(s.factionLeaderOf, out, at);
  if ("ownerOf" in s && !CONTENT.groupIdx.has(s.ownerOf)) {
    out.push(`${at}: group ${s.ownerOf}`);
  }
}

function pickRefs(p: RegionPick, out: string[], at: string): void {
  if (typeof p === "string") return;
  if ("group" in p && !CONTENT.groupIdx.has(p.group)) {
    out.push(`${at}: group ${p.group}`);
  }
  if ("best" in p && p.of !== undefined && !CONTENT.groupIdx.has(p.of)) {
    out.push(`${at}: group ${p.of}`);
  }
  if ("borderWith" in p && p.borderWith !== "threat") {
    selectorRefs(p.borderWith, out, at);
  }
}

function conditionRefs(
  c: Condition | undefined,
  out: string[],
  at: string,
): void {
  walkConds(c, (leaf) => {
    if ("all" in leaf || "any" in leaf || "not" in leaf) return;
    selectorRefs(leaf.who, out, at);
    const bad = (what: string) => out.push(`${at}: ${leaf.kind} ${what}`);
    switch (leaf.kind) {
      case "focus_done":
      case "focus_in_progress":
        if (!CONTENT.focusIdx.has(leaf.id)) bad(leaf.id);
        break;
      case "decision_taken":
        if (!CONTENT.decisionIdx.has(leaf.id)) bad(leaf.id);
        break;
      case "has_spirit":
        if (!CONTENT.spiritIdx.has(leaf.id)) bad(leaf.id);
        break;
      case "has_advisor":
      case "leader":
        if (!personOk(leaf.person)) bad(leaf.person);
        break;
      case "flag":
      case "gflag":
      case "days_since_flag_ge":
        if (!CONTENT.flagSet.has(leaf.flag)) bad(leaf.flag);
        break;
      case "owns_group":
      case "controls_group":
        if (!CONTENT.groupIdx.has(leaf.group)) bad(leaf.group);
        break;
      case "law":
      case "law_ge":
        if (!LAW_LADDERS[leaf.law].includes(leaf.value)) bad(leaf.value);
        break;
      case "strength_ratio_ge":
        selectorRefs(leaf.vs, out, at);
        break;
      default:
        if ("of" in leaf) selectorRefs(leaf.of, out, at);
    }
  });
}

describe("content references", () => {
  it("every effect names what exists; who is never on if or random_list", () => {
    const out: string[] = [];
    for (const [at, list] of allEffectLists()) {
      walkEffects(list, (e) => {
        const bad = (what: string) => out.push(`${at}: ${e.kind} ${what}`);
        selectorRefs(e.who, out, at);
        switch (e.kind) {
          case "fire_event":
            if (!CONTENT.eventIdx.has(e.id)) bad(e.id);
            selectorRefs(e.to, out, at);
            break;
          case "news":
            if (!hasKey(`ww1936.news.${e.id}`)) bad(e.id);
            break;
          case "unlock_decision":
          case "lock_decision":
          case "take_decision":
            if (!CONTENT.decisionIdx.has(e.id)) bad(e.id);
            break;
          case "add_spirit":
          case "remove_spirit":
            if (!CONTENT.spiritIdx.has(e.id)) bad(e.id);
            break;
          case "swap_spirit":
            if (!CONTENT.spiritIdx.has(e.from)) bad(e.from);
            if (!CONTENT.spiritIdx.has(e.to)) bad(e.to);
            break;
          case "set_leader":
          case "add_advisor_candidate":
          case "remove_advisor":
          case "person_trait":
            if (!personOk(e.person)) bad(e.person);
            break;
          case "set_flag":
          case "clear_flag":
          case "set_gflag":
          case "clear_gflag":
            if (!CONTENT.flagSet.has(e.flag)) bad(e.flag);
            break;
          case "set_law":
            if (!LAW_LADDERS[e.law].includes(e.value)) bad(e.value);
            break;
          case "research_bonus":
            if (e.branch === undefined && e.tech === undefined)
              bad("no target");
            break;
          case "unlock_template":
            if (!templates.has(e.template)) bad(e.template);
            break;
          case "divisions":
            if (!templates.has(e.template)) bad(e.template);
            pickRefs(e.where, out, at);
            break;
          case "add_general":
            if (e.general !== undefined && !generals.has(e.general)) {
              bad(e.general);
            }
            break;
          case "remove_general":
          case "restore_general":
            if (!generals.has(e.general)) bad(e.general);
            break;
          case "war_goal":
            if (e.group !== undefined && !CONTENT.groupIdx.has(e.group)) {
              bad(e.group);
            }
            selectorRefs(e.on, out, at);
            break;
          case "transfer_regions":
            if (!CONTENT.groupIdx.has(e.group)) bad(e.group);
            selectorRefs(e.to, out, at);
            break;
          case "create_faction":
            if (e.name !== undefined && !factionNames.has(e.name)) bad(e.name);
            break;
          case "build":
          case "infra":
          case "rail":
          case "fort":
          case "resource":
            pickRefs(e.where, out, at);
            break;
          case "move_buildings":
            pickRefs(e.from, out, at);
            pickRefs(e.to, out, at);
            break;
          case "if":
          case "random_list":
            if (e.who !== undefined) bad("has who");
            break;
          case "annex":
            selectorRefs(e.target, out, at);
            break;
          case "send_equipment":
            selectorRefs(e.to, out, at);
            break;
          default:
            if ("of" in e && e.of !== "all") selectorRefs(e.of, out, at);
            if ("on" in e) selectorRefs(e.on, out, at);
        }
      });
    }
    expect(out).toEqual([]);
  });

  it("every condition names what exists", () => {
    const out: string[] = [];
    for (const [at, c] of allConditions()) conditionRefs(c, out, at);
    expect(out).toEqual([]);
  });

  it("the country table holds no row or every country of the world map (controller ruling M4)", () => {
    // A country without a row falls back to neutral 50% / 50% (test
    // content); spec §19.10's defaults live in the rows, so none may be
    // missing once the table is filled.
    const scenario = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../resources/maps/world1936/scenario.json"),
        "utf8",
      ),
    ) as { countries: { tag: string }[] };
    if (CONTENT.countries.length === 0) return;
    const missing = scenario.countries
      .map((c) => c.tag)
      .filter((t) => !CONTENT.countryIdx.has(t as never));
    expect(missing).toEqual([]);
    const tags = CONTENT.countries.map((c) => c.tag);
    expect(tags.filter((t, i) => tags.indexOf(t) !== i)).toEqual([]);
  });

  it("the country table, claims, branch points and spirit rules name what exists", () => {
    const out: string[] = [];
    for (const c of CONTENT.countries) {
      for (const s of c.spirits ?? []) {
        if (!CONTENT.spiritIdx.has(s)) out.push(`${c.tag}: spirit ${s}`);
      }
      for (const id of [c.startLeader, ...Object.values(c.leaders)]) {
        if (id !== undefined && !personOk(id)) out.push(`${c.tag}: ${id}`);
      }
    }
    for (const cl of CONTENT.claims) {
      for (const g of cl.groups) {
        if (!CONTENT.groupIdx.has(g)) out.push(`claim ${cl.tag}: ${g}`);
      }
    }
    for (const s of CONTENT.spirits) {
      for (const r of s.rules ?? []) {
        if (
          typeof r === "object" &&
          "dmz" in r &&
          !CONTENT.groupIdx.has(r.dmz)
        ) {
          out.push(`spirit ${s.id}: dmz ${r.dmz}`);
        }
      }
    }
    for (const [tree, list] of Object.entries(CONTENT.paths)) {
      for (const id of list ?? []) {
        if (!id.startsWith("@") && !CONTENT.focusIdx.has(id)) {
          out.push(`path ${tree}: ${id}`);
        }
      }
    }
    expect(out).toEqual([]);
  });
});
