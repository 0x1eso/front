import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, render, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  whitePeaceCardModel,
  type WhitePeaceCardView,
} from "./WhitePeaceModel";
import {
  TWO_TAP_MS,
  TwoTap,
  WW_BAND_PX,
  type WwPaceGame,
  wwSeconds,
  wwWindowTicks,
} from "./WorldWarModel";
import { EVENT_LAYER_CLASS } from "./WwEventCards";

/** A card's width: the event cards'. */
const CARD_WIDTH = "w-[min(46vw,380px)]";
/** Space kept below the band, in CSS px. */
const TOP_GAP = 8;
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
 * 3 s), the second sends ww_order {peace_reply}.
 */
@customElement("ww-white-peace-card")
export class WwWhitePeaceCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  private readonly twoTap = new TwoTap();
  /** The answer sent for this card (by offer id) and the tick it went. */
  private sent: { id: number; accept: boolean; tick: number } | null = null;
  private layer: HTMLDivElement | null = null;
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
    window.addEventListener("resize", this.place);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.place());
      this.resizeObserver.observe(layer);
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
  }

  init() {}

  getTickIntervalMs() {
    return 250;
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
    const key = [
      card?.id ?? -1,
      card?.held.join("|") ?? "",
      card?.more ?? 0,
      wwSeconds(pace, now),
      this.sent?.id ?? 0,
    ];
    if (key.some((v, n) => v !== this.drawn[n])) {
      this.drawn = key;
      this.requestUpdate();
    }
  }

  private cardView(): WhitePeaceCardView | null {
    return this.game ? whitePeaceCardModel(this.game) : null;
  }

  protected updated(): void {
    if (this.layer === null) return;
    render(this.cardTemplate ?? nothing, this.layer);
    this.place();
  }

  /** Sizes the slot in the HUD column to the card and lays the layer over it. */
  readonly place = () => {
    const layer = this.layer;
    if (layer === null) return;
    const slot = this.querySelector<HTMLElement>("[data-ww-wpeace-slot]");
    const card = layer.querySelector<HTMLElement>("[data-ww-wpeace]");
    if (slot === null || card === null) return;
    const room = (r: DOMRect) =>
      Math.max(96, Math.floor(r.bottom - WW_BAND_PX - TOP_GAP));
    card.style.maxHeight = `${room(slot.getBoundingClientRect())}px`;
    const height = `${Math.round(card.getBoundingClientRect().height)}px`;
    if (slot.style.height !== height) slot.style.height = height;
    const r = slot.getBoundingClientRect();
    card.style.maxHeight = `${room(r)}px`;
    layer.style.left = `${Math.round(r.left)}px`;
    layer.style.bottom = `${Math.round(window.innerHeight - r.bottom)}px`;
  };

  private answer(card: WhitePeaceCardView, accept: boolean) {
    if (this.sent !== null) return;
    if (!this.twoTap.tap(`${card.id}:${accept}`, Date.now())) {
      this.requestUpdate();
      setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
      return;
    }
    this.sent = { id: card.id, accept, tick: this.game?.ticks() ?? 0 };
    this.eventBus.emit(
      new SendWwOrderIntentEvent({
        kind: "peace_reply",
        offer: card.id,
        accept,
      }),
    );
    this.requestUpdate();
  }

  private button(c: WhitePeaceCardView, accept: boolean) {
    const armed =
      this.sent === null &&
      this.twoTap.isArmed(`${c.id}:${accept}`, Date.now());
    const label = accept ? "ww1936.wpeace.accept" : "ww1936.wpeace.refuse";
    return html`<button
      type="button"
      data-ww-wpeace-answer=${accept ? "accept" : "refuse"}
      data-armed=${String(armed)}
      class="min-h-9 flex-1 rounded-md border px-2 text-xs font-semibold ${armed
        ? "border-amber-300 bg-amber-900/60"
        : accept
          ? "border-emerald-400/60 bg-emerald-900/40 hover:bg-emerald-800/60"
          : "border-white/20 bg-gray-800 hover:bg-gray-700"} disabled:opacity-40"
      ?disabled=${this.sent !== null}
      @click=${() => this.answer(c, accept)}
    >
      ${armed ? translateText("ww1936.pol.tap_again") : translateText(label)}
    </button>`;
  }

  render() {
    this.cardTemplate = null;
    const c = this.cardView();
    if (c === null) return nothing;
    this.cardTemplate = html`<div
      data-ww-wpeace=${c.id}
      class="${CARD_WIDTH} pointer-events-auto flex flex-col gap-1 overflow-y-auto rounded-lg border border-emerald-300/80 bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
    >
      <span class="font-bold leading-tight">🕊 ${c.title}</span>
      <span class="text-white/70">${c.war}</span>
      <span data-ww-wpeace-scope class="text-amber-200">${c.scope}</span>
      <div class="h-1 shrink-0 rounded bg-white/10">
        <div
          data-ww-wpeace-time
          class="h-1 rounded ${c.secondsLeft <= 5
            ? "bg-red-500"
            : "bg-emerald-400"}"
          style="width: ${Math.round(c.fraction * 100)}%"
        ></div>
      </div>
      <div class="flex justify-between gap-2 text-white/60">
        <span class="min-w-0 truncate"
          >${translateText("ww1936.wpeace.default")}</span
        >
        <span class="shrink-0 tabular-nums"
          >${translateText("ww1936.takeover.time", { s: c.secondsLeft })}</span
        >
      </div>
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
      <div class="flex gap-1">
        ${this.button(c, true)} ${this.button(c, false)}
      </div>
      ${this.sent === null
        ? nothing
        : html`<span data-ww-wpeace-sent class="text-emerald-300"
            >${translateText("ww1936.eventui.sent")}</span
          >`}
      ${c.more > 0
        ? html`<span class="text-white/60"
            >${translateText("ww1936.eventui.more", { n: c.more })}</span
          >`
        : nothing}
    </div>`;
    return html`<div
      data-ww-wpeace-slot
      class="${CARD_WIDTH} shrink-0 pointer-events-none"
    ></div>`;
  }
}
