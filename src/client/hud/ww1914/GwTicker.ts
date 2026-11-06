import { GW_LINES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { tempBand, theatreSpot } from "./GwModel";
import { GLASS } from "./GwStyle";

/** A key's text, or null when it has none (a reason the content did not translate). */
export function textOrNull(key: string): string | null {
  const t = translateText(key);
  return t === key ? null : t;
}

/**
 * The world's news in one-line sentences, from what the view shows: the fronts
 * that are open, the temperature in a crisis, and the last why-lines.
 */
export function tickerLines(data: GreatWarData, seat: GwSeatView): string[] {
  const out: string[] = [];
  if (data.stage === "crisis") {
    out.push(translateText(`gw.ui.news.temp.${tempBand(data.temp)}`));
  }
  for (const t of seat.theatres) {
    if (!t.open) continue;
    const spot = theatreSpot(t.id, t.line, t.progress);
    const name = textOrNull(`gw.ui.line.${t.id}.${GW_LINES[t.id][spot.line]}`);
    out.push(
      translateText("gw.ui.news.front", {
        theatre: translateText(`gw.ui.theatre.${t.id}`),
        line: name ?? GW_LINES[t.id][spot.line],
      }),
    );
  }
  for (const r of seat.log.slice(-2).reverse()) {
    const text = textOrNull(`gw.reason.${r.key}`);
    if (text !== null) out.push(text);
  }
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
