// World War 1936 ww107: the automatic support companies of a country's
// templates, humans' and the AI's alike. One rule for adding and dropping
// (engine-lib AutoCompanies): the check runs every WW_AUTO_COMPANY_DAYS, one
// change per template, through the ordinary template save and refit.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NEED_GROUP_COUNT,
  NEED_GROUPS,
  SupportId,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  AI_TRAIN_FILL_PM,
  autoCompanyTarget,
  companyBit,
  hasAutoCompanies,
  nextAutoCompany,
  WW_AUTO_COMPANY_DAYS,
} from "@openfront/engine-lib/ww1936/AutoCompanies";
import { SUPPORTS } from "@openfront/engine-lib/ww1936/Battalions";
import {
  equipByType,
  GEN1,
  groupStock,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import type { CountryEconomy } from "../economy/WwEconomy";
import type { CountryLand, LandTemplate, WwLand } from "./WwLand";

/**
 * Nothing of `tpl` is training and the stock of a type company `s` uses is
 * under the AI's training gate. A stock near nothing alone says little: a
 * country short of support gear trains on what comes off the line.
 */
function stallsTraining(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  tpl: LandTemplate,
  s: SupportId,
): boolean {
  if (
    cl.trainees.some((x) => x.template === tpl.id) ||
    cl.training.some((e) => e.template === tpl.id)
  ) {
    return false;
  }
  const ks = land.keyStatsOf(cl.smallID);
  const need = templateStats(tpl.def, ce.stats, GEN1).need;
  const without = templateStats(
    { ...tpl.def, support: tpl.def.support.filter((x) => x !== s) },
    ce.stats,
    GEN1,
  ).need;
  return need.some(
    (n, i) =>
      n > without[i] &&
      Math.floor((groupStock(ce.stock, i, ks) * 1000) / n) < AI_TRAIN_FILL_PM,
  );
}

function save(
  land: WwLand,
  cl: CountryLand,
  tpl: LandTemplate,
  support: readonly SupportId[],
): boolean {
  return (
    land.issue(
      cl.smallID,
      {
        kind: "template_save",
        template: tpl.id,
        base: 0,
        name: tpl.def.name,
        battalions: [...tpl.def.battalions],
        support: [...support],
      },
      "ai",
    ) === null
  );
}

/** One change to `tpl`: the AI gives up a company that stops its training, the last in first, else the next one joins. */
function stepTemplate(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  tpl: LandTemplate,
  divisions: number,
  free: number[],
  ai: boolean,
): void {
  const support = tpl.def.support;
  for (let i = support.length - 1; i >= 0 && ai; i--) {
    if (!stallsTraining(land, cl, ce, tpl, support[i])) continue;
    const gone = support[i];
    if (
      save(
        land,
        cl,
        tpl,
        support.filter((_, k) => k !== i),
      )
    ) {
      tpl.autoDropped = (tpl.autoDropped ?? 0) | companyBit(gone);
    }
    return;
  }
  const s = nextAutoCompany({
    def: tpl.def,
    target: autoCompanyTarget(tpl.key),
    researched: ce.researched,
    divisions,
    free,
    dropped: tpl.autoDropped ?? 0,
  });
  if (s === null || !save(land, cl, tpl, [...support, s])) return;
  // The same check's next template sees this stock as spoken for.
  for (const [t, k] of SUPPORTS[s].equip) {
    free[NEED_GROUPS.indexOf(t)] -= k * Math.max(1, divisions);
  }
  if (tpl.autoDropped !== undefined) {
    const left = tpl.autoDropped & ~companyBit(s);
    if (left === 0) delete tpl.autoDropped;
    else tpl.autoDropped = left;
  }
  land.message(cl.smallID, "events_display.ww1936_company_added", {
    template: tpl.key,
    name: tpl.def.name,
    company: s,
  });
}

/** The country's day: every WW_AUTO_COMPANY_DAYS, each template with the switch on takes its step. */
export function dailyAutoCompanies(
  land: WwLand,
  cl: CountryLand,
  day: number,
): void {
  if (day % WW_AUTO_COMPANY_DAYS !== cl.smallID % WW_AUTO_COMPANY_DAYS) return;
  if (!cl.templates.some((t) => t.auto === true)) return;
  // A template saved in the preparation minute would re-form its divisions.
  if (land.ww.inPrep(land.mg.ticks())) return;
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return;
  const ks = land.keyStatsOf(cl.smallID);
  const free: number[] = [];
  for (let g = 0; g < NEED_GROUP_COUNT; g++) {
    free.push(groupStock(ce.stock, g, ks));
  }
  const count = new Map<number, number>();
  const add = (template: number, n: number) =>
    count.set(template, (count.get(template) ?? 0) + n);
  // What the divisions are still owed is not free: reinforcement draws it.
  const owe = (need: readonly number[], held: readonly number[]) => {
    for (let g = 0; g < need.length; g++) {
      if (need[g] > held[g]) free[g] -= need[g] - held[g];
    }
  };
  const t = land.divisions;
  for (const r of land.rowsOf(cl.smallID)) {
    add(t.template[r], 1);
    owe(land.templateNumbersOf(r).need, equipByType(t.equipOf(r), ks));
  }
  for (const x of cl.trainees) {
    add(x.template, 1);
    const s = land.templateStatsOf(cl.smallID, x.template);
    if (s !== null) owe(s.need, equipByType(x.equip, ks));
  }
  for (const e of cl.training) add(e.template, e.remaining);
  const ai = !land.ww.isHumanControlled(cl.smallID);
  for (const tpl of [...cl.templates]) {
    if (tpl.auto !== true) continue;
    stepTemplate(land, cl, ce, tpl, count.get(tpl.id) ?? 0, free, ai);
  }
}

/** The template card's switch. */
export function setTemplateAuto(
  land: WwLand,
  cl: CountryLand,
  o: Extract<LandOrder, { kind: "template_auto" }>,
): WwOrderBlock | null {
  const tpl = cl.template(o.template);
  if (tpl === null || !hasAutoCompanies(tpl.key)) return "bad_template";
  if (o.on) tpl.auto = true;
  else delete tpl.auto;
  delete tpl.autoDropped;
  land.markCountry(cl.smallID);
  return null;
}
