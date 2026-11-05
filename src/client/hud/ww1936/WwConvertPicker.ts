// World War 1936: the template overwrite picker (divisions_convert). One
// list for both screens (the army panel's templates tab converts every
// division of a template, the army card converts one army): my other
// templates with their battalions and combat numbers, what the tap does,
// and a two-tap confirm. The caller owns the state and sends the order.
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  DivisionStats,
  TemplateData,
  TrainingData,
} from "@openfront/engine-api/ww1936/LandTypes";
import { specialCap } from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  type TechTotals,
  techTotals,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { blockText } from "./EconomyModel";
import {
  battalionSummary,
  designer,
  templateDef,
  templateName,
} from "./LandModel";

export interface ConvertOption {
  template: TemplateData;
  stats: DivisionStats;
  /** Divisions that change if this one is picked. */
  changes: number;
  /** Why it cannot be picked; null: it can. */
  block: WwOrderBlock | null;
}

/**
 * The templates a conversion may pick: every one but `exclude`. `moved`
 * is the divisions that would move, by their template id. A target with
 * a part the country lacks, or that would break the special battalion cap
 * counting every converted division, is blocked with the engine's reason.
 */
export function convertOptions(
  templates: readonly TemplateData[],
  training: readonly Pick<TrainingData, "template" | "remaining">[],
  researched: ReadonlySet<WwTechId>,
  moved: ReadonlyMap<number, number>,
  exclude: number | null,
  // ww107: the country's whole stat sum (spirits, laws), as the engine
  // reads it; the techs alone when not given.
  techIn?: TechTotals,
): ConvertOption[] {
  const tech = techIn ?? techTotals(researched);
  const info = new Map(
    templates.map((t) => {
      const d = designer(templateDef(t), tech, researched);
      return [t.id, { stats: d.stats, block: d.block }] as const;
    }),
  );
  let total = 0;
  let special = 0;
  const add = (id: number, n: number) => {
    const s = info.get(id)?.stats;
    if (s === undefined) return;
    total += n * s.battalions;
    special += n * s.special;
  };
  for (const t of templates) add(t.id, t.inUse);
  for (const e of training) add(e.template, e.remaining);
  return templates
    .filter((t) => t.id !== exclude)
    .map((t) => {
      const mine = info.get(t.id)!;
      let changes = 0;
      let tot = total;
      let spc = special;
      for (const [from, n] of moved) {
        if (from === t.id) continue;
        const s = info.get(from)?.stats;
        if (s === undefined) continue;
        changes += n;
        tot += n * (mine.stats.battalions - s.battalions);
        spc += n * (mine.stats.special - s.special);
      }
      let block = mine.block;
      if (block === null && mine.stats.special > 0 && spc > specialCap(tot)) {
        block = "special_cap";
      }
      return { template: t, stats: mine.stats, changes, block };
    });
}

export interface ConvertEnv {
  /** Data-attribute scope: "template:<id>" or "army:<id>". */
  scope: string;
  /** The line over the list: what is being converted. */
  intro: string;
  options: readonly ConvertOption[];
  /** The option whose first tap is waiting for its second. */
  armed: (to: number) => boolean;
  tap: (to: number) => void;
  cancel: () => void;
  /** The engine's refusal of the last order, if any. */
  refused: string;
  /** Queued training of the template moves too (templates tab only). */
  queued: boolean;
  /** ww91: the national unit the country holds (names its battalions). */
  natUnit?: number;
}

const BTN = "min-h-11 w-full rounded-md border p-1.5 text-left text-xs";

export function renderConvertPicker(env: ConvertEnv): TemplateResult {
  return html`<div
    data-ww-convert=${env.scope}
    class="col-span-5 flex min-w-0 flex-col gap-1"
  >
    <p class="m-0 text-xs font-semibold">${env.intro}</p>
    <p class="m-0 text-xs leading-snug text-white/60">
      ${translateText("ww1936.convert.note")}
      ${env.queued ? translateText("ww1936.convert.queued") : nothing}
    </p>
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      ${env.options.map((o) => {
        const blocked = o.block !== null || o.changes === 0;
        const armed = !blocked && env.armed(o.template.id);
        return html`<li>
          <button
            type="button"
            data-ww-convert-to=${o.template.id}
            data-armed=${String(armed)}
            aria-disabled=${String(blocked)}
            class="${BTN} ${blocked
              ? "border-white/5 bg-white/5 text-white/40"
              : armed
                ? "border-amber-300 bg-amber-700/50"
                : "border-white/10 bg-white/5 hover:bg-white/10"}"
            @click=${() => {
              if (!blocked) env.tap(o.template.id);
            }}
          >
            <span class="block truncate text-sm font-bold"
              >${templateName(o.template)}</span
            >
            <span class="block truncate"
              >${battalionSummary(templateDef(o.template), env.natUnit)}</span
            >
            <span class="block truncate tabular-nums"
              >${statLine(o.stats)}</span
            >
            ${o.block !== null
              ? html`<span data-ww-block class="block text-red-300"
                  >🔒 ${blockText(o.block)}</span
                >`
              : o.changes === 0
                ? html`<span class="block"
                    >${translateText("ww1936.convert.already")}</span
                  >`
                : armed
                  ? html`<span class="block font-semibold text-amber-200"
                      >${translateText("ww1936.convert.tap_again", {
                        n: o.changes,
                      })}</span
                    >`
                  : nothing}
          </button>
        </li>`;
      })}
    </ul>
    ${env.refused === ""
      ? nothing
      : html`<p data-ww-block class="m-0 text-xs text-red-300">
          🔒 ${env.refused}
        </p>`}
    <button
      type="button"
      data-ww-convert-cancel
      class="min-h-10 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20"
      @click=${env.cancel}
    >
      ${translateText("common.cancel")}
    </button>
  </div>`;
}

/** "Soft 12.0 · Hard 3.0 · Defence 20.0 · Men 10500": the combat numbers. */
function statLine(s: DivisionStats): string {
  const f = (v: number) => (v / 100).toFixed(1);
  return [
    `${translateText("ww1936.land.stat_soft")} ${f(s.soft)}`,
    `${translateText("ww1936.land.stat_hard")} ${f(s.hard)}`,
    `${translateText("ww1936.land.stat_defense")} ${f(s.def)}`,
    `${translateText("ww1936.land.stat_men")} ${s.men}`,
  ].join(" · ");
}
