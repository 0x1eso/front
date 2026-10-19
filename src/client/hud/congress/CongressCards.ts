import {
  BallotOption,
  CongressData,
  ResultData,
  SessionData,
} from "@openfront/engine-api/congress/CongressTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendCongressVoteIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import { OpenDomesticScreenEvent } from "../domestic/DomesticEvents";
import {
  CardModel,
  cardModels,
  ChipModel,
  extraChips,
  formatClock,
  nameOf,
  newResults,
  optionLabel,
  reasonText,
  resolutionChips,
  sameDrawKey,
  ticksToSeconds,
  titleText,
  viewerOf,
} from "./CongressModel";

/** Cards fold into a pill this long after my last ballot of the session (5 s). */
export const COLLAPSE_TICKS = 50;
/** A closed item's result stamp stays this long (3 s). */
export const STAMP_TICKS = 30;
const MAX_STAMPS = 3;

/** Same width as a card: about 260 px on tablets, never past the screen's middle. */
const CARD_WIDTH = "w-[min(260px,calc(50vw-16px))]";

/** Space the bottom HUD column keeps from the screen's top edge, in CSS px. */
const TOP_GAP = 8;
/** The card stack never shrinks below this (a card's title, reason and buttons), in CSS px. */
const MIN_STACK_PX = 96;

interface Stamp {
  result: ResultData;
  untilTick: number;
}

/**
 * World congress (spec §12): the vote cards right above the domestic dials,
 * left-aligned in the bottom HUD's middle column so they never reach the
 * map's centre or the attack-ratio row. One tap votes; extra-vote chips then
 * raise it. After my last ballot the cards fold into a pill; the pill or the
 * 🏛 dial opens them again. When a session closes, each item's result stays
 * a moment as a stamp. Under them, chips for the resolutions in force.
 * Secret ballot (spec §6.5): cards show turnout only, and totals after the close.
 */
@customElement("congress-cards")
export class CongressCards extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  /** The history last seen; null until the first congress data. */
  private seen: readonly ResultData[] | null = null;
  private stamps: Stamp[] = [];
  /**
   * When I last finished or changed my ballots with every card I may vote
   * on voted (`ballots` is their signature), or last tapped a raise: the fold
   * timer runs from there.
   */
  private votedAt: { sessionId: number; tick: number; ballots: string } | null =
    null;
  /** A session the pill or the dial unfolded. */
  private expandedSession: number | null = null;
  /**
   * The tallest the card stack may be, in CSS px; null: no stack, or not
   * measured. It is the stack's height plus the room left above the bottom
   * HUD column, so attacks, stamps and chips all stay on screen.
   */
  private stackMax: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /** What the last redraw request was made for (sameDrawKey). */
  private drawn: unknown[] | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("resize", this.refit);
    // The column changes size when cards, chips, attacks or the HUD rows do.
    const column = this.parentElement;
    if (column !== null && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.refit);
      this.resizeObserver.observe(column);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.refit);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /**
   * Bounds the card stack by the room above the bottom HUD column: the stack
   * may grow by the column's distance from the top edge, and shrinks by as
   * much as the column overflows it. Measured on resize only, never per tick.
   */
  readonly refit = () => {
    const column = this.parentElement;
    const stack = this.querySelector("[data-card-stack]");
    let next: number | null = null;
    if (column !== null && stack !== null) {
      const room = column.getBoundingClientRect().top - TOP_GAP;
      next = Math.max(
        MIN_STACK_PX,
        Math.floor(stack.getBoundingClientRect().height + room),
      );
    }
    if (
      next === this.stackMax ||
      (next !== null &&
        this.stackMax !== null &&
        Math.abs(next - this.stackMax) <= 1)
    ) {
      return;
    }
    this.stackMax = next;
    this.requestUpdate();
  };

  init() {
    this.eventBus.on(OpenDomesticScreenEvent, (e) => {
      if (e.screen === "congress") this.expand();
    });
  }

  private expand() {
    const s = this.game?.congressData()?.session ?? null;
    if (s === null) return;
    this.expandedSession = s.id;
    this.requestUpdate();
  }

  tick() {
    if (!this.game?.config().congress()) return;
    const data = this.game.congressData();
    if (data === null) return;
    const now = this.game.ticks();
    for (const result of newResults(this.seen, data.history)) {
      this.stamps.push({ result, untilTick: now + STAMP_TICKS });
    }
    this.seen = data.history;
    this.stamps = this.stamps
      .filter((s) => s.untilTick > now)
      .slice(-MAX_STAMPS);
    this.trackVotedAt(data, now);
    // Redraw only when what is shown can change: the congress data, my own
    // data, a displayed second (the session's clock, the chips'), a stamp
    // going, or the fold timer running out. Not every tick.
    const me = this.game.myPlayer();
    const s = data.session;
    const key = [
      data,
      me?.congressData() ?? null,
      me?.isAlive() ?? false,
      this.stamps.length,
      this.votedAt !== null && now - this.votedAt.tick >= COLLAPSE_TICKS,
      s === null ? -1 : ticksToSeconds(s.closeTick - now),
      resolutionChips(data, me?.smallID() ?? -1, now)
        .map((c) => (c.remaining === null ? -1 : ticksToSeconds(c.remaining)))
        .join(","),
    ];
    if (sameDrawKey(this.drawn, key)) return;
    this.drawn = key;
    this.requestUpdate();
  }

  private trackVotedAt(data: CongressData, now: number) {
    const s = data.session;
    const viewer = viewerOf(this.game);
    if (s === null || viewer === null) {
      this.votedAt = null;
      return;
    }
    const mine = cardModels(data, viewer).filter((c) => c.eligible);
    if (mine.length === 0 || mine.some((c) => c.myVote === null)) {
      this.votedAt = null;
      return;
    }
    // A raise changes the signature and restarts the fold timer.
    const ballots = mine
      .map((c) => `${c.index}:${c.myVote!.option}:${c.myVote!.extra}`)
      .join("|");
    if (this.votedAt?.sessionId === s.id && this.votedAt.ballots === ballots) {
      return;
    }
    this.votedAt = { sessionId: s.id, tick: now, ballots };
  }

  private collapsed(s: SessionData, cards: CardModel[], now: number): boolean {
    if (this.expandedSession === s.id) return false;
    if (!cards.some((c) => c.eligible)) return true;
    return (
      this.votedAt?.sessionId === s.id &&
      now - this.votedAt.tick >= COLLAPSE_TICKS
    );
  }

  render() {
    if (!this.game?.config().congress()) return nothing;
    const data = this.game.congressData();
    if (data === null) return nothing;
    const now = this.game.ticks();
    const viewer = viewerOf(this.game);
    const stamps = this.stamps.filter((s) => s.untilTick > now);
    const s = data.session;
    const cards = s !== null && viewer !== null ? cardModels(data, viewer) : [];
    const chips = resolutionChips(data, viewer?.smallID ?? -1, now);
    if (stamps.length === 0 && cards.length === 0 && chips.length === 0) {
      return nothing;
    }
    const influence = viewer?.data?.influence ?? 0;
    const eligible = cards.filter((c) => c.eligible).length;
    // Three cards fit a tablet; on a short phone screen the stack scrolls
    // (stackMax, see refit) rather than pushing the HUD off the top.
    return html`<div
      data-congress-cards
      class="flex flex-col items-start gap-1 pb-1 pointer-events-none text-white select-none"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${stamps.map((st) => this.renderStamp(st.result))}
      ${s === null || cards.length === 0
        ? nothing
        : this.collapsed(s, cards, now)
          ? // Nothing to vote on (a dead viewer): no pill either.
            eligible === 0
            ? nothing
            : this.renderPill(s, cards, now)
          : html`<div
              data-card-stack
              class="flex flex-col items-start gap-1 overflow-y-auto"
              style=${this.stackMax === null
                ? nothing
                : `max-height: ${this.stackMax}px`}
            >
              ${cards.map((c) => this.renderCard(c, influence, now))}
            </div>`}
      ${chips.length === 0
        ? nothing
        : html`<div data-congress-chips class="flex flex-wrap gap-1">
            ${chips.map((c) => this.renderChip(c))}
          </div>`}
    </div>`;
  }

  private name = (id: number) => nameOf(this.game, id);

  private renderCard(
    c: CardModel,
    influence: number,
    now: number,
  ): TemplateResult {
    const footer = this.renderFooter(c, influence);
    // About 128 px once voted: title, reason with turnout, the buttons, and
    // one line of chips that scrolls sideways rather than wrapping.
    return html`<div
      data-congress-card=${c.index}
      class="${CARD_WIDTH} min-h-20 shrink-0 pointer-events-auto flex flex-col gap-0.5 rounded-lg border border-yellow-400/80 bg-gray-900/92 px-2 py-1 text-xs shadow-lg"
    >
      <div class="flex items-center gap-1">
        <span class="flex-1 min-w-0 font-bold truncate"
          >🏛 ${titleText(c.item, this.name, translateText)}</span
        >
        <span data-card-seconds class="shrink-0 tabular-nums font-bold"
          >${formatClock(c.closeTick - now)}</span
        >
      </div>
      <div class="flex items-center gap-1">
        <span data-card-reason class="flex-1 min-w-0 text-gray-400 truncate"
          >${reasonText(c.item, this.name, translateText)}</span
        >
        ${c.turnout.total === 0
          ? nothing
          : html`<span
              data-turnout
              class="shrink-0 tabular-nums text-gray-300 whitespace-nowrap"
              >${translateText("congress.card.turnout", c.turnout)}</span
            >`}
      </div>
      <div class="flex gap-1">
        ${this.renderVote(c, "A")} ${this.renderVote(c, "B")}
      </div>
      ${footer === null
        ? nothing
        : html`<div
            data-card-footer
            class="flex flex-nowrap items-center gap-px overflow-x-auto [scrollbar-width:none]"
          >
            ${footer}
          </div>`}
    </div>`;
  }

  private renderVote(c: CardModel, option: BallotOption): TemplateResult {
    const label = optionLabel(c.item.resolution, option, translateText);
    const mine = c.myVote?.option === option;
    const disabled =
      !c.eligible ||
      (c.bOnly && option === "A") ||
      (c.myVote !== null && c.myVote.option !== option);
    const side =
      c.favorable === null ? "none" : c.favorable === option ? "good" : "bad";
    const border =
      side === "good"
        ? "border-green-400"
        : side === "bad"
          ? "border-red-400"
          : mine
            ? "border-yellow-300"
            : "border-white/20";
    return html`<button
      type="button"
      data-vote=${option}
      data-side=${side}
      aria-pressed=${String(mine)}
      aria-label=${mine
        ? translateText("congress.card.your_vote", {
            option: label,
            extra: c.myVote!.extra,
          })
        : nothing}
      class="flex-1 min-w-0 flex flex-col items-start gap-0.5 rounded-md border ${border} px-1.5 py-0.5 text-left leading-tight disabled:opacity-40 ${mine
        ? "bg-yellow-300 text-gray-900"
        : "bg-gray-800 hover:bg-gray-700"}"
      ?disabled=${disabled}
      @click=${() => this.vote(c, option)}
    >
      <span class="w-full truncate font-bold"
        >${option}
        ${label}${mine
          ? html` ✓${c.myVote!.extra > 0 ? ` +${c.myVote!.extra}` : ""}`
          : nothing}</span
      >
      <span
        class="text-[10px] ${side === "none"
          ? "line-clamp-2"
          : "line-clamp-1"} ${mine ? "" : "text-gray-300"}"
        >${translateText(
          `congress.resolution.${c.item.resolution}.${option.toLowerCase()}_effect`,
        )}</span
      >
      ${side === "none"
        ? nothing
        : // In the effect's second line: a named card is no taller than the others.
          html`<span
            data-side-note
            class="text-[10px] font-bold ${side === "good"
              ? mine
                ? "text-green-800"
                : "text-green-400"
              : mine
                ? "text-red-800"
                : "text-red-400"}"
            >${translateText(
              side === "good" ? "congress.card.good" : "congress.card.bad",
            )}</span
          >`}
    </button>`;
  }

  /** The last line: why I can't vote, the B-only note, or the raise chips; null when empty. */
  private renderFooter(
    c: CardModel,
    influence: number,
  ): TemplateResult | TemplateResult[] | null {
    if (!c.eligible) {
      return html`<span class="text-gray-400 truncate"
        >${translateText("congress.card.no_seat")}</span
      >`;
    }
    if (c.myVote === null) {
      return c.bOnly
        ? html`<span class="text-amber-300 truncate"
            >${translateText("congress.card.b_only")}</span
          >`
        : null;
    }
    const chips = extraChips(c.myVote, influence);
    if (chips.length === 0) return null;
    return chips.map(
      (chip) =>
        html`<button
          type="button"
          data-extra=${chip.extra}
          class="h-8 shrink-0 px-1 rounded-md text-[11px] font-bold tabular-nums whitespace-nowrap bg-gray-700 border border-white/20 hover:bg-gray-600 disabled:opacity-40"
          ?disabled=${!chip.affordable}
          @click=${() => this.raise(c, chip.extra)}
        >
          ${translateText("congress.card.extra", {
            votes: chip.extra,
            cost: chip.cost,
          })}
        </button>`,
    );
  }

  private renderPill(
    s: SessionData,
    cards: CardModel[],
    now: number,
  ): TemplateResult {
    const mine = cards.filter((c) => c.eligible);
    return html`<button
      type="button"
      data-congress-pill
      class="pointer-events-auto h-8 px-3 rounded-full text-xs font-bold tabular-nums whitespace-nowrap bg-gray-900/92 border border-yellow-400/80 shadow-lg"
      @click=${() => this.expand()}
    >
      ${translateText("congress.card.collapsed", {
        seconds: ticksToSeconds(s.closeTick - now),
        voted: mine.filter((c) => c.myVote !== null).length,
        total: mine.length,
      })}
    </button>`;
  }

  private renderStamp(r: ResultData): TemplateResult {
    return html`<div
      data-congress-stamp
      class="${CARD_WIDTH} shrink-0 flex flex-col gap-0.5 rounded-lg border-2 ${r.adopted ===
      null
        ? "border-gray-400"
        : "border-yellow-400"} bg-gray-900/92 px-2 py-1 text-xs shadow-lg"
    >
      <span class="font-bold truncate"
        >🏛 ${titleText(r, this.name, translateText)}</span
      >
      <span
        class="text-sm font-black tabular-nums ${r.adopted === null
          ? "text-gray-300"
          : "text-yellow-300"}"
        >${r.adopted === null
          ? translateText("congress.card.tied", { a: r.a, b: r.b })
          : translateText("congress.card.adopted", {
              option: optionLabel(r.resolution, r.adopted, translateText),
              a: r.a,
              b: r.b,
            })}</span
      >
    </div>`;
  }

  private renderChip(c: ChipModel): TemplateResult {
    return html`<button
      type="button"
      data-congress-chip
      class="pointer-events-auto h-8 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap bg-gray-800/90 border ${c.mine
        ? "border-amber-400 text-amber-200"
        : "border-white/15"}"
      @click=${() =>
        this.eventBus.emit(new OpenDomesticScreenEvent("congress"))}
    >
      ${titleText(c, this.name, translateText)} ·
      ${optionLabel(c.resolution, c.option, translateText)}
      <span class="tabular-nums"
        >${c.remaining === null
          ? translateText("congress.chip.until_project")
          : formatClock(c.remaining)}</span
      >
    </button>`;
  }

  /** One tap: my ballot, one vote on that side. */
  private vote(c: CardModel, option: BallotOption) {
    if (!c.eligible || c.myVote !== null || (c.bOnly && option === "A")) {
      return;
    }
    this.eventBus.emit(
      new SendCongressVoteIntentEvent(c.sessionId, c.index, option, 0),
    );
  }

  /** Raise my ballot to `extra` extra votes on the side I chose. */
  private raise(c: CardModel, extra: number) {
    if (c.myVote === null || extra <= c.myVote.extra) return;
    // Keep the card open under my finger until the raise comes back.
    if (this.votedAt?.sessionId === c.sessionId) {
      this.votedAt = { ...this.votedAt, tick: this.game.ticks() };
    }
    this.eventBus.emit(
      new SendCongressVoteIntentEvent(
        c.sessionId,
        c.index,
        c.myVote.option,
        extra,
      ),
    );
  }
}
