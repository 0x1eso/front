import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  FM_TRAITS,
  type GrandDoctrine,
  MEDALS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { GENERAL_TRAITS } from "@openfront/engine-api/ww1936/LandTypes";
import { GRAND_DOCTRINE_STATS } from "@openfront/engine-lib/ww1936/DoctrineRules";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { WwDepthOpenEvent } from "./DepthEvents";
import {
  DOCTRINE_BLOCK_KEYS,
  DoctrineBlock,
  DoctrineModel,
  DomainView,
  TrackRow,
} from "./DoctrineModel";
import { armyName, armyRows } from "./LandModel";
import { statLines } from "./PoliticsModel";
import { TWO_TAP_MS, TwoTap, wwActive } from "./WorldWarModel";
import { WwDrawerBase } from "./WwDrawer";

export type WwDoctrineTab = "land" | "naval" | "air" | "officers" | "command";
export const DOCTRINE_TABS: readonly WwDoctrineTab[] = [
  "land",
  "naval",
  "air",
  "officers",
  "command",
];
const TAB_KEYS: Readonly<Record<WwDoctrineTab, string>> = {
  land: "ww1936.doctrine.tab_land",
  naval: "ww1936.doctrine.tab_naval",
  air: "ww1936.doctrine.tab_air",
  officers: "ww1936.doctrine.tab_officers",
  command: "ww1936.doctrine.tab_command",
};
const DOMAIN_TAB: readonly WwDoctrineTab[] = ["land", "naval", "air"];
const XP_KEYS = [
  "ww1936.doctrine.xp_land",
  "ww1936.doctrine.xp_naval",
  "ww1936.doctrine.xp_air",
] as const;

const HEADING =
  "mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-white/70";
const BTN =
  "min-h-9 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-40";
const CARD = "rounded-md border border-white/10 bg-white/5 p-1.5 text-xs";

/**
 * World War 1936 P6 (spec §20.3): the doctrine drawer — land, naval and air
 * tabs (grand doctrine chips, effect cards, three mastery tracks with their
 * sub-doctrines), the officer corps, and command (command power, trait
 * purchases, field marshals, medals). Three taps to a first pick: the dial,
 * a chip, [Pick]; a switch costs experience and needs a second tap.
 */
@customElement("ww-doctrine-panel")
export class WwDoctrinePanel extends WwDrawerBase {
  protected readonly drawerId = "doctrine" as const;
  @state() private tab: WwDoctrineTab = "land";
  /** The chip (GRAND_DOCTRINES index) and the track whose cards are open. */
  @state() private chip: number | null = null;
  @state() private track: number | null = null;
  @state() private person: string | null = null;
  @state() private promoting: number | null = null;
  @state() private marshalTrait: number | null = null;
  @state() private medal: string | null = null;
  private model: DoctrineModel | null = null;
  private readonly twoTap = new TwoTap();
  private redrawKey = "";

  init() {
    super.init();
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "doctrine") return;
      const tab = (e.arg?.tab as WwDoctrineTab | undefined) ?? null;
      if (this.open && (tab === null || tab === this.tab)) {
        this.setOpen(false);
        return;
      }
      if (tab !== null && DOCTRINE_TABS.includes(tab)) this.tab = tab;
      this.chip = this.track = null;
      this.setOpen(true);
    });
  }

  private m(): DoctrineModel {
    return (this.model ??= new DoctrineModel(this.game));
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const key = this.m().version();
    if (key !== this.redrawKey) {
      this.redrawKey = key;
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

  private blockText(b: DoctrineBlock, days = 0): string {
    return translateText(DOCTRINE_BLOCK_KEYS[b], { days });
  }

  render() {
    if (!this.open) return null;
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const label = translateText("ww1936.doctrine.title");
    const head = html`<span aria-hidden="true">🎖</span>
      <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">${label}</h3>`;
    const me = this.game.myPlayer();
    if (me === null || !wwActive(this.game, me.smallID())) {
      return this.renderFrame(label, head, nothing, html``);
    }
    const model = this.m();
    const domains = model.domains();
    const tabs = this.renderTabs(
      DOCTRINE_TABS,
      this.tab,
      (t) => {
        const i = DOMAIN_TAB.indexOf(t);
        const glow = i >= 0 && domains[i]?.unpicked;
        return `${translateText(TAB_KEYS[t])}${glow ? " ●" : ""}`;
      },
      (t) => {
        this.tab = t;
        this.chip = this.track = null;
      },
    );
    let body: TemplateResult;
    if (!model.ready()) body = html``;
    else if (this.tab === "officers") body = this.renderOfficers(model);
    else if (this.tab === "command") body = this.renderCommand(model);
    else body = this.renderDomain(model, domains[DOMAIN_TAB.indexOf(this.tab)]);
    return this.renderFrame(label, head, tabs, body);
  }

  // ---- Land / naval / air ----

  private renderDomain(model: DoctrineModel, d: DomainView): TemplateResult {
    const open = this.chip ?? (d.picked >= 0 ? d.picked : null);
    return html`<div data-ww-domain=${d.id}>
      <div class="${HEADING} flex items-center gap-2">
        <span>${translateText("ww1936.doctrine.grand_title")}</span>
        ${d.xp === null
          ? nothing
          : html`<span class="ml-auto normal-case text-white/60"
              >${translateText(XP_KEYS[d.domain], { xp: d.xp })}</span
            >`}
      </div>
      ${d.unpicked
        ? html`<p
            data-ww-pick-prompt
            class="m-0 mb-1 animate-pulse text-xs font-bold text-amber-300"
          >
            ${translateText("ww1936.doctrine.choose_prompt")}
          </p>`
        : nothing}
      <div class="flex flex-wrap gap-1">
        ${d.chips.map(
          (c) =>
            html`<button
              type="button"
              data-ww-gd=${c.id}
              aria-pressed=${String(c.picked)}
              class="min-h-9 rounded-md border px-2 text-xs font-semibold ${c.picked
                ? "border-emerald-300 bg-emerald-500/20"
                : open === c.index
                  ? "border-white/60 bg-white/15"
                  : "border-white/15 bg-white/5 hover:bg-white/10"} ${d.unpicked
                ? "animate-pulse"
                : ""}"
              @click=${() => (this.chip = c.index)}
            >
              ${translateText(`ww1936.gd.${c.id}`)}
            </button>`,
        )}
      </div>
      ${open === null ? nothing : this.renderGdCard(model, d, open)}
      <div class=${HEADING}>${translateText("ww1936.doctrine.tracks")}</div>
      <div class="flex flex-col gap-1">
        ${d.tracks.map((t) => this.renderTrack(model, t))}
      </div>
    </div>`;
  }

  private renderGdCard(
    model: DoctrineModel,
    d: DomainView,
    gd: number,
  ): TemplateResult {
    const chip = d.chips.find((c) => c.index === gd);
    if (chip === undefined) return html``;
    const pick = model.pickBlock({ domain: d.domain, gd });
    const key = `gd${gd}`;
    const stats = (i: 0 | 1) => statLines(grandStats(chip.id)[i]);
    return html`<div data-ww-gd-card=${chip.id} class="${CARD} mt-1">
      <div class="font-bold">${translateText(`ww1936.gd.${chip.id}`)}</div>
      <div class="text-white/60">
        ${translateText(`ww1936.gd_desc.${chip.id}`)}
      </div>
      <div class="mt-1 font-semibold">
        ${translateText("ww1936.doctrine.base_effect")}
      </div>
      <ul class="m-0 list-none p-0">
        ${stats(0).map((l) => html`<li>${l}</li>`)}
      </ul>
      <div class="mt-1 font-semibold">
        ${translateText("ww1936.doctrine.full_effect")}
      </div>
      <ul class="m-0 list-none p-0">
        ${stats(1).map((l) => html`<li>${l}</li>`)}
      </ul>
      ${chip.picked
        ? html`<div class="mt-1 text-emerald-300">
            ✓ ${translateText("ww1936.doctrine.chosen")}
          </div>`
        : this.pickButton(key, pick, d.xp, () =>
            this.send(model.gdOrder(d.domain, gd)),
          )}
    </div>`;
  }

  /** [Pick] (one tap) or [Switch — xp, halves mastery] (two taps), with why it cannot. */
  private pickButton(
    key: string,
    pick: ReturnType<DoctrineModel["pickBlock"]>,
    _xp: number | null,
    act: () => void,
    sub = false,
  ): TemplateResult {
    const blocked = pick.block !== null;
    const label = !pick.switching
      ? translateText("ww1936.doctrine.choose")
      : this.armed(key)
        ? translateText("ww1936.doctrine.tap_again")
        : translateText(
            sub ? "ww1936.doctrine.switch_sub" : "ww1936.doctrine.switch",
            { xp: pick.xpCost },
          );
    return html`<button
        type="button"
        data-ww-pick=${key}
        data-state=${pick.switching ? "switch" : "pick"}
        ?disabled=${blocked}
        class="${BTN} mt-1 w-full ${this.armed(key)
          ? "border-amber-300 bg-amber-500/30"
          : ""}"
        @click=${() => (pick.switching ? this.confirmTap(key, act) : act())}
      >
        ${label}
      </button>
      ${blocked
        ? html`<p data-ww-block class="m-0 mt-0.5 text-red-300">
            🔒 ${this.blockText(pick.block!, pick.lockDays)}
          </p>`
        : nothing}`;
  }

  private renderTrack(model: DoctrineModel, t: TrackRow): TemplateResult {
    const open = this.track === t.track;
    const sub = t.subs.find((s) => s.picked);
    const next = t.next;
    return html`<div data-ww-track=${t.id} class=${CARD}>
      <button
        type="button"
        class="flex min-h-9 w-full flex-col gap-0.5 text-left"
        aria-expanded=${String(open)}
        @click=${() => (this.track = open ? null : t.track)}
      >
        <span class="flex w-full items-center gap-1.5">
          <span class="font-bold"
            >${translateText(`ww1936.track.${t.id}`)}</span
          >
          <span class="min-w-0 flex-1 truncate text-white/70"
            >${sub === undefined
              ? translateText("ww1936.doctrine.sub_none")
              : translateText(`ww1936.subdoc.${sub.id}`)}</span
          >
          <span data-ww-level class="font-black tabular-nums"
            >${translateText("ww1936.doctrine.level_short", {
              level: t.level,
            })}</span
          >
        </span>
        <span class="flex w-full gap-0.5" data-ww-ticks=${t.level}>
          ${[1, 2, 3, 4, 5].map(
            (i) =>
              html`<span class="h-1.5 flex-1 rounded bg-white/10"
                ><span
                  class="block h-1.5 rounded ${i <= t.level
                    ? "bg-emerald-400"
                    : "bg-sky-400"}"
                  style="width: ${i <= t.level
                    ? 100
                    : i === t.level + 1
                      ? Math.floor(t.fill * 100)
                      : 0}%"
                ></span
              ></span>`,
          )}
        </span>
        <span class="flex w-full gap-2 text-white/70">
          ${next === null
            ? html`<span class="min-w-0 flex-1"
                >${t.level === 5
                  ? translateText("ww1936.doctrine.next_done")
                  : ""}</span
              >`
            : html`<span data-ww-next class="min-w-0 flex-1 truncate"
                >${translateText("ww1936.doctrine.next", {
                  level: next.level,
                  reward: statLines(next.stats).join(", "),
                })}${t.days === null
                  ? ""
                  : ` · ${translateText("ww1936.doctrine.days", { days: t.days })}`}</span
              >`}
          ${t.gainText === ""
            ? nothing
            : html`<span data-ww-gain class="shrink-0 tabular-nums"
                >${translateText("ww1936.doctrine.per_day", {
                  x: t.gainText,
                })}</span
              >`}
        </span>
      </button>
      ${open
        ? html`<div class="mt-1 flex flex-col gap-1">
            ${t.subs.map((s) => {
              const pick = model.pickBlock({ track: t.track, sub: s.index });
              return html`<div
                data-ww-sub=${s.id}
                class="${CARD} ${s.picked ? "border-emerald-300" : ""}"
              >
                <div class="font-bold">
                  ${translateText(`ww1936.subdoc.${s.id}`)}
                </div>
                <div class="text-white/60">
                  ${translateText(`ww1936.subdoc_desc.${s.id}`)}
                </div>
                <ul class="m-0 mt-1 list-none p-0">
                  ${s.rewards.map(
                    (r, i) =>
                      html`<li class=${i < t.level ? "text-emerald-300" : ""}>
                        ${translateText("ww1936.doctrine.level_short", {
                          level: i + 1,
                        })}
                        ${statLines(r).join(", ")}
                      </li>`,
                  )}
                </ul>
                ${s.picked
                  ? nothing
                  : this.pickButton(
                      `sub${s.index}`,
                      pick,
                      null,
                      () => this.send(model.subOrder(t.track, s.index)),
                      true,
                    )}
              </div>`;
            })}
          </div>`
        : nothing}
    </div>`;
  }

  // ---- Officer corps ----

  private renderOfficers(model: DoctrineModel): TemplateResult {
    return html`<div data-ww-officers class="flex flex-col gap-1.5 pt-2">
      ${model.spiritCards().map(
        (c) =>
          html`<div data-ww-spirit=${c.id} class=${CARD}>
            <div class="flex items-center gap-2">
              <span class="font-bold"
                >${translateText(`ww1936.army_spirit_cat.${c.id}`)}</span
              >
              <span class="ml-auto text-white/60"
                >${c.lockDays > 0
                  ? translateText("ww1936.doctrine.locked_days", {
                      days: c.lockDays,
                    })
                  : translateText("ww1936.doctrine.xp_cost", {
                      xp: c.cost,
                    })}</span
              >
            </div>
            <div class="mt-1 flex flex-col gap-1">
              ${c.options.map((o) => {
                const block = model.spiritBlock(c.category, o.index);
                const key = `sp${o.index}`;
                return html`<div
                  class="rounded border p-1 ${o.picked
                    ? "border-emerald-300 bg-emerald-500/10"
                    : "border-white/10"}"
                >
                  <div class="font-semibold">
                    ${translateText(`ww1936.army_spirit.${o.id}`)}
                  </div>
                  <div class="text-white/60">
                    ${translateText(`ww1936.army_spirit_desc.${o.id}`)}
                  </div>
                  ${o.picked
                    ? nothing
                    : html`<button
                          type="button"
                          data-ww-spirit-pick=${o.id}
                          ?disabled=${block !== null}
                          class="${BTN} mt-1 w-full ${this.armed(key)
                            ? "border-amber-300 bg-amber-500/30"
                            : ""}"
                          @click=${() =>
                            c.picked >= 0
                              ? this.confirmTap(key, () =>
                                  this.send(
                                    model.spiritOrder(c.category, o.index),
                                  ),
                                )
                              : this.send(
                                  model.spiritOrder(c.category, o.index),
                                )}
                        >
                          ${c.picked < 0
                            ? translateText("ww1936.doctrine.choose")
                            : this.armed(key)
                              ? translateText("ww1936.doctrine.tap_again")
                              : translateText("ww1936.doctrine.switch_sub", {
                                  xp: c.cost,
                                })}
                        </button>
                        ${block === null
                          ? nothing
                          : html`<p class="m-0 mt-0.5 text-red-300">
                              🔒 ${this.blockText(block, c.lockDays)}
                            </p>`}`}
                </div>`;
              })}
            </div>
          </div>`,
      )}
    </div>`;
  }

  // ---- Command ----

  private traitName(t: string, admiral: boolean): string {
    return translateText(
      admiral && !isGeneralTrait(t)
        ? `ww1936.admiral_trait.${t}`
        : `ww1936.trait.${t}`,
    );
  }

  private renderCommand(model: DoctrineModel): TemplateResult {
    const bar = model.cpBar();
    if (bar === null) return html``;
    const people = model.commandPeople();
    const marshals = model.marshalRows();
    const promo = model.promoteCandidates();
    return html`<div data-ww-command class="flex flex-col gap-1 pt-2">
      <div data-ww-cp class=${CARD}>
        <div class="flex items-center gap-2">
          <span class="font-bold"
            >🎖 ${translateText("ww1936.command.cp")}</span
          >
          <span class="ml-auto font-black tabular-nums"
            >${bar.cpText} / ${bar.max}</span
          >
        </div>
        <div class="mt-1 h-2 rounded bg-white/10">
          <div
            class="h-2 rounded bg-amber-400"
            style="width: ${bar.pct}%"
          ></div>
        </div>
        <div class="mt-1 text-white/70">
          ${translateText("ww1936.command.cp_gain", {
            gain: (bar.gainMilli / 1000).toFixed(2),
          })}
          ${bar.upkeepMilli > 0
            ? `· ${translateText("ww1936.command.upkeep", { n: (bar.upkeepMilli / 1000).toFixed(2) })}`
            : ""}
        </div>
      </div>

      <div class=${HEADING}>${translateText("ww1936.command.generals")}</div>
      ${people.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.command.none")}
          </p>`
        : people.map((p) => this.renderPerson(model, p))}

      <div class=${HEADING}>${translateText("ww1936.command.marshals")}</div>
      <p class="m-0 text-xs text-white/60">
        ${translateText("ww1936.command.marshal_cap", {
          n: bar.marshals,
          max: bar.cap,
        })}
      </p>
      ${marshals.map(
        (f) =>
          html`<div data-ww-marshal=${f.id} class=${CARD}>
            <div class="flex items-center gap-2">
              <span class="font-bold">${f.name}</span>
              ${f.group > 0
                ? html`<span class="ml-auto text-white/60"
                    >${translateText("ww1936.ag.number", {
                      n: f.group,
                    })}</span
                  >`
                : nothing}
            </div>
            <div class="text-white/70">
              ${f.traits
                .map((t) => translateText(`ww1936.fm_trait.${t}`))
                .join(", ")}
            </div>
            ${this.renderMarshalTraits(model, f.id, f.traits, bar.cp)}
          </div>`,
      )}
      ${promo.map((g) => this.renderPromote(model, g))}

      <div class=${HEADING}>${translateText("ww1936.command.medals")}</div>
      <div class="flex flex-col gap-1">
        ${model.medalCards().map(
          (c) =>
            html`<div data-ww-medal=${c.id} class=${CARD}>
              <div class="flex items-center gap-2">
                <span class="font-bold"
                  >${translateText(`ww1936.medal.${c.id}`)}</span
                >
                <button
                  type="button"
                  data-ww-medal-award=${c.id}
                  ?disabled=${c.block !== null}
                  class="${BTN} ml-auto"
                  @click=${() =>
                    (this.medal = this.medal === c.id ? null : c.id)}
                >
                  ${translateText("ww1936.command.award", { cp: c.cp })}
                </button>
              </div>
              ${c.block === null
                ? nothing
                : html`<p class="m-0 text-red-300">
                    🔒 ${this.blockText(c.block)}
                  </p>`}
              ${this.medal === c.id
                ? this.renderMedalArmies(model, c.id)
                : nothing}
            </div>`,
        )}
      </div>
    </div>`;
  }

  private renderMedalArmies(
    model: DoctrineModel,
    medal: string,
  ): TemplateResult {
    const land = this.game.wwLand?.() ?? null;
    const me = this.game.myPlayer()!.smallID();
    const rows = land === null ? [] : armyRows(land, me);
    return html`<div class="mt-1 flex flex-col gap-1">
      <div class="text-white/70">
        ${translateText("ww1936.command.award_pick")}
      </div>
      ${rows.map((r) => {
        // Lane D: an army waits out its medal cooldown.
        const wait = model.medalDaysLeft(r.id);
        return html`<button
          type="button"
          data-ww-medal-army=${r.id}
          ?disabled=${wait > 0}
          class=${BTN}
          @click=${() => {
            this.send({
              kind: "medal_award",
              army: r.id,
              medal: medal as (typeof MEDALS)[number],
            });
            this.medal = null;
          }}
        >
          ${armyName(r.nameNo)}
          ${wait > 0
            ? html`<span class="text-white/60"
                >${translateText("ww1936.doctrine.locked_days", {
                  days: wait,
                })}</span
              >`
            : nothing}
        </button>`;
      })}
    </div>`;
  }

  private renderPerson(
    model: DoctrineModel,
    p: ReturnType<DoctrineModel["commandPeople"]>[number],
  ): TemplateResult {
    const key = `${p.admiral ? "a" : "g"}${p.id}`;
    const open = this.person === key;
    const usable = p.candidates.filter((c) => c.block === null).length;
    return html`<div data-ww-person=${key} class=${CARD}>
      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate font-bold"
          >${p.admiral ? "⚓ " : ""}${p.name}</span
        >
        <span class="shrink-0 text-white/60"
          >${translateText("ww1936.doctrine.level_short", { level: p.level })} ·
          ${translateText("ww1936.command.trait_slots", {
            free: p.slots - p.used,
            total: p.slots,
          })}</span
        >
        <button
          type="button"
          data-ww-traits=${key}
          ?disabled=${p.candidates.length === 0}
          class="${BTN} ${usable > 0 ? "border-amber-300" : ""}"
          @click=${() => (this.person = open ? null : key)}
        >
          ${translateText("ww1936.command.traits")}
        </button>
      </div>
      <div class="text-white/70">
        ${p.traits.map((t) => this.traitName(t, p.admiral)).join(", ")}
      </div>
      ${open
        ? html`<div class="mt-1 flex flex-col gap-1">
            ${p.candidates.map(
              (c) =>
                html`<div class="rounded border border-white/10 p-1">
                  <div class="font-semibold">
                    ${this.traitName(c.trait, p.admiral)}
                  </div>
                  <div class="text-white/60">
                    ${translateText(
                      p.admiral && !isGeneralTrait(c.trait)
                        ? `ww1936.admiral_trait_desc.${c.trait}`
                        : `ww1936.trait_desc.${c.trait}`,
                    )}
                  </div>
                  <button
                    type="button"
                    data-ww-trait-buy=${c.trait}
                    ?disabled=${c.block !== null}
                    class="${BTN} mt-1 w-full"
                    @click=${() =>
                      this.send(model.traitOrder(p.id, c.trait, p.admiral))}
                  >
                    ${translateText("ww1936.command.trait_cost", { cp: c.cp })}
                  </button>
                  ${c.block === null
                    ? nothing
                    : html`<p class="m-0 mt-0.5 text-red-300">
                        🔒 ${this.blockText(c.block)}
                      </p>`}
                </div>`,
            )}
          </div>`
        : nothing}
    </div>`;
  }

  private renderMarshalTraits(
    model: DoctrineModel,
    id: number,
    held: readonly string[],
    cp: number,
  ): TemplateResult {
    const open = this.marshalTrait === id;
    const free = FM_TRAITS.filter((t) => !held.includes(t));
    return html`<button
        type="button"
        data-ww-fm-traits=${id}
        class="${BTN} mt-1"
        @click=${() => (this.marshalTrait = open ? null : id)}
      >
        ${translateText("ww1936.command.traits")}
      </button>
      ${open
        ? html`<div class="mt-1 flex flex-col gap-1">
            ${free.map(
              (t) =>
                html`<div class="rounded border border-white/10 p-1">
                  <div class="font-semibold">
                    ${translateText(`ww1936.fm_trait.${t}`)}
                  </div>
                  <div class="text-white/60">
                    ${translateText(`ww1936.fm_trait_desc.${t}`)}
                  </div>
                  <button
                    type="button"
                    data-ww-fm-trait-buy=${t}
                    ?disabled=${model.fmTraitBlock(id, t) !== null}
                    class="${BTN} mt-1 w-full"
                    @click=${() => this.send(model.traitOrder(id, t, false))}
                  >
                    ${translateText("ww1936.command.trait_cost", {
                      cp: model.fmTraitCp,
                    })}
                  </button>
                </div>`,
            )}
          </div>`
        : nothing}`;
  }

  private renderPromote(
    model: DoctrineModel,
    g: ReturnType<DoctrineModel["promoteCandidates"]>[number],
  ): TemplateResult {
    const open = this.promoting === g.id;
    return html`<div data-ww-promote=${g.id} class=${CARD}>
      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate font-bold">${g.name}</span>
        <button
          type="button"
          ?disabled=${g.block !== null}
          class=${BTN}
          @click=${() => (this.promoting = open ? null : g.id)}
        >
          ${translateText("ww1936.command.promote")}
        </button>
      </div>
      ${g.block === null
        ? nothing
        : html`<p class="m-0 text-red-300">🔒 ${this.blockText(g.block)}</p>`}
      ${open
        ? html`<div class="mt-1 flex flex-col gap-1">
            <div class="text-white/70">
              ${translateText("ww1936.command.pick_trait")}
            </div>
            ${FM_TRAITS.map((t) => {
              const key = `fm${g.id}${t}`;
              return html`<button
                type="button"
                data-ww-promote-trait=${t}
                class="${BTN} text-left ${this.armed(key)
                  ? "border-amber-300 bg-amber-500/30"
                  : ""}"
                @click=${() =>
                  this.confirmTap(key, () => {
                    this.send(model.promoteOrder(g.id, t));
                    this.promoting = null;
                  })}
              >
                ${this.armed(key)
                  ? translateText("ww1936.doctrine.tap_again")
                  : translateText(`ww1936.fm_trait.${t}`)}
              </button>`;
            })}
          </div>`
        : nothing}
    </div>`;
  }
}

function grandStats(id: GrandDoctrine) {
  return GRAND_DOCTRINE_STATS[id];
}
function isGeneralTrait(t: string): boolean {
  return (GENERAL_TRAITS as readonly string[]).includes(t);
}
