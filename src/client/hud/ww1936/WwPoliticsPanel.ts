import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { LawKind } from "@openfront/engine-api/ww1936/EconomyTypes";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import {
  CONGRESS_DECISIONS,
  DepthMiscModel,
  isBopDecision,
} from "./DepthMiscModel";
import { blockText } from "./EconomyModel";
import {
  AdvisorSeat,
  advisorTab,
  BarModel,
  canAct,
  decisionTab,
  DecisionView,
  flagUrl,
  governmentTab,
  LawStepView,
  lawTab,
  politicsInput,
  type PoliticsModelInput,
  spiritDesc,
  spiritName,
  spiritTab,
  TextLine,
  TONE_BAR_CLASS,
  TONE_CLASS,
} from "./PoliticsModel";
import { today, TWO_TAP_MS, TwoTap } from "./WorldWarModel";
import { renderBopBar } from "./WwBopBar";
import { renderCongressBar } from "./WwCongressTab";
import {
  OpenWwPoliticsEvent,
  WW_POLITICS_TABS,
  WwDrawerBase,
  WwPoliticsTab,
} from "./WwDrawer";

const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const CARD = "rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs";

/**
 * World War 1936 P3 (spec §21.4): the politics drawer — government (leader,
 * the ideology pie with its drift, the next election or a crisis, political
 * power by source, stability and war support with their lines and
 * effects), advisors (8 seats; a tapped empty seat lists its candidates),
 * the laws (moved from the industry drawer, with cost and thresholds),
 * national spirits and decisions. Every number and text comes from
 * PoliticsModel; every order is one ww_order intent.
 */
@customElement("ww-politics-panel")
export class WwPoliticsPanel extends WwDrawerBase {
  protected readonly drawerId = "politics" as const;
  @state() private tab: WwPoliticsTab = "government";
  /** The advisor seat whose candidates are listed; null: none. */
  @state() private pickSeat: number | null = null;
  private readonly twoTap = new TwoTap();
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwPoliticsEvent, (e) => this.onOpenEvent(e));
  }

  /** The tab on show. */
  shownTab(): WwPoliticsTab {
    return this.tab;
  }

  private onOpenEvent(e: OpenWwPoliticsEvent) {
    if (this.open && (e.tab === null || e.tab === this.tab)) {
      this.setOpen(false);
      return;
    }
    if (e.tab !== null) this.tab = e.tab;
    this.setOpen(true);
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const view = this.game?.wwPolitics?.() ?? null;
    const econ = this.game?.wwEconomy?.() ?? null;
    const id = this.game?.myPlayer()?.smallID() ?? 0;
    const key = [
      view?.version ?? 0,
      econ?.detail(id) ?? null,
      econ?.summary(id) ?? null,
      this.game?.worldWarScenario() ? today(this.game) : 0,
      this.game?.worldWarData() ?? null,
      this.game?.wwDepth?.()?.version ?? 0,
    ];
    if (key.some((v, n) => v !== this.redrawKey[n])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  /** An irreversible action: the first tap arms `key`, a second within 3 s acts. */
  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  render() {
    if (!this.open) return null;
    const i = this.game ? politicsInput(this.game) : null;
    if (i === null) return null;
    const dead = !canAct(i);
    return this.renderFrame(
      translateText("ww1936.pol.title"),
      html`<span aria-hidden="true">🏛</span>
        <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
          ${translateText("ww1936.pol.title")}
        </h3>`,
      dead
        ? nothing
        : this.renderTabs(
            this.tabList(),
            this.tab,
            (t) =>
              translateText(
                t === "congress"
                  ? "ww1936.congress.tab"
                  : `ww1936.pol.tab.${t}`,
              ),
            (t) => {
              this.tab = t;
              this.pickSeat = null;
              this.redrawKey = [];
              this.tick();
            },
          ),
      dead
        ? html`<p data-ww-block="dead" class="m-0 mt-2 text-xs text-red-300">
            🔒 ${blockText("dead")}
          </p>`
        : this.renderTab(i),
    );
  }

  private misc(): DepthMiscModel | null {
    return this.game === undefined ? null : new DepthMiscModel(this.game);
  }

  /** The five tabs, and the congress tab for the United States. */
  private tabList(): readonly WwPoliticsTab[] {
    return this.misc()?.congressBar() != null
      ? [...WW_POLITICS_TABS, "congress"]
      : WW_POLITICS_TABS;
  }

  /** The decisions of one list, the cards of the decisions tab. */
  private decisionCards(
    i: PoliticsModelInput,
    keep: (id: string) => boolean,
  ): TemplateResult {
    const ds = decisionTab(i)
      .groups.flatMap((g) => g.decisions)
      .filter((d) => keep(d.id));
    return html`<ul class="m-0 mt-2 flex list-none flex-col gap-1 p-0">
      ${ds.map((d) => this.renderDecision(d))}
    </ul>`;
  }

  private renderCongress(i: PoliticsModelInput): TemplateResult {
    const bar = this.misc()?.congressBar() ?? null;
    if (bar === null) return html`${nothing}`;
    return html`${renderCongressBar(bar)}
    ${this.decisionCards(i, (id) => CONGRESS_DECISIONS.includes(id))}`;
  }

  /** The balance-of-power bar and its decisions under the government. */
  private renderBop(i: PoliticsModelInput): TemplateResult {
    const m = this.misc();
    const tag = this.game?.myPlayer()?.countryTag() ?? null;
    const bar = tag === null ? null : (m?.bopBar(tag) ?? null);
    if (bar === null || tag === null) return html`${nothing}`;
    return html`${renderBopBar(bar, spiritName, spiritDesc)}
    ${this.decisionCards(i, (id) => isBopDecision(tag, id))}`;
  }

  private renderTab(i: PoliticsModelInput): TemplateResult {
    switch (this.tab) {
      case "congress":
        return this.renderCongress(i);
      case "government":
        return html`${this.renderGovernment(i)}${this.renderBop(i)}`;
      case "advisors":
        return this.renderAdvisors(i);
      case "laws":
        return this.renderLaws(i);
      case "spirits":
        return this.renderSpirits(i);
      case "decisions":
        return this.renderDecisions(i);
    }
  }

  private lines(lines: readonly TextLine[]): TemplateResult {
    return html`<ul class="m-0 list-none p-0">
      ${lines.map(
        (l) =>
          html`<li
            class="text-white/80"
            style="padding-left: ${l.depth * 0.75}rem"
          >
            ${l.text}
          </li>`,
      )}
    </ul>`;
  }

  // ---- Government ----

  private renderGovernment(i: PoliticsModelInput): TemplateResult {
    const g = governmentTab(i);
    if (g === null) return html`${nothing}`;
    return html`
      <section data-ww-gov class="mt-2 flex flex-col gap-1 text-xs">
        <div class="flex items-center gap-2">
          <span
            class="size-2.5 shrink-0 rounded-full"
            style="background: ${g.rulingColor}"
          ></span>
          <span class="text-white/60"
            >${translateText("ww1936.pol.gov.government")}</span
          >
          <b data-ww-government class="min-w-0 truncate">${g.government}</b>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-white/60"
            >${translateText("ww1936.pol.gov.leader")}</span
          >
          <b data-ww-leader class="min-w-0 truncate">${g.leader}</b>
        </div>
      </section>
      <div class=${HEADING}>${translateText("ww1936.pol.gov.support")}</div>
      <section data-ww-pie class="flex items-center gap-3 text-xs">
        <div
          class="size-16 shrink-0 rounded-full border border-white/20"
          style="background: ${g.pieGradient}"
          aria-hidden="true"
        ></div>
        <ul class="m-0 flex min-w-0 list-none flex-col gap-0.5 p-0">
          ${g.pie.map(
            (p) =>
              html`<li
                data-ww-ideology=${p.ideology}
                class="flex items-center gap-1.5"
              >
                <span
                  class="size-2 shrink-0 rounded-full"
                  style="background: ${p.color}"
                ></span>
                <span class="min-w-0 truncate"
                  >${translateText("ww1936.pol.gov.pop_line", {
                    ideology: p.name,
                    pct: p.pct,
                  })}</span
                >
                ${p.drift === null
                  ? nothing
                  : html`<span
                      data-ww-drift
                      class="shrink-0 ${p.driftUp
                        ? "text-emerald-300"
                        : "text-red-300"}"
                      >${p.drift}</span
                    >`}
              </li>`,
          )}
        </ul>
      </section>
      <p data-ww-election class="m-0 mt-1 text-xs text-amber-200">
        ${g.election}
      </p>
      ${g.crisis === null
        ? nothing
        : html`<p data-ww-crisis class="m-0 text-xs text-white/70">
            ${g.crisis}
          </p>`}
      <div class=${HEADING}>${translateText("ww1936.pol.gov.pp")}</div>
      <p data-ww-pp class="m-0 text-xs font-semibold">${g.pp}</p>
      <div class="mt-1 text-xs text-white/60">
        ${translateText("ww1936.pol.gov.pp_sources")}
      </div>
      <ul data-ww-pp-sources class="m-0 list-none p-0 text-xs">
        ${g.ppSources.map(
          (s) =>
            html`<li class="flex justify-between gap-2">
              <span class="text-white/70">${s.label}</span>
              <span class="text-right tabular-nums"
                >${s.values.join(" · ")}</span
              >
            </li>`,
        )}
      </ul>
      ${this.renderBar(
        "stability",
        translateText("ww1936.pol.gov.stability"),
        g.stability,
      )}
      ${this.renderBar(
        "war_support",
        translateText("ww1936.pol.gov.war_support"),
        g.warSupport,
      )}
      <p data-ww-surrender class="m-0 mt-2 text-xs text-white/70">
        ${g.surrender}
      </p>
    `;
  }

  private renderBar(id: string, title: string, b: BarModel): TemplateResult {
    return html`<section data-ww-bar=${id} class="text-xs">
      <div class="${HEADING} flex justify-between">
        <span>${title}</span>
        <span class="tabular-nums normal-case ${TONE_CLASS[b.tone]}"
          >${b.pct}%</span
        >
      </div>
      <div class="h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded ${TONE_BAR_CLASS[b.tone]}"
          style="width: ${Math.max(0, Math.min(100, b.pct))}%"
        ></div>
      </div>
      <ul class="m-0 mt-1 list-none p-0">
        <li class="text-white/70">${b.base}</li>
        ${b.lines.map(
          (l) =>
            html`<li data-ww-line class="flex justify-between gap-2">
              <span class="min-w-0 truncate text-white/70">${l.label}</span>
              <span
                class="shrink-0 tabular-nums ${l.negative
                  ? "text-red-300"
                  : "text-emerald-300"}"
                >${l.value}</span
              >
            </li>`,
        )}
      </ul>
      ${b.effects.length === 0
        ? nothing
        : html`<div class="mt-1 text-white/60">
              ${translateText("ww1936.pol.gov.effects")}
            </div>
            <ul data-ww-effects class="m-0 list-none p-0 text-white/80">
              ${b.effects.map((e) => html`<li>${e}</li>`)}
            </ul>`}
    </section>`;
  }

  // ---- Advisors ----

  private renderAdvisors(i: PoliticsModelInput): TemplateResult {
    const seats = advisorTab(i);
    const picked =
      this.pickSeat === null
        ? null
        : (seats.find((s) => s.index === this.pickSeat) ?? null);
    return html`
      <div data-ww-seats class="mt-2 grid grid-cols-2 gap-1.5">
        ${seats.map((s) => this.renderSeat(s))}
      </div>
      ${picked === null ? nothing : this.renderCandidates(picked)}
    `;
  }

  private renderSeat(s: AdvisorSeat): TemplateResult {
    const key = `fire:${s.index}`;
    const armed = this.armed(key);
    const h = s.holder;
    return html`<div
      data-ww-seat=${s.index}
      data-slot=${s.slot}
      class="${CARD} flex min-w-0 flex-col gap-0.5 ${this.pickSeat === s.index
        ? "border-amber-300"
        : ""}"
    >
      <span class="truncate text-xs uppercase tracking-wide text-white/60"
        >${s.slotName}</span
      >
      ${h === null
        ? html`<button
            type="button"
            data-ww-seat-pick
            class="min-h-9 rounded-md border border-dashed border-white/25 px-1 text-left text-white/70 hover:bg-white/10"
            @click=${() =>
              (this.pickSeat = this.pickSeat === s.index ? null : s.index)}
          >
            ${translateText("ww1936.pol.adv.empty")}
          </button>`
        : html`<b class="truncate">${h.name}</b>
            <span class="text-xs text-emerald-300"
              >${translateText("ww1936.pol.adv.in_seat")}</span
            >
            <span class="truncate text-white/70">${h.traits.join(", ")}</span>
            ${h.effects.map(
              (e) => html`<span class="text-white/80">${e}</span>`,
            )}
            ${h.until === null
              ? nothing
              : html`<span class="text-white/60">${h.until}</span>`}
            <span class="flex gap-1">
              <button
                type="button"
                data-ww-seat-pick
                class="${BUTTON} flex-1"
                ?disabled=${s.lockDays > 0}
                @click=${() =>
                  (this.pickSeat = this.pickSeat === s.index ? null : s.index)}
              >
                ${translateText("ww1936.pol.adv.replace")}
              </button>
              <button
                type="button"
                data-ww-fire=${s.index}
                data-armed=${String(armed)}
                class="${BUTTON} flex-1 ${armed ? "ring-2 ring-red-400" : ""}"
                ?disabled=${s.lockDays > 0}
                @click=${() =>
                  this.confirmTap(key, () =>
                    this.send({ kind: "advisor_fire", slot: s.index }),
                  )}
              >
                ${armed
                  ? translateText("ww1936.pol.tap_again")
                  : translateText("ww1936.pol.adv.fire")}
              </button>
            </span>`}
      ${s.locked === null
        ? nothing
        : html`<span data-ww-seat-locked class="text-amber-300"
            >${s.locked}</span
          >`}
    </div>`;
  }

  private renderCandidates(s: AdvisorSeat): TemplateResult {
    return html`<section data-ww-candidates=${s.index} class="mt-2">
      <div class="${HEADING} flex items-center justify-between">
        <span>${s.candidatesLabel}</span>
        <button
          type="button"
          class="size-9 rounded-md normal-case hover:bg-white/10"
          aria-label=${translateText("ww1936.pol.close")}
          @click=${() => (this.pickSeat = null)}
        >
          ✕
        </button>
      </div>
      ${s.candidates.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.pol.adv.no_candidates")}
          </p>`
        : html`<ul class="m-0 flex list-none flex-col gap-1 p-0">
            ${s.candidates.map(
              (c) =>
                html`<li data-ww-candidate=${c.id} class="${CARD} flex gap-2">
                  <div class="min-w-0 flex-1">
                    <b class="block truncate">${c.name}</b>
                    <span class="block text-white/70"
                      >${c.traits.join(", ")}</span
                    >
                    ${c.effects.map(
                      (e) =>
                        html`<span class="block text-white/80">${e}</span>`,
                    )}
                    ${c.from === null
                      ? nothing
                      : html`<span class="block text-white/60"
                          >${c.from}</span
                        >`}
                    ${c.until === null
                      ? nothing
                      : html`<span class="block text-white/60"
                          >${c.until}</span
                        >`}
                    ${c.block === null
                      ? nothing
                      : html`<span
                          data-ww-candidate-block
                          class="block text-red-300"
                          >🔒 ${c.block}</span
                        >`}
                  </div>
                  <button
                    type="button"
                    data-ww-hire=${c.id}
                    class="${BUTTON} flex flex-col items-center justify-center self-center"
                    ?disabled=${c.block !== null}
                    @click=${() => {
                      this.send({
                        kind: "advisor_hire",
                        slot: s.index,
                        advisor: c.id,
                      });
                      this.pickSeat = null;
                    }}
                  >
                    <span>${c.action}</span>
                    <span class="font-normal text-white/70">${c.cost}</span>
                  </button>
                </li>`,
            )}
          </ul>`}
    </section>`;
  }

  // ---- Laws (moved from the industry drawer, controller ruling R16) ----

  private renderLaws(i: PoliticsModelInput): TemplateResult {
    const ladders = lawTab(i);
    if (ladders === null) return html`${nothing}`;
    return html`${ladders.map(
      (l) =>
        html`<section data-ww-law-kind=${l.kind}>
          <div class="${HEADING} flex items-center justify-between gap-2">
            <span>${l.name}</span>
            ${l.wait === null
              ? nothing
              : html`<span
                  data-ww-law-wait
                  class="normal-case tracking-normal text-amber-300"
                  >${l.wait}</span
                >`}
          </div>
          <ol class="m-0 flex list-none flex-col gap-1 p-0">
            ${l.steps.map((s) => this.renderStep(l.kind, s))}
          </ol>
        </section>`,
    )}`;
  }

  private renderStep(kind: LawKind, s: LawStepView): TemplateResult {
    const key = `law:${kind}:${s.value}`;
    const armed = s.closes && this.armed(key);
    const set = () => this.send({ kind: "set_law", law: kind, value: s.value });
    return html`<li>
      <button
        type="button"
        data-ww-law=${s.value}
        data-state=${s.state}
        data-armed=${String(armed)}
        ?disabled=${s.state !== "open"}
        class="w-full min-h-9 rounded-md border px-2 py-1 text-left text-xs ${s.state ===
        "current"
          ? "border-emerald-400 bg-emerald-950/60"
          : s.state === "open"
            ? "border-white/20 bg-white/5 hover:border-amber-300"
            : "border-white/5 bg-gray-900/60 text-white/50"} ${armed
          ? "ring-2 ring-red-400"
          : ""}"
        @click=${() => (s.closes ? this.confirmTap(key, set) : set())}
      >
        <span class="flex items-center gap-1">
          <span class="min-w-0 flex-1 truncate font-semibold">${s.name}</span>
          <span class="shrink-0 text-white/70"
            >${s.state === "current"
              ? translateText("ww1936.pol.law.in_force")
              : s.state === "open"
                ? translateText("ww1936.pol.law.change")
                : "🔒"}</span
          >
        </span>
        ${s.state === "current"
          ? nothing
          : html`<span data-ww-law-cost class="block text-white/70"
              >${s.cost}</span
            >`}
        ${s.lines.map(
          (l) =>
            html`<span
              data-ww-law-line
              data-ok=${String(l.ok)}
              class="block ${l.ok ? "text-emerald-300" : "text-red-300"}"
              ><span
                aria-label=${l.ok
                  ? translateText("ww1936.pol.law.ok")
                  : nothing}
                >${l.ok ? "✓" : "✗"}</span
              >
              ${l.text}</span
            >`,
        )}
        ${s.reason === null
          ? nothing
          : html`<span data-ww-law-reason class="block text-red-300"
              >${s.reason}</span
            >`}
        ${armed
          ? html`<span data-ww-law-closes class="block text-red-300"
              >${translateText("ww1936.econ.law_closes_deals")}</span
            >`
          : nothing}
      </button>
    </li>`;
  }

  // ---- Spirits ----

  private renderSpirits(i: PoliticsModelInput): TemplateResult {
    const list = spiritTab(i);
    if (list.length === 0) {
      return html`<p class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.pol.spirit.none")}
      </p>`;
    }
    return html`<ul class="m-0 mt-2 flex list-none flex-col gap-1 p-0">
      ${list.map(
        (s) =>
          html`<li data-ww-spirit=${s.id} class="${CARD} flex gap-2">
            <img
              src=${s.icon}
              alt=""
              class="size-8 shrink-0 rounded bg-gray-800 p-1"
              @error=${(e: Event) =>
                ((e.target as HTMLElement).style.visibility = "hidden")}
            />
            <div class="min-w-0 flex-1">
              <div class="flex justify-between gap-2">
                <b class="min-w-0 truncate">${s.name}</b>
                <span class="shrink-0 text-white/60">${s.left}</span>
              </div>
              <p class="m-0 text-white/70">${s.desc}</p>
              ${s.effects.map(
                (e) => html`<span class="block text-white/80">${e}</span>`,
              )}
            </div>
          </li>`,
      )}
    </ul>`;
  }

  // ---- Decisions ----

  private renderDecisions(i: PoliticsModelInput): TemplateResult {
    const t = decisionTab(i);
    return html`
      ${t.missions.map((m) => {
        const key = `mission:${m.id}:${m.target}`;
        const armed = this.armed(key);
        return html`<section data-ww-mission=${m.id} class="${CARD} mt-2">
          <div class="flex items-center justify-between gap-2">
            <b class="min-w-0 truncate"
              >${m.name}${m.targetName === "" ? "" : ` · ${m.targetName}`}</b
            >
            <button
              type="button"
              data-ww-mission-cancel
              data-armed=${String(armed)}
              class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
              @click=${() =>
                this.confirmTap(key, () =>
                  this.send({
                    kind: "decision_cancel",
                    decision: m.id,
                    target: m.target,
                  }),
                )}
            >
              ${armed
                ? translateText("ww1936.pol.tap_again")
                : translateText("ww1936.pol.decision.cancel")}
            </button>
          </div>
          <div class="mt-1 h-1.5 rounded bg-white/10">
            <div
              class="h-1.5 rounded bg-amber-400"
              style="width: ${Math.round(m.progress * 100)}%"
            ></div>
          </div>
          <span class="text-white/70">${m.text}</span>
        </section>`;
      })}
      ${t.groups.length === 0
        ? html`<p class="m-0 mt-2 text-xs text-white/60">
            ${translateText("ww1936.pol.decision.none")}
          </p>`
        : t.groups.map(
            (g) =>
              html`<section data-ww-decision-cat=${g.category}>
                <div class=${HEADING}>${g.name}</div>
                <ul class="m-0 flex list-none flex-col gap-1 p-0">
                  ${g.decisions.map((d) => this.renderDecision(d))}
                </ul>
              </section>`,
          )}
    `;
  }

  private renderDecision(d: DecisionView): TemplateResult {
    // A coup takes two taps (it can't be undone); the rest one.
    const take = (target: number) => {
      const send = () =>
        this.send({ kind: "decision_take", decision: d.id, target });
      if (d.twoTap) this.confirmTap(`take:${d.id}:${target}`, send);
      else send();
    };
    const label = (target: number) =>
      d.twoTap && this.armed(`take:${d.id}:${target}`)
        ? translateText("ww1936.pol.tap_again")
        : translateText("ww1936.pol.decision.take");
    return html`<li data-ww-decision=${d.id} class="${CARD}">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <b class="block">${d.name}</b>
          ${d.cost === null && d.duration === null
            ? nothing
            : html`<span class="block text-amber-200"
                >${[d.cost, d.duration]
                  .filter((x) => x !== null)
                  .join(" · ")}</span
              >`}
          <p class="m-0 line-clamp-2 text-white/60">${d.desc}</p>
          ${this.lines(d.effects)}
        </div>
        ${d.targeted
          ? nothing
          : html`<button
              type="button"
              data-ww-take=${d.id}
              class="${BUTTON} self-center"
              ?disabled=${d.state !== 0}
              @click=${() => take(0)}
            >
              ${label(0)}
            </button>`}
      </div>
      ${d.reason === null
        ? nothing
        : html`<span data-ww-decision-reason class="block text-red-300"
            >🔒 ${d.reason}</span
          >`}
      ${d.failing.map(
        (f) =>
          html`<span data-ww-decision-failing class="block text-red-300"
            >✗ ${f}</span
          >`,
      )}
      ${d.targeted
        ? html`<div class="mt-1 text-white/60">
              ${translateText("ww1936.pol.decision.choose_target")}
            </div>
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              ${d.targets.map(
                (t) =>
                  html`<li
                    data-ww-decision-target=${t.target}
                    class="flex items-center gap-2"
                  >
                    ${t.tag === null
                      ? nothing
                      : html`<img
                          src=${flagUrl(t.tag)}
                          alt=""
                          class="h-3 w-4 shrink-0 rounded-sm object-cover"
                        />`}
                    <span class="min-w-0 flex-1 truncate">${t.name}</span>
                    ${t.reason === null
                      ? nothing
                      : html`<span class="min-w-0 truncate text-red-300"
                          >${t.reason}</span
                        >`}
                    <button
                      type="button"
                      data-ww-take-target=${t.target}
                      class=${BUTTON}
                      data-armed=${String(
                        d.twoTap && this.armed(`take:${d.id}:${t.target}`),
                      )}
                      ?disabled=${t.state !== 0}
                      @click=${() => take(t.target)}
                    >
                      ${label(t.target)}
                    </button>
                  </li>`,
              )}
            </ul>`
        : nothing}
    </li>`;
  }
}
