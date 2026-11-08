import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, render, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { drawerInsets } from "../domestic/DomesticPanel";
import { dealUiOf } from "./DealUi";
import { DEAL_UI_KEYS } from "./DiploKeys";
import {
  clampMonths,
  dealComposer,
  diploCardModel,
  type DiploCardView,
  newDealForm,
} from "./DiploModel";
import { linePeaceBand, linePeaceUiOf } from "./LinePeaceModel";
import { negPeaceBand, negPeaceUiOf } from "./NegPeaceModel";
import type { WhitePeaceCardView } from "./WhitePeaceModel";
import {
  TWO_TAP_MS,
  TwoTap,
  WW_BAND_PX,
  type WwPaceGame,
  wwSeconds,
  wwWindowTicks,
} from "./WorldWarModel";
import { dealComposerTemplate } from "./WwDealComposer";
import { EVENT_LAYER_CLASS } from "./WwEventCards";
import { lineSummaryTemplate } from "./WwLinePeacePreview";

/** A card's width: the event cards'. */
const CARD_WIDTH = "w-[min(46vw,380px)]";
/** Space kept below the band, in CSS px. */
const TOP_GAP = 8;
/** Below this width the composer is a bottom sheet (design §7: 390 px phones). */
const SHEET_MAX_WIDTH = 640;
/** The height a waiting card keeps above the sheet, in CSS px: the sheet yields to it. */
const CARD_OVER_SHEET_PX = 160;
/**
 * An answer goes on the next tick and the card goes; a card still there
 * this long after (2 s, in 100 ms ticks: wwWindowTicks) was refused, and
 * may be answered again.
 */
export const ANSWER_WAIT_TICKS = 20;

/**
 * World War 1936: the white peace card of a human target (owner-approved
 * plan §3). Where the event cards sit, on their layer over the full-screen
 * panels: who offers, the war, whether the whole war ends or the proposer
 * alone leaves it, each side's surrender line and war score, who holds
 * how much of whose land, a time bar (30 s; at the end it is refused) and
 * [Accept] [Refuse]. The first tap arms a button ("tap again to confirm",
 * 3 s), the second sends ww_order {peace_reply}. Peace on the current
 * line: the card also shows what changes hands each way and [Show on the
 * map] (the regions in their new owner's colour; the band's [Done] or
 * Back ends it).
 */
@customElement("ww-white-peace-card")
export class WwWhitePeaceCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  private readonly twoTap = new TwoTap();
  /** The answer sent for this card (by offer id) and the tick it went. */
  private sent: { id: number; accept: boolean; tick: number } | null = null;
  private layer: HTMLDivElement | null = null;
  /** Negotiated peace: the region pick mode's band (bottom centre). */
  private mapLayer: HTMLDivElement | null = null;
  private mapTemplate: TemplateResult | null = null;
  /** Diplomacy (ww162 L6): the deal / ultimatum / collaboration composer. */
  private dealLayer: HTMLDivElement | null = null;
  private dealTemplate: TemplateResult | null = null;
  private unregisterDealBack: (() => void) | null = null;
  private unregisterBack: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cardTemplate: TemplateResult | null = null;
  private drawn: readonly unknown[] = [];

  createRenderRoot() {
    return this;
  }

  /** The card layer while connected (tests and layout read it). */
  cardLayer(): HTMLElement | null {
    return this.layer;
  }

  connectedCallback() {
    super.connectedCallback();
    const layer = document.createElement("div");
    layer.setAttribute("data-ww-wpeace-layer", "");
    layer.className = `${EVENT_LAYER_CLASS} text-white select-none`;
    layer.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(layer);
    this.layer = layer;
    const map = document.createElement("div");
    map.setAttribute("data-ww-npeace-map-layer", "");
    map.className = `${EVENT_LAYER_CLASS} text-white select-none`;
    map.style.inset = "0";
    document.body.appendChild(map);
    this.mapLayer = map;
    const deal = document.createElement("div");
    deal.setAttribute("data-ww-deal-layer", "");
    deal.className = "fixed z-[1003] text-white select-none";
    deal.style.display = "none";
    deal.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(deal);
    this.dealLayer = deal;
    window.addEventListener("resize", this.place);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.place());
      this.resizeObserver.observe(layer);
      this.resizeObserver.observe(deal);
      if (this.parentElement !== null) {
        this.resizeObserver.observe(this.parentElement);
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.place);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.layer !== null) {
      render(nothing, this.layer);
      this.layer.remove();
      this.layer = null;
    }
    if (this.mapLayer !== null) {
      render(nothing, this.mapLayer);
      this.mapLayer.remove();
      this.mapLayer = null;
    }
    if (this.dealLayer !== null) {
      render(nothing, this.dealLayer);
      this.dealLayer.remove();
      this.dealLayer = null;
    }
    this.unregisterBack?.();
    this.unregisterBack = null;
    this.unregisterDealBack?.();
    this.unregisterDealBack = null;
  }

  init() {}

  getTickIntervalMs() {
    return 250;
  }

  /**
   * While the game is paused too: the diplomacy rows open the composer and
   * its taps redraw it (they read only the views and the UI state).
   */
  idleTick() {
    this.tick();
  }

  tick() {
    const card = this.cardView();
    const now = this.game?.ticks() ?? 0;
    const pace: WwPaceGame = this.game ?? {};
    const sent = this.sent;
    if (
      sent !== null &&
      (card === null ||
        card.id !== sent.id ||
        now - sent.tick >= wwWindowTicks(pace, ANSWER_WAIT_TICKS))
    ) {
      this.sent = null;
    }
    // Negotiated peace: Back leaves the pick mode first (and the line's map).
    const ui = this.game ? negPeaceUiOf(this.game) : null;
    const lui = this.game ? linePeaceUiOf(this.game) : null;
    // A card's line map ends with its offer.
    if (
      lui?.map === true &&
      lui.offer > 0 &&
      !(this.game.wwEndgame?.()?.peaceOffers ?? []).some(
        (o) => o.id === lui.offer,
      )
    ) {
      lui.closeMap();
    }
    // Diplomacy: Back closes the composer.
    const deal = this.game ? dealUiOf(this.game) : null;
    if (deal?.map === true && this.unregisterDealBack === null) {
      this.unregisterDealBack = registerBackClosable(() => {
        if (deal.mode === null) return false;
        deal.close();
        this.requestUpdate();
        return true;
      });
    } else if (deal?.map !== true && this.unregisterDealBack !== null) {
      this.unregisterDealBack();
      this.unregisterDealBack = null;
    }
    const mapOn = ui?.map === true || lui?.map === true;
    if (mapOn && this.unregisterBack === null) {
      this.unregisterBack = registerBackClosable(() => {
        if (ui?.map === true) {
          ui.closeMap();
        } else if (lui?.map === true) {
          lui.closeMap();
        } else {
          return false;
        }
        this.requestUpdate();
        return true;
      });
    } else if (!mapOn && this.unregisterBack !== null) {
      this.unregisterBack();
      this.unregisterBack = null;
    }
    const key = [
      card?.id ?? -1,
      card?.kind === "peace" ? card.peace.held.join("|") : "",
      card?.more ?? 0,
      wwSeconds(pace, now),
      this.sent?.id ?? 0,
      ui?.map === true ? ui.version : -1,
      card?.kind === "peace" ? (card.peace.line?.totals ?? "") : "",
      lui?.version ?? -1,
      deal?.version ?? -1,
      // The composer's facts: my politics (PP, treaties) and the endgame lists.
      deal?.map === true ? (this.game.wwPolitics?.()?.version ?? 0) : 0,
      deal?.map === true ? (this.game.wwEndgame?.()?.deals ?? null) : null,
    ];
    if (key.some((v, n) => v !== this.drawn[n])) {
      this.drawn = key;
      this.requestUpdate();
    }
  }

  private cardView(): DiploCardView | null {
    return this.game ? diploCardModel(this.game) : null;
  }

  protected updated(): void {
    if (this.mapLayer !== null) {
      render(this.mapTemplate ?? nothing, this.mapLayer);
    }
    if (this.dealLayer !== null) {
      render(this.dealTemplate ?? nothing, this.dealLayer);
      this.placeDeal();
    }
    if (this.layer === null) return;
    render(this.cardTemplate ?? nothing, this.layer);
    this.place();
  }

  /** Sizes the slot in the HUD column to the card and lays the layer over it. */
  readonly place = () => {
    this.placeDeal();
    const layer = this.layer;
    if (layer === null) return;
    const slot = this.querySelector<HTMLElement>("[data-ww-wpeace-slot]");
    const card = layer.querySelector<HTMLElement>("[data-ww-wpeace]");
    if (slot === null || card === null) return;
    const room = (bottom: number) =>
      Math.max(96, Math.floor(bottom - WW_BAND_PX - TOP_GAP));
    card.style.maxHeight = `${room(slot.getBoundingClientRect().bottom)}px`;
    const height = `${Math.round(card.getBoundingClientRect().height)}px`;
    if (slot.style.height !== height) slot.style.height = height;
    const r = slot.getBoundingClientRect();
    // On a phone the composer sheet would cover the card's slot: a card that
    // waits for my answer stands above the sheet instead (the sheet yields
    // CARD_OVER_SHEET_PX for it: placeDeal).
    const sheet = this.sheetTop();
    const bottom =
      sheet === null ? r.bottom : Math.min(r.bottom, sheet - TOP_GAP);
    card.style.maxHeight = `${room(bottom)}px`;
    layer.style.left = `${Math.round(r.left)}px`;
    layer.style.bottom = `${Math.round(window.innerHeight - bottom)}px`;
  };

  /** The composer sheet's top edge while it is open on a phone (null: no sheet). */
  private sheetTop(): number | null {
    const deal = this.dealLayer;
    if (deal === null || deal.dataset.wwDealPlace !== "sheet") return null;
    if (deal.style.display === "none") return null;
    return deal.getBoundingClientRect().top;
  }

  /**
   * The composer's place (design §7): on a phone a bottom sheet, full width,
   * at most 55% of the height, above the dock, so the map above stays
   * tappable; on a desktop the diplomacy drawer's spot, right of the
   * map's centre, at most 420 px wide.
   */
  private placeDeal(): void {
    const layer = this.dealLayer;
    if (layer === null) return;
    if (this.dealTemplate === null) {
      layer.style.display = "none";
      delete layer.dataset.wwDealPlace;
      return;
    }
    layer.style.display = "flex";
    layer.style.flexDirection = "column";
    if (window.innerWidth < SHEET_MAX_WIDTH) {
      layer.style.left = "0";
      layer.style.right = "0";
      layer.style.top = "";
      layer.style.width = "";
      layer.style.bottom =
        "calc(var(--ww-dock-h, 0px) + env(safe-area-inset-bottom))";
      // A card waiting for my answer keeps its room above the sheet.
      layer.style.maxHeight =
        this.cardTemplate === null
          ? "55vh"
          : `min(55vh, calc(100vh - var(--ww-dock-h, 0px) - env(safe-area-inset-bottom) - ${
              WW_BAND_PX + 2 * TOP_GAP + CARD_OVER_SHEET_PX
            }px))`;
      layer.dataset.wwDealPlace = "sheet";
    } else {
      const i = drawerInsets();
      layer.style.left = "";
      layer.style.right = `${i.right}px`;
      layer.style.top = `${Math.max(i.top, WW_BAND_PX + TOP_GAP)}px`;
      layer.style.bottom = "";
      layer.style.width = "min(420px, calc(100vw - 16px))";
      layer.style.maxHeight = `${Math.max(
        200,
        window.innerHeight - Math.max(i.top, WW_BAND_PX + TOP_GAP) - i.bottom,
      )}px`;
      layer.dataset.wwDealPlace = "side";
    }
  }

  /** The open composer (null: none). */
  private dealComposerTemplate(): TemplateResult | null {
    if (!this.game) return null;
    const v = dealComposer(this.game);
    if (v === null) return null;
    const ui = dealUiOf(this.game);
    const redraw = () => this.requestUpdate();
    const key = `deal:${v.mode}:${v.to}`;
    const sheet = window.innerWidth < SHEET_MAX_WIDTH;
    // On a phone the sheet lies over the army drawer: opaque, or the drawer
    // shows through it (ww164).
    return html`<div
      class="pointer-events-auto flex min-h-0 w-full flex-1 flex-col border border-emerald-300/80 px-2 py-1.5 shadow-xl ${sheet
        ? "rounded-t-lg bg-gray-900"
        : "rounded-lg bg-gray-900/95"}"
    >
      ${dealComposerTemplate(v, {
        armed: this.twoTap.isArmed(key, Date.now()),
        remove: (side, index) => {
          ui.removeAt(side, index);
          redraw();
        },
        removeRegion: (r) => {
          ui.removeRegion(r);
          redraw();
        },
        toggleAdding: (side) => {
          ui.toggleAdding(side);
          redraw();
        },
        pickKind: (side, kind) => {
          if (kind === "region") {
            // Regions come from the map: the list closes, the hint says so.
            ui.toggleAdding(side);
          } else if (
            kind === "access" ||
            kind === "nap" ||
            kind === "guarantee"
          ) {
            ui.add(side, { kind });
          } else {
            ui.setForm(newDealForm(side, kind));
          }
          redraw();
        },
        choose: (value) => {
          const f = ui.form;
          if (f === null) return;
          if (f.kind === "promise") {
            ui.setForm({ ...f, target: Number(value), group: "" });
          } else if (f.kind === "join_war") {
            const [war, target] = value.split(":").map(Number);
            ui.setForm({ ...f, war, target });
          } else {
            ui.setForm({ ...f, item: value, gen: 1 });
          }
          redraw();
        },
        gen: (g) => {
          if (ui.form !== null) ui.setForm({ ...ui.form, gen: g });
          redraw();
        },
        group: (g) => {
          if (ui.form !== null) ui.setForm({ ...ui.form, group: g });
          redraw();
        },
        count: (n) => {
          if (ui.form !== null) ui.setForm({ ...ui.form, count: n });
          redraw();
        },
        months: (n) => {
          if (ui.form !== null) {
            ui.setForm({ ...ui.form, months: clampMonths(n) });
          }
          redraw();
        },
        addForm: () => {
          const item = v.form?.item ?? null;
          if (item !== null && ui.form !== null) ui.add(ui.form.side, item);
          redraw();
        },
        cancelForm: () => {
          ui.setForm(null);
          redraw();
        },
        send: () => {
          const order = v.order;
          if (order === null || v.block !== null) return;
          if (this.twoTap.tap(key, Date.now())) {
            this.eventBus.emit(new SendWwOrderIntentEvent(order));
            ui.close();
          } else {
            setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
          }
          redraw();
        },
        close: () => {
          ui.close();
          redraw();
        },
      })}
    </div>`;
  }

  /** Negotiated peace: the pick mode's band above the bottom HUD — what is picked, the last tap, [Done]. */
  private bandTemplate(): TemplateResult | null {
    if (!this.game) return null;
    const b = negPeaceBand(this.game);
    if (b === null) return this.lineBandTemplate();
    const rows = document.querySelector("[data-bottom-hud-rows]");
    const top = rows?.getBoundingClientRect().top ?? window.innerHeight;
    const bottom = Math.round(
      window.innerHeight - Math.min(top, window.innerHeight) + 6,
    );
    return html`<div
      data-ww-npeace-band
      class="pointer-events-auto absolute left-1/2 flex w-[min(92vw,440px)] -translate-x-1/2 flex-col gap-1 rounded-lg border border-emerald-300/80 bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
      style="bottom: ${bottom}px"
    >
      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1">🕊 ${b.line}</span>
        <button
          type="button"
          data-ww-act="npeace_done"
          class="min-h-9 shrink-0 rounded-md border border-emerald-400/60 bg-emerald-900/40 px-3 font-semibold hover:bg-emerald-800/60"
          @click=${() => {
            negPeaceUiOf(this.game).closeMap();
            this.requestUpdate();
          }}
        >
          ${translateText("ww1936.npeace.done")}
        </button>
      </div>
      ${b.region === ""
        ? nothing
        : html`<span class="text-white/70">${b.region}</span>`}
      ${b.note === null
        ? nothing
        : html`<span data-ww-npeace-note class="text-red-300">${b.note}</span>`}
    </div>`;
  }

  /** Peace on the current line: its map's band — what the colours mean, the tapped region, [Done]. */
  private lineBandTemplate(): TemplateResult | null {
    const b = linePeaceBand(this.game);
    if (b === null) return null;
    const rows = document.querySelector("[data-bottom-hud-rows]");
    const top = rows?.getBoundingClientRect().top ?? window.innerHeight;
    const bottom = Math.round(
      window.innerHeight - Math.min(top, window.innerHeight) + 6,
    );
    return html`<div
      data-ww-lpeace-band
      class="pointer-events-auto absolute left-1/2 flex w-[min(92vw,440px)] -translate-x-1/2 flex-col gap-1 rounded-lg border border-sky-300/80 bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
      style="bottom: ${bottom}px"
    >
      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1">🗺 ${b.line}</span>
        <button
          type="button"
          data-ww-act="lpeace_done"
          class="min-h-9 shrink-0 rounded-md border border-sky-400/60 bg-sky-900/40 px-3 font-semibold hover:bg-sky-800/60"
          @click=${() => {
            linePeaceUiOf(this.game).closeMap();
            this.requestUpdate();
          }}
        >
          ${translateText("ww1936.npeace.done")}
        </button>
      </div>
      ${b.region === ""
        ? nothing
        : html`<span data-ww-lpeace-region class="text-white/70"
            >${b.region}</span
          >`}
    </div>`;
  }

  private answer(card: DiploCardView, accept: boolean, counter = false) {
    if (this.sent !== null) return;
    const tapKey = `${card.id}:${counter ? "counter" : accept}`;
    if (!this.twoTap.tap(tapKey, Date.now())) {
      this.requestUpdate();
      setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
      return;
    }
    this.sent = { id: card.id, accept, tick: this.game?.ticks() ?? 0 };
    this.eventBus.emit(
      new SendWwOrderIntentEvent(
        card.kind === "peace"
          ? { kind: "peace_reply", offer: card.id, accept }
          : { kind: "deal_reply", offer: card.id, accept },
      ),
    );
    // A counter-offer refuses this one and opens the composer with both
    // columns swapped (one pending deal a pair: theirs must go first).
    if (counter && card.kind === "deal") {
      dealUiOf(this.game).open("deal", card.from, card.counter);
    }
    this.requestUpdate();
  }

  private button(
    c: DiploCardView,
    accept: boolean,
    label = accept ? "ww1936.wpeace.accept" : "ww1936.wpeace.refuse",
    counter = false,
  ) {
    const armed =
      this.sent === null &&
      this.twoTap.isArmed(
        `${c.id}:${counter ? "counter" : accept}`,
        Date.now(),
      );
    return html`<button
      type="button"
      data-ww-wpeace-answer=${counter
        ? "counter"
        : accept
          ? "accept"
          : "refuse"}
      data-armed=${String(armed)}
      class="min-h-9 flex-1 rounded-md border px-2 text-xs font-semibold ${armed
        ? "border-amber-300 bg-amber-900/60"
        : accept
          ? "border-emerald-400/60 bg-emerald-900/40 hover:bg-emerald-800/60"
          : "border-white/20 bg-gray-800 hover:bg-gray-700"} disabled:opacity-40"
      ?disabled=${this.sent !== null}
      @click=${() => this.answer(c, accept, counter)}
    >
      ${armed ? translateText("ww1936.pol.tap_again") : translateText(label)}
    </button>`;
  }

  /** The time bar and "if time runs out" line every card shows. */
  private timeTemplate(
    c: { secondsLeft: number; fraction: number },
    defaultKey: string,
  ) {
    return html`<div class="h-1 shrink-0 rounded bg-white/10">
        <div
          data-ww-wpeace-time
          class="h-1 rounded ${c.secondsLeft <= 5
            ? "bg-red-500"
            : "bg-emerald-400"}"
          style="width: ${Math.round(c.fraction * 100)}%"
        ></div>
      </div>
      <div class="flex justify-between gap-2 text-white/60">
        <span class="min-w-0 truncate">${translateText(defaultKey)}</span>
        <span class="shrink-0 tabular-nums"
          >${translateText("ww1936.takeover.time", { s: c.secondsLeft })}</span
        >
      </div>`;
  }

  /** The card's foot: sent, and how many wait behind it. */
  private footTemplate(more: number) {
    return html`${this.sent === null
      ? nothing
      : html`<span data-ww-wpeace-sent class="text-emerald-300"
          >${translateText("ww1936.eventui.sent")}</span
        >`}
    ${more > 0
      ? html`<span class="text-white/60"
          >${translateText("ww1936.eventui.more", { n: more })}</span
        >`
      : nothing}`;
  }

  /** A deal (D3, D4) or an ultimatum (D5) made to me: what it asks, the time, the answers. */
  private diploCardTemplate(c: Exclude<DiploCardView, { kind: "peace" }>) {
    const items = (head: string, lines: readonly string[], attr: string) =>
      lines.length === 0
        ? nothing
        : html`<div data-ww-deal-card-col=${attr} class="flex flex-col">
            <span class="font-semibold text-amber-200">${head}</span>
            <ul class="m-0 list-none p-0 text-white/90">
              ${lines.map((l) => html`<li>· ${l}</li>`)}
            </ul>
          </div>`;
    return html`<div
      data-ww-wpeace=${c.id}
      data-ww-deal-card=${c.kind}
      class="${CARD_WIDTH} pointer-events-auto flex flex-col gap-1 overflow-y-auto rounded-lg border ${c.kind ===
      "ultimatum"
        ? "border-red-300/80"
        : "border-emerald-300/80"} bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
    >
      <span class="font-bold leading-tight"
        >${c.kind === "ultimatum" ? "⚠" : "🤝"} ${c.title}</span
      >
      ${this.timeTemplate(c, DEAL_UI_KEYS.default)}
      ${c.kind === "deal"
        ? html`${items(c.givesHead, c.gives, "gives")}
          ${items(c.wantsHead, c.wants, "wants")}`
        : html`<span data-ww-deal-card-regions class="text-white/90"
              >${c.regions}</span
            >
            <span class="text-amber-200">${c.hint}</span>`}
      <div class="flex gap-1">
        ${c.kind === "deal"
          ? html`${this.button(c, true, DEAL_UI_KEYS.accept)}
            ${this.button(c, false, DEAL_UI_KEYS.refuse)}
            ${this.button(c, false, DEAL_UI_KEYS.counter, true)}`
          : html`${this.button(c, true, DEAL_UI_KEYS.ultGive)}
            ${this.button(c, false, DEAL_UI_KEYS.refuse)}`}
      </div>
      ${this.footTemplate(c.more)}
    </div>`;
  }

  render() {
    this.cardTemplate = null;
    this.mapTemplate = this.bandTemplate();
    this.dealTemplate = this.dealComposerTemplate();
    const card = this.cardView();
    if (card === null) return nothing;
    if (card.kind !== "peace") {
      this.cardTemplate = this.diploCardTemplate(card);
      return html`<div
        data-ww-wpeace-slot
        class="${CARD_WIDTH} shrink-0 pointer-events-none"
      ></div>`;
    }
    const c: WhitePeaceCardView = card.peace;
    this.cardTemplate = html`<div
      data-ww-wpeace=${c.id}
      class="${CARD_WIDTH} pointer-events-auto flex flex-col gap-1 overflow-y-auto rounded-lg border border-emerald-300/80 bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
    >
      <span class="font-bold leading-tight">🕊 ${c.title}</span>
      <span class="text-white/70">${c.war}</span>
      <span data-ww-wpeace-scope class="text-amber-200">${c.scope}</span>
      ${this.timeTemplate(c, "ww1936.wpeace.default")}
      <ul data-ww-wpeace-sides class="m-0 flex list-none flex-col gap-0.5 p-0">
        ${c.sides.map(
          (s) =>
            html`<li class="flex min-w-0 items-center gap-1">
              <img
                src=${s.flagUrl}
                alt=""
                class="h-3 w-4 shrink-0 rounded-sm object-cover"
              />
              <span class="min-w-0 truncate">${s.line}</span>
            </li>`,
        )}
      </ul>
      ${c.held.length === 0
        ? nothing
        : html`<ul data-ww-wpeace-held class="m-0 list-none p-0 text-white/70">
            ${c.held.map((l) => html`<li>${l}</li>`)}
          </ul>`}
      ${c.line === null
        ? nothing
        : html`<div
            data-ww-wpeace-line
            class="flex flex-col gap-1 rounded border border-sky-300/40 bg-sky-950/30 p-1"
          >
            ${lineSummaryTemplate(c.line)}
            <button
              type="button"
              data-ww-act="lpeace_card_map"
              class="min-h-8 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10"
              @click=${() => {
                linePeaceUiOf(this.game).openMap(c.id);
                this.requestUpdate();
              }}
            >
              🗺 ${translateText("ww1936.lpeace.map")}
            </button>
          </div>`}
      ${c.terms.length === 0
        ? nothing
        : html`<ul
            data-ww-wpeace-terms
            class="m-0 list-none rounded border border-amber-300/40 bg-amber-950/30 p-1 text-amber-100"
          >
            ${c.terms.map((l) => html`<li>${l}</li>`)}
          </ul>`}
      <div class="flex gap-1">
        ${this.button(card, true)} ${this.button(card, false)}
      </div>
      ${this.footTemplate(c.more)}
    </div>`;
    return html`<div
      data-ww-wpeace-slot
      class="${CARD_WIDTH} shrink-0 pointer-events-none"
    ></div>`;
  }
}
