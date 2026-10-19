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
  /** The first tick every card I may vote on had my ballot. */
  private votedAt: { sessionId: number; tick: number } | null = null;
  /** A session the pill or the dial unfolded. */
  private expandedSession: number | null = null;

  createRenderRoot() {
    return this;
  }

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
    this.requestUpdate();
  }

  private trackVotedAt(data: CongressData, now: number) {
    const s = data.session;
    const viewer = viewerOf(this.game);
    if (s === null || viewer === null) {
      this.votedAt = null;
      return;
    }
    if (this.votedAt?.sessionId === s.id) return;
    const mine = cardModels(data, viewer).filter((c) => c.eligible);
    this.votedAt =
      mine.length > 0 && mine.every((c) => c.myVote !== null)
        ? { sessionId: s.id, tick: now }
        : null;
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
    // Three cards fit a tablet; on a short phone screen the stack scrolls
    // (max-h-[60dvh]) rather than climbing over the map.
    return html`<div
      data-congress-cards
      class="flex flex-col items-start gap-1 pb-1 pointer-events-none text-white select-none"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${stamps.map((st) => this.renderStamp(st.result))}
      ${s === null || cards.length === 0
        ? nothing
        : this.collapsed(s, cards, now)
          ? this.renderPill(s, cards, now)
          : html`<div
              class="flex flex-col items-start gap-1 max-h-[60dvh] overflow-y-auto"
            >
              ${cards.map((c) => this.renderCard(c, influence, now))}
            </div>`}
      ${chips.length === 0
        ? nothing
        : html`<div class="flex flex-wrap gap-1">
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
    return html`<div
      data-congress-card=${c.index}
      class="${CARD_WIDTH} min-h-20 shrink-0 pointer-events-auto flex flex-col gap-1 rounded-lg border border-yellow-400/80 bg-gray-900/92 px-2 py-1 text-xs shadow-lg"
    >
      <div class="flex items-center gap-1">
        <span class="flex-1 min-w-0 font-bold truncate"
          >🏛 ${titleText(c.item, this.name, translateText)}</span
        >
        <span data-card-seconds class="shrink-0 tabular-nums font-bold"
          >${formatClock(c.closeTick - now)}</span
        >
      </div>
      <div data-card-reason class="text-gray-400 truncate">
        ${reasonText(c.item, this.name, translateText)}
      </div>
      <div class="flex gap-1">
        ${this.renderVote(c, "A")} ${this.renderVote(c, "B")}
      </div>
      <div class="flex items-center gap-1">
        <div class="flex-1 min-w-0 flex flex-wrap gap-0.5">
          ${this.renderFooter(c, influence)}
        </div>
        <span
          data-turnout
          class="shrink-0 tabular-nums text-gray-300 whitespace-nowrap"
          >${translateText("congress.card.turnout", c.turnout)}</span
        >
      </div>
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
      class="flex-1 min-w-0 flex flex-col items-start gap-0.5 rounded-md border ${border} px-1.5 py-1 text-left leading-tight disabled:opacity-40 ${mine
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
      <span class="text-[10px] line-clamp-2 ${mine ? "" : "text-gray-300"}"
        >${translateText(
          `congress.resolution.${c.item.resolution}.${option.toLowerCase()}_effect`,
        )}</span
      >
      ${side === "none"
        ? nothing
        : html`<span
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

  private renderFooter(
    c: CardModel,
    influence: number,
  ): TemplateResult | TemplateResult[] {
    if (!c.eligible) {
      return html`<span class="text-gray-400"
        >${translateText("congress.card.no_seat")}</span
      >`;
    }
    if (c.myVote === null) {
      return c.bOnly
        ? html`<span class="text-amber-300"
            >${translateText("congress.card.b_only")}</span
          >`
        : html``;
    }
    return extraChips(c.myVote, influence).map(
      (chip) =>
        html`<button
          type="button"
          data-extra=${chip.extra}
          class="h-8 px-1 rounded-md text-[11px] font-bold tabular-nums whitespace-nowrap bg-gray-700 border border-white/20 hover:bg-gray-600 disabled:opacity-40"
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
      class="pointer-events-auto h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap bg-gray-800/90 border ${c.mine
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
