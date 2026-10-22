import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { BopBar } from "./DepthMiscModel";

const BAND_COLORS = [
  "bg-red-500",
  "bg-orange-400",
  "bg-gray-300",
  "bg-sky-400",
  "bg-blue-600",
];

/** P6 (spec §13.2): the five-band balance-of-power bar, its marker and the band's spirit. */
export function renderBopBar(
  bar: BopBar,
  spiritName: (id: string) => string,
  spiritDesc: (id: string) => string,
): TemplateResult {
  return html`<section data-ww-bop=${bar.tag} class="mt-2">
    <div class="flex justify-between text-xs font-bold">
      <span>${translateText(`ww1936.bop.${bar.tag}.title`)}</span>
      <span class="tabular-nums" data-ww-bop-value
        >${bar.valuePm > 0 ? "+" : ""}${bar.valuePm / 10}</span
      >
    </div>
    <div class="relative mt-1 flex h-2.5 overflow-hidden rounded">
      ${BAND_COLORS.map(
        (c, n) =>
          html`<div
            data-ww-bop-band=${n}
            class="h-2.5 flex-1 ${c} ${n === bar.band
              ? "opacity-100"
              : "opacity-40"}"
          ></div>`,
      )}
      <span
        data-ww-bop-marker
        class="absolute -top-0.5 h-3.5 w-1 -translate-x-1/2 bg-white"
        style="left: ${bar.pos * 100}%"
      ></span>
    </div>
    <div class="flex justify-between text-[11px] text-white/60">
      <span>${translateText(`ww1936.bop.${bar.tag}.left`)}</span>
      <span>${translateText(`ww1936.bop.${bar.tag}.right`)}</span>
    </div>
    ${bar.spirit === null
      ? nothing
      : html`<div
          data-ww-bop-spirit=${bar.spirit}
          class="mt-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs"
        >
          <b>${spiritName(bar.spirit)}</b>
          <p class="m-0 text-white/70">${spiritDesc(bar.spirit)}</p>
        </div>`}
  </section>`;
}
