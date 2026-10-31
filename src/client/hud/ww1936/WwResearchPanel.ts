import {
  DOCTRINE_SCHOOLS,
  TECH_BRANCHES,
  TechBranch,
  WwCountryDetail,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { ringSvg } from "../domestic/Dial";
import { WwDepthOpenEvent } from "./DepthEvents";
import { DepthIndustryModel } from "./DepthIndustryModel";
import {
  blockText,
  branchName,
  effectLines,
  researchBlock,
  ResearchCard,
  researchCards,
  ResearchCardState,
  researchSlots,
  schoolName,
  SlotRow,
  stockOnly,
  techName,
  techUnlock,
} from "./EconomyModel";
import {
  countryName,
  today,
  TWO_TAP_MS,
  TwoTap,
  wwActive,
} from "./WorldWarModel";
import { autoMaskOf, autoOnIn, renderAutoSwitch } from "./WwAutoUi";
import { OpenWwResearchEvent, WwDrawerBase } from "./WwDrawer";
import { renderProjectsTab } from "./WwProjectsTab";
import { TabUi } from "./WwTabUi";

const STATE_KEYS: Readonly<Record<ResearchCardState, string>> = {
  done: "ww1936.econ.state_done",
  running: "ww1936.econ.state_running",
  available: "ww1936.econ.state_available",
  prereq: "ww1936.econ.state_prereq",
  doctrine: "ww1936.econ.state_doctrine",
};

/** Card looks after the domestic research tree's nodes. */
const CARD_LOOK: Readonly<Record<ResearchCardState, string>> = {
  done: "border-emerald-500/70 bg-emerald-950/70",
  running: "border-cyan-300 bg-cyan-950/70",
  available: "border-yellow-300 bg-gray-800 hover:bg-gray-700",
  prereq: "border-gray-700 bg-gray-900 opacity-60",
  doctrine: "border-gray-700 bg-gray-900 opacity-50",
};

const STATE_COLOR: Readonly<Record<ResearchCardState, string>> = {
  done: "text-emerald-300",
  running: "text-cyan-200",
  available: "text-yellow-200 font-semibold",
  prereq: "text-gray-400",
  doctrine: "text-gray-400",
};

/**
 * World War 1936 P1 (spec §13.4): the research drawer — the slots on top
 * (progress, days left, the ahead-of-time penalty; two taps cancel), the
 * seven branches as tabs, one card per tech. Tapping an available card
 * starts it in a free slot, or says there is none.
 */
@customElement("ww-research-panel")
export class WwResearchPanel extends WwDrawerBase {
  protected readonly drawerId = "research" as const;
  @state() private branch: TechBranch | "projects" = "infantry";
  private readonly tabPick: Record<string, number> = {};
  /** The card tapped while it could not start, and why. */
  @state() private refused: { tech: WwTechId; block: WwOrderBlock } | null =
    null;
  private readonly twoTap = new TwoTap();
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwResearchEvent, () => this.setOpen(!this.open));
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "projects") return;
      this.branch = "projects";
      this.setOpen(true);
    });
  }

  protected setOpen(open: boolean) {
    this.refused = null;
    super.setOpen(open);
  }

  private detail(): WwCountryDetail | null {
    const me = this.game?.myPlayer() ?? null;
    if (me === null || this.game.worldWarScenario() === null) return null;
    return this.game.wwEconomy?.()?.detail(me.smallID()) ?? null;
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const key = [
      this.detail(),
      this.game.worldWarScenario() ? today(this.game) : 0,
      // Automation: the head's switch.
      autoMaskOf(this.game, this.game.myPlayer()?.smallID() ?? 0),
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private tabUi(): TabUi {
    const sc = this.game.worldWarScenario()!;
    return {
      send: (o) => this.eventBus.emit(new SendWwOrderIntentEvent(o)),
      confirm: (k, act) => {
        if (this.twoTap.tap(k, Date.now())) act();
        this.requestUpdate();
        setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
      },
      armed: (k) => this.twoTap.isArmed(k, Date.now()),
      redraw: () => this.requestUpdate(),
      me: this.game.myPlayer()?.smallID() ?? 0,
      regionName: (r) => sc.region(r)?.name ?? String(r),
      name: (id) => {
        const tag = sc.tagOfSmallId(id);
        return tag === undefined ? "?" : countryName(tag);
      },
      pick: this.tabPick,
    };
  }

  private send(tech: WwTechId) {
    this.eventBus.emit(new SendWwOrderIntentEvent({ kind: "research", tech }));
  }

  private tapCard(d: WwCountryDetail, card: ResearchCard) {
    // Checked again on the tap: the drawer may show an older render.
    const block = researchBlock(d, card.id);
    if (block !== null) {
      this.refused = { tech: card.id, block };
      return;
    }
    this.refused = null;
    this.send(card.id);
  }

  private tapSlot(slot: SlotRow) {
    const key = `cancel_research:${slot.index}:${slot.tech}`;
    if (this.twoTap.tap(key, Date.now())) {
      this.eventBus.emit(
        new SendWwOrderIntentEvent({
          kind: "cancel_research",
          slot: slot.index,
        }),
      );
    }
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  render() {
    if (!this.open) return null;
    const d = this.detail();
    if (d === null) return null;
    const me = this.game.myPlayer()!;
    // P5 pre-flight §0-1: an exile still researches.
    if (!wwActive(this.game, me.smallID())) {
      // Gone or capitulated: the engine refuses every order.
      return this.renderFrame(
        translateText("ww1936.econ.research"),
        html`<span aria-hidden="true">🔬</span>
          <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
            ${translateText("ww1936.econ.research")}
          </h3>`,
        nothing,
        html`<p data-ww-block="dead" class="m-0 mt-2 text-xs text-red-300">
          🔒 ${blockText("dead")}
        </p>`,
      );
    }
    const day = today(this.game);
    const rows = researchSlots(d, day);
    const mask = autoMaskOf(this.game, me.smallID());
    const slots = this.renderSlots(rows);
    // Live report 2026-10-30: an empty slot waits for the player's pick
    // (the AI fills it only while auto research is on) — say so.
    const free = rows.filter((s) => s.tech === null && !s.paused).length;
    const prompt =
      free > 0 && !autoOnIn(mask, "research")
        ? html`<p
            data-ww-pick-prompt
            class="m-0 mt-1 rounded-md border border-yellow-300/60 bg-yellow-900/40 px-2 py-1 text-xs font-semibold text-yellow-100"
          >
            👉 ${translateText("ww1936.econ.pick_prompt", { n: free })}
          </p>`
        : nothing;
    const cards =
      this.branch === "projects"
        ? renderProjectsTab(new DepthIndustryModel(this.game), this.tabUi())
        : this.renderCards(d, researchCards(d, this.branch, day));
    return this.renderFrame(
      translateText("ww1936.econ.research"),
      html`<span aria-hidden="true">🔬</span>
        <h3 class="m-0 min-w-0 truncate text-sm font-bold">
          ${translateText("ww1936.econ.research")}
        </h3>
        ${renderAutoSwitch(
          "research",
          mask,
          (o) => this.eventBus.emit(new SendWwOrderIntentEvent(o)),
          true,
        )}`,
      this.renderTabs(
        [...TECH_BRANCHES, "projects"] as const,
        this.branch,
        (b) =>
          b === "projects"
            ? translateText("ww1936.project_ui.tab")
            : branchName(b),
        (b) => {
          this.branch = b;
          this.refused = null;
        },
      ),
      // The top bar holds the title, the tabs and the close button: the
      // slots open the list.
      html`${slots}${prompt}${cards}`,
    );
  }

  private renderSlots(slots: SlotRow[]): TemplateResult {
    return html`<div
      data-ww-slots
      class="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1"
    >
      ${slots.map((s) => {
        if (s.tech === null) {
          return html`<div
            data-ww-slot=${s.index}
            data-empty
            class="flex h-10 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-white/25 px-1 text-xs text-white/50"
          >
            <span class="truncate"
              >${translateText("ww1936.econ.slot_empty")}</span
            >
          </div>`;
        }
        const key = `cancel_research:${s.index}:${s.tech}`;
        const armed = this.twoTap.isArmed(key, Date.now());
        return html`<button
          type="button"
          data-ww-slot=${s.index}
          data-armed=${String(armed)}
          aria-label=${`${techName(s.tech)} · ${translateText(
            armed ? "ww1936.econ.cancel_tap" : "ww1936.econ.cancel_research",
          )}`}
          class="flex h-10 w-36 shrink-0 items-center gap-1 rounded-md border px-1 text-left ${armed
            ? "border-red-400 bg-red-900/60"
            : "border-sky-400/40 bg-sky-950/40"} ${s.paused
            ? "opacity-50"
            : ""}"
          @click=${() => this.tapSlot(s)}
        >
          <span class="relative size-8 shrink-0">
            ${ringSvg(s.progress, s.paused ? "grey" : "science")}
            <span
              class="relative flex size-full items-center justify-center text-[10px] font-bold tabular-nums"
              >${Math.floor(s.progress * 100)}%</span
            >
          </span>
          <span class="min-w-0 flex-1 leading-tight">
            <span class="block truncate text-xs font-semibold"
              >${armed
                ? translateText("ww1936.econ.cancel_tap")
                : techName(s.tech)}</span
            >
            <span class="block truncate text-[10px] text-white/70"
              >${translateText("ww1936.econ.days_left", {
                n: s.daysLeft,
              })}${s.ahead > 0
                ? html` ·
                    <span data-ww-ahead class="text-amber-300"
                      >${translateText("ww1936.econ.ahead", {
                        n: s.ahead,
                      })}</span
                    >`
                : nothing}</span
            >
          </span>
        </button>`;
      })}
    </div>`;
  }

  private renderCards(
    d: WwCountryDetail,
    cards: ResearchCard[],
  ): TemplateResult {
    if (this.branch !== "doctrine" && this.branch !== "projects") {
      return html`<ul
        data-ww-cards
        class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0"
      >
        ${cards.map((c) => this.renderCard(d, c))}
      </ul>`;
    }
    // P6 plan decision 25 (review "rest" 1): every doctrine tech is retired;
    // a short line says where the doctrines went.
    if (cards.length === 0) {
      return html`<p
        data-ww-cards
        data-ww-doctrine-moved
        class="mt-2 text-xs text-white/60"
      >
        ${translateText("ww1936.econ.doctrine_moved")}
      </p>`;
    }
    // One school only (spec §9.3): the cards by school, under its name
    // (P6 plan decision 25: a school whose techs are all retired is not shown).
    return html`<div data-ww-cards class="mt-2 flex flex-col gap-2">
      ${DOCTRINE_SCHOOLS.filter((school) =>
        cards.some((c) => c.school === school),
      ).map(
        (school) =>
          html`<section data-ww-school=${school}>
            <div
              class="mb-1 text-xs font-bold uppercase tracking-wide text-white/70"
            >
              ${schoolName(school)}
            </div>
            <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
              ${cards
                .filter((c) => c.school === school)
                .map((c) => this.renderCard(d, c))}
            </ul>
          </section>`,
      )}
    </div>`;
  }

  private renderCard(d: WwCountryDetail, c: ResearchCard): TemplateResult {
    const unlock = techUnlock(c.id);
    const refused = this.refused?.tech === c.id ? this.refused.block : null;
    return html`<li>
      <button
        type="button"
        data-ww-tech=${c.id}
        data-state=${c.state}
        ?disabled=${c.state !== "available"}
        class="flex w-full min-h-11 flex-col gap-0.5 rounded-md border p-2 text-left disabled:cursor-default ${CARD_LOOK[
          c.state
        ]}"
        @click=${() => this.tapCard(d, c)}
      >
        <span class="flex items-baseline gap-2">
          <span class="min-w-0 flex-1 truncate text-sm font-bold"
            >${techName(c.id)}</span
          >
          <span class="text-xs tabular-nums text-white/60">${c.year}</span>
        </span>
        <span data-ww-effects class="text-xs text-white/80"
          >${effectLines(c.id).join(" · ")}</span
        >
        ${unlock !== null && stockOnly(unlock.equipment)
          ? html`<span class="text-[11px] text-sky-300"
              >${translateText("ww1936.econ.stock_only")}</span
            >`
          : nothing}
        <span class="flex items-baseline justify-between gap-2 text-xs">
          <span data-ww-card-state class=${STATE_COLOR[c.state]}
            >${translateText(STATE_KEYS[c.state])}</span
          >
          ${c.state === "done"
            ? nothing
            : html`<span class="tabular-nums text-white/70"
                >${translateText("ww1936.econ.days_left", {
                  n: c.etaDays,
                })}${c.ahead > 0
                  ? html` ·
                      <span class="text-amber-300"
                        >${translateText("ww1936.econ.ahead", {
                          n: c.ahead,
                        })}</span
                      >`
                  : nothing}</span
              >`}
        </span>
        ${c.saved > 0 && c.state !== "done"
          ? html`<span data-ww-saved class="flex flex-col gap-0.5">
              <span class="text-[11px] text-cyan-200"
                >${translateText("ww1936.econ.saved_progress", {
                  n: Math.floor(c.saved * 100),
                })}</span
              >
              <span class="h-1 w-full overflow-hidden rounded bg-white/15"
                ><span
                  class="block h-full bg-cyan-300"
                  style="width: ${Math.floor(c.saved * 100)}%"
                ></span
              ></span>
            </span>`
          : nothing}
        ${refused === null
          ? nothing
          : html`<span data-ww-block=${refused} class="text-xs text-red-300"
              >🔒 ${blockText(refused)}</span
            >`}
      </button>
    </li>`;
  }
}
