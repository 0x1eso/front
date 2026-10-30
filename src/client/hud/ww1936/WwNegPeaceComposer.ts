import { WW_NEG_REPARATIONS_STEP_PCT } from "@openfront/engine-api/ww1936/EndgameTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type {
  NegPeaceComposerView,
  NegPeaceFreeRow,
  NegPeaceRegionRow,
} from "./NegPeaceModel";

/** What the composer's buttons do (the drawer's handlers). */
export interface NegPeaceComposerActions {
  pick(): void;
  remove(region: number): void;
  pay(level: number): void;
  demand(level: number): void;
  free(id: number): void;
  send(): void;
  cancel(): void;
  /** The send button is armed (the first of two taps). */
  armed: boolean;
}

const SMALL =
  "min-h-7 shrink-0 rounded border border-white/15 bg-white/5 px-1.5 text-xs hover:bg-white/10";
const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";

function chips(
  rows: readonly NegPeaceRegionRow[],
  remove: (region: number) => void,
): TemplateResult {
  if (rows.length === 0) {
    return html`<span class="text-white/50"
      >${translateText("ww1936.npeace.none")}</span
    >`;
  }
  return html`${rows.map(
    (r) =>
      html`<button
        type="button"
        data-ww-npeace-region=${r.region}
        class="${SMALL} flex items-center gap-1"
        aria-label=${translateText("ww1936.npeace.remove", { region: r.name })}
        @click=${() => remove(r.region)}
      >
        <span class="min-w-0 truncate">${r.name}</span
        ><span aria-hidden="true">×</span>
      </button>`,
  )}`;
}

function levels(
  side: "pay" | "demand",
  current: number,
  lines: readonly string[],
  set: (level: number) => void,
): TemplateResult {
  return html`<div class="flex flex-wrap items-center gap-1">
    <span class="text-white/70"
      >${translateText("ww1936.npeace.reparations")}</span
    >
    ${lines.map(
      (line, lv) =>
        html`<button
          type="button"
          data-ww-npeace-level=${`${side}:${lv}`}
          data-on=${String(lv === current)}
          title=${line}
          class="${SMALL} ${lv === current
            ? "border-emerald-300 bg-emerald-900/50"
            : ""}"
          @click=${() => set(lv)}
        >
          ${lv === 0
            ? translateText("ww1936.npeace.rep_none")
            : translateText("ww1936.npeace.rep_level", {
                pct: lv * WW_NEG_REPARATIONS_STEP_PCT,
              })}
        </button>`,
    )}
    ${current > 0
      ? html`<span class="w-full text-white/60">${lines[current]}</span>`
      : nothing}
  </div>`;
}

function frees(
  rows: readonly NegPeaceFreeRow[],
  toggle: (id: number) => void,
): TemplateResult | typeof nothing {
  if (rows.length === 0) return nothing;
  return html`<div class="flex flex-wrap gap-1">
    ${rows.map(
      (r) =>
        html`<button
          type="button"
          data-ww-npeace-free=${r.id}
          data-on=${String(r.on)}
          class="${SMALL} ${r.on ? "border-emerald-300 bg-emerald-900/50" : ""}"
          @click=${() => toggle(r.id)}
        >
          ${translateText("ww1936.npeace.free", { country: r.name })}
        </button>`,
    )}
  </div>`;
}

/**
 * Negotiated peace (owner request "7번"): the composer under my war's row
 * in the diplomacy drawer — what I give (my regions, my reparations level,
 * my subjects set free) and what I demand (theirs), "Pick regions on the
 * map" (the panel steps aside for the map), each giver's share of its
 * victory points, the engine's reason when the terms can't go, the live
 * chance they accept, and [Send offer] (two taps) / [Cancel]. With no
 * terms it reads "a white peace".
 */
export function negPeaceComposerTemplate(
  v: NegPeaceComposerView,
  a: NegPeaceComposerActions,
): TemplateResult {
  const mineFree = v.free.filter((f) => f.mine);
  const theirFree = v.free.filter((f) => !f.mine);
  const hintTone =
    v.hintLevel === "high"
      ? "text-emerald-300"
      : v.hintLevel === "medium"
        ? "text-amber-200"
        : v.hintLevel === "low"
          ? "text-red-300"
          : "text-white/70";
  return html`<div
    data-ww-npeace=${v.war}
    class="mt-1 flex flex-col gap-1.5 rounded-md border border-emerald-300/40 bg-black/20 p-1.5 text-xs"
  >
    <b class="leading-tight">🕊 ${v.title}</b>
    <section data-ww-npeace-give class="flex flex-col gap-1">
      <span class="font-semibold text-amber-200"
        >${translateText("ww1936.npeace.give")}</span
      >
      <div class="flex flex-wrap gap-1">${chips(v.give, a.remove)}</div>
      ${levels("pay", v.pay, v.payLines, a.pay)} ${frees(mineFree, a.free)}
    </section>
    <section data-ww-npeace-demand class="flex flex-col gap-1">
      <span class="font-semibold text-amber-200"
        >${translateText("ww1936.npeace.demand")}</span
      >
      <div class="flex flex-wrap gap-1">${chips(v.take, a.remove)}</div>
      ${levels("demand", v.demand, v.demandLines, a.demand)}
      ${frees(theirFree, a.free)}
    </section>
    <button
      type="button"
      data-ww-act="npeace_pick"
      class=${BUTTON}
      @click=${a.pick}
    >
      🗺 ${translateText("ww1936.npeace.pick")}
    </button>
    ${v.vpLines.map((l) => html`<span class="text-white/60">${l}</span>`)}
    ${v.white === null
      ? nothing
      : html`<span data-ww-npeace-white class="text-white/70"
          >${v.white}</span
        >`}
    ${v.block === null
      ? nothing
      : html`<span data-ww-npeace-block class="text-red-300">${v.block}</span>`}
    ${v.hint === ""
      ? nothing
      : html`<span
          data-ww-npeace-hint=${v.hintLevel ?? "human"}
          class="font-semibold ${hintTone}"
          >${v.hint}</span
        >`}
    <div class="flex gap-1">
      <button
        type="button"
        data-ww-act="peace_offer"
        data-armed=${String(a.armed)}
        class="${BUTTON} flex-1 ${a.armed ? "ring-2 ring-red-400" : ""}"
        ?disabled=${v.block !== null}
        @click=${a.send}
      >
        ${a.armed
          ? translateText("ww1936.pol.tap_again")
          : translateText("ww1936.npeace.send")}
      </button>
      <button
        type="button"
        data-ww-act="npeace_cancel"
        class=${BUTTON}
        @click=${a.cancel}
      >
        ${translateText("ww1936.npeace.cancel")}
      </button>
    </div>
  </div>`;
}
