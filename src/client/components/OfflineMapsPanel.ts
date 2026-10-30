import type { GameMapType } from "@openfront/engine-api/game/GameTypes";
import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  type AssetSizes,
  buildAssetSizes,
  downloadOfflineMaps,
  formatMegabytes,
  missingFiles,
  offlineMapChoices,
  type OfflineMapPlan,
  planOfflineMap,
  requestPersistentStorage,
  sumSizes,
} from "../pwa/OfflineMaps";
import { isOffline, onOfflineChange } from "../pwa/OfflineState";
import { serviceWorkerActive } from "../pwa/RegisterServiceWorker";
import { terrainMapFileLoader } from "../TerrainMapFileLoader";
import { getMapName, translateText } from "../Utils";

interface MapRow {
  plan: OfflineMapPlan;
  /** What is still to download: none once the map is here. */
  missing: string[];
}

/**
 * The solo screen's "download maps for offline", collapsed until opened:
 * World War 1936's map and the featured solo maps, each with its size and
 * whether it is already here, and a download of the chosen ones with
 * progress (pwa/OfflineMaps.ts). Renders nothing without a build's sizes
 * (dev) or the Cache Storage API.
 */
@customElement("offline-maps-panel")
export class OfflineMapsPanel extends LitElement {
  /** Map file and flag sizes; the build's, unless a test passes its own. */
  @property({ attribute: false }) sizes: AssetSizes = buildAssetSizes();

  @state() private expanded = false;
  @state() private rows: MapRow[] | "loading" | "error" = "loading";
  @state() private chosen = new Set<GameMapType>();
  @state() private progress: { done: number; total: number } | null = null;
  @state() private failed = false;
  @state() private offline = isOffline();
  private unsubscribe: (() => void) | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.offline = isOffline();
    this.unsubscribe = onOfflineChange((offline) => (this.offline = offline));
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.disconnectedCallback();
  }

  private available(): boolean {
    return Object.keys(this.sizes).length > 0 && typeof caches !== "undefined";
  }

  private toggle = () => {
    this.expanded = !this.expanded;
    if (this.expanded) void this.load();
  };

  /** Plans every offered map and reads what of each is still missing. */
  async load(): Promise<void> {
    try {
      const rows = await Promise.all(
        offlineMapChoices().map(async (map): Promise<MapRow> => {
          const manifest = await terrainMapFileLoader
            .getMapData(map)
            .manifest();
          const plan = planOfflineMap(map, manifest, this.sizes);
          return { plan, missing: await missingFiles(plan) };
        }),
      );
      // First visit: the two maps a solo game most likely starts on.
      if (this.rows === "loading" && this.chosen.size === 0) {
        this.chosen = new Set(
          rows
            .slice(0, 2)
            .filter((row) => row.missing.length > 0)
            .map((row) => row.plan.map),
        );
      }
      this.rows = rows;
    } catch (err) {
      console.warn("Offline maps: could not read the map list", err);
      this.rows = "error";
    }
  }

  private choose(map: GameMapType, on: boolean) {
    const next = new Set(this.chosen);
    if (on) next.add(map);
    else next.delete(map);
    this.chosen = next;
  }

  private chosenRows(): MapRow[] {
    if (!Array.isArray(this.rows)) return [];
    return this.rows.filter(
      (row) => this.chosen.has(row.plan.map) && row.missing.length > 0,
    );
  }

  private download = async () => {
    const plans = this.chosenRows().map((row) => row.plan);
    if (plans.length === 0 || this.progress !== null) return;
    this.failed = false;
    void requestPersistentStorage();
    try {
      await downloadOfflineMaps(plans, this.sizes, (done, total) => {
        this.progress = { done, total };
      });
      this.chosen = new Set();
    } catch (err) {
      console.warn("Offline maps: download failed", err);
      this.failed = true;
    } finally {
      this.progress = null;
      await this.load();
    }
  };

  private renderRow(row: MapRow) {
    const { plan, missing } = row;
    const done = missing.length === 0;
    const id = `offline-map-${plan.map.replace(/\W+/g, "-")}`;
    return html`<li
      class="flex items-center gap-3 py-2"
      data-offline-map=${plan.map}
    >
      <input
        id=${id}
        type="checkbox"
        class="w-4 h-4 shrink-0 accent-malibu-blue"
        .checked=${done || this.chosen.has(plan.map)}
        ?disabled=${done || this.progress !== null}
        @change=${(e: Event) =>
          this.choose(plan.map, (e.target as HTMLInputElement).checked)}
      />
      <label for=${id} class="flex-1 min-w-0 truncate text-sm font-semibold">
        ${getMapName(plan.map)}
      </label>
      <span class="shrink-0 text-xs tabular-nums text-white/60">
        ${done
          ? translateText("pwa.offline_maps.downloaded")
          : formatMegabytes(sumSizes(missing, this.sizes))}
      </span>
    </li>`;
  }

  private renderBody() {
    if (this.rows === "loading") {
      return html`<p class="text-sm text-white/60">
        ${translateText("pwa.offline_maps.loading")}
      </p>`;
    }
    if (this.rows === "error") {
      return html`<p class="text-sm text-white/60">
        ${translateText("pwa.offline_maps.list_failed")}
      </p>`;
    }
    // What the download fetches: maps share flags, so each file counts once.
    const files = [...new Set(this.chosenRows().flatMap((r) => r.missing))];
    const bytes = sumSizes(files, this.sizes);
    const busy = this.progress !== null;
    return html`
      <p class="text-xs text-white/60">
        ${serviceWorkerActive()
          ? translateText("pwa.offline_maps.app_ready")
          : translateText("pwa.offline_maps.app_preparing")}
      </p>
      <ul class="divide-y divide-white/10">
        ${this.rows.map((row) => this.renderRow(row))}
      </ul>
      ${busy
        ? html`<div class="flex flex-col gap-1" data-offline-progress>
            <div
              class="h-2 w-full rounded-full bg-white/10 overflow-hidden"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax=${this.progress!.total}
              aria-valuenow=${this.progress!.done}
            >
              <div
                class="h-full bg-malibu-blue transition-[width] duration-200"
                style="width: ${percent(this.progress!)}%"
              ></div>
            </div>
            <p class="text-xs tabular-nums text-white/60">
              ${translateText("pwa.offline_maps.progress", {
                done: formatMegabytes(this.progress!.done),
                total: formatMegabytes(this.progress!.total),
                percent: percent(this.progress!),
              })}
            </p>
          </div>`
        : nothing}
      ${this.failed
        ? html`<p class="text-sm text-red-400" role="alert">
            ${translateText("pwa.offline_maps.failed")}
          </p>`
        : nothing}
      ${this.offline
        ? html`<p class="text-xs text-white/60">
            ${translateText("pwa.offline_maps.needs_network")}
          </p>`
        : nothing}
      <button
        type="button"
        data-offline-download
        class="w-full py-2.5 rounded-xl bg-malibu-blue text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        ?disabled=${busy || this.offline || files.length === 0}
        @click=${this.download}
      >
        ${files.length === 0
          ? translateText("pwa.offline_maps.download_none")
          : translateText("pwa.offline_maps.download", {
              size: formatMegabytes(bytes),
            })}
      </button>
    `;
  }

  render() {
    if (!this.available()) return nothing;
    const expanded = this.expanded;
    return html`<div class="w-full">
      <button
        type="button"
        aria-expanded=${expanded}
        data-offline-maps-toggle
        @click=${this.toggle}
        class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold text-white uppercase tracking-wider transition-all duration-200 active:scale-[0.99] ${expanded
          ? "bg-malibu-blue/20 border-malibu-blue/50"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"}"
      >
        <svg
          class="w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${expanded
            ? "rotate-90"
            : ""}"
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4 2l5 4-5 4z" />
        </svg>
        ${translateText("pwa.offline_maps.title")}
      </button>
      ${expanded
        ? html`<div class="mt-4 flex flex-col gap-3">${this.renderBody()}</div>`
        : nothing}
    </div>`;
  }
}

function percent(progress: { done: number; total: number }): number {
  return progress.total === 0
    ? 100
    : Math.min(100, Math.floor((progress.done / progress.total) * 100));
}

declare global {
  interface HTMLElementTagNameMap {
    "offline-maps-panel": OfflineMapsPanel;
  }
}
