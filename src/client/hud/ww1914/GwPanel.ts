import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GreatWarData,
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { GW_OPENING_CHAPTERS } from "@openfront/engine-lib/ww1914/StoryRows";
import { EventBus } from "@openfront/shared/EventBus";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { noteGwPrologue } from "../../GwRecentRuns";
import type { MapRenderer } from "../../render/gl/MapRenderer";
import type { TransformHandler } from "../../TransformHandler";
import { SendGwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { band } from "./GwBand";
import { blocsTab } from "./GwBlocs";
import { budgetPanel } from "./GwBudget";
import { countryTab } from "./GwCountry";
import type { GwCtx, GwUi } from "./GwCtx";
import { deskTab, reader } from "./GwDesk";
import { dictCard } from "./GwDict";
import { frontsTab } from "./GwFronts";
import { GwMapPaint } from "./GwMapPaint";
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
import { notebookTab } from "./GwNotebook";
import { peopleTab } from "./GwPeople";
import { scheduleTab } from "./GwSchedule";
import { GLASS } from "./GwStyle";
import {
  paintPane,
  paintTags,
  speech,
  tableTab,
  tableTags,
} from "./GwTable";
import { paintCells, tableCells, togglePlace } from "./GwTableModel";
import { activeTalk, syncTranscripts, talkView } from "./GwTalk";
import { ticker, tickerLines } from "./GwTicker";

/** The ticker moves to its next line this often, ms. */
const TICKER_MS = 7000;
/** Where the camera goes as the table opens: the middle of Europe. */
const TABLE_VIEW = [2150, 690] as const;
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
 * ticker, a left drawer of tabs (desk, people, schedule, fronts, country,
 * notebook, blocs, memoir), the reader for a paper and the talk view for a conversation. The
 * map stays the background. Every engine read is in GreatWarData; every
 * action is one `gw_order`.
 */
@customElement("gw-panel")
export class GwPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  /** Absent in tests with no map. */
  public transformHandler?: TransformHandler;
  public mapView?: MapRenderer;
  private map: GwMapPaint | null = null;
  @state() private data: GreatWarData | null = null;
  @state() private pack: GwPack | null = null;
  private asked = false;
  private ticks = 0;
  private news = 0;
  private newsAt = 0;
  private recorded = false;
  private chapter = -1;
  private tableSeen = false;
  private lineSeen = -1;
  /** Lines in the open talk when last drawn: a new one scrolls into view. */
  private talkTurns = 0;
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
    armedRepeal: null,
    research: null,
    budgetOpen: false,
    budgetPlan: null,
    term: null,
    pressPick: null,
    actOpen: null,
    actPicks: {},
    aimOpen: false,
    aimArmed: null,
    paint: null,
    tableArmed: null,
    tableBarred: null,
    tableOffer: false,
    termTag: null,
    termGive: [],
    termAsk: [],
    backOpen: false,
    backArmed: null,
    notes: [],
    pastDue: false,
    shelf: loadShelf(),
  };

  createRenderRoot() {
    return this;
  }

  init() {
    if (this.transformHandler === undefined || this.mapView === undefined) {
      return;
    }
    this.map = new GwMapPaint(
      this.game,
      this.eventBus,
      this.transformHandler,
      this.mapView,
      () => this.mapCells(),
      (place) => this.onPlace(place),
    );
  }

  /** What the map shows painted now; null while it is just the map. */
  private mapCells() {
    const seat = this.seat();
    const ui = this.ui;
    if (seat === null) return null;
    if (ui.paint !== null) return paintCells(seat.tag, ui.paint);
    const t = seat.table ?? null;
    if (t === null || ui.tab !== "table") return null;
    return tableCells(t, seat.claims?.places ?? [], ui.tableArmed);
  }

  /** A place tapped on the map while it is painted. */
  private onPlace(place: GwPlace): void {
    const ui = this.ui;
    const seat = this.seat();
    if (ui.paint !== null) {
      if (GW_PLACES[place].owner === seat?.tag) return;
      ui.paint = togglePlace(ui.paint, place);
    } else if (seat?.table?.due?.kind === "turn") {
      const open = seat.table.due.places.includes(place);
      ui.tableBarred = open ? null : place;
      ui.tableArmed = open && ui.tableArmed !== place ? place : null;
    } else {
      return;
    }
    this.requestUpdate();
  }

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
    if (this.keepYearsOpen()) dirty = true;
    if (dirty) this.requestUpdate();
  }

  /**
   * The years leave nothing else to look at: what is on the desk is on screen.
   * When they end, the first card of 1914 opens the same way. True when one did.
   */
  private keepYearsOpen(): boolean {
    const ui = this.ui;
    const seat = this.seat();
    const years = seat?.prologue ?? null;
    if (seat === null || years === null) return false;
    if (ui.talkUid !== null || ui.readerUid !== null) return false;
    if (years.done && !ui.pastDue) return false;
    const card = seat.desk[0];
    if (card === undefined) return false;
    if (card.kind !== "talk") ui.readerUid = card.uid;
    else if (ui.talks.has(card.uid)) ui.talkUid = card.uid;
    else return false;
    if (years.done) ui.pastDue = false;
    return true;
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
      ui.pressPick = null;
      ui.readerUid = null;
      ui.armed = null;
      ui.actOpen = null;
      ui.actPicks = {};
      ui.termTag = null;
      ui.termGive = [];
      ui.termAsk = [];
      ui.backOpen = false;
      ui.backArmed = null;
      ui.paint = null;
      if (data.chapter >= GW_OPENING_CHAPTERS) {
        ui.shelf = shelve(ui.shelf, "played", [seat.tag]);
        saveShelf(ui.shelf);
      }
    }
    this.followTable(seat);
    if (seat.prologue?.done === false) ui.pastDue = true;
    if (seat.prologue?.done === true && ui.pastDue) {
      noteGwPrologue(seat.tag, seat.prologue.picks);
    }
    // A talk that came after my summons opens by itself; a visitor waits on the desk.
    const before = new Set(ui.talks.keys());
    syncTranscripts(ui, seat);
    // A big scene just ended stays until it is left: its last words are on it.
    const shown = ui.talkUid === null ? undefined : ui.talks.get(ui.talkUid);
    const held = shown?.closed === true && shown.turns[0]?.card.big === true;
    for (const t of ui.talks.values()) {
      if (before.has(t.uid) || t.closed) continue;
      // A big scene is the chapter: it takes the screen as it comes.
      const first = t.turns[0]?.card;
      const big = first?.big === true && !held;
      if (big || Date.now() - ui.summoned < SUMMON_OPEN_MS) ui.talkUid = t.uid;
      if (t.who === "" || first?.past !== undefined) continue;
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

  /** The table takes the screen as it opens, and the camera follows what is said. */
  private followTable(seat: GwSeatView): void {
    const t = seat.table ?? null;
    const ui = this.ui;
    if (t === null) return;
    if (!this.tableSeen) {
      this.tableSeen = true;
      ui.tab = "table";
      ui.folded = false;
      ui.readerUid = null;
      this.map?.flyTo(TABLE_VIEW[0], TABLE_VIEW[1]);
    }
    if (t.due?.kind !== "turn") {
      ui.tableArmed = null;
      ui.tableBarred = null;
    }
    if (t.due?.kind !== "word") ui.tableOffer = false;
    const line = t.lines[t.lines.length - 1];
    if (line === undefined || line.n === this.lineSeen) return;
    this.lineSeen = line.n;
    const claim = t.claims.find((x) => x.id === line.claim);
    if (claim !== undefined && ui.tab === "table") this.map?.fly(claim.place);
  }

  /** A talk grows downward: its newest line must not open below the fold. */
  protected updated(): void {
    if (this.querySelector("[data-gw-tag-at]") !== null) this.map?.keepTags();
    const uid = this.ui.talkUid;
    const turns =
      uid === null ? 0 : (this.ui.talks.get(uid)?.turns.length ?? 0);
    if (turns > this.talkTurns) {
      const view = this.querySelector("[data-gw-talk]");
      if (view !== null) view.scrollTop = view.scrollHeight;
    }
    this.talkTurns = turns;
  }

  private send(order: GwOrder): void {
    this.eventBus.emit(new SendGwOrderIntentEvent(order));
  }

  private tabBody(c: GwCtx) {
    if (this.ui.paint !== null) return paintPane(c);
    switch (this.ui.tab) {
      case "table":
        return tableTab(c);
      case "people":
        return peopleTab(c);
      case "schedule":
        return scheduleTab(c);
      case "fronts":
        return frontsTab(c);
      case "country":
        return countryTab(c);
      case "notebook":
        return notebookTab(c);
      case "blocs":
        return blocsTab(c);
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
      fly: (p) => this.map?.fly(p),
      card: (uid) => seat.desk.find((x: GwCardView) => x.uid === uid),
    };
    const open = ui.readerUid === null ? undefined : c.card(ui.readerUid);
    const talk = activeTalk(c);
    // The years: no desk, no map, nothing of 1914 yet.
    const years =
      seat.prologue?.done === false ||
      talk?.t.turns[0]?.card.past !== undefined;
    if (years) {
      return html`${KEYFRAMES}
        <div
          class="pointer-events-auto fixed inset-0 z-[1000] bg-black"
          data-gw-years
        ></div>
        ${open === undefined ? nothing : reader(c, open)}
        ${talk === null ? nothing : talkView(c, talk.t, talk.card)}
        ${dictCard(c)}`;
    }
    return html`${KEYFRAMES}${band(c)}${ticker(
        tickerLines(data, seat, this.pack),
        this.news,
      )}
      <aside
        data-gw-drawer
        class="${GLASS} pointer-events-auto fixed inset-x-0 bottom-0 z-[898] flex h-[56vh] flex-col text-white sm:inset-x-auto sm:left-0 sm:bottom-auto sm:top-10 sm:h-auto sm:max-h-[calc(100vh-2.5rem)] sm:w-[400px] sm:border-b-0 sm:border-l-0 ${ui.folded
          ? "!h-9"
          : ui.paint !== null || ui.tab === "table"
            ? "max-sm:!h-[42vh]"
            : ""} ${talk === null ? "" : "invisible"}"
      >
        <nav
          class="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-white/10 p-1.5"
          data-gw-tabs
        >
          ${GW_TABS.filter((t) => t !== "table" || seat.table != null).map(
            (tab) => this.tabButton(c, tab),
          )}
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
      ${paintTags(c)} ${tableTags(c)} ${speech(c)}
      ${open === undefined ? nothing : reader(c, open)}
      ${ui.budgetOpen ? budgetPanel(c) : nothing}
      ${talk === null ? nothing : talkView(c, talk.t, talk.card)} ${dictCard(c)}`;
  }

  private tabButton(c: GwCtx, tab: GwTab) {
    const on = this.ui.tab === tab;
    const badge = tabBadge(c.seat, tab);
    return html`<button
      class="${on
        ? "bg-white/20 text-white"
        : "text-white/70 hover:bg-white/10"} rounded px-1.5 py-1 text-sm"
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
