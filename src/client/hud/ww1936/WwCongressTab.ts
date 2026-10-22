import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { CongressBar } from "./DepthMiscModel";

/** P6 (spec §13.1): the US congress support bar with its 50 / 60 / 70 marks. */
export function renderCongressBar(bar: CongressBar): TemplateResult {
  return html`<section data-ww-congress class="mt-2">
    <div class="flex justify-between text-xs font-bold">
      <span>${translateText("ww1936.congress.support")}</span>
      <span data-ww-congress-pct class="tabular-nums">${bar.pct}%</span>
    </div>
    <div class="relative mt-1 h-2 rounded bg-white/10">
      <div
        class="h-2 rounded bg-sky-400"
        style="width: ${Math.min(100, bar.pct)}%"
      ></div>
      ${bar.marks.map(
        (m) =>
          html`<span
            data-ww-congress-mark=${m.pct}
            class="absolute top-0 h-2 w-0.5 ${m.passed
              ? "bg-emerald-300"
              : "bg-white/80"}"
            style="left: ${m.pct}%"
          ></span>`,
      )}
    </div>
    <div class="relative h-4 text-[11px] text-white/60">
      ${bar.marks.map(
        (m) =>
          html`<span class="absolute -translate-x-1/2" style="left: ${m.pct}%"
            >${m.pct}</span
          >`,
      )}
    </div>
    <ul class="m-0 list-none p-0 text-xs text-white/70">
      ${bar.marks.map(
        (m) =>
          html`<li class=${m.passed ? "text-emerald-300" : ""}>
            ${m.passed ? "✓" : "·"}
            ${translateText("ww1936.congress.threshold", { pct: m.pct })} ·
            ${translateText(
              m.passed ? "ww1936.congress.passed" : "ww1936.congress.pending",
            )}
          </li>`,
      )}
    </ul>
  </section>`;
}
