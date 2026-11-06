import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { tempBand } from "./GwModel";
import { GLASS } from "./GwStyle";
import { frontLine, newsText, reasonText } from "./GwText";

/**
 * The world's news in one-line sentences: the temperature in a crisis, the
 * wires of the last chapter, where the fronts stand, the last why-lines.
 */
export function tickerLines(
  data: GreatWarData,
  seat: GwSeatView,
  pack: GwPack | null,
): string[] {
  const out: string[] = [];
  if (data.stage === "crisis") {
    out.push(translateText(`gw.ui.news.temp.${tempBand(data.temp)}`));
  }
  const fresh = seat.world.news.filter((n) => n.chapter >= data.chapter - 1);
  for (const n of [...fresh].reverse()) {
    const text = newsText(n);
    if (text !== null) out.push(text);
  }
  for (const f of seat.world.fronts) {
    out.push(
      translateText("gw.ui.news.front", {
        theatre: translateText(`gw.ui.theatre.${f.id}`),
        line: frontLine(f.id, f.line),
      }),
    );
  }
  for (const r of seat.log.slice(-2).reverse()) out.push(reasonText(pack, r));
  if (out.length === 0) out.push(translateText("gw.ui.news.quiet"));
  return out;
}

/** The ticker: one line under the top band, centred; the panel rotates `n`. */
export function ticker(lines: readonly string[], n: number): TemplateResult {
  if (lines.length === 0) return html`${nothing}`;
  const text = lines[n % lines.length];
  return html`<div
    data-gw-ticker
    class="pointer-events-none fixed left-1/2 top-12 z-[899] max-w-[min(60vw,640px)] -translate-x-1/2 truncate rounded-full px-4 py-1 text-xs text-white/90 ${GLASS}"
  >
    ${text}
  </div>`;
}
