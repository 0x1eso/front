// World War 1936 w14: the map lens button. One button on the map opens the
// list of lenses (sea and air, which used to hide in the dials, and the nine
// land lenses); one lens is on at a time, and the button's cross turns it
// off. While a land lens shows, a small legend stands beside the map's
// right edge and a chip row sets the lens's choice (a resource, faction or
// ideology). A region's own value is a block in the region info card
// (PlayerInfoOverlay.renderRegionLens), which follows the normal tap rules.
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  isRegionLens,
  LENS_HINT_KEYS,
  LENS_NAME_KEYS,
  lensAvailable,
  lensLegend,
  type LensLegend,
} from "./LensModel";
import {
  WwAirLayerEvent,
  WwSeaLayerEvent,
  type LensDiplo,
  type LensResource,
  type RegionLens,
} from "./SeaAirSelection";
import { WwDrawerEvent, type WwDrawerId } from "./WwDrawer";
import { WwPanelMinimizedEvent } from "./WwPanelMode";
import { seaAirOf } from "./WwSeaAirController";

const LIST: readonly (RegionLens | "sea" | "air")[] = [
  "terrain",
  "vp",
  "weather",
  "supply",
  "defence",
  "resources",
  "industry",
  "occupation",
  "diplomacy",
  "sea",
  "air",
];

/** The lens now on: sea or air by the layer, else the region lens; "none". */
export function activeLens(
  sel: ReturnType<typeof seaAirOf>["selection"],
): RegionLens | "sea" | "air" | "none" {
  return sel.layer !== "none" ? sel.layer : sel.regionLens;
}

@customElement("ww-lens")
export class WwLens extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private open = false;
  @state() private legend: LensLegend | null = null;
  @state() private active: RegionLens | "sea" | "air" | "none" = "none";
  @state() private blocked: ReadonlySet<string> = new Set();
  /** The full-screen panels open now: they cover the map, so the lens steps aside. */
  @state() private drawers: ReadonlySet<WwDrawerId> = new Set();
  /** A map flow set the open panel aside: the map shows again. */
  @state() private minimized = false;
  private shown = "";

  createRenderRoot() {
    return this;
  }

  init() {
    // Everything else is polled in tick(): the selection is shared state.
    this.eventBus.on(WwDrawerEvent, (e) => {
      // A set: opening one drawer closes the last one after it says so.
      const open = new Set(this.drawers);
      if (e.open) open.add(e.drawer);
      else open.delete(e.drawer);
      this.drawers = open;
      if (open.size === 0) this.minimized = false;
      else if (e.open) this.open = false;
    });
    this.eventBus.on(WwPanelMinimizedEvent, (e) => {
      this.minimized = e.minimized;
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  private get sel() {
    return seaAirOf(this.game).selection;
  }

  tick() {
    this.refresh();
  }

  /** Works out what the screen shows; redraws only when it differs. */
  private refresh(): void {
    if ((this.game?.worldWarScenario() ?? null) === null) return;
    const sel = this.sel;
    const active = activeLens(sel);
    const legend = active === "none" ? null : lensLegend(this.game, sel);
    const blocked = new Set(
      LIST.filter((l) => !lensAvailable(this.game, l)) as string[],
    );
    const key = JSON.stringify([active, legend, [...blocked], this.open]);
    if (key === this.shown) return;
    this.shown = key;
    this.active = active;
    this.legend = legend;
    this.blocked = blocked;
  }

  /** The list's choice; the same lens again turns it off. */
  choose(lens: RegionLens | "sea" | "air" | "none"): void {
    const sel = this.sel;
    this.open = false;
    if (lens === "none" || lens === activeLens(sel)) {
      this.eventBus.emit(new WwSeaLayerEvent(false));
      this.eventBus.emit(new WwAirLayerEvent(false));
      sel.setRegionLens("none");
      sel.setLayer("none");
    } else if (lens === "sea") {
      this.eventBus.emit(new WwSeaLayerEvent(true));
      if (sel.layer !== "sea") sel.setLayer("sea");
    } else if (lens === "air") {
      this.eventBus.emit(new WwAirLayerEvent(true));
      if (sel.layer !== "air") sel.setLayer("air");
    } else {
      this.eventBus.emit(new WwSeaLayerEvent(false));
      this.eventBus.emit(new WwAirLayerEvent(false));
      sel.setRegionLens(lens);
    }
    this.refresh();
    this.requestUpdate();
  }

  private chip(kind: "resource" | "diplo", id: string): void {
    if (kind === "resource") this.sel.setLensResource(id as LensResource);
    else this.sel.setLensDiplo(id as LensDiplo);
    this.refresh();
  }

  private rgb(c: readonly [number, number, number] | null | undefined): string {
    return c ? `rgb(${c[0]} ${c[1]} ${c[2]})` : "transparent";
  }

  private renderList(): TemplateResult {
    return html`<div
      data-ww-lens-list
      class="pointer-events-auto grid max-h-[calc(100vh-110px)] w-[min(320px,calc(100vw-16px))] grid-cols-2 gap-1 overflow-y-auto rounded-md bg-gray-900/95 p-1 text-white shadow-lg"
    >
      ${LIST.map((l) => {
        const on = l === this.active;
        const off = this.blocked.has(l);
        return html`<button
          type="button"
          data-ww-lens-item=${l}
          aria-pressed=${String(on)}
          ?disabled=${off}
          class="flex min-h-10 flex-col justify-center rounded px-2 py-0.5 text-left ${on
            ? "bg-amber-600/70 ring-1 ring-amber-300"
            : "bg-white/10 hover:bg-white/20"} ${off ? "opacity-40" : ""}"
          @click=${() => this.choose(l)}
        >
          <span class="text-xs font-semibold leading-tight"
            >${translateText(LENS_NAME_KEYS[l])}</span
          >
          <span class="truncate text-[10px] leading-tight text-white/60"
            >${off
              ? translateText("ww1936.lens.unavailable")
              : translateText(LENS_HINT_KEYS[l])}</span
          >
        </button>`;
      })}
    </div>`;
  }

  private renderLegend(g: LensLegend): TemplateResult {
    return html`<div
      data-ww-lens-legend
      class="pointer-events-none max-h-[calc(100vh-130px)] w-[min(340px,50vw)] overflow-y-auto rounded-md bg-gray-900/85 p-1.5 text-xs text-white"
    >
      <div class="mb-0.5 font-semibold">${g.title}</div>
      ${g.rows.map(
        (r) =>
          html`<div class="flex items-start gap-1.5">
            <span
              class="mt-0.5 size-3 shrink-0 rounded-sm border border-white/40 ${r.mark ===
              "hatch"
                ? "bg-[repeating-linear-gradient(45deg,#fff_0_2px,transparent_2px_5px)]"
                : ""} ${r.mark === "rim" ? "border-2 border-red-500" : ""}"
              style="background-color: ${this.rgb(r.rgb)}"
            ></span>
            <span class="min-w-0 text-[11px] leading-[13px]"
              >${r.label}${r.detail
                ? html`<span class="block text-[10px] leading-3 text-white/60"
                    >${r.detail}</span
                  >`
                : nothing}</span
            >
          </div>`,
      )}
      ${g.gauge
        ? html`<div
            data-ww-lens-gauge
            class="relative mt-1 h-2 rounded bg-white/20"
            title=${g.notes[0] ?? ""}
          >
            <div
              class="h-2 rounded bg-red-500"
              style="width: ${Math.min(100, g.gauge[1])}%"
            ></div>
            <div
              class="absolute inset-y-[-2px] w-0.5 bg-white"
              style="left: ${Math.min(100, g.gauge[0])}%"
            ></div>
          </div>`
        : nothing}
      ${g.notes.map(
        (n) =>
          html`<div class="mt-1 text-[10px] leading-tight text-white/70">
            ${n}
          </div>`,
      )}
    </div>`;
  }

  private renderChips(g: LensLegend): TemplateResult | typeof nothing {
    if (g.chipKind === null || g.chips.length === 0) return nothing;
    const kind = g.chipKind;
    return html`<div
      data-ww-lens-chips
      class="pointer-events-auto flex max-w-[calc(100vw-140px)] gap-1 overflow-x-auto"
    >
      ${g.chips.map(
        (c) =>
          html`<button
            type="button"
            data-ww-lens-chip=${c.id}
            aria-pressed=${String(c.active)}
            class="flex h-10 min-w-10 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-white ${c.active
              ? "bg-amber-600/80 ring-1 ring-amber-300"
              : "bg-gray-900/85 hover:bg-gray-700"}"
            @click=${() => this.chip(kind, c.id)}
          >
            ${c.rgb
              ? html`<span
                  class="size-2.5 rounded-sm"
                  style="background-color: ${this.rgb(c.rgb)}"
                ></span>`
              : nothing}${c.label}
          </button>`,
      )}
    </div>`;
  }

  render() {
    if ((this.game?.worldWarScenario() ?? null) === null) return nothing;
    if (this.drawers.size > 0 && !this.minimized) return nothing;
    const on = this.active !== "none";
    const g = this.legend;
    return html`
      <button
        type="button"
        data-ww-lens-button=${on ? "on" : "off"}
        aria-expanded=${String(this.open)}
        aria-label=${translateText("ww1936.lens.button")}
        title=${translateText("ww1936.lens.button")}
        class="fixed right-2 z-[1002] flex size-10 items-center justify-center rounded-lg text-white shadow-lg ${on
          ? "bg-amber-700/90 ring-1 ring-amber-300"
          : "bg-gray-800/92 hover:bg-gray-700"}"
        style="top: calc(50% + 62px)"
        @click=${() => {
          this.open = !this.open;
          this.shown = "";
          this.refresh();
          this.requestUpdate();
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="size-5 shrink-0"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"></path>
        </svg>
      </button>
      ${on
        ? html`<button
            type="button"
            data-ww-lens-off
            aria-label=${translateText("ww1936.lens.off")}
            class="fixed right-14 z-[1002] h-10 w-10 rounded-lg bg-gray-800/92 text-sm text-white shadow-lg hover:bg-gray-700"
            style="top: calc(50% + 62px)"
            @click=${() => this.choose("none")}
          >
            ✕
          </button>`
        : nothing}
      <div
        data-ww-lens
        class="pointer-events-none fixed right-14 top-12 z-[1002] flex flex-col items-end gap-1 text-white"
      >
        ${this.open
          ? this.renderList()
          : html`${g ? this.renderChips(g) : nothing}
            ${g && isRegionLens(this.active) ? this.renderLegend(g) : nothing}`}
      </div>
    `;
  }
}
