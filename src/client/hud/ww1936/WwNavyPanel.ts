// World War 1936 P4 (spec §18.5): the navy drawer — four tabs: my fleets
// (a row chooses the fleet and the camera goes there), the shipyards (the
// naval lines; the industry drawer shows the same <ww-shipyards>), the
// convoys (their uses, the routes, the last 30 days' losses) and the
// admirals. Every order goes out as one ww_order; a removal takes two taps.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  ShipClass,
  WW_MAX_DOCKS_PER_LINE,
  WW_MAX_LINE_COUNT,
  WW_TITLED_ADMIRAL_XP_MILLI,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { GoToPositionEvent } from "../../TransformHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { designButton } from "./DesignButton";
import { blockText, genName } from "./EconomyModel";
import { regionName } from "./LandModel";
import {
  ADMIRAL_TRAIT_ICONS,
  admiralRows,
  convoyLosses,
  convoySummary,
  docksLine,
  fleetRows,
  LINE_CLASSES,
  LineCard,
  lineCards,
  lineGens,
  linePorts,
  NavyCtx,
  navyCtx,
  NavyGame,
  newLineBlock,
  newLineOrder,
  routeRows,
  SHIP_ICONS,
  shipClassName,
  shipGenName,
} from "./NavyModel";
import { WwFleetSelectedEvent, WwSeaLayerEvent } from "./SeaAirSelection";
import { isCapitulated, TWO_TAP_MS, TwoTap } from "./WorldWarModel";
import {
  OpenWwNavyEvent,
  WW_NAVY_TABS,
  WwDrawerBase,
  WwNavyTab,
} from "./WwDrawer";

const TAB_KEYS: Readonly<Record<WwNavyTab, string>> = {
  fleets: "ww1936.navy.tab_fleets",
  shipyards: "ww1936.navy.tab_shipyards",
  convoys: "ww1936.navy.tab_convoys",
  admirals: "ww1936.navy.tab_admirals",
};

const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const BUTTON =
  "h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const ICON_BUTTON =
  "size-9 shrink-0 rounded-md border border-white/10 bg-white/5 text-xs hover:bg-white/10 disabled:opacity-30";

function lineClassName(cls: ShipClass | "convoy" | "floating_harbor"): string {
  return cls === "convoy" || cls === "floating_harbor"
    ? translateText(`ww1936.equip.${cls}`)
    : shipClassName(cls);
}

/** The new line's draft (spec §18.5-2: class → generation → port → dockyards → ships). */
interface LineDraft {
  cls: ShipClass | "convoy";
  gen: number;
  port: number;
  docks: number;
  count: number;
}

/**
 * The naval lines (spec §18.5-2): the dockyards line, a card per line
 * (class, generation, next name, dockyards −/+, ships left −/+, progress,
 * days to the next launch from engine-lib nextLaunchDays, short
 * resources, ▲▼, remove by two taps) and "new line". The navy drawer's
 * second tab and the industry drawer's shipyards view.
 */
@customElement("ww-shipyards")
export class WwShipyards extends LitElement {
  @property({ attribute: false }) game: GameView;
  @property({ attribute: false }) eventBus: EventBus;
  /** Open "new line" with the convoy picked (the convoys tab's shortcut). */
  @property({ attribute: false }) preset: "convoy" | null = null;
  /** The navy and economy views' versions: a new one redraws the lines. */
  @property({ attribute: false }) version = "";
  @state() private draft: LineDraft | null = null;
  private readonly twoTap = new TwoTap();

  createRenderRoot() {
    return this;
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("preset") && this.preset === "convoy") {
      this.draft = { cls: "convoy", gen: 1, port: 0, docks: 1, count: 0 };
    }
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  render() {
    const ctx = navyCtx(this.game as unknown as NavyGame);
    if (ctx === null) return nothing;
    const docks = docksLine(ctx);
    const cards = lineCards(ctx);
    return html`<section data-ww-shipyards>
      ${docks === null
        ? nothing
        : html`<p data-ww-docks class="m-0 mt-2 text-xs text-white/80">
            ${translateText(docks.key, docks.params)}
          </p>`}
      ${cards.length === 0
        ? html`<p class="m-0 mt-2 text-xs text-white/60">
            ${translateText("ww1936.navy.lines_none")}
          </p>`
        : html`<ul class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            ${cards.map((c) => this.renderLine(c, cards.length))}
          </ul>`}
      ${this.renderNewLine(ctx)}
    </section>`;
  }

  private stepper(
    label: string,
    key: string,
    value: number,
    min: number,
    max: number,
    set: (v: number) => void,
  ): TemplateResult {
    return html`<span class="flex shrink-0 items-center gap-1">
      <button
        type="button"
        data-ww-step=${`${key}:down`}
        aria-label=${translateText("ww1936.econ.fewer")}
        class=${ICON_BUTTON}
        ?disabled=${value <= min}
        @click=${() => set(value - 1)}
      >
        −
      </button>
      <span
        data-ww-step-value=${key}
        class="min-w-16 text-center text-xs tabular-nums"
        >${label}</span
      >
      <button
        type="button"
        data-ww-step=${`${key}:up`}
        aria-label=${translateText("ww1936.econ.more")}
        class=${ICON_BUTTON}
        ?disabled=${value >= max}
        @click=${() => set(value + 1)}
      >
        +
      </button>
    </span>`;
  }

  private renderLine(c: LineCard, n: number): TemplateResult {
    const l = c.line;
    const key = `remove_naval_line:${l.id}`;
    const armed = this.twoTap.isArmed(key, Date.now());
    return html`<li
      data-ww-naval-line=${l.id}
      class="rounded-md border border-white/10 bg-white/5 p-2 text-xs"
    >
      <div class="flex items-center gap-1.5">
        <span aria-hidden="true">${SHIP_ICONS[l.cls]}</span>
        <span class="min-w-0 flex-1 truncate font-semibold"
          >${translateText("ww1936.navy.line_ship", {
            cls: lineClassName(l.cls),
            gen:
              l.cls === "convoy" || l.cls === "floating_harbor"
                ? genName(1)
                : shipGenName(l.gen),
          })}</span
        >
        <button
          type="button"
          data-ww-move-naval-line="up"
          aria-label=${translateText("ww1936.econ.move_up")}
          class=${ICON_BUTTON}
          ?disabled=${c.index === 0}
          @click=${() =>
            this.send({ kind: "naval_line_move", line: l.id, to: c.index - 1 })}
        >
          ▲
        </button>
        <button
          type="button"
          data-ww-move-naval-line="down"
          aria-label=${translateText("ww1936.econ.move_down")}
          class=${ICON_BUTTON}
          ?disabled=${c.index === n - 1}
          @click=${() =>
            this.send({ kind: "naval_line_move", line: l.id, to: c.index + 1 })}
        >
          ▼
        </button>
        <button
          type="button"
          data-ww-remove-naval-line=${l.id}
          data-armed=${String(armed)}
          aria-label=${translateText("ww1936.econ.remove_line")}
          class=${armed
            ? "h-9 rounded-md bg-red-700 px-2 text-xs font-semibold"
            : ICON_BUTTON}
          @click=${() => {
            if (this.twoTap.tap(key, Date.now())) {
              this.send({ kind: "naval_line_remove", line: l.id });
            }
            this.requestUpdate();
            setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
          }}
        >
          ${armed ? translateText("ww1936.econ.remove_tap") : "✕"}
        </button>
      </div>
      ${c.nextName === null
        ? nothing
        : html`<p data-ww-next-name class="m-0 text-white/80">
            ${translateText("ww1936.navy.line_next_name", { name: c.nextName })}
          </p>`}
      <div class="mt-1 flex flex-wrap items-center gap-2">
        ${this.stepper(
          translateText("ww1936.navy.line_docks", {
            n:
              l.activeDocks < l.docks ? `${l.activeDocks}/${l.docks}` : l.docks,
          }),
          `docks-${l.id}`,
          l.docks,
          1,
          WW_MAX_DOCKS_PER_LINE,
          (v) => this.send({ kind: "naval_line_docks", line: l.id, docks: v }),
        )}
        ${this.stepper(
          l.left === 0 && l.cls === "convoy"
            ? "∞"
            : translateText("ww1936.navy.line_remaining", { n: l.left }),
          `count-${l.id}`,
          l.left,
          l.cls === "convoy" ? 0 : 1,
          WW_MAX_LINE_COUNT,
          (v) => this.send({ kind: "naval_line_count", line: l.id, count: v }),
        )}
      </div>
      <div class="mt-1.5 h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded bg-sky-400"
          style="width: ${Math.round(c.progress * 100)}%"
        ></div>
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-white/80">
        <span data-ww-next-launch
          >${c.nextDays < 0
            ? translateText("ww1936.navy.line_stalled", {
                reason: blockText(
                  l.activeDocks === 0 ? "no_dock" : "no_naval_base",
                ),
              })
            : translateText("ww1936.navy.next_launch", {
                days: c.nextDays,
              })}</span
        >
        <span>⚓ ${c.portName}</span>
        ${c.short
          ? html`<span
              data-ww-line-short
              class="rounded bg-red-900/60 px-1 text-red-200"
              >${translateText("ww1936.navy.line_short", {
                list: `${Math.floor(l.fill / 10)}%`,
              })}</span
            >`
          : nothing}
      </div>
    </li>`;
  }

  private renderNewLine(ctx: NavyCtx): TemplateResult {
    const d = this.draft;
    const ports = linePorts(ctx);
    if (d === null) {
      const block = newLineBlock(ctx, "dd", 1);
      return html`<section data-ww-new-naval-line-section>
        <button
          type="button"
          data-ww-new-naval-line
          class="${BUTTON} mt-2 w-full"
          ?disabled=${block !== null && block !== "no_tech"}
          @click=${() => {
            this.draft = {
              cls: "dd",
              gen: 1,
              port: ports[0] ?? 0,
              docks: 1,
              count: 1,
            };
          }}
        >
          + ${translateText("ww1936.navy.new_line")}
        </button>
        ${block !== null && block !== "no_tech"
          ? html`<p
              data-ww-block=${block}
              class="m-0 mt-1 text-xs text-red-300"
            >
              🔒 ${blockText(block)}
            </p>`
          : nothing}
      </section>`;
    }
    const port = ports.includes(d.port) ? d.port : (ports[0] ?? 0);
    const block = newLineBlock(ctx, d.cls, d.gen);
    const chip = (
      key: string,
      label: string,
      on: boolean,
      act: () => void,
      disabled = false,
    ) =>
      html`<button
        type="button"
        data-ww-pick=${key}
        aria-pressed=${String(on)}
        class="h-9 shrink-0 rounded-md border px-2 text-xs ${on
          ? "border-sky-300 bg-sky-800/60"
          : "border-white/15 bg-white/5 hover:bg-white/10"} disabled:opacity-40"
        ?disabled=${disabled}
        @click=${act}
      >
        ${label}
      </button>`;
    return html`<section
      data-ww-new-naval-line-section
      class="mt-2 flex flex-col gap-1.5 rounded-md border border-white/10 bg-gray-900/80 p-2 text-xs"
    >
      <div class=${HEADING}>${translateText("ww1936.navy.new_line_class")}</div>
      <div class="flex flex-wrap gap-1">
        ${LINE_CLASSES.map((cls) =>
          chip(
            `cls:${cls}`,
            `${SHIP_ICONS[cls]} ${lineClassName(cls)}`,
            d.cls === cls,
            () => {
              this.draft = {
                ...d,
                cls,
                gen: 1,
                count: cls === "convoy" ? 0 : Math.max(1, d.count),
              };
            },
          ),
        )}
      </div>
      <div class=${HEADING}>${translateText("ww1936.navy.new_line_gen")}</div>
      <div class="flex flex-wrap gap-1">
        ${lineGens(d.cls).map((gen) => {
          const locked = newLineBlock(ctx, d.cls, gen) === "no_tech";
          return chip(
            `gen:${gen}`,
            `${locked ? "🔒 " : ""}${d.cls === "convoy" ? genName(gen) : shipGenName(gen)}`,
            d.gen === gen,
            () => (this.draft = { ...d, gen }),
            locked,
          );
        })}
      </div>
      <div class=${HEADING}>${translateText("ww1936.navy.new_line_port")}</div>
      <div class="flex flex-wrap gap-1">
        ${ports.map((r) =>
          chip(`port:${r}`, regionName(ctx.scenario, r), port === r, () => {
            this.draft = { ...d, port: r };
          }),
        )}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span>${translateText("ww1936.navy.new_line_docks")}</span>
        ${this.stepper(
          String(d.docks),
          "new-docks",
          d.docks,
          1,
          WW_MAX_DOCKS_PER_LINE,
          (v) => {
            this.draft = { ...d, docks: v };
          },
        )}
        <span>${translateText("ww1936.navy.new_line_count")}</span>
        ${this.stepper(
          d.cls === "convoy" && d.count === 0 ? "∞" : String(d.count),
          "new-count",
          d.count,
          d.cls === "convoy" ? 0 : 1,
          WW_MAX_LINE_COUNT,
          (v) => (this.draft = { ...d, count: v }),
        )}
      </div>
      ${block === null
        ? nothing
        : html`<p data-ww-block=${block} class="m-0 text-red-300">
            🔒 ${blockText(block)}
          </p>`}
      <div class="flex gap-1">
        <button
          type="button"
          data-ww-start-naval-line
          class="${BUTTON} flex-1 bg-sky-800/60"
          ?disabled=${block !== null || port === 0}
          @click=${() => {
            this.send(newLineOrder(d.cls, d.gen, port, d.docks, d.count));
            this.draft = null;
          }}
        >
          ${translateText("ww1936.navy.new_line_start")}
        </button>
        <button
          type="button"
          class=${BUTTON}
          @click=${() => (this.draft = null)}
        >
          ${translateText("common.cancel")}
        </button>
      </div>
    </section>`;
  }
}

/**
 * World War 1936 P4 (spec §18.5): the navy drawer. The ⚓ dial opens it
 * and turns the sea layer on; it turns the layer off when it closes.
 */
@customElement("ww-navy-panel")
export class WwNavyPanel extends WwDrawerBase {
  protected readonly drawerId = "navy" as const;
  @state() private tab: WwNavyTab = "fleets";
  @state() private preset: "convoy" | null = null;
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwNavyEvent, (e) => {
      if (this.open && (e.tab === null || e.tab === this.tab)) {
        this.setOpen(false);
        return;
      }
      if (e.tab !== null) this.tab = e.tab;
      this.setOpen(true);
    });
  }

  shownTab(): WwNavyTab {
    return this.tab;
  }

  protected setOpen(open: boolean) {
    const was = this.open;
    super.setOpen(open);
    if (was !== open) this.eventBus.emit(new WwSeaLayerEvent(open));
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const key = [
      this.game?.wwNavy?.()?.version,
      this.game?.wwEconomy?.()?.version,
      this.tab,
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  render() {
    if (!this.open) return null;
    const ctx = navyCtx(this.game as unknown as NavyGame);
    if (ctx === null) return null;
    const dead =
      !(this.game.myPlayer()?.isAlive() ?? false) ||
      isCapitulated(this.game, ctx.me);
    return this.renderFrame(
      translateText("ww1936.navy.drawer_title"),
      html`<span aria-hidden="true">⚓</span>
        <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
          ${translateText("ww1936.navy.drawer_title")}
        </h3>`,
      dead
        ? nothing
        : this.renderTabs(
            WW_NAVY_TABS,
            this.tab,
            (t) => translateText(TAB_KEYS[t]),
            (t) => {
              this.tab = t;
              this.preset = null;
            },
          ),
      dead
        ? html`<p data-ww-block="dead" class="m-0 mt-1 text-xs text-red-300">
            🔒 ${blockText("dead")}
          </p>`
        : this.renderTab(ctx),
    );
  }

  private renderTab(ctx: NavyCtx): TemplateResult {
    switch (this.tab) {
      case "fleets":
        return this.renderFleets(ctx);
      case "shipyards":
        return html`${designButton(this.eventBus, "ship")}
          <ww-shipyards
            .game=${this.game}
            .eventBus=${this.eventBus}
            .preset=${this.preset}
            .version=${`${ctx.navy.version}:${ctx.economy.version}`}
          ></ww-shipyards>`;
      case "convoys":
        return this.renderConvoys(ctx);
      case "admirals":
        return this.renderAdmirals(ctx);
    }
  }

  private renderFleets(ctx: NavyCtx): TemplateResult {
    const rows = fleetRows(ctx);
    if (rows.length === 0) {
      return html`<p class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.navy.no_fleets")}
      </p>`;
    }
    return html`<ul
      data-ww-fleet-rows
      class="m-0 mt-2 flex list-none flex-col gap-1 p-0"
    >
      ${rows.map(
        (r) =>
          html`<li>
            <button
              type="button"
              data-ww-fleet-row=${r.id}
              class="flex w-full flex-col gap-0.5 rounded-md border border-white/10 bg-white/5 p-1.5 text-left text-xs hover:bg-white/10"
              @click=${() => {
                this.eventBus.emit(new WwFleetSelectedEvent(r.id));
                const f = ctx.navy.fleets.get(r.id);
                if (f !== undefined) {
                  const c =
                    f.docked !== 0
                      ? ctx.scenario.centerTile(f.docked)
                      : ctx.scenario.zoneCenter(f.zone);
                  const w = ctx.scenario.width;
                  this.eventBus.emit(
                    new GoToPositionEvent(c % w, Math.floor(c / w)),
                  );
                }
              }}
            >
              <span class="flex w-full items-baseline gap-1.5">
                <span class="min-w-0 truncate font-semibold">${r.name}</span>
                <span class="min-w-0 flex-1 truncate text-white/60"
                  >${r.admiral}</span
                >
                <span class="shrink-0 tabular-nums"
                  >${r.counts
                    .map(([cls, n]) => `${SHIP_ICONS[cls]}${n}`)
                    .join(" ")}</span
                >
              </span>
              <span class="block h-1 w-full rounded bg-white/10"
                ><span
                  class="block h-1 rounded bg-emerald-400"
                  style="width: ${r.hpPm / 10}%"
                ></span
              ></span>
              <span class="flex w-full gap-1.5 text-white/80">
                <span class="min-w-0 truncate"
                  >${translateText("ww1936.navy.fleet_row", {
                    n: r.ships,
                    where: r.where,
                  })}</span
                >
                <span class="ml-auto shrink-0"
                  >${translateText(`ww1936.fleet_state.${r.state}`)}</span
                >
              </span>
            </button>
          </li>`,
      )}
    </ul>`;
  }

  private renderConvoys(ctx: NavyCtx): TemplateResult {
    const s = convoySummary(ctx);
    const routes = routeRows(ctx);
    const loss = convoyLosses(ctx);
    return html`
      ${s === null
        ? nothing
        : html`<p data-ww-convoys-line class="m-0 mt-2 text-xs text-white/80">
            ${translateText("ww1936.navy.convoys_line", {
              used: s.used,
              all: s.all,
              t: s.byUse.trade,
              s: s.byUse.supply,
              v: s.byUse.voyage,
              i: s.idle,
            })}
          </p>`}
      <div class=${HEADING}>${translateText("ww1936.navy.routes_title")}</div>
      ${routes.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.navy.routes_none")}
          </p>`
        : html`<ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
            ${routes.map(
              (r) =>
                html`<li
                  data-ww-route=${r.id}
                  class="rounded-md border border-white/10 bg-white/5 p-1.5"
                >
                  <div class="flex gap-1.5">
                    <span class="shrink-0 text-white/70"
                      >${translateText(`ww1936.convoy_use.${r.use}`)}</span
                    >
                    <span class="min-w-0 truncate"
                      >${translateText("ww1936.navy.route_row", {
                        from: r.from,
                        to: r.to,
                      })}</span
                    >
                  </div>
                  <div class="flex flex-wrap gap-x-2 text-white/80">
                    <span
                      >${translateText("ww1936.navy.route_need", {
                        need: r.need,
                        have: r.got,
                      })}</span
                    >
                    <span class=${r.effPct < 100 ? "text-amber-300" : ""}
                      >${translateText("ww1936.navy.route_eff", {
                        pct: r.effPct,
                      })}</span
                    >
                    ${r.via.length === 0
                      ? nothing
                      : html`<span class="min-w-0 truncate"
                          >${translateText("ww1936.navy.route_via", {
                            list: r.via.join(", "),
                          })}</span
                        >`}
                  </div>
                </li>`,
            )}
          </ul>`}
      <div class=${HEADING}>${translateText("ww1936.navy.losses_title")}</div>
      ${loss.max <= 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.navy.losses_none")}
          </p>`
        : html`<div
              data-ww-loss-bars
              class="flex h-10 items-end gap-px"
              aria-hidden="true"
            >
              ${loss.days.map(
                (n) =>
                  html`<span
                    class="flex-1 rounded-t bg-red-400"
                    style="height: ${Math.round((n / loss.max) * 100)}%"
                  ></span>`,
              )}
            </div>
            <ul class="m-0 mt-1 list-none p-0 text-xs text-white/80">
              ${loss.bySr.map(
                ([name, n]) =>
                  html`<li>
                    ${translateText("ww1936.navy.losses_row", {
                      sr: name,
                      n: n.toFixed(1),
                    })}
                  </li>`,
              )}
            </ul>`}
      <button
        type="button"
        data-ww-build-convoys
        class="${BUTTON} mt-2 w-full"
        @click=${() => {
          this.tab = "shipyards";
          this.preset = "convoy";
        }}
      >
        ${translateText("ww1936.navy.btn_build_convoys")}
      </button>
    `;
  }

  private renderAdmirals(ctx: NavyCtx): TemplateResult {
    const rows = admiralRows(ctx);
    const xp = ctx.navy.detail?.navyXpMilli ?? 0;
    const cost = WW_TITLED_ADMIRAL_XP_MILLI;
    return html`
      <p data-ww-navy-xp class="m-0 mt-2 text-xs text-white/80">
        ${translateText("ww1936.navy.navy_xp", { n: Math.floor(xp / 1000) })}
      </p>
      <button
        type="button"
        data-ww-appoint-admiral
        class="${BUTTON} mt-1 w-full"
        aria-disabled=${String(xp < cost)}
        @click=${() => {
          if (xp >= cost) this.send({ kind: "appoint_admiral" });
        }}
      >
        ${translateText("ww1936.navy.appoint_admiral", { cost: cost / 1000 })}
      </button>
      ${xp < cost
        ? html`<p data-ww-block="no_xp" class="m-0 mt-1 text-xs text-red-300">
            🔒 ${blockText("no_xp")}
          </p>`
        : nothing}
      ${rows.length === 0
        ? html`<p class="m-0 mt-2 text-xs text-white/60">
            ${translateText("ww1936.navy.admirals_none")}
          </p>`
        : html`<ul
            data-ww-admirals
            class="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs"
          >
            ${rows.map(
              (a) =>
                html`<li
                  data-ww-admiral=${a.id}
                  class="rounded-md border border-white/10 bg-white/5 p-1.5"
                >
                  <div class="flex items-baseline gap-1.5">
                    <span class="min-w-0 truncate font-semibold"
                      >${a.name}</span
                    >
                    ${(a.now?.traits ?? []).map(
                      (t) =>
                        html`<span
                          data-ww-trait=${t}
                          role="img"
                          aria-label=${translateText(
                            `ww1936.admiral_trait.${t}`,
                          )}
                          >${ADMIRAL_TRAIT_ICONS[t]}</span
                        >`,
                    )}
                    <span class="ml-auto shrink-0 text-white/70"
                      >${a.fleetName === null
                        ? translateText("ww1936.navy.admiral_free")
                        : translateText("ww1936.navy.admiral_commands", {
                            fleet: a.fleetName,
                          })}</span
                    >
                  </div>
                  ${a.now === null
                    ? nothing
                    : html`<div class="tabular-nums text-white/60">
                        ${translateText("ww1936.navy.admiral_stats", {
                          a: a.now.skills[0],
                          d: a.now.skills[1],
                          m: a.now.skills[2],
                          c: a.now.skills[3],
                        })}
                        ${a.now.level > 0
                          ? html` ·
                            ${translateText("ww1936.navy.admiral_level", {
                              n: a.now.level,
                            })}`
                          : nothing}
                      </div>`}
                  ${(a.now?.traits ?? []).map(
                    (t) =>
                      html`<div class="text-white/60">
                        ${ADMIRAL_TRAIT_ICONS[t]}
                        ${translateText(`ww1936.admiral_trait.${t}`)}:
                        ${translateText(`ww1936.admiral_trait_desc.${t}`)}
                      </div>`,
                  )}
                </li>`,
            )}
          </ul>`}
    `;
  }
}
