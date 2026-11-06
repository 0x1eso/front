import { GW_GAUGES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { clock, gaugeFill, gaugeLevel, secondsLeft, tempBand } from "./GwModel";
import { CHIP, fillColor, GLASS } from "./GwStyle";

/** The top band: date, flag, chapter, timer, the crisis, five gauges in words. */
export function band(c: GwCtx): TemplateResult {
  const { data, seat } = c;
  const country = gwCountry(seat.tag);
  const left = secondsLeft(data, c.tick);
  return html`<div
    data-gw-band
    class="pointer-events-auto fixed left-0 top-0 z-[900] flex h-10 items-center gap-3 overflow-hidden whitespace-nowrap px-3 text-white sm:right-[260px] right-[150px] ${GLASS} border-x-0 border-t-0"
  >
    <img
      class="h-5 w-7 rounded-sm object-cover"
      src=${assetUrl(`flags/${country.flag}.svg`)}
      alt=""
    />
    <span class="text-sm font-bold" data-gw-date>${data.date}</span>
    <span class="hidden text-xs text-white/60 sm:inline"
      >${translateText("gw.panel.chapter", {
        date: translateText(`gw.ui.stage.${data.stage}`),
        n: data.chapter + 1,
        total: data.chapterCount,
      })}</span
    >
    ${left === null
      ? nothing
      : html`<span class=${CHIP} data-gw-timer>${clock(left)}</span>`}
    ${data.stage === "crisis"
      ? html`<span class=${CHIP} data-gw-temp
          >${translateText(`gw.ui.temp.${tempBand(data.temp)}`)}</span
        >`
      : nothing}
    <span class="ml-auto hidden gap-2 md:flex" data-gw-gauges>
      ${GW_GAUGES.map((g) => {
        const v = gaugeLevel(g, seat.gauges[g] ?? 0);
        return html`<span
          class="flex items-center gap-1 text-xs"
          title=${translateText(`gw.ui.gauge_name.${g}`)}
        >
          <span
            class="h-2 w-2 rounded-full ${fillColor(gaugeFill(g, v))}"
          ></span>
          ${translateText(`gw.ui.gauge.${g}.${v}`)}
        </span>`;
      })}
    </span>
  </div>`;
}
