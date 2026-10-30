import type { WwOrder } from "@openfront/engine-api/Schemas";
import { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { historicalAiActive } from "@openfront/engine-lib/ww1936/Pace";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { factionDotClass } from "../../components/ww1936/FactionDot";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  COMPACT_MAX_HEIGHT,
  DrawerInsets,
  drawerInsets,
} from "../domestic/DomesticPanel";
import { DepthMiscModel } from "./DepthMiscModel";
import type { WarCard } from "./EndgameModel";
import { countryBadges, endgameKey } from "./EndgameModel";
import { countryText } from "./EndgameNames";
import {
  canAct,
  factionTab,
  FactionView,
  flagUrl,
  type Gate,
  lostVpPct,
  politicsInput,
  type PoliticsModelInput,
  TreatyRow,
  treatyTab,
  warGoalTab,
  worldTab,
} from "./PoliticsModel";
import { whitePeaceButton } from "./WhitePeaceModel";
import {
  countryName,
  diplomacyModel,
  factionName,
  today,
  TWO_TAP_MS,
  TwoTap,
  WW_BAND_PX,
} from "./WorldWarModel";
import { type AidPreset, OpenWwAidEvent } from "./WwAidTab";
import {
  OpenWwDiplomacyEvent,
  WW_DIPLOMACY_TABS,
  WwDiplomacyTab,
  WwDrawerEvent,
} from "./WwDrawer";
import { renderFactionRules, renderRelations } from "./WwFactionRulesCard";
import {
  WwClosePanelEvent,
  WwPanelMinimizedEvent,
  wwPanelStyle,
} from "./WwPanelMode";
import "./WwSubjectsTab";
import { ToggleWwDiplomacyEvent } from "./WwTopBand";
import { renderTreaty } from "./WwTreatyCard";
import { pastConferencesTemplate, warCardsTemplate } from "./WwWarsTab";

/**
 * P5 (spec §20.5): P3's four tabs with aid and subjects between treaties
 * and the world — on a phone they scroll sideways, an icon and a short name each.
 */
export type DiploDrawerTab = WwDiplomacyTab | "aid" | "subjects";
export const DIPLO_DRAWER_TABS: readonly DiploDrawerTab[] = [
  WW_DIPLOMACY_TABS[0],
  WW_DIPLOMACY_TABS[1],
  WW_DIPLOMACY_TABS[2],
  "aid",
  "subjects",
  WW_DIPLOMACY_TABS[3],
];
const TAB_ICONS: Readonly<Record<DiploDrawerTab, string>> = {
  factions: "🤝",
  wars: "⚔",
  treaties: "📜",
  aid: "📦",
  subjects: "👑",
  world: "🌐",
};

function tabLabel(t: DiploDrawerTab): string {
  if (t === "aid") return translateText("ww1936.aid.tab");
  if (t === "subjects") return translateText("ww1936.subject.tab");
  return translateText(`ww1936.diplo.tab.${t}`);
}

/** Camps listed under "if the war ended now" (mine is always added). */
const SHOWN_CAMPS = 6;
/** Space between the drawer and the HUD around it, in CSS px. */
const GAP = 8;
const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";

/**
 * World War 1936 (spec §8.2; P3 spec §21.5): a right-hand drawer with four
 * tabs — factions (mine with its leader, members and ideology: invite,
 * leave, expel, found, dissolve; the others, and a request to join one),
 * wars and goals (my wars, my war goals, my justification, who justifies
 * against me), treaties (guarantees, pacts, access; two taps end one) and
 * the world (tension with its thresholds, who made the most, the camp
 * scores, the next history beat, the last 30 world news).
 *
 * It keeps the map's centre and the HUD around it clear: right of the
 * screen's middle (at most 420 px wide), below the band and the top-right
 * sidebar, above the bottom HUD's rows (the attack ratio), left of the map
 * buttons — the domestic drawer's insets. Under the hover card (z-1001), so
 * a tapped country's card stays readable. On a short landscape screen (at
 * most COMPACT_MAX_HEIGHT tall, like the domestic drawer) that HUD would
 * squeeze it to nothing, so it runs from below the band to the bottom edge
 * over the top-right stack and the bottom rows instead (the tabs beside the
 * close button); and it is never shorter than 15rem (min-h-60).
 */
@customElement("ww-diplomacy-panel")
export class WwDiplomacyPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private open = false;
  @state() private minimized = false;
  @state() private tab: DiploDrawerTab = "factions";
  /** P5: the aid tab's walk started from the player panel (OpenWwAidEvent). */
  @state() private aidPreset: AidPreset | null = null;
  /** Bumped with each redraw, so the aid and subjects tabs (own elements) redraw too. */
  private stamp = 0;
  /** The leader's invite list is unfolded. */
  @state() private inviting = false;
  @state() private insets: DrawerInsets = {
    top: WW_BAND_PX + GAP,
    right: GAP,
    bottom: GAP,
  };
  /** A short landscape screen: below the band down to the bottom edge. */
  @state() private compact = false;
  private readonly twoTap = new TwoTap();
  private unregisterBack: (() => void) | null = null;
  private redrawKey: readonly unknown[] = [];
  private readonly refit = () => {
    const i = drawerInsets();
    this.compact = window.innerHeight <= COMPACT_MAX_HEIGHT;
    this.insets = this.compact
      ? { top: WW_BAND_PX + GAP, right: i.right, bottom: GAP }
      : { ...i, top: Math.max(i.top, WW_BAND_PX + GAP) };
  };

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(ToggleWwDiplomacyEvent, () => this.setOpen(!this.open));
    this.eventBus.on(OpenWwDiplomacyEvent, (e) => {
      if (this.open && (e.tab === null || e.tab === this.tab)) {
        this.setOpen(false);
        return;
      }
      if (e.tab !== null) this.tab = e.tab;
      this.setOpen(true);
    });
    // P5 (spec §20.7): the player panel's "send lend-lease" / "ask for it".
    this.eventBus.on(OpenWwAidEvent, (e) => {
      this.aidPreset = {
        to: e.to,
        mode: e.mode,
        nonce: (this.aidPreset?.nonce ?? 0) + 1,
      };
      this.tab = "aid";
      this.setOpen(true);
    });
    // One drawer at a time (P1 pre-flight R7.2): another one opening closes this.
    this.eventBus.on(WwDrawerEvent, (e) => {
      if (e.open && e.drawer !== "diplomacy") this.setOpen(false);
    });
    this.eventBus.on(WwPanelMinimizedEvent, (e) => {
      if (this.open) this.minimized = e.minimized;
    });
    this.eventBus.on(WwClosePanelEvent, () => this.setOpen(false));
    // Back closes the drawer before it asks to leave the game.
    this.unregisterBack?.();
    this.unregisterBack = registerBackClosable(() => {
      if (!this.open) return false;
      this.setOpen(false);
      return true;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unregisterBack?.();
    this.unregisterBack = null;
    window.removeEventListener("resize", this.refit);
  }

  isOpen(): boolean {
    return this.open;
  }

  /** The tab on show. */
  shownTab(): DiploDrawerTab {
    return this.tab;
  }

  private setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    this.minimized = false;
    if (open) {
      this.refit();
      window.addEventListener("resize", this.refit);
    } else {
      window.removeEventListener("resize", this.refit);
    }
    this.eventBus.emit(new WwDrawerEvent("diplomacy", open));
  }

  getTickIntervalMs() {
    return 500;
  }

  tick() {
    if (!this.open) return;
    // The HUD around the drawer grows and shrinks during the game.
    this.refit();
    // Redraw when politics, the wars or the day change (not every tick).
    const me = this.game?.myPlayer()?.smallID() ?? 0;
    const key = [
      this.game?.wwPolitics?.()?.version ?? 0,
      this.game?.worldWarData() ?? null,
      this.game?.worldWarScenario() ? today(this.game) : 0,
      // P5: the endgame (wars, aid, subjects, exiles); the aid tab's stock and armies.
      this.game ? endgameKey(this.game) : 0,
      this.tab === "aid" ? (this.game?.wwEconomy?.()?.detail(me) ?? null) : 0,
      this.tab === "aid" ? (this.game?.wwLand?.()?.version ?? 0) : 0,
      this.game?.wwDepth?.()?.version ?? 0,
    ];
    if (key.some((v, n) => v !== this.redrawKey[n])) {
      this.redrawKey = key;
      this.stamp++;
      this.requestUpdate();
    }
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  private flag(tag: CountryTag) {
    return html`<img
      src=${flagUrl(tag)}
      alt=""
      class="h-3 w-4 shrink-0 rounded-sm object-cover"
    />`;
  }

  render() {
    if (!this.open || !this.game?.worldWarScenario()) return null;
    const i = politicsInput(this.game);
    const tabs = html`<div
      role="tablist"
      class="flex min-w-0 flex-1 gap-1 overflow-x-auto"
    >
      ${DIPLO_DRAWER_TABS.map(
        (t) =>
          html`<button
            type="button"
            role="tab"
            data-ww-tab=${t}
            aria-selected=${String(t === this.tab)}
            class="flex h-9 min-w-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold ${t ===
            this.tab
              ? "bg-white/15 text-white"
              : "text-white/70 hover:bg-white/10"}"
            @click=${() => {
              this.tab = t;
              this.inviting = false;
              this.redrawKey = [];
              this.tick();
            }}
          >
            <span aria-hidden="true">${TAB_ICONS[t]}</span>
            <span class="max-w-24 truncate">${tabLabel(t)}</span>
          </button>`,
      )}
    </div>`;
    const close = html`<button
      type="button"
      data-ww-diplomacy-close
      class="size-9 shrink-0 rounded-md hover:bg-white/10"
      aria-label=${translateText("common.close")}
      @click=${() => this.setOpen(false)}
    >
      ✕
    </button>`;
    return html`
      <aside
        data-ww-diplomacy
        aria-label=${translateText("ww1936.panel.title")}
        class="fixed z-[1002] flex flex-col overflow-hidden bg-gray-900 text-sm text-white"
        style=${wwPanelStyle(this.minimized)}
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div
          data-ww-drawer-head
          class="flex shrink-0 items-center gap-1 border-b border-white/10 py-0.5 pl-3 pr-1"
        >
          <span aria-hidden="true">🌐</span>
          <h3 class="m-0 max-w-[30%] shrink-0 truncate text-sm font-bold">
            ${translateText("ww1936.panel.title")}
          </h3>
          ${tabs} ${close}
        </div>
        <div data-ww-scroll class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          ${this.renderTab(i)}
        </div>
      </aside>
    `;
  }

  private renderTab(i: PoliticsModelInput | null): TemplateResult {
    switch (this.tab) {
      case "factions":
        return this.renderFactions(i);
      case "wars":
        return this.renderWars(i);
      case "treaties":
        return i === null ? html`${nothing}` : this.renderTreaties(i);
      case "aid":
        return html`<ww-aid-tab
          .game=${this.game}
          .eventBus=${this.eventBus}
          .stamp=${this.stamp}
          .preset=${this.aidPreset}
        ></ww-aid-tab>`;
      case "subjects":
        return html`<ww-subjects-tab
          .game=${this.game}
          .eventBus=${this.eventBus}
          .stamp=${this.stamp}
        ></ww-subjects-tab>`;
      case "world":
        return this.renderWorld(i);
    }
  }

  private gateButton(
    id: string,
    label: string,
    gate: Gate,
    order: WwOrder,
  ): TemplateResult {
    return html`<span class="inline-flex flex-col">
      <button
        type="button"
        data-ww-act=${id}
        class=${BUTTON}
        ?disabled=${gate.block !== null}
        @click=${() => this.send(order)}
      >
        ${label}
        ${gate.cost === null
          ? nothing
          : html`<span class="font-normal text-white/60">· ${gate.cost}</span>`}
      </button>
      ${gate.block === null
        ? nothing
        : html`<span data-ww-act-block class="text-xs text-red-300"
            >${gate.block}</span
          >`}
    </span>`;
  }

  private twoTapButton(key: string, label: string, order: WwOrder) {
    const armed = this.armed(key);
    return html`<button
      type="button"
      data-ww-act=${order.kind}
      data-armed=${String(armed)}
      class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
      @click=${() => this.confirmTap(key, () => this.send(order))}
    >
      ${armed ? translateText("ww1936.pol.tap_again") : label}
    </button>`;
  }

  // ---- Factions ----

  private renderFaction(
    f: FactionView,
    mine: boolean,
    amLeader: boolean,
    request: Gate | null,
  ): TemplateResult {
    return html`<section data-ww-faction=${f.key} class="mb-3">
      <div class="${HEADING} flex items-center gap-1.5">
        <span class="size-2 rounded-full ${factionDotClass(f.key)}"></span>
        <span class="min-w-0 truncate">${f.name}</span>
      </div>
      ${f.leaderName === ""
        ? nothing
        : html`<div class="flex flex-wrap gap-x-3 text-xs text-white/70">
            <span data-ww-faction-leader
              >${translateText("ww1936.diplo.faction.leader", {
                country: f.leaderName,
              })}</span
            >
            ${f.ideology === ""
              ? nothing
              : html`<span class="flex items-center gap-1"
                  ><span
                    class="size-2 rounded-full"
                    style="background: ${f.ideologyColor}"
                  ></span
                  >${translateText("ww1936.diplo.faction.ideology", {
                    ideology: f.ideology,
                  })}</span
                >`}
          </div>`}
      ${mine
        ? html`<div class="mt-1 text-xs text-white/60">
            ${translateText("ww1936.diplo.faction.members")}
          </div>`
        : nothing}
      <ul class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs">
        ${f.members.map((x) => {
          const key = `kick:${x.id}`;
          return html`<li
            data-ww-member=${x.tag}
            class="flex items-center gap-1 ${x.out
              ? "text-white/40 line-through"
              : ""}"
          >
            ${this.flag(x.tag)}
            ${countryText(this.game, x.id) || x.name}${x.leader ? " ★" : ""}
            ${this.badges(x.id)}
            ${mine && amLeader && !x.leader
              ? this.twoTapButton(
                  key,
                  translateText("ww1936.diplo.faction.kick"),
                  { kind: "faction_kick", target: x.id },
                )
              : nothing}
          </li>`;
        })}
      </ul>
      ${request === null || f.leader <= 0
        ? nothing
        : html`<div class="mt-1">
            ${this.gateButton(
              "faction_request",
              translateText("ww1936.diplo.faction.request"),
              request,
              { kind: "faction_request", target: f.leader },
            )}
          </div>`}
    </section>`;
  }

  private renderFactions(i: PoliticsModelInput | null): TemplateResult {
    if (i === null) {
      // A spectator: the factions and their members.
      const m = diplomacyModel(this.game);
      return html`${m.factions.map(
        (f) =>
          html`<section data-ww-faction=${f.id} class="mb-3 mt-2">
            <div class="${HEADING} flex items-center gap-1.5">
              <span class="size-2 rounded-full ${factionDotClass(f.id)}"></span>
              ${factionName(f.id, this.game)}
            </div>
            <ul
              class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs"
            >
              ${f.members.map(
                (x) =>
                  html`<li
                    data-ww-member=${x.tag}
                    class="flex items-center gap-1 ${x.capitulated || !x.alive
                      ? "text-white/40 line-through"
                      : ""}"
                  >
                    ${this.flag(x.tag)} ${countryName(x.tag)}
                    ${this.badges(
                      this.game.worldWarScenario()?.smallIdOf(x.tag) ?? 0,
                    )}
                  </li>`,
              )}
            </ul>
          </section>`,
      )}`;
    }
    const t = factionTab(i);
    const act = canAct(i);
    const misc = new DepthMiscModel(this.game);
    return html`
      <div class=${HEADING}>${translateText("ww1936.diplo.faction.mine")}</div>
      ${t.mine === null
        ? html`<p data-ww-no-faction class="m-0 text-xs text-white/60">
              ${translateText("ww1936.diplo.faction.none")}
            </p>
            ${act && t.create !== null
              ? html`<div class="mt-1">
                  ${this.gateButton(
                    "faction_create",
                    translateText("ww1936.diplo.faction.create"),
                    t.create,
                    { kind: "faction_create" },
                  )}
                </div>`
              : nothing}`
        : html`${this.renderFaction(t.mine, true, t.amLeader && act, null)}
          ${act
            ? html`<div class="flex flex-wrap gap-1">
                ${t.amLeader
                  ? html`<button
                      type="button"
                      data-ww-invite-open
                      aria-expanded=${String(this.inviting)}
                      class=${BUTTON}
                      @click=${() => (this.inviting = !this.inviting)}
                    >
                      ${translateText("ww1936.diplo.faction.invite")}
                    </button>`
                  : nothing}
                ${this.twoTapButton(
                  "faction_leave",
                  translateText("ww1936.diplo.faction.leave"),
                  { kind: "faction_leave" },
                )}
                ${t.amLeader
                  ? this.twoTapButton(
                      "faction_dissolve",
                      translateText("ww1936.diplo.faction.dissolve"),
                      { kind: "faction_dissolve" },
                    )
                  : nothing}
              </div>`
            : nothing}
          ${this.inviting && t.amLeader && act
            ? html`<ul
                data-ww-invite-list
                class="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-xs"
              >
                ${t.invite.map(
                  (x) =>
                    html`<li class="flex items-center gap-2">
                      ${this.flag(x.tag)}
                      <span class="min-w-0 flex-1 truncate">${x.name}</span>
                      ${this.gateButton(
                        "faction_invite",
                        translateText("ww1936.diplo.faction.invite"),
                        x.gate,
                        { kind: "faction_invite", target: x.id },
                      )}
                    </li>`,
                )}
              </ul>`
            : nothing}`}
      ${t.mine === null
        ? nothing
        : renderFactionRules(misc.factionRuleRows(), misc.goalSlots(), {
            armed: (k) => this.armed(k),
            tap: (k, order) => this.confirmTap(k, () => this.send(order)),
            send: (order) => this.send(order),
          })}
      ${t.others.length === 0
        ? nothing
        : html`<div class=${HEADING}>
              ${translateText("ww1936.diplo.faction.others")}
            </div>
            ${t.others.map((f) =>
              this.renderFaction(f, false, false, act ? f.request : null),
            )}`}
    `;
  }

  // ---- Wars and war goals ----

  /**
   * White peace (owner-approved plan §6): my ongoing war's offer button —
   * "Whole war" when I lead my side, else "Separate peace (leaves the
   * faction)"; two taps send it; greyed with the reason; "waiting for the
   * answer" while my offer stands.
   */
  private renderWhitePeace(c: WarCard, me: number) {
    if (c.ended || c.mySide < 0) return nothing;
    const w = this.game.wwEndgame?.()?.wars.find((x) => x.id === c.id);
    const b = w === undefined ? null : whitePeaceButton(this.game, me, w);
    if (b === null) return nothing;
    const key = `wpeace:${b.war}:${b.target}`;
    const armed = this.armed(key);
    return html`<div
      data-ww-wpeace-row=${b.war}
      class="mt-1 flex flex-wrap items-center gap-1.5"
    >
      ${b.pending
        ? html`<span data-ww-wpeace-pending class="text-xs text-amber-200"
            >${translateText("ww1936.wpeace.pending")}</span
          >`
        : html`<button
            type="button"
            data-ww-act="peace_offer"
            data-armed=${String(armed)}
            class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
            ?disabled=${b.block !== null}
            @click=${() => this.confirmTap(key, () => this.send(b.order))}
          >
            ${armed
              ? translateText("ww1936.pol.tap_again")
              : translateText("ww1936.wpeace.offer")}
          </button>`}
      <span class="text-xs text-white/60">${b.scope}</span>
      ${b.block === null || b.pending
        ? nothing
        : html`<span data-ww-wpeace-block class="text-xs text-red-300"
            >${b.block}</span
          >`}
    </div>`;
  }

  private renderWars(i: PoliticsModelInput | null): TemplateResult {
    const m = diplomacyModel(this.game);
    // P5 (spec §20.5): the war records first, the past conferences last.
    const me = this.game.myPlayer()?.smallID() ?? 0;
    const cards = warCardsTemplate(this.game, me, (c) =>
      this.renderWhitePeace(c, me),
    );
    const past = pastConferencesTemplate(this.game);
    const myWars = html`<div class=${HEADING}>
        ${translateText("ww1936.panel.my_wars")}
      </div>
      ${m.myWars.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.diplo.wars.none")}
          </p>`
        : html`<ul
            data-ww-my-wars
            class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs"
          >
            ${m.myWars.map(
              // P4 (plan decision 33): landings reach a war across the sea,
              // so it is no longer marked "overseas".
              (tag) =>
                html`<li class="flex items-center gap-1">
                  ${this.flag(tag)} ${countryName(tag)}
                </li>`,
            )}
          </ul>`}`;
    if (i === null) return html`${cards} ${myWars} ${past}`;
    const t = warGoalTab(i);
    const s = i.view.summary(i.me);
    const j = t.justification;
    return html`
      ${cards}
      ${s === null
        ? nothing
        : html`<p data-ww-surrender class="m-0 mt-2 text-xs text-white/70">
            ${translateText("ww1936.diplo.surrender", {
              pct: s.surrenderPct,
              lost: lostVpPct(i),
            })}
          </p>`}
      ${myWars}
      <div class=${HEADING}>${translateText("ww1936.diplo.wars.goals")}</div>
      ${t.goals.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.diplo.wars.none_goals")}
          </p>`
        : html`<ul data-ww-goals class="m-0 list-none p-0 text-xs">
            ${t.goals.map((g) => html`<li>${g}</li>`)}
          </ul>`}
      ${j === null
        ? nothing
        : html`<div class=${HEADING}>
              ${translateText("ww1936.diplo.wars.justifying")}
            </div>
            <section data-ww-justifying class="text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="min-w-0">${j.text}</span>
                ${canAct(i)
                  ? this.twoTapButton(
                      "justify_cancel",
                      translateText("ww1936.diplo.act.justify_cancel"),
                      { kind: "justify_cancel" },
                    )
                  : nothing}
              </div>
              <div class="mt-1 h-1.5 rounded bg-white/10">
                <div
                  class="h-1.5 rounded ${j.blocked === null
                    ? "bg-amber-400"
                    : "bg-gray-500"}"
                  style="width: ${Math.round(j.progress * 100)}%"
                ></div>
              </div>
              ${j.blocked === null
                ? nothing
                : html`<span data-ww-justify-blocked class="text-red-300"
                    >${j.blocked}</span
                  >`}
            </section>`}
      <div class=${HEADING}>${translateText("ww1936.diplo.wars.against")}</div>
      ${t.against.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.diplo.wars.none_against")}
          </p>`
        : html`<ul
            data-ww-against
            class="m-0 list-none p-0 text-xs font-semibold text-red-300"
          >
            ${t.against.map((a) => html`<li>${a}</li>`)}
          </ul>`}
      ${past}
    `;
  }

  /** P5 (spec §20.5–§20.6): "Exile" and "Subject" beside a country's name. */
  private badges(id: number) {
    return countryBadges(this.game, id).map(
      (b) =>
        html`<span
          data-ww-badge
          class="rounded border border-amber-300/50 px-1 text-xs text-amber-200 no-underline"
          >${b}</span
        >`,
    );
  }

  // ---- Treaties ----

  private renderTreaties(i: PoliticsModelInput): TemplateResult {
    const t = treatyTab(i);
    const act = canAct(i);
    const section = (id: string, key: string, rows: TreatyRow[]) =>
      html`<section data-ww-treaties=${id}>
        <div class=${HEADING}>${translateText(key)}</div>
        ${rows.length === 0
          ? html`<p class="m-0 text-xs text-white/60">
              ${translateText("ww1936.diplo.treaties.none")}
            </p>`
          : html`<ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
              ${rows.map((r) => this.renderTreatyRow(id, r, act))}
            </ul>`}
      </section>`;
    return html`
      ${section("given", "ww1936.diplo.treaties.given", t.given)}
      ${section("received", "ww1936.diplo.treaties.received", t.received)}
      ${section("nap", "ww1936.diplo.treaties.nap", t.naps)}
      ${section(
        "access_given",
        "ww1936.diplo.treaties.access_given",
        t.accessGiven,
      )}
      ${section(
        "access_received",
        "ww1936.diplo.treaties.access_received",
        t.accessReceived,
      )}
      ${renderTreaty(
        new DepthMiscModel(this.game).treatyRows(),
        act,
        this.armed("treaty_leave"),
        () =>
          this.confirmTap("treaty_leave", () =>
            this.send({ kind: "treaty_leave" }),
          ),
        (tag) => this.flag(tag),
      )}
    `;
  }

  private renderTreatyRow(
    id: string,
    r: TreatyRow,
    act: boolean,
  ): TemplateResult {
    const key = `end:${id}:${r.id}`;
    const armed = this.armed(key);
    const end = r.end;
    return html`<li data-ww-treaty=${r.id} class="flex items-center gap-2">
      ${r.tag === null ? nothing : this.flag(r.tag)}
      <span class="min-w-0 flex-1">
        <span class="block truncate">${r.name}</span>
        ${r.note === null
          ? nothing
          : html`<span class="block text-white/60">${r.note}</span>`}
        ${end?.block
          ? html`<span class="block text-red-300">${end.block}</span>`
          : nothing}
      </span>
      ${end === null || !act
        ? nothing
        : html`<button
            type="button"
            data-ww-end=${id}
            data-armed=${String(armed)}
            class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
            ?disabled=${end.block !== null}
            @click=${() => this.confirmTap(key, () => this.send(end.order))}
          >
            ${armed
              ? translateText("ww1936.pol.tap_again")
              : translateText("ww1936.diplo.treaties.end")}
          </button>`}
    </li>`;
  }

  // ---- The world ----

  private renderWorld(i: PoliticsModelInput | null): TemplateResult {
    const m = diplomacyModel(this.game);
    const camps = m.camps.filter((c, n) => n < SHOWN_CAMPS || c.mine);
    const w = i === null ? null : worldTab(i);
    // As the engine's AI: it follows history until V-J Day.
    const nextBeat =
      m.nextHistory !== null &&
      historicalAiActive(this.game.config(), today(this.game))
        ? translateText("ww1936.diplo.world.next_beat", {
            date: m.nextHistory,
          })
        : null;
    return html`
      ${w === null
        ? nothing
        : html`<div class="${HEADING} flex justify-between">
              <span>${translateText("ww1936.diplo.world.tension")}</span>
              <span data-ww-tension class="normal-case tabular-nums"
                >${w.wtPct}%</span
              >
            </div>
            <div class="relative h-2 rounded bg-white/10">
              <div
                class="h-2 rounded bg-orange-400"
                style="width: ${Math.min(100, w.wtBp / 100)}%"
              ></div>
              ${w.ticks.map(
                (t) =>
                  html`<span
                    data-ww-tick=${t}
                    class="absolute top-0 h-2 w-px bg-white/70"
                    style="left: ${t}%"
                  ></span>`,
              )}
            </div>
            <div class="relative h-4 text-xs text-white/50">
              ${w.ticks.map(
                (t) =>
                  html`<span
                    class="absolute -translate-x-1/2"
                    style="left: ${t}%"
                    >${t}</span
                  >`,
              )}
            </div>
            ${w.top.length === 0
              ? nothing
              : html`<div class=${HEADING}>
                    ${translateText("ww1936.diplo.world.top")}
                  </div>
                  <ul data-ww-threats class="m-0 list-none p-0 text-xs">
                    ${w.top.map(
                      (x) =>
                        html`<li class="flex items-center gap-1">
                          ${x.tag === null ? nothing : this.flag(x.tag)}
                          <span class="min-w-0 flex-1 truncate">${x.name}</span>
                          <span class="tabular-nums">${x.pct}</span>
                        </li>`,
                    )}
                  </ul>`}`}
      <section class="mb-3">
        <div class=${HEADING}>${translateText("ww1936.panel.scores")}</div>
        ${camps.map(
          (c) =>
            html`<div data-ww-camp class="mb-1">
              <div
                class="flex justify-between gap-2 text-xs ${c.mine
                  ? "font-bold text-amber-300"
                  : ""}"
              >
                <span class="truncate">${c.name}</span
                ><span class="tabular-nums"
                  >${(c.scoreBp / 100).toFixed(1)}%</span
                >
              </div>
              <div class="h-1.5 rounded bg-white/10">
                <div
                  class="h-1.5 rounded ${c.mine
                    ? "bg-amber-400"
                    : "bg-white/60"}"
                  style="width: ${c.scoreBp / 100}%"
                ></div>
              </div>
            </div>`,
        )}
      </section>
      ${nextBeat === null
        ? nothing
        : html`<p data-ww-next class="m-0 text-xs text-white/70">
            ${nextBeat}
          </p>`}
      ${w === null
        ? nothing
        : (() => {
            const r = new DepthMiscModel(this.game).relationRows();
            return renderRelations(r.best, r.worst, (tag) => this.flag(tag));
          })()}
      ${w === null
        ? nothing
        : html`<div class=${HEADING}>
              ${translateText("ww1936.diplo.world.news")}
            </div>
            ${w.news.length === 0
              ? html`<p class="m-0 text-xs text-white/60">
                  ${translateText("ww1936.diplo.world.news_none")}
                </p>`
              : html`<ul
                  data-ww-news-list
                  class="m-0 flex list-none flex-col gap-1 p-0 text-xs"
                >
                  ${w.news.map(
                    (n) =>
                      html`<li class="flex items-start gap-1.5">
                        ${n.tag === null ? nothing : this.flag(n.tag)}
                        <span class="min-w-0">${n.text}</span>
                      </li>`,
                  )}
                </ul>`}`}
    `;
  }
}
