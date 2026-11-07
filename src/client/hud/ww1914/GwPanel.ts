import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { EventBus } from "@openfront/shared/EventBus";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendGwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { band } from "./GwBand";
import { budgetPanel } from "./GwBudget";
import { countryTab } from "./GwCountry";
import type { GwCtx, GwUi } from "./GwCtx";
import { deskTab, reader } from "./GwDesk";
import { frontsTab } from "./GwFronts";
import { memoirTab } from "./GwMemoir";
import {
  GW_TABS,
  GwTab,
  loadShelf,
  saveShelf,
  shelve,
  shelveMemoir,
  tabBadge,
} from "./GwModel";
import { peopleTab } from "./GwPeople";
import { GLASS } from "./GwStyle";
import { activeTalk, syncTranscripts, talkView } from "./GwTalk";
import { ticker, tickerLines } from "./GwTicker";

/** The ticker moves to its next line this often, ms. */
const TICKER_MS = 7000;
/** A talk that appears this soon after a summon opens on its own, ms. */
const SUMMON_OPEN_MS = 6000;
/** The talk view's line fades in. */
const KEYFRAMES = html`<style>
  @keyframes gwfade {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>`;

/**
 * Great War 1914: the screens (design §11). A top band, a one-line news
 * ticker, a left drawer with five tabs (desk, people, fronts, country,
 * memoir), the reader for a paper and the talk view for a conversation. The
 * map stays the background. Every engine read is in GreatWarData; every
 * action is one `gw_order`.
 */
@customElement("gw-panel")
export class GwPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private data: GreatWarData | null = null;
  @state() private pack: GwPack | null = null;
  private asked = false;
  private ticks = 0;
  private news = 0;
  private newsAt = 0;
  private recorded = false;
  private chapter = -1;
  private readonly ui: GwUi = {
    tab: "desk",
    folded: false,
    readerUid: null,
    armed: null,
    talkUid: null,
    talks: new Map(),
    openPerson: null,
    privateOpen: false,
    summoned: 0,
    armedDismiss: null,
    research: null,
    budgetOpen: false,
    budgetPlan: null,
    shelf: loadShelf(),
  };

  createRenderRoot() {
    return this;
  }

  init() {}

  getTickIntervalMs() {
    return 100;
  }

  tick() {
    const data = this.game?.greatWarData?.() ?? null;
    const ticks = this.game?.ticks?.() ?? 0;
    let dirty = false;
    if (data !== this.data) {
      this.data = data;
      dirty = true;
      const seat = this.seat();
      if (seat !== null && !this.asked) {
        this.asked = true;
        loadGwPack(seat.tag).then(
          (p) => (this.pack = p),
          (e) => console.error("Great War text pack", e),
        );
      }
      if (data !== null && seat !== null) this.onData(data, seat);
    }
    // The band's clock moves with seconds, the ticker with its own timer.
    if (Math.floor(ticks / 10) !== Math.floor(this.ticks / 10)) dirty = true;
    this.ticks = ticks;
    const now = Date.now();
    if (now - this.newsAt >= TICKER_MS) {
      this.newsAt = now;
      this.news++;
      dirty = true;
    }
    if (dirty) this.requestUpdate();
  }

  private seat(): GwSeatView | null {
    const me = this.game?.myPlayer()?.smallID();
    return this.data?.seats.find((s) => s.smallID === me) ?? null;
  }

  /** What a fresh view changes on this side: transcripts, the shelf, the next chapter. */
  private onData(data: GreatWarData, seat: GwSeatView): void {
    const ui = this.ui;
    if (data.chapter !== this.chapter) {
      this.chapter = data.chapter;
      ui.research = null;
      ui.budgetPlan = null;
      ui.budgetOpen = false;
      ui.readerUid = null;
      ui.armed = null;
    }
    // A talk that came after my summons opens by itself; a visitor waits on the desk.
    const before = new Set(ui.talks.keys());
    syncTranscripts(ui, seat);
    for (const t of ui.talks.values()) {
      if (before.has(t.uid) || t.closed) continue;
      if (Date.now() - ui.summoned < SUMMON_OPEN_MS) ui.talkUid = t.uid;
      ui.shelf = shelve(ui.shelf, "people", [t.who]);
      saveShelf(ui.shelf);
    }
    if (ui.talkUid !== null && !ui.talks.has(ui.talkUid)) ui.talkUid = null;
    const memoir = seat.world.memoir;
    if (memoir !== null && !this.recorded) {
      // The game is over: the memoir is what the seat has left to read.
      this.recorded = true;
      ui.shelf = shelveMemoir(ui.shelf, seat.tag, memoir, data.date);
      saveShelf(ui.shelf);
      ui.tab = "memoir";
      ui.folded = false;
      ui.readerUid = null;
    }
  }

  private send(order: GwOrder): void {
    this.eventBus.emit(new SendGwOrderIntentEvent(order));
  }

  private tabBody(c: GwCtx) {
    switch (this.ui.tab) {
      case "people":
        return peopleTab(c);
      case "fronts":
        return frontsTab(c);
      case "country":
        return countryTab(c);
      case "memoir":
        return memoirTab(c);
      default:
        return deskTab(c);
    }
  }

  render() {
    const data = this.data;
    const seat = this.seat();
    if (data === null || seat === null) return nothing;
    const ui = this.ui;
    const c: GwCtx = {
      data,
      seat,
      pack: this.pack,
      ui,
      tick: this.ticks,
      send: (o) => this.send(o),
      redraw: () => this.requestUpdate(),
      card: (uid) => seat.desk.find((x: GwCardView) => x.uid === uid),
    };
    const open = ui.readerUid === null ? undefined : c.card(ui.readerUid);
    const talk = activeTalk(c);
    return html`${KEYFRAMES}${band(c)}${ticker(
        tickerLines(data, seat, this.pack),
        this.news,
      )}
      <aside
        data-gw-drawer
        class="${GLASS} pointer-events-auto fixed inset-x-0 bottom-0 z-[898] flex h-[56vh] flex-col text-white sm:inset-x-auto sm:left-0 sm:bottom-auto sm:top-10 sm:h-auto sm:max-h-[calc(100vh-2.5rem)] sm:w-[400px] sm:border-b-0 sm:border-l-0 ${ui.folded
          ? "!h-9"
          : ""} ${talk === null ? "" : "invisible"}"
      >
        <nav
          class="flex shrink-0 items-center gap-1 border-b border-white/10 p-1.5"
          data-gw-tabs
        >
          ${GW_TABS.map((tab) => this.tabButton(c, tab))}
          <button
            class="ml-auto px-2 text-white/60 hover:text-white"
            data-gw-fold
            title=${translateText("gw.ui.fold")}
            @click=${() => {
              ui.folded = !ui.folded;
              this.requestUpdate();
            }}
          >
            ${ui.folded ? "▾" : "▴"}
          </button>
        </nav>
        ${ui.folded
          ? nothing
          : html`<div class="min-h-0 flex-1 overflow-y-auto p-2.5">
              ${data.ended !== null && ui.tab === "desk"
                ? html`<p class="mb-2 text-sm text-amber-200" data-gw-ended>
                    ${translateText("gw.panel.ended")}
                  </p>`
                : nothing}
              ${this.tabBody(c)}
            </div>`}
      </aside>
      ${open === undefined ? nothing : reader(c, open)}
      ${ui.budgetOpen ? budgetPanel(c) : nothing}
      ${talk === null ? nothing : talkView(c, talk.t, talk.card)}`;
  }

  private tabButton(c: GwCtx, tab: GwTab) {
    const on = this.ui.tab === tab;
    const badge = tabBadge(c.seat, tab);
    return html`<button
      class="${on
        ? "bg-white/20 text-white"
        : "text-white/70 hover:bg-white/10"} rounded px-2 py-1 text-sm"
      data-gw-tab=${tab}
      @click=${() => {
        this.ui.tab = tab;
        this.ui.folded = false;
        this.requestUpdate();
      }}
    >
      ${translateText(`gw.ui.tab.${tab}`)}${badge > 0
        ? html`<span
            class="ml-1 rounded-full bg-amber-300/90 px-1.5 text-xs font-bold text-slate-900"
            >${badge}</span
          >`
        : nothing}
    </button>`;
  }
}
