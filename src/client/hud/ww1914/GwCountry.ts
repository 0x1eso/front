import {
  GW_GAUGE_MAX,
  GW_GAUGES,
  GW_INSTITUTIONS,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { gaugeFill, gaugeLevel, instBand, logByChapter } from "./GwModel";
import { fillColor, HEAD, MUTED } from "./GwStyle";
import { textOrNull } from "./GwTicker";

function bar(fill: number): TemplateResult {
  return html`<span class="block h-1.5 w-full rounded bg-white/15"
    ><span
      class="block h-1.5 rounded ${fillColor(fill)}"
      style="width:${Math.max(6, Math.round(fill * 100))}%"
    ></span
  ></span>`;
}

/** The country tab: five gauges in words, the bodies that can say no, the why-log. */
export function countryTab(c: GwCtx): TemplateResult {
  const { seat } = c;
  const insts = GW_INSTITUTIONS.filter((i) => seat.inst[i] !== undefined);
  const log = logByChapter(seat.log);
  return html`<div class="space-y-3" data-gw-country>
    <section class="space-y-2 rounded border border-white/15 bg-black/35 p-2.5">
      <h3 class=${HEAD}>${translateText("gw.ui.gauges_title")}</h3>
      ${GW_GAUGES.map((g) => {
        const v = gaugeLevel(g, seat.gauges[g] ?? 0);
        return html`<div class="space-y-0.5" data-gw-gauge=${g}>
          <div class="flex justify-between text-sm">
            <span class="text-white/70"
              >${translateText(`gw.ui.gauge_name.${g}`)}</span
            >
            <span>${translateText(`gw.ui.gauge.${g}.${v}`)}</span>
          </div>
          ${bar(gaugeFill(g, v))}
          <span class="sr-only">${v}/${GW_GAUGE_MAX[g]}</span>
        </div>`;
      })}
    </section>
    ${insts.length === 0
      ? nothing
      : html`<section
          class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
        >
          <h3 class=${HEAD}>${translateText("gw.ui.inst_title")}</h3>
          ${insts.map(
            (i) =>
              html`<div class="flex justify-between text-sm" data-gw-inst=${i}>
                <span class="text-white/70"
                  >${translateText(`gw.ui.inst_name.${i}`)}</span
                >
                <span
                  >${translateText(
                    `gw.ui.inst.${instBand(seat.inst[i] ?? 0)}`,
                  )}</span
                >
              </div>`,
          )}
        </section>`}
    <section
      class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
    >
      <h3 class=${HEAD}>${translateText("gw.ui.why_title")}</h3>
      ${log.length === 0
        ? html`<p class=${MUTED}>${translateText("gw.ui.why_none")}</p>`
        : log.map(
            (g) =>
              html`<div data-gw-why-chapter=${g.chapter}>
                <div class=${MUTED}>
                  ${translateText("gw.ui.chapter_n", { n: g.chapter + 1 })}
                </div>
                ${g.keys.map(
                  (k) =>
                    html`<p class="text-sm text-white/85">
                      ${textOrNull(`gw.reason.${k}`) ?? k}
                    </p>`,
                )}
              </div>`,
          )}
    </section>
  </div>`;
}
