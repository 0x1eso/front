import {
  GW_RULER_SIDES,
  GwRulerSide,
} from "@openfront/engine-api/ww1914/GwRuler";
import type { GwCardView } from "@openfront/engine-api/ww1914/GwView";
import { GW_BROKEN_BODY } from "@openfront/engine-lib/ww1914/RulerRows";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { HEAD, MUTED } from "./GwStyle";
import { reasonText } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

/**
 * The sides drawn: GW_RULER_SIDES, and ww196's nerve (기력) as the fifth once
 * the view carries it (lane P appends it to the list).
 */
function sidesOf(levels: readonly number[]): readonly string[] {
  return [...new Set<string>([...GW_RULER_SIDES, "nerve"])].slice(
    0,
    levels.length,
  );
}

/** The side's sentence for the person: words, never a number. */
function sideLine(
  c: GwCtx,
  id: string,
  side: string,
  level: number,
  broken: boolean,
): string {
  const words = c.pack?.rulers?.[id];
  if (side === "nerve") {
    // His own words for it where written, else the plain ones.
    const own = (words as Record<string, unknown> | undefined)?.nerve as
      | readonly string[]
      | undefined;
    return own?.[level] ?? translateText(`gw.ruler.nerve.${level}`);
  }
  if (words === undefined) return "";
  return side === "conscience" && broken
    ? words.broken
    : words[side as GwRulerSide][level];
}

/**
 * How the person takes this paper once conscience has given out. Null before
 * that, and on a card with its own body for it (GW_BROKEN_BODY).
 */
export function brokenLine(c: GwCtx, card: GwCardView): string | null {
  const r = c.seat.ruler;
  if (r === null || r === undefined || !r.broken) return null;
  if (card.options.length === 0 || card.variant === GW_BROKEN_BODY) return null;
  const lines = c.pack?.rulers?.[r.id]?.after ?? [];
  return lines.length === 0 ? null : lines[card.uid % lines.length];
}

/** Two causes can read the same: the line shows once. */
function oneEach<T>(rows: readonly T[], read: (row: T) => string) {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const text = read(row);
    if (seen.has(text)) return [];
    seen.add(text);
    return [{ row, text }];
  });
}

/** The person at the desk, at the head of the country tab. */
export function rulerCard(c: GwCtx): TemplateResult | typeof nothing {
  const r = c.seat.ruler;
  if (r === null || r === undefined) return nothing;
  const name = c.pack?.rulers?.[r.id]?.name ?? r.id;
  return html`<section class=${BOX} data-gw-ruler=${r.id}>
    <h3 class=${HEAD}>
      ${translateText("gw.ruler.title", { name, age: r.age })}
    </h3>
    ${sidesOf(r.levels).map(
      (side, i) =>
        html`<div class="text-sm" data-gw-ruler-side=${side}>
          <span class="text-white/70"
            >${translateText(`gw.ruler.side.${side}`)}</span
          >
          <p class="text-white/85">
            ${sideLine(c, r.id, side, r.levels[i], r.broken)}
          </p>
        </div>`,
    )}
    ${r.atRisk === null || r.atRisk === undefined
      ? nothing
      : html`<p class="text-sm text-amber-200" data-gw-ruler-risk=${r.atRisk}>
          ${translateText(`gw.ruler.at_risk.${r.atRisk}`)}
        </p>`}
    ${oneEach(r.lines, (l) =>
      reasonText(c.pack, { ...l, chapter: 0 }, c.seat.tag),
    ).map(
      ({ row: l, text }) =>
        html`<p class=${MUTED} data-gw-ruler-line=${l.key}>
          ${l.delta > 0 ? "▲" : "▼"} ${text}
        </p>`,
    )}
  </section>`;
}
