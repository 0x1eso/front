import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, render, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  canAct,
  eventCardModel,
  EventCardView,
  flagUrl,
  politicsInput,
} from "./PoliticsModel";
import { TWO_TAP_MS, TwoTap, WW_BAND_PX } from "./WorldWarModel";

/** Spec §21.6: at most this many cards open at once; the rest wait behind "+N". */
export const MAX_SHOWN_CARDS = 2;
/** A card's width: as wide as the congress cards' column allows, at most 380 px. */
const CARD_WIDTH = "w-[min(46vw,380px)]";
/** Space kept below the band, in CSS px. */
const TOP_GAP = 8;
/** A body longer than this many characters folds to three lines. */
const LONG_BODY = 110;

/**
 * The card stack's own layer: over the drawers (z-1002) and the hover card
 * (1001) as spec §21.9 asks, and above the leaderboard (900), which covers
 * the bottom HUD's middle column on a phone — the bottom HUD (z-200) is a
 * stacking context its children can't leave (world congress fix 23374fcae).
 */
export const EVENT_LAYER_CLASS = "fixed z-[1003] pointer-events-none";

/**
 * World War 1936 P3 (spec §21.6, §12.5): my pending event cards, right
 * above the dials where the congress vote cards sit. At most two open, the
 * rest behind a "+N" badge. A card shows its picture, the sender's flag,
 * the title, three lines of text (tap to read on), the options with the
 * first two lines of their effects (a red line when an option hands my
 * country over), a time bar and what happens when time runs out. The
 * first tap on an option arms it ("tap again to confirm", 3 s), the second
 * sends ww_order {event_choose}; the card then says it waits for the next
 * tick. "–" folds a card to a strip (its time still runs).
 */
@customElement("ww-event-cards")
export class WwEventCards extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  private readonly twoTap = new TwoTap();
  /** Options sent, by card uid: the card waits for the engine. */
  private readonly chosen = new Map<number, string>();
  private readonly folded = new Set<number>();
  private readonly unfolded = new Set<number>();
  private layer: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private stackTemplate: TemplateResult | null = null;
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
    layer.setAttribute("data-ww-event-layer", "");
    layer.className = `${EVENT_LAYER_CLASS} text-white select-none`;
    layer.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(layer);
    this.layer = layer;
    window.addEventListener("resize", this.place);
    // The stack grows as pictures load and cards fold; the HUD column
    // moves with the rows under it.
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
    const i = this.game ? politicsInput(this.game) : null;
    const cards = i === null ? [] : i.view.cards(i.me);
    // Forget cards that are gone (chosen, or their time ran out).
    const live = new Set(cards.map((c) => c.uid));
    for (const uid of [...this.chosen.keys()]) {
      if (!live.has(uid)) this.chosen.delete(uid);
    }
    for (const set of [this.folded, this.unfolded]) {
      for (const uid of [...set]) if (!live.has(uid)) set.delete(uid);
    }
    const key = [
      i?.view.version ?? 0,
      Math.ceil((this.game?.ticks() ?? 0) / 10),
      cards.length,
    ];
    if (key.some((v, n) => v !== this.drawn[n])) {
      this.drawn = key;
      this.requestUpdate();
    }
  }

  protected updated(): void {
    if (this.layer === null) return;
    render(this.stackTemplate ?? nothing, this.layer);
    this.place();
  }

  /**
   * Sizes the slot in the HUD column to the stack, then lays the layer over
   * the slot (its left and bottom edges); the stack never reaches the band.
   */
  readonly place = () => {
    const layer = this.layer;
    if (layer === null) return;
    const slot = this.querySelector<HTMLElement>("[data-ww-event-slot]");
    const stack = layer.querySelector<HTMLElement>("[data-ww-event-stack]");
    if (slot === null || stack === null) return;
    const room = (r: DOMRect) =>
      Math.max(96, Math.floor(r.bottom - WW_BAND_PX - TOP_GAP));
    const before = slot.getBoundingClientRect();
    stack.style.maxHeight = `${room(before)}px`;
    const height = `${Math.round(stack.getBoundingClientRect().height)}px`;
    if (slot.style.height !== height) slot.style.height = height;
    // The column grew or shrank: measure the slot again.
    const r = slot.getBoundingClientRect();
    stack.style.maxHeight = `${room(r)}px`;
    layer.style.left = `${Math.round(r.left)}px`;
    layer.style.bottom = `${Math.round(window.innerHeight - r.bottom)}px`;
  };

  private refresh() {
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private pick(card: EventCardView, option: string) {
    if (this.chosen.has(card.uid)) return;
    if (!this.twoTap.tap(`${card.uid}:${option}`, Date.now())) {
      this.refresh();
      return;
    }
    this.chosen.set(card.uid, option);
    this.eventBus.emit(
      new SendWwOrderIntentEvent({
        kind: "event_choose",
        uid: card.uid,
        option,
      }),
    );
    this.requestUpdate();
  }

  render() {
    this.stackTemplate = null;
    const i = this.game ? politicsInput(this.game) : null;
    if (i === null || !canAct(i)) return nothing;
    const cards = i.view
      .cards(i.me)
      .map((c) => eventCardModel(i, c))
      .filter((c): c is EventCardView => c !== null);
    if (cards.length === 0) return nothing;
    const shown = cards.slice(0, MAX_SHOWN_CARDS);
    const more = cards.length - shown.length;
    this.stackTemplate = html`<div
      data-ww-event-stack
      class="flex flex-col items-start gap-1 overflow-y-auto"
    >
      ${shown.map((c) =>
        this.folded.has(c.uid) ? this.renderStrip(c) : this.renderCard(c),
      )}
      ${more > 0
        ? html`<span
            data-ww-event-more
            class="pointer-events-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-gray-900"
            >${translateText("ww1936.eventui.more", { n: more })}</span
          >`
        : nothing}
    </div>`;
    return html`<div
      data-ww-event-slot
      class="${CARD_WIDTH} shrink-0 pointer-events-none"
    ></div>`;
  }

  private timeBar(c: EventCardView): TemplateResult {
    return html`<div class="h-1 rounded bg-white/10">
      <div
        data-ww-event-time
        class="h-1 rounded ${c.secondsLeft <= 5
          ? "bg-red-500"
          : "bg-amber-400"}"
        style="width: ${Math.round(c.fraction * 100)}%"
      ></div>
    </div>`;
  }

  private renderStrip(c: EventCardView): TemplateResult {
    return html`<div
      data-ww-event=${c.uid}
      data-folded="true"
      class="${CARD_WIDTH} pointer-events-auto flex shrink-0 flex-col gap-0.5 rounded-lg border border-amber-300/80 bg-gray-900/92 px-2 py-1 text-xs shadow-lg"
    >
      <div class="flex items-center gap-1">
        <span class="min-w-0 flex-1 truncate font-bold">${c.title}</span>
        <span class="shrink-0 tabular-nums">${c.seconds}</span>
        <button
          type="button"
          data-ww-event-unfold
          class="size-9 shrink-0 rounded-md hover:bg-white/10"
          aria-label=${translateText("ww1936.eventui.expand")}
          @click=${() => {
            this.folded.delete(c.uid);
            this.requestUpdate();
          }}
        >
          +
        </button>
      </div>
      ${this.timeBar(c)}
    </div>`;
  }

  private renderCard(c: EventCardView): TemplateResult {
    const sent = this.chosen.get(c.uid) ?? null;
    const long = c.body.length > LONG_BODY;
    const open = this.unfolded.has(c.uid);
    return html`<div
      data-ww-event=${c.uid}
      data-event-id=${c.eventId}
      class="${CARD_WIDTH} pointer-events-auto flex shrink-0 flex-col gap-1 overflow-hidden rounded-lg border border-amber-300/80 bg-gray-900/95 text-xs shadow-xl"
    >
      ${c.pictureUrl === null
        ? nothing
        : html`<div
            class="h-12 shrink-0 bg-gray-800 [@media(max-height:500px)]:h-8"
          >
            <img
              data-ww-event-picture=${c.picture ?? ""}
              src=${c.pictureUrl}
              alt=${c.pictureAlt}
              class="h-full w-full object-contain p-1 opacity-90"
            />
          </div>`}
      <div
        class="flex flex-col gap-1 px-2 pb-1.5 ${c.pictureUrl === null
          ? "pt-1.5"
          : ""}"
      >
        <div class="flex items-center gap-1.5">
          ${c.from === null
            ? nothing
            : html`<img
                data-ww-event-flag=${c.from}
                src=${flagUrl(c.from)}
                alt=${c.fromText ?? ""}
                class="h-3.5 w-5 shrink-0 rounded-sm object-cover"
              />`}
          <span class="min-w-0 flex-1 font-bold leading-tight">${c.title}</span>
          <button
            type="button"
            data-ww-event-fold
            class="size-9 shrink-0 rounded-md hover:bg-white/10"
            aria-label=${translateText("ww1936.eventui.collapse")}
            @click=${() => {
              this.folded.add(c.uid);
              this.requestUpdate();
            }}
          >
            –
          </button>
        </div>
        <p
          data-ww-event-body
          class="m-0 text-white/80 ${long && !open ? "line-clamp-3" : ""}"
        >
          ${c.body}
        </p>
        ${long
          ? html`<button
              type="button"
              data-ww-event-more-text
              class="self-start text-sky-300 underline"
              @click=${() => {
                if (open) this.unfolded.delete(c.uid);
                else this.unfolded.add(c.uid);
                this.requestUpdate();
              }}
            >
              ${translateText(
                open ? "ww1936.eventui.read_less" : "ww1936.eventui.read_more",
              )}
            </button>`
          : nothing}
        <div class="flex flex-col gap-1">
          ${c.options.map((o) => {
            const armed =
              sent === null &&
              this.twoTap.isArmed(`${c.uid}:${o.id}`, Date.now());
            const picked = sent === o.id;
            return html`<button
              type="button"
              data-ww-option=${o.id}
              data-armed=${String(armed)}
              class="min-h-9 rounded-md border px-2 py-1 text-left ${picked
                ? "border-emerald-400 bg-emerald-950/70"
                : armed
                  ? "border-amber-300 bg-amber-900/60"
                  : "border-white/20 bg-gray-800 hover:bg-gray-700"} disabled:opacity-40"
              ?disabled=${!o.open || (sent !== null && !picked)}
              @click=${() => this.pick(c, o.id)}
            >
              <span class="block font-semibold"
                >${o.label}${o.id === c.defaultOption ? " ⏱" : ""}</span
              >
              ${o.effects.map(
                (e) =>
                  html`<span class="block text-[11px] text-white/70"
                    >${e}</span
                  >`,
              )}
              ${o.annexWarning === null
                ? nothing
                : html`<span
                    data-ww-annex-warning
                    class="block font-semibold text-red-400"
                    >${o.annexWarning}</span
                  >`}
              ${armed
                ? html`<span data-ww-confirm class="block text-amber-200"
                    >${translateText("ww1936.eventui.confirm")}</span
                  >`
                : nothing}
            </button>`;
          })}
        </div>
        ${sent === null
          ? nothing
          : html`<span data-ww-event-sent class="text-emerald-300"
              >${translateText("ww1936.eventui.sent")}</span
            >`}
        ${this.timeBar(c)}
        <div class="flex justify-between gap-2 text-white/60">
          <span data-ww-event-default class="min-w-0 truncate"
            >${c.defaultText}</span
          >
          <span class="shrink-0 tabular-nums">${c.seconds}</span>
        </div>
      </div>
    </div>`;
  }
}
