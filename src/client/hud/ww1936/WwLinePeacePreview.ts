import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { LinePeacePreviewView, LinePeaceSummary } from "./LinePeaceModel";

/** What the preview's buttons do (the drawer's handlers). */
export interface LinePeacePreviewActions {
  map(): void;
  send(): void;
  cancel(): void;
  /** The send button is armed (the first of two taps). */
  armed: boolean;
}

const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";

/** The hint's colour by its level. */
export function lineHintTone(level: string | null): string {
  return level === "high"
    ? "text-emerald-300"
    : level === "medium"
      ? "text-amber-200"
      : level === "low"
        ? "text-red-300"
        : "text-white/70";
}

/** A line's totals and the regions each way (the preview's and the card's). */
export function lineSummaryTemplate(
  s: LinePeaceSummary,
): TemplateResult | typeof nothing {
  if (s.totals === "") return nothing;
  return html`<div data-ww-lpeace-summary class="flex flex-col gap-0.5">
    <span data-ww-lpeace-totals class="font-semibold text-amber-100"
      >${s.totals}</span
    >
    ${s.gain === ""
      ? nothing
      : html`<span data-ww-lpeace-gain class="text-emerald-200"
          >${s.gain}</span
        >`}
    ${s.lose === ""
      ? nothing
      : html`<span data-ww-lpeace-lose class="text-red-200">${s.lose}</span>`}
    ${s.empty === null
      ? nothing
      : html`<span data-ww-lpeace-empty class="text-white/70"
          >${s.empty}</span
        >`}
  </div>`;
}

/**
 * Peace on the current line (owner request 2026-10-31): the preview under
 * my war's row in the diplomacy drawer — what the line does, the totals
 * and regions each way, [Show on the map] (the panel steps aside), the
 * chance they accept, and [Offer the current line] (two taps) / [Cancel].
 */
export function linePeacePreviewTemplate(
  v: LinePeacePreviewView,
  a: LinePeacePreviewActions,
): TemplateResult {
  return html`<div
    data-ww-lpeace=${v.war}
    class="mt-1 flex flex-col gap-1.5 rounded-md border border-sky-300/40 bg-black/20 p-1.5 text-xs"
  >
    <b class="leading-tight">🗺 ${v.title}</b>
    <span class="text-white/70">${v.rules}</span>
    ${lineSummaryTemplate(v)}
    <button
      type="button"
      data-ww-act="lpeace_map"
      class=${BUTTON}
      ?disabled=${!v.ready}
      @click=${a.map}
    >
      🗺 ${translateText("ww1936.lpeace.map")}
    </button>
    ${v.hint === ""
      ? nothing
      : html`<span
          data-ww-lpeace-hint=${v.hintLevel ?? "human"}
          class="font-semibold ${lineHintTone(v.hintLevel)}"
          >${v.hint}</span
        >`}
    <div class="flex gap-1">
      <button
        type="button"
        data-ww-act="line_peace_offer"
        data-armed=${String(a.armed)}
        class="${BUTTON} flex-1 ${a.armed ? "ring-2 ring-red-400" : ""}"
        @click=${a.send}
      >
        ${a.armed
          ? translateText("ww1936.pol.tap_again")
          : translateText("ww1936.lpeace.send")}
      </button>
      <button
        type="button"
        data-ww-act="lpeace_cancel"
        class=${BUTTON}
        @click=${a.cancel}
      >
        ${translateText("ww1936.npeace.cancel")}
      </button>
    </div>
  </div>`;
}
