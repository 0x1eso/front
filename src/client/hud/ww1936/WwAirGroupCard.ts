// World War 1936 w51 (air groups, design ww50 Part 2): the group card, in the
// wing card's place, and the small chooser that asks "army or group?" when an
// army token and a group token lie one on the other. A tap on a group token
// chooses it; each map tap on a zone adds or removes it (WwWingController);
// everything here is a button of 40 px.
import {
  AIR_TYPES,
  AirGroupView,
  WW_BOMB_CLASSES,
  WW_GROUP_MAX_ZONES,
} from "@openfront/engine-api/ww1936/AirTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  airTypeLabel,
  disbandOrder,
  flyingPlanes,
  groupById,
  groupName,
  GroupPatch,
  groupPlanes,
  groupStatus,
  groupStrengthPm,
  groupWanted,
  memberLines,
  reachLine,
  shownGroup,
  statusText,
  togglePriority,
  zoneRowsOf,
} from "./AirGroupModel";
import { armyName } from "./LandModel";
import { landSelectionOf, WwSelectArmyEvent } from "./LandSelection";
import { navyCtx, NavyCtx, NavyGame } from "./NavyModel";
import { baseName } from "./WingModel";
import { wingUiOf, WwSelectGroupEvent, WwWingChangedEvent } from "./WingUi";
import { isCapitulated, TWO_TAP_MIN_MS } from "./WorldWarModel";
import {
  CARD_MIN_PX,
  CardPlace,
  cardPlace,
  placeStyle,
  samePlace,
} from "./WwArmyCard";
import { WwDrawerEvent } from "./WwDrawer";
import { sendGroupOrder } from "./WwWingController";

const GAP = 8;
const BTN =
  "relative flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-md border px-2 text-xs leading-none";
const IDLE = "border-white/15 bg-white/10 hover:bg-white/20";
const PRESSED = "border-amber-300 bg-amber-700/50";

@customElement("ww-air-group-card")
export class WwAirGroupCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private place: CardPlace = {
    bottom: GAP,
    right: null,
    maxWidth: 560,
    maxHeight: CARD_MIN_PX,
  };
  /** [더보기] open. */
  @state() private more = false;
  private redrawKey: readonly unknown[] = [];
  private disbandAt = 0;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwWingChangedEvent, () => {
      this.refit();
      this.requestUpdate();
    });
    this.eventBus.on(WwDrawerEvent, () => {
      void this.updateComplete.then(() =>
        requestAnimationFrame(() => this.refit()),
      );
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    const ui = wingUiOf(this.game);
    if (ui.airGroup === 0 && ui.chooser === null) return;
    this.refit();
    const key = [
      ui.version,
      this.game.wwAir?.()?.version,
      Math.floor(this.game.ticks() / 3),
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private refit() {
    const next = cardPlace();
    if (!samePlace(next, this.place)) this.place = next;
  }

  private changed() {
    wingUiOf(this.game).bump();
    this.eventBus.emit(new WwWingChangedEvent());
  }

  private ctx(): NavyCtx | null {
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const p = this.game.myPlayer();
    if (p === null || !p.isAlive() || isCapitulated(this.game, p.smallID())) {
      return null;
    }
    return navyCtx(this.game as unknown as NavyGame);
  }

  private patch(g: AirGroupView, p: GroupPatch) {
    sendGroupOrder(this.eventBus, wingUiOf(this.game), g, p, Date.now());
  }

  render() {
    if (this.game === undefined) return nothing;
    const ui = wingUiOf(this.game);
    const ctx = this.ctx();
    if (ctx === null) return nothing;
    if (ui.chooser !== null) return this.renderChooser(ctx);
    if (ui.airGroup === 0) return nothing;
    const raw = groupById(ctx, ui.airGroup);
    if (raw === undefined) return nothing;
    const g = shownGroup(raw, ui.draft, Date.now());
    return html`<section
      data-ww-air-group-card=${g.id}
      aria-label=${groupName(g)}
      class="fixed z-[1001] flex flex-col gap-1 overflow-y-auto rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${this.renderHead(ctx, g)} ${this.renderZones(ctx, g)}
      ${this.renderTypes(g)} ${this.renderButtons(g)}
      ${this.more ? this.renderMore(g) : nothing}
    </section>`;
  }

  private renderChooser(ctx: NavyCtx): TemplateResult {
    const ui = wingUiOf(this.game);
    const c = ui.chooser!;
    const g = groupById(ctx, c.group);
    return html`<section
      data-ww-air-chooser
      class="fixed z-[1002] flex items-center gap-1.5 rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
    >
      <span class="shrink-0">${translateText("ww1936.airgroup.which")}</span>
      <button
        type="button"
        data-ww-choose="army"
        class="${BTN} ${IDLE} min-w-0 flex-1"
        @click=${() => {
          ui.chooser = null;
          this.eventBus.emit(new WwSelectArmyEvent(c.army));
          this.changed();
        }}
      >
        <span class="truncate"
          >⚔
          ${translateText("ww1936.airgroup.pick_army", {
            army: armyName(c.army),
          })}</span
        >
      </button>
      <button
        type="button"
        data-ww-choose="group"
        class="${BTN} ${IDLE} min-w-0 flex-1"
        @click=${() => {
          ui.chooser = null;
          if (landSelectionOf(this.game).army !== null) {
            this.eventBus.emit(new WwSelectArmyEvent(null));
          }
          this.eventBus.emit(new WwSelectGroupEvent(c.group));
        }}
      >
        <span class="truncate">✈ ${g === undefined ? "" : groupName(g)}</span>
      </button>
    </section>`;
  }

  private renderHead(ctx: NavyCtx, g: AirGroupView): TemplateResult {
    const pm = groupStrengthPm(g);
    const full = groupWanted(g);
    const status = groupStatus(g, this.game.ticks());
    return html`<div class="flex shrink-0 items-center gap-1.5">
      <span aria-hidden="true">✈</span>
      <span data-ww-group-name class="min-w-0 shrink truncate text-sm font-bold"
        >${groupName(g)}</span
      >
      <span data-ww-group-planes class="shrink-0 tabular-nums text-white/80"
        >${groupPlanes(g)}${full > 0 ? `/${full}` : ""}</span
      >
      <span class="h-1.5 w-10 shrink-0 rounded bg-white/10"
        ><span
          class="block h-1.5 rounded ${pm >= 600
            ? "bg-emerald-400"
            : pm >= 300
              ? "bg-amber-400"
              : "bg-red-500"}"
          style="width: ${Math.min(100, pm / 10)}%"
        ></span
      ></span>
      <span
        data-ww-group-status=${status.status}
        class="min-w-0 flex-1 truncate text-white/80"
        >${statusText(status)} ·
        ${translateText("ww1936.airgroup.base_line", {
          base: baseName(ctx, g.base),
        })}</span
      >
      <button
        type="button"
        data-ww-card-close
        class="${BTN} ${IDLE} w-10"
        aria-label=${translateText("common.close")}
        @click=${() => {
          wingUiOf(this.game).clear();
          this.changed();
        }}
      >
        ✕
      </button>
    </div>`;
  }

  /** The zones in order: their numbers, the priority mark, how to add more. */
  private renderZones(ctx: NavyCtx, g: AirGroupView): TemplateResult {
    const ui = wingUiOf(this.game);
    const rows = zoneRowsOf(ctx, g);
    const hint =
      g.army !== 0
        ? translateText("ww1936.airgroup.following", { army: armyName(g.army) })
        : rows.length === 0
          ? translateText("ww1936.airgroup.hint_tap_zones", {
              n: WW_GROUP_MAX_ZONES,
            })
          : "";
    return html`<div data-ww-group-zones class="flex shrink-0 flex-col gap-0.5">
      ${hint === ""
        ? nothing
        : html`<div class="text-white/70" data-ww-group-hint>${hint}</div>`}
      ${rows.map(
        (r) =>
          html`<div
            data-ww-group-zone=${r.sr}
            class="flex items-center gap-1.5 rounded border border-white/10 bg-white/5 pl-1.5"
          >
            <span class="shrink-0 text-amber-200">${r.mark}</span>
            <span class="min-w-0 flex-1 truncate">
              <span class="font-semibold">${r.name}</span>
              <span class="tabular-nums text-white/70">
                ·
                ${translateText("ww1936.airgroup.zone_planes", { n: r.planes })}
              </span>
              <span
                class="tabular-nums ${r.supPct < r.enemyPct
                  ? "text-red-300"
                  : "text-emerald-300"}"
              >
                ·
                ${translateText("ww1936.airgroup.zone_sup", {
                  mine: r.supPct,
                  enemy: r.enemyPct,
                })}
              </span>
              ${reachLine(r) === ""
                ? nothing
                : html`<span data-ww-group-reach class="text-amber-300"
                    >· ${reachLine(r)}</span
                  >`}
            </span>
            <button
              type="button"
              data-ww-group-priority=${r.sr}
              aria-pressed=${String(r.priority)}
              aria-label=${translateText("ww1936.airgroup.priority")}
              class="${BTN} ${r.priority ? PRESSED : IDLE} w-10"
              @click=${() =>
                this.patch(g, { priority: togglePriority(g, r.sr) })}
            >
              ★
            </button>
          </div>`,
      )}
      ${ui.groupRefused === ""
        ? nothing
        : html`<div data-ww-group-refused class="text-red-300">
            ${translateText(`ww1936.airgroup.refused_${ui.groupRefused}`)}
          </div>`}
    </div>`;
  }

  /** One line per type: planes, state, yesterday's kills and losses; the types' range. */
  private renderTypes(g: AirGroupView): TemplateResult {
    return html`<ul
      data-ww-group-types
      class="m-0 flex list-none flex-col gap-0.5 p-0 tabular-nums"
    >
      ${memberLines(g).map(
        (m) =>
          html`<li
            data-ww-group-type=${AIR_TYPES[m.type]}
            class="flex flex-wrap gap-x-2 text-white/85"
          >
            <span class="font-semibold">${airTypeLabel(m.type)}</span>
            <span>${m.planes}/${m.full}</span>
            <span class="text-white/70">${translateText(m.state)}</span>
            <span class="text-white/60"
              >${translateText("ww1936.airgroup.yesterday", {
                kills: m.kills,
                lost: m.lost,
              })}</span
            >
            <span class="text-white/50"
              >${translateText("ww1936.airgroup.range_km", {
                km: g.rangeKm[m.type] ?? 0,
              })}</span
            >
          </li>`,
      )}
    </ul>`;
  }

  private renderButtons(g: AirGroupView): TemplateResult {
    const ui = wingUiOf(this.game);
    return html`<div class="flex shrink-0 flex-wrap items-center gap-1">
      <button
        type="button"
        data-ww-group-stop
        class="${BTN} ${IDLE}"
        @click=${() => {
          sendGroupOrder(this.eventBus, ui, g, {
            zones: [],
            priority: 0,
            army: 0,
            auto: false,
          });
        }}
      >
        ■ ${translateText("ww1936.airgroup.stop")}
      </button>
      <button
        type="button"
        data-ww-group-more
        aria-pressed=${String(this.more)}
        class="${BTN} ${this.more ? PRESSED : IDLE}"
        @click=${() => {
          this.more = !this.more;
        }}
      >
        ${translateText("ww1936.airgroup.more")}
      </button>
      <span class="text-white/60"
        >${flyingPlanes(g) > 0
          ? translateText("ww1936.airgroup.flying", { n: flyingPlanes(g) })
          : ""}</span
      >
    </div>`;
  }

  private renderMore(g: AirGroupView): TemplateResult {
    const ui = wingUiOf(this.game);
    const send = (p: GroupPatch) =>
      sendGroupOrder(this.eventBus, ui, g, p, Date.now());
    return html`<div
      data-ww-group-moreblock
      class="flex shrink-0 flex-col gap-1"
    >
      <div class="flex flex-wrap gap-1">
        ${WW_BOMB_CLASSES.filter((c) => c !== "port").map((c) => {
          const i = WW_BOMB_CLASSES.indexOf(c);
          return html`<button
            type="button"
            data-ww-group-cls=${c}
            aria-pressed=${String(g.cls === i)}
            class="${BTN} ${g.cls === i ? PRESSED : IDLE}"
            @click=${() => send({ cls: i })}
          >
            ${translateText(`ww1936.bomb.class_${c}`)}
          </button>`;
        })}
      </div>
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          data-ww-group-target
          aria-pressed=${String(ui.pickTarget)}
          class="${BTN} ${ui.pickTarget ? PRESSED : IDLE}"
          @click=${() => {
            ui.pickTarget = !ui.pickTarget;
            this.changed();
          }}
        >
          ${ui.pickTarget
            ? translateText("ww1936.airgroup.target_pick")
            : g.target !== 0
              ? translateText("ww1936.airgroup.target_set")
              : translateText("ww1936.airgroup.target")}
        </button>
        ${g.target !== 0
          ? html`<button
              type="button"
              data-ww-group-target-clear
              class="${BTN} ${IDLE}"
              @click=${() => send({ target: 0 })}
            >
              ${translateText("ww1936.airgroup.target_clear")}
            </button>`
          : nothing}
        <button
          type="button"
          data-ww-group-night
          aria-pressed=${String(g.night)}
          class="${BTN} ${g.night ? PRESSED : IDLE}"
          @click=${() => send({ night: !g.night })}
        >
          🌙 ${translateText("ww1936.airgroup.night")}
        </button>
        <button
          type="button"
          data-ww-group-auto
          aria-pressed=${String(g.auto)}
          class="${BTN} ${g.auto ? PRESSED : IDLE}"
          @click=${() => send({ auto: !g.auto })}
        >
          ${translateText("ww1936.airgroup.auto")}
        </button>
        <button
          type="button"
          data-ww-group-disband
          class="${BTN} ${ui.disbandAsk
            ? "border-red-400 bg-red-800/60"
            : IDLE}"
          @click=${() => this.disband(g)}
        >
          ${ui.disbandAsk
            ? translateText("ww1936.airgroup.disband_confirm")
            : translateText("ww1936.airgroup.disband")}
        </button>
      </div>
    </div>`;
  }

  private disband(g: AirGroupView) {
    const ui = wingUiOf(this.game);
    if (!ui.disbandAsk) {
      ui.disbandAsk = true;
      this.disbandAt = Date.now();
      this.changed();
      return;
    }
    if (Date.now() - this.disbandAt < TWO_TAP_MIN_MS) return;
    this.eventBus.emit(new SendWwOrderIntentEvent(disbandOrder(g)));
    ui.clear();
    this.changed();
  }
}
