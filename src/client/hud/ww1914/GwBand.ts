import { GW_GAUGES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { footingChip } from "./GwCraft";
import type { GwCtx } from "./GwCtx";
import { houseChip } from "./GwHouse";
import { clock, gaugeFill, gaugeLevel, secondsLeft, tempBand } from "./GwModel";
import { gaugeTitle } from "./GwNow";
import { CHIP, fillColor, GLASS } from "./GwStyle";
import { fullDate } from "./GwText";

/** The top band: date, flag, chapter, timer, the crisis, five gauges in words. */
export function band(c: GwCtx): TemplateResult {
  const { data, seat } = c;
  const country = gwCountry(seat.tag);
  const left = secondsLeft(data, c.tick);
  return html`<div
    data-gw-band
    class="pointer-events-auto fixed left-0 right-0 top-0 z-[900] flex flex-col overflow-hidden whitespace-nowrap px-3 text-white sm:right-[260px] sm:h-10 sm:flex-row sm:items-center sm:gap-3 ${GLASS} border-x-0 border-t-0"
  >
    <!-- A phone has room left of the top-right buttons for the flag and the
      date only: the chips take a row of their own below those buttons. -->
    <div class="flex h-12 items-center gap-3 sm:contents">
      <img
        class="h-5 w-7 rounded-sm object-cover"
        src=${assetUrl(`flags/${country.flag}.svg`)}
        alt=""
      />
      <span class="text-sm font-bold" data-gw-date>${fullDate(data.date)}</span>
    </div>
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1 pb-1.5 sm:contents"
      data-gw-band-chips
    >
      <span
        class="text-xs text-white/60"
        data-gw-chapter
        title=${translateText("gw.ui.chapter_hint")}
        >${translateText("gw.panel.chapter", {
          date: translateText(
            `gw.ui.stage.${data.stage === "war" && seat.world.side === null ? "peace" : data.stage}`,
          ),
          n: data.chapter + 1,
          total: data.chapterCount,
        })}</span
      >
      ${footingChip(c)} ${houseChip(c)}
      ${left === null
        ? nothing
        : html`<span class=${CHIP} data-gw-timer>${clock(left)}</span>`}
      ${data.roster.length > 1
        ? html`<span class=${CHIP} data-gw-ready-count
            >${translateText("gw.diplo.ready_count", {
              n: data.roster.filter((r) => r.ready).length,
              total: data.roster.length,
            })}</span
          >`
        : nothing}
      ${data.stage === "crisis" || (seat.world.chain ?? null) !== null
        ? html`<span
            class=${CHIP}
            data-gw-temp
            title=${translateText("gw.ui.temp_hint")}
            >${translateText(`gw.ui.temp.${tempBand(data.temp)}`)}</span
          >`
        : nothing}
      <span class="ml-auto hidden gap-2 md:flex" data-gw-gauges>
        ${GW_GAUGES.map((g) => {
          const v = gaugeLevel(g, seat.gauges[g] ?? 0);
          return html`<span
            class="flex items-center gap-1 text-xs"
            data-gw-band-gauge=${g}
            title=${gaugeTitle(c, g)}
          >
            <span
              class="h-2 w-2 rounded-full ${fillColor(gaugeFill(g, v))}"
            ></span>
            <span class="text-white/55"
              >${translateText(`gw.ui.gauge_name.${g}`)}</span
            >
            ${translateText(`gw.ui.gauge.${g}.${v}`)}
          </span>`;
        })}
      </span>
    </div>
  </div>`;
}
