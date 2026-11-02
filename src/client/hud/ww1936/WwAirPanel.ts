// World War 1936 P4 (spec §18.7): the air drawer — four tabs: the zones
// my planes fly over (a row opens that zone's card), my planes by type and
// generation (stock, deployed, on decks; each carrier fleet's deck mix),
// my air bases (level, planes / capacity, damage, "build more" in the
// industry drawer) and the last 30 days' record. A long press on ✈ opens it.
import {
  WW_BOMB_CLASSES,
  WW_FIELD_STRIP_MAX,
} from "@openfront/engine-api/ww1936/AirTypes";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { GoToPositionEvent } from "../../TransformHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import {
  AIR_MISSION_ICONS,
  airMissionName,
  airRecord,
  airTypeName,
  myAirBases,
  planeStockRows,
  zoneRows,
} from "./AirModel";
import { designButton } from "./DesignButton";
import { blockText, EQUIPMENT_ICONS, genName } from "./EconomyModel";
import {
  fleetName,
  fleetNumbers,
  NavyCtx,
  navyCtx,
  NavyGame,
} from "./NavyModel";
import { WwAirLayerEvent, WwAirZoneSelectedEvent } from "./SeaAirSelection";
import {
  autoCounts,
  baseName,
  liveBases,
  myWings,
  orderLine,
  phaseNow,
  reportPlace,
  reportRows,
  stateKeyOf,
  stripsBuilding,
  wingMax,
  wingName,
  xpTierOf,
} from "./WingModel";
import { wingUiOf, WwSelectWingsEvent, WwWingChangedEvent } from "./WingUi";
import { isCapitulated } from "./WorldWarModel";
import { autoMaskOf, renderAutoSwitch } from "./WwAutoUi";
import {
  OpenWwAirEvent,
  OpenWwIndustryEvent,
  WW_AIR_TABS,
  WW_AIR_TABS_LIVE,
  WwAirTab,
  WwDrawerBase,
} from "./WwDrawer";
import { DECK_MIXES } from "./WwFleetCard";

const TAB_KEYS: Readonly<Record<WwAirTab, string>> = {
  wings: "ww1936.wing.tab_wings",
  reports: "ww1936.wing.tab_reports",
  zones: "ww1936.air.tab_zones",
  planes: "ww1936.air.tab_planes",
  bases: "ww1936.air.tab_bases",
  record: "ww1936.air.tab_record",
};

const BUTTON =
  "h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";

@customElement("ww-air-panel")
export class WwAirPanel extends WwDrawerBase {
  protected readonly drawerId = "air" as const;
  @state() private tab: WwAirTab = "zones";
  /** ww8: the wings ticked in the wings tab (sent to the card by its button). */
  @state() private checked = new Set<number>();
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwAirEvent, (e) => {
      if (this.open && (e.tab === null || e.tab === this.tab)) {
        this.setOpen(false);
        return;
      }
      if (e.tab !== null) this.tab = e.tab;
      this.setOpen(true);
    });
  }

  shownTab(): WwAirTab {
    return this.tab;
  }

  private live(): boolean {
    return this.game?.wwAir?.()?.live === true;
  }

  /** The tab to show: the old ones map onto the wing model's. */
  private activeTab(): WwAirTab {
    if (!this.live()) return this.tab;
    if (this.tab === "zones") return "wings";
    if (this.tab === "record") return "reports";
    return this.tab;
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const key = [
      this.game?.wwAir?.()?.version,
      this.game?.wwEconomy?.()?.version,
      this.game?.wwNavy?.()?.version,
      this.tab,
      this.checked.size,
      // Automation: the head's switch.
      autoMaskOf(this.game, this.game?.myPlayer()?.smallID() ?? 0),
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  render() {
    if (!this.open) return null;
    const ctx = navyCtx(this.game as unknown as NavyGame);
    if (ctx === null) return null;
    const dead =
      !(this.game.myPlayer()?.isAlive() ?? false) ||
      isCapitulated(this.game, ctx.me);
    return this.renderFrame(
      translateText("ww1936.air.drawer_title"),
      html`<span aria-hidden="true">✈</span>
        <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
          ${translateText("ww1936.air.drawer_title")}
        </h3>
        ${dead
          ? nothing
          : renderAutoSwitch(
              "air",
              autoMaskOf(this.game, ctx.me),
              (o) => this.eventBus.emit(new SendWwOrderIntentEvent(o)),
              true,
            )}`,
      dead
        ? nothing
        : this.renderTabs(
            this.live() ? WW_AIR_TABS_LIVE : WW_AIR_TABS,
            this.activeTab(),
            (t) => translateText(TAB_KEYS[t]),
            (t) => (this.tab = t),
          ),
      dead
        ? html`<p data-ww-block="dead" class="m-0 mt-1 text-xs text-red-300">
            🔒 ${blockText("dead")}
          </p>`
        : this.renderTab(ctx),
    );
  }

  private renderTab(ctx: NavyCtx): TemplateResult {
    switch (this.activeTab()) {
      case "wings":
        return this.renderWings(ctx);
      case "reports":
        return this.renderReports(ctx);
      case "zones":
        return this.renderZones(ctx);
      case "planes":
        return this.renderPlanes(ctx);
      case "bases":
        return this.renderBases(ctx);
      case "record":
        return this.renderRecord(ctx);
    }
  }

  private renderZones(ctx: NavyCtx): TemplateResult {
    const rows = zoneRows(ctx);
    if (rows.length === 0) {
      return html`<p class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.air.hint_pick_zone")}
      </p>`;
    }
    return html`<ul
      data-ww-zone-list
      class="m-0 mt-2 flex list-none flex-col gap-1 p-0"
    >
      ${rows.map(
        (r) =>
          html`<li>
            <button
              type="button"
              data-ww-zone-row=${r.sr}
              class="flex w-full flex-col gap-0.5 rounded-md border border-white/10 bg-white/5 p-1.5 text-left text-xs hover:bg-white/10"
              @click=${() => {
                this.eventBus.emit(new WwAirLayerEvent(true));
                this.eventBus.emit(new WwAirZoneSelectedEvent(r.sr));
                const c = ctx.scenario.sr(r.sr)?.center ?? 0;
                const w = ctx.scenario.width;
                this.eventBus.emit(
                  new GoToPositionEvent(c % w, Math.floor(c / w)),
                );
              }}
            >
              <span class="flex w-full items-baseline gap-1.5">
                <span class="min-w-0 flex-1 truncate font-semibold"
                  >${r.name}</span
                >
                <span
                  class="shrink-0 tabular-nums ${r.supPm < 500
                    ? "text-red-300"
                    : "text-emerald-300"}"
                  >${translateText("ww1936.air.zone_sup", {
                    pct: Math.floor(r.supPm / 10),
                  })}</span
                >
              </span>
              <span class="flex flex-wrap gap-x-2 text-white/80">
                ${r.missions.map(
                  ([m, n]) =>
                    html`<span
                      >${AIR_MISSION_ICONS[m]} ${airMissionName(m)} ${n}</span
                    >`,
                )}
                ${r.lost > 0
                  ? html`<span class="text-red-300"
                      >${translateText("ww1936.air.result_line", {
                        kills: "—",
                        lost: r.lost,
                      })}</span
                    >`
                  : nothing}
              </span>
            </button>
          </li>`,
      )}
    </ul>`;
  }

  private renderPlanes(ctx: NavyCtx): TemplateResult {
    const rows = planeStockRows(ctx);
    const carriers = [...ctx.navy.fleets.values()]
      .filter((f) => f.owner === ctx.me && fleetNumbers(ctx, f).hasCarrier)
      .sort((a, b) => a.id - b.id);
    return html`
      ${designButton(this.eventBus, "plane")}
      ${rows.length === 0
        ? html`<p class="m-0 mt-2 text-xs text-white/60">
            ${translateText("ww1936.air.rows_none")}
          </p>`
        : html`<ul
            data-ww-plane-stock
            class="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs"
          >
            ${rows.map(
              (r) =>
                html`<li
                  data-ww-plane-type=${r.type}
                  class="rounded-md border border-white/10 bg-white/5 p-1.5"
                >
                  <div class="flex items-baseline gap-1.5">
                    <span aria-hidden="true">${EQUIPMENT_ICONS[r.type]}</span>
                    <span class="min-w-0 flex-1 truncate font-semibold"
                      >${airTypeName(r.type)}</span
                    >
                  </div>
                  <div
                    class="flex flex-wrap gap-x-2 tabular-nums text-white/80"
                  >
                    <span
                      >${translateText("ww1936.air.planes_stock", {
                        n: r.stock,
                      })}</span
                    >
                    <span
                      >${translateText("ww1936.air.planes_deployed", {
                        n: r.deployed,
                      })}</span
                    >
                    ${r.decks > 0
                      ? html`<span
                          >${translateText("ww1936.air.planes_deck", {
                            n: r.decks,
                          })}</span
                        >`
                      : nothing}
                    <span class="text-white/60"
                      >${r.gens
                        .map((n, i) => (n > 0 ? `${genName(i + 1)} ${n}` : ""))
                        .filter((x) => x !== "")
                        .join(" · ")}</span
                    >
                  </div>
                </li>`,
            )}
          </ul>`}
      ${carriers.map(
        (f) =>
          html`<div
            data-ww-deck-mix=${f.id}
            class="mt-2 rounded-md border border-white/10 bg-white/5 p-1.5 text-xs"
          >
            <div class="font-semibold">
              ${translateText("ww1936.air.deck_title", {
                carrier: fleetName(f),
              })}
            </div>
            <div class="mt-1 flex flex-wrap gap-1">
              ${DECK_MIXES.map(
                (mix) =>
                  html`<button
                    type="button"
                    data-ww-pick=${`deck:${f.id}:${mix.join("")}`}
                    aria-pressed=${String(f.mix?.join() === mix.join())}
                    class="${BUTTON} ${f.mix?.join() === mix.join()
                      ? "border-sky-300 bg-sky-800/60"
                      : ""}"
                    @click=${() =>
                      this.eventBus.emit(
                        new SendWwOrderIntentEvent({
                          kind: "carrier_mix",
                          fleet: f.id,
                          mix,
                        }),
                      )}
                  >
                    ${translateText("ww1936.navy.deck_line", {
                      fighters: mix[0] * 10,
                      cas: mix[1] * 10,
                      torp: mix[2] * 10,
                    })}
                  </button>`,
              )}
            </div>
          </div>`,
      )}
    `;
  }

  private renderBases(ctx: NavyCtx): TemplateResult {
    if (this.live()) return this.renderLiveBases(ctx);
    const bases = myAirBases(ctx);
    if (bases.length === 0) {
      return html`<p class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.air.bases_none")}
      </p>`;
    }
    return html`<ul
      data-ww-air-bases
      class="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs"
    >
      ${bases.map(
        (b) =>
          html`<li
            data-ww-air-base=${b.region}
            class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-white/10 bg-white/5 p-1.5"
          >
            <span class="min-w-0 flex-1 truncate font-semibold"
              >${translateText("ww1936.air.base_row", {
                region: b.name,
                lvl: b.level,
              })}</span
            >
            <span class="tabular-nums"
              >${translateText("ww1936.air.base_use", {
                used: b.used,
                cap: b.cap,
              })}</span
            >
            ${b.damagePm > 0
              ? html`<span class="text-red-300"
                  >${translateText("ww1936.air.base_damage", {
                    pct: Math.round(b.damagePm / 10),
                  })}</span
                >`
              : nothing}
            <button
              type="button"
              data-ww-build-air-base=${b.region}
              class=${BUTTON}
              @click=${() =>
                this.eventBus.emit(
                  new OpenWwIndustryEvent("construction", b.region, "air_base"),
                )}
            >
              ${translateText("ww1936.air.btn_build_more")}
            </button>
          </li>`,
      )}
    </ul>`;
  }

  private renderRecord(ctx: NavyCtx): TemplateResult {
    const r = airRecord(ctx);
    if (r === null) return html``;
    return html`<ul
      data-ww-air-record
      class="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs"
    >
      <li>${translateText("ww1936.air.record_kills", { n: r.kills })}</li>
      <li>${translateText("ww1936.air.record_lost", { n: r.lost })}</li>
      <li>${translateText("ww1936.air.record_dealt", { n: r.dealt })}</li>
      <li>${translateText("ww1936.air.record_taken", { n: r.taken })}</li>
      <li>
        ${translateText("ww1936.air.record_sunk", {
          ships: r.ships,
          convoys: r.convoys,
        })}
      </li>
    </ul>`;
  }

  // ---- ww8: the wing model's tabs (design §8.7) ----

  /** Close the drawer and hand the card these wings. */
  private openCard(ids: readonly number[]) {
    this.eventBus.emit(new WwSelectWingsEvent(ids));
    this.setOpen(false);
  }

  private renderWings(ctx: NavyCtx): TemplateResult {
    const wings = myWings(ctx);
    const ticks = this.game.ticks();
    const { on, all } = autoCounts(ctx);
    if (wings.length === 0) {
      return html`<p class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.wing.none")}
      </p>`;
    }
    return html`<div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span data-ww-wing-auto-count class="text-white/70"
          >${translateText("ww1936.wing.auto_count", { on, all })}</span
        >
        <button
          type="button"
          data-ww-wings-open
          class="${BUTTON} ${this.checked.size > 0 ? "border-sky-300" : ""}"
          aria-disabled=${String(this.checked.size === 0)}
          @click=${() => {
            if (this.checked.size === 0) return;
            this.openCard([...this.checked].slice(0, 20));
          }}
        >
          ${translateText("ww1936.wing.btn_order_chosen", {
            n: this.checked.size,
          })}
        </button>
        ${this.checked.size > 0
          ? html`<button
              type="button"
              class=${BUTTON}
              @click=${() => (this.checked = new Set())}
            >
              ${translateText("ww1936.wing.btn_clear")}
            </button>`
          : nothing}
      </div>
      <ul
        data-ww-wing-list
        class="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-xs"
      >
        ${wings.map((w) => {
          const ph = phaseNow(ctx.air, w, ticks);
          const on = this.checked.has(w.id);
          return html`<li
            data-ww-wing-row=${w.id}
            class="flex items-stretch gap-1 rounded-md border border-white/10 bg-white/5"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked=${String(on)}
              aria-label=${wingName(w)}
              data-ww-wing-check=${w.id}
              class="w-10 shrink-0 rounded-l-md ${on
                ? "bg-sky-800/60"
                : "hover:bg-white/10"}"
              @click=${() => {
                const next = new Set(this.checked);
                if (on) next.delete(w.id);
                else next.add(w.id);
                this.checked = next;
              }}
            >
              ${on ? "☑" : "☐"}
            </button>
            <button
              type="button"
              class="flex min-h-10 min-w-0 flex-1 flex-col gap-0.5 p-1.5 text-left hover:bg-white/10"
              @click=${() => this.openCard([w.id])}
            >
              <span class="flex items-baseline gap-1.5">
                <span class="min-w-0 flex-1 truncate font-semibold"
                  >${wingName(w)}</span
                >
                <span class="shrink-0 tabular-nums"
                  >${w.planes}/${wingMax(w)}</span
                >
                <span class="shrink-0 text-amber-200"
                  >${"★".repeat(xpTierOf(w.xpMilli))}${w.auto
                    ? " 🤖"
                    : ""}</span
                >
              </span>
              <span class="flex flex-wrap gap-x-2 text-white/70">
                <span>${baseName(ctx, w.base)}</span>
                <span>${orderLine(ctx, w)}</span>
                <span>${translateText(stateKeyOf(ph.phase, w.planes))}</span>
              </span>
            </button>
          </li>`;
        })}
      </ul>`;
  }

  private renderLiveBases(ctx: NavyCtx): TemplateResult {
    const ticks = this.game.ticks();
    const bases = liveBases(ctx, ticks);
    const building = stripsBuilding(ctx, ticks);
    const strips = bases.filter((b) => b.strip).length + building.length;
    return html`<div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          data-ww-field-strip
          aria-disabled=${String(strips >= WW_FIELD_STRIP_MAX)}
          class=${BUTTON}
          @click=${() => {
            if (strips >= WW_FIELD_STRIP_MAX) return;
            const ui = wingUiOf(this.game);
            ui.clear();
            ui.mode = "field";
            ui.bump();
            this.eventBus.emit(new WwWingChangedEvent());
            this.setOpen(false);
          }}
        >
          ${translateText("ww1936.wing.btn_field")}
        </button>
        <span class="text-white/70"
          >${translateText("ww1936.wing.field_count", {
            n: strips,
            max: WW_FIELD_STRIP_MAX,
          })}</span
        >
      </div>
      ${bases.length === 0 && building.length === 0
        ? html`<p class="m-0 mt-2 text-xs text-white/60">
            ${translateText("ww1936.air.bases_none")}
          </p>`
        : html`<ul
            data-ww-air-bases
            class="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-xs"
          >
            ${building.map(
              ([r, left]) =>
                html`<li
                  data-ww-air-strip-building=${r}
                  class="rounded-md border border-white/10 bg-white/5 p-1.5 text-white/80"
                >
                  ${translateText("ww1936.wing.strip_building", {
                    region: baseName(ctx, r),
                    days: Math.ceil((left * 2) / 15),
                  })}
                </li>`,
            )}
            ${bases.map(
              (b) =>
                html`<li
                  data-ww-air-base=${b.region}
                  class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-white/10 bg-white/5 p-1.5"
                >
                  <span class="min-w-0 flex-1 truncate font-semibold"
                    >${b.strip
                      ? translateText("ww1936.wing.strip_row", {
                          region: b.name,
                        })
                      : b.name}</span
                  >
                  <span class="tabular-nums"
                    >${translateText("ww1936.air.base_use", {
                      used: b.used,
                      cap: b.cap,
                    })}</span
                  >
                  <span class="tabular-nums text-white/70"
                    >${translateText("ww1936.wing.base_wings", {
                      n: b.wings,
                    })}</span
                  >
                  ${b.damagePm > 0
                    ? html`<span class="text-red-300"
                        >${translateText("ww1936.air.base_damage", {
                          pct: Math.round(b.damagePm / 10),
                        })}</span
                      >`
                    : nothing}
                  ${b.strip
                    ? nothing
                    : html`<button
                        type="button"
                        data-ww-build-air-base=${b.region}
                        class=${BUTTON}
                        @click=${() =>
                          this.eventBus.emit(
                            new OpenWwIndustryEvent(
                              "construction",
                              b.region,
                              "air_base",
                            ),
                          )}
                      >
                        ${translateText("ww1936.air.btn_build_more")}
                      </button>`}
                </li>`,
            )}
          </ul>`}`;
  }

  private renderReports(ctx: NavyCtx): TemplateResult {
    const rows = reportRows(ctx);
    return html`${this.renderRecord(ctx)}
    ${rows.length === 0
      ? html`<p class="m-0 mt-2 text-xs text-white/60">
          ${translateText("ww1936.wing.reports_none")}
        </p>`
      : html`<ul
          data-ww-air-reports
          class="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs"
        >
          ${rows.map(
            (x) =>
              html`<li
                data-ww-air-report
                class="rounded-md border p-1.5 ${x.hit
                  ? "border-red-400/40 bg-red-900/20"
                  : "border-white/10 bg-white/5"}"
              >
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="font-semibold"
                    >${translateText(
                      x.hit
                        ? "ww1936.wing.report_hit"
                        : "ww1936.wing.report_raid",
                      { place: reportPlace(ctx, x.report) },
                    )}</span
                  >
                  <span class="text-white/70"
                    >${translateText(
                      `ww1936.bomb.class_${WW_BOMB_CLASSES[x.report.cls]}`,
                    )}</span
                  >
                  <span class="tabular-nums text-white/70"
                    >${translateText("ww1936.wing.report_counts", {
                      raids: x.report.raids,
                      lost: x.report.lost,
                    })}</span
                  >
                </div>
                ${x.lines.map(
                  (l) =>
                    html`<div class="text-white/80">
                      ${translateText(l.key, l.params)}
                    </div>`,
                )}
              </li>`,
          )}
        </ul>`}`;
  }
}
