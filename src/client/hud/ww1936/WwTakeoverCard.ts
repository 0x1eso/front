import { WW_TAKEOVER_CARD_TICKS } from "@openfront/engine-api/ww1936/EndgameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, render, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { WwControllerChangedEvent } from "../../view/WwEndgameView";
import { countryFlagUrl, countryText, type NameGame } from "./EndgameNames";
import { enemiesOf, TWO_TAP_MS, TwoTap, WW_BAND_PX } from "./WorldWarModel";
import { WwDrawerEvent } from "./WwDrawer";
import { EVENT_LAYER_CLASS } from "./WwEventCards";

/** A card's width: the event cards' (spec §20.1: the conference card's place). */
const CARD_WIDTH = "w-[min(46vw,380px)]";
/** Space kept below the band, in CSS px. */
const TOP_GAP = 8;
/** At most this many enemies are named on a candidate's line. */
const ENEMIES_SHOWN = 2;
/**
 * A pick goes on the next tick and the card goes; a card still there this
 * long after (2 s) was refused (the country fell meanwhile), and may be
 * picked again.
 */
export const PICK_WAIT_TICKS = 20;

/** What the takeover card reads (a fake in tests). */
export type TakeoverGame = NameGame &
  Partial<Pick<GameView, "wwEconomy" | "wwLand">>;

export interface TakeoverRow {
  id: number;
  flagUrl: string;
  name: string;
  /** "Italy · factories 34 · divisions 41". */
  line: string;
  /** "At war: France, United Kingdom"; null at peace. */
  war: string | null;
}

export interface TakeoverCardView {
  /** The engine's deadline tick: the card's identity (a new card, a new deadline). */
  deadlineTick: number;
  rows: TakeoverRow[];
  secondsLeft: number;
  /** Time left, 1 → 0. */
  fraction: number;
  /** "If time runs out: Italy" (the first candidate, spec §11.2). */
  defaultText: string;
}

/**
 * Spec §11.2, §20.6: my takeover card — up to three same-faction AI
 * countries (flag, name, factories, divisions, the wars they fight), the
 * time left and what happens when it runs out; null without a card.
 */
export function takeoverCardModel(game: TakeoverGame): TakeoverCardView | null {
  const client = game.myClientID?.();
  const eg = game.wwEndgame?.() ?? null;
  if (!client || eg === null) return null;
  const card = eg.takeoverFor(client);
  if (card === null || card.candidates.length === 0) return null;
  const economy = game.wwEconomy?.() ?? null;
  const land = game.wwLand?.() ?? null;
  const rows = card.candidates.map((id): TakeoverRow => {
    const s = economy?.summary(id) ?? null;
    const name = countryText(game, id);
    const enemies = enemiesOf(game, id);
    const named = enemies
      .slice(0, ENEMIES_SHOWN)
      .map((e) => countryText(game, e));
    if (enemies.length > ENEMIES_SHOWN) {
      named.push(
        translateText("ww1936.eventui.more", {
          n: enemies.length - ENEMIES_SHOWN,
        }),
      );
    }
    return {
      id,
      flagUrl: countryFlagUrl(game, id),
      name,
      line: translateText("ww1936.takeover.candidate", {
        country: name,
        factories: s === null ? 0 : s.civ + s.mil,
        divisions: land?.countries.get(id)?.divisions ?? 0,
      }),
      war:
        named.length === 0
          ? null
          : translateText("ww1936.takeover.at_war", {
              enemies: named.join(", "),
            }),
    };
  });
  const left = Math.max(0, card.deadlineTick - game.ticks());
  return {
    deadlineTick: card.deadlineTick,
    rows,
    secondsLeft: Math.ceil(left / 10),
    fraction: Math.min(1, left / WW_TAKEOVER_CARD_TICKS),
    defaultText: translateText("ww1936.takeover.default", {
      country: rows[0].name,
    }),
  };
}

/**
 * The P0 spectate screen's question in World War 1936 P5 (spec §11): is
 * my client out of the game — spectating (no candidate), or its country
 * gone with no exile, no takeover card and no new country? An exile and a
 * human picking a country play on.
 */
export function wwOutOfGame(game: TakeoverGame): boolean {
  const client = game.myClientID?.();
  const eg = game.wwEndgame?.() ?? null;
  if (!client || eg === null) return false;
  if (eg.controlledBy(client) === 0) return true;
  if (eg.takeoverFor(client) !== null) return false;
  const me = game.myPlayer();
  return (
    me !== null && me.hasSpawned() && !me.isAlive() && !eg.isExile(me.smallID())
  );
}

/**
 * Spec §3.6: my controller changed — every open World War drawer closes.
 * A drawer closes when another one opens (P1 pre-flight R7.2), so two
 * drawers are said to open in turn (each closing every other one) and
 * then to close, which leaves the drawers' trackers (the dials' outline,
 * the leaderboard's fold, the hover card) as they were: nothing open.
 */
export function closeWwDrawers(bus: EventBus): void {
  bus.emit(new WwDrawerEvent("politics", true));
  bus.emit(new WwDrawerEvent("diplomacy", true));
  bus.emit(new WwDrawerEvent("diplomacy", false));
  bus.emit(new WwDrawerEvent("politics", false));
}

/**
 * World War 1936 P5 (spec §11.2, §20.6): a human whose country is gone
 * picks a same-faction AI country to play on. Where the event cards sit
 * (the conference card's place, above the dials): "Take over a country —
 * same faction", up to three candidates (flag, name, factories, divisions,
 * "At war: …"), a time bar and what happens when the 30 seconds run out.
 * The first tap on a candidate arms it ("tap again to confirm", 3 s), the
 * second sends ww_order {takeover_pick} (by client id: the sender has no
 * country). On the tick the controller changes, every open drawer closes
 * and the HUD reads myPlayer() again.
 */
@customElement("ww-takeover-card")
export class WwTakeoverCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  private readonly twoTap = new TwoTap();
  /** The pick sent for this card (by its deadline) and the tick it went. */
  private sent: { deadline: number; pick: number; tick: number } | null = null;
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
    layer.setAttribute("data-ww-takeover-layer", "");
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

  init() {
    this.eventBus.on(WwControllerChangedEvent, () => {
      closeWwDrawers(this.eventBus);
      this.sent = null;
      this.requestUpdate();
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    const card = this.cardView();
    const now = this.game?.ticks() ?? 0;
    const sent = this.sent;
    // The card went (taken, or its time ran out), a new one came, or the
    // engine refused the pick: the candidates come back.
    if (
      sent !== null &&
      (card === null ||
        card.deadlineTick !== sent.deadline ||
        now - sent.tick >= PICK_WAIT_TICKS)
    ) {
      this.sent = null;
    }
    const key = [
      card?.deadlineTick ?? -1,
      card?.rows.map((r) => r.line + (r.war ?? "")).join("|") ?? "",
      Math.ceil(now / 10),
      this.sent?.pick ?? 0,
    ];
    if (key.some((v, n) => v !== this.drawn[n])) {
      this.drawn = key;
      this.requestUpdate();
    }
  }

  private cardView(): TakeoverCardView | null {
    return this.game ? takeoverCardModel(this.game) : null;
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
    const slot = this.querySelector<HTMLElement>("[data-ww-takeover-slot]");
    const card = layer.querySelector<HTMLElement>("[data-ww-takeover]");
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

  private refresh() {
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private pick(card: TakeoverCardView, id: number) {
    if (this.sent !== null) return;
    if (!this.twoTap.tap(`${card.deadlineTick}:${id}`, Date.now())) {
      this.refresh();
      return;
    }
    this.sent = {
      deadline: card.deadlineTick,
      pick: id,
      tick: this.game?.ticks() ?? 0,
    };
    this.eventBus.emit(
      new SendWwOrderIntentEvent({ kind: "takeover_pick", smallID: id }),
    );
    this.requestUpdate();
  }

  render() {
    this.cardTemplate = null;
    const c = this.cardView();
    if (c === null) return nothing;
    const sent = this.sent?.pick ?? 0;
    this.cardTemplate = html`<div
      data-ww-takeover
      class="${CARD_WIDTH} pointer-events-auto flex flex-col gap-1 overflow-y-auto rounded-lg border border-sky-300/80 bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
    >
      <span class="font-bold leading-tight"
        >${translateText("ww1936.takeover.title")}</span
      >
      <div class="h-1 shrink-0 rounded bg-white/10">
        <div
          data-ww-takeover-time
          class="h-1 rounded ${c.secondsLeft <= 5
            ? "bg-red-500"
            : "bg-sky-400"}"
          style="width: ${Math.round(c.fraction * 100)}%"
        ></div>
      </div>
      <div class="flex justify-between gap-2 text-white/60">
        <span data-ww-takeover-default class="min-w-0 truncate"
          >${c.defaultText}</span
        >
        <span class="shrink-0 tabular-nums"
          >${translateText("ww1936.takeover.time", { s: c.secondsLeft })}</span
        >
      </div>
      ${c.rows.map((r, i) => {
        const armed =
          sent === 0 &&
          this.twoTap.isArmed(`${c.deadlineTick}:${r.id}`, Date.now());
        const picked = sent === r.id;
        return html`<button
          type="button"
          data-ww-candidate=${r.id}
          data-armed=${String(armed)}
          class="flex min-h-9 items-center gap-2 rounded-md border px-2 py-1 text-left ${picked
            ? "border-emerald-400 bg-emerald-950/70"
            : armed
              ? "border-amber-300 bg-amber-900/60"
              : "border-white/20 bg-gray-800 hover:bg-gray-700"} disabled:opacity-40"
          ?disabled=${sent !== 0 && !picked}
          @click=${() => this.pick(c, r.id)}
        >
          <img
            src=${r.flagUrl}
            alt=""
            class="h-3.5 w-5 shrink-0 rounded-sm object-cover"
          />
          <span class="flex min-w-0 flex-col">
            <span class="font-semibold">${r.line}${i === 0 ? " ⏱" : ""}</span>
            ${r.war === null
              ? nothing
              : html`<span class="text-white/70">${r.war}</span>`}
            ${armed
              ? html`<span data-ww-confirm class="text-amber-200"
                  >${translateText("ww1936.takeover.confirm")}</span
                >`
              : nothing}
          </span>
        </button>`;
      })}
      ${sent === 0
        ? nothing
        : html`<span data-ww-takeover-sent class="text-emerald-300"
            >${translateText("ww1936.eventui.sent")}</span
          >`}
    </div>`;
    return html`<div
      data-ww-takeover-slot
      class="${CARD_WIDTH} shrink-0 pointer-events-none"
    ></div>`;
  }
}
