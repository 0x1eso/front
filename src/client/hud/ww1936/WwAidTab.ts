import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import type { LendLeaseItem } from "@openfront/engine-api/ww1936/EndgameTypes";
import type { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import {
  airVolunteerTypes,
  airVolunteerWhy,
  airVolunteerZones,
  amountStep,
  contractWhy,
  egFlag,
  egName,
  type EndgameGame,
  llCountries,
  llGate,
  llGenName,
  llItemName,
  llItems,
  llRequestItems,
  myAid,
  shipFleets,
  subjectActionsOn,
  volunteerArmies,
  volunteerInputs,
  volunteerRoom,
  type Why,
  whyText,
} from "./EndgameModel";
import { armyName } from "./LandModel";
import { srName } from "./NavyModel";
import { dateLabel, TWO_TAP_MS, TwoTap, wwActive } from "./WorldWarModel";

const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const CARD = "rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs";
const MAX_PER_MONTH = 100_000;

/**
 * Open the diplomacy drawer's aid tab on a new contract with `to` (the
 * player panel's "send lend-lease", spec §20.7), or on a request to it.
 */
export class OpenWwAidEvent implements GameEvent {
  constructor(
    public readonly to: number,
    public readonly mode: "send" | "request" = "send",
  ) {}
}

/** What the drawer hands the tab to start a walk at a country. */
export interface AidPreset {
  to: number;
  mode: "send" | "request";
  /** Bumped for each OpenWwAidEvent. */
  nonce: number;
}

/** "New contract" (spec §20.5): country → equipment → generation → amount. */
interface Walk {
  mode: "send" | "request";
  step: "country" | "item" | "gen" | "amount";
  to: number;
  item: LendLeaseItem | null;
  gen: number;
  amount: number;
}

function why(w: Why | null): TemplateResult | typeof nothing {
  return w === null
    ? nothing
    : html`<span data-ww-aid-why=${w.key} class="block text-xs text-red-300"
        >${whyText(w)}</span
      >`;
}

/**
 * World War 1936 P5 (spec §20.5): the diplomacy drawer's aid tab — my
 * lend-lease contracts (country, equipment, a month, sent / arrived this
 * month, why one stopped, "End" with two taps), "New contract" (country →
 * equipment → generation → a month −/+), the shipments on their way to me,
 * the volunteers I sent ("Recall", two taps) and those I received.
 */
@customElement("ww-aid-tab")
export class WwAidTab extends LitElement {
  @property({ attribute: false }) game: EndgameGame | null = null;
  @property({ attribute: false }) eventBus: EventBus | null = null;
  @property({ type: Number }) stamp = 0;
  /** A walk the drawer starts (OpenWwAidEvent). */
  @property({ attribute: false }) preset: AidPreset | null = null;
  @state() private walk: Walk | null = null;
  private presetSeen = -1;
  private readonly twoTap = new TwoTap();

  createRenderRoot() {
    return this;
  }

  protected willUpdate() {
    const p = this.preset;
    if (p !== null && p.nonce !== this.presetSeen) {
      this.presetSeen = p.nonce;
      this.walk = {
        mode: p.mode,
        step: "item",
        to: p.to,
        item: null,
        gen: 1,
        amount: 1,
      };
    }
  }

  private send(order: WwOrder) {
    this.eventBus?.emit(new SendWwOrderIntentEvent(order));
  }

  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  render() {
    const game = this.game;
    const me = game?.myPlayer()?.smallID() ?? 0;
    if (game === null || me === 0 || !wwActive(game, me)) return nothing;
    const aid = myAid(game, me);
    return html`
      <div class=${HEADING}>${translateText("ww1936.aid.my_contracts")}</div>
      ${aid === null || aid.contracts.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.aid.none")}
          </p>`
        : html`<ul
            data-ww-aid-contracts
            class="m-0 flex list-none flex-col gap-1 p-0"
          >
            ${aid.contracts.map((c) => {
              const key = `end:${c.id}`;
              const armed = this.armed(key);
              return html`<li data-ww-aid-contract=${c.id} class=${CARD}>
                <div class="flex items-center gap-2">
                  <span class="min-w-0 flex-1"
                    >${translateText("ww1936.aid.contract_line", {
                      to: egName(game, c.to),
                      item: llItemName(c.item),
                      perMonth: c.perMonth.toLocaleString(),
                      sent: c.sentMonth.toLocaleString(),
                      arrived: c.arrivedMonth.toLocaleString(),
                    })}</span
                  >
                  <button
                    type="button"
                    data-ww-aid-end=${c.id}
                    data-armed=${String(armed)}
                    class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
                    @click=${() =>
                      this.confirmTap(key, () =>
                        this.send({ kind: "lend_lease_cancel", id: c.id }),
                      )}
                  >
                    ${armed
                      ? translateText("ww1936.pol.tap_again")
                      : translateText("ww1936.aid.end")}
                  </button>
                </div>
                ${c.blocked === null
                  ? nothing
                  : html`<span data-ww-aid-blocked class="block text-red-300"
                      >${contractWhy(game, c.blocked)}</span
                    >`}
              </li>`;
            })}
          </ul>`}
      ${this.renderWalk(game, me)}
      ${aid === null ? nothing : this.renderReceived(game, aid)}
      ${aid === null ? nothing : this.renderVolunteers(game, aid)}
    `;
  }

  // ---- New contract ----

  private renderWalk(game: EndgameGame, me: number): TemplateResult {
    const w = this.walk;
    if (w === null) {
      return html`<div class="mt-2">
        <button
          type="button"
          data-ww-aid-new
          class=${BUTTON}
          @click=${() =>
            (this.walk = {
              mode: "send",
              step: "country",
              to: 0,
              item: null,
              gen: 1,
              amount: 1,
            })}
        >
          + ${translateText("ww1936.aid.new")}
        </button>
      </div>`;
    }
    const title =
      w.mode === "send"
        ? translateText("ww1936.aid.new")
        : translateText("ww1936.aid.request");
    const path = [
      w.to === 0 ? null : egName(game, w.to),
      w.item === null ? null : llItemName(w.item),
      w.step === "amount" && w.item !== null && w.mode === "send"
        ? llGenName(w.item, w.gen)
        : null,
    ].filter((x): x is string => x !== null && x !== "");
    return html`<section data-ww-aid-walk=${w.step} class="${CARD} mt-2">
      <div class="flex items-center gap-2">
        <b class="min-w-0 flex-1 truncate">${title}</b>
        <button
          type="button"
          data-ww-aid-walk-close
          class="size-9 shrink-0 rounded-md hover:bg-white/10"
          aria-label=${translateText("common.close")}
          @click=${() => (this.walk = null)}
        >
          ✕
        </button>
      </div>
      ${path.length === 0
        ? nothing
        : html`<p data-ww-aid-path class="m-0 text-white/70">
            ${path.join(" → ")}
          </p>`}
      ${w.step === "country"
        ? this.renderCountries(game, me, w)
        : w.step === "item"
          ? this.renderItems(game, me, w)
          : w.step === "gen"
            ? this.renderGens(game, me, w)
            : this.renderAmount(game, me, w)}
    </section>`;
  }

  private renderCountries(game: EndgameGame, me: number, w: Walk) {
    return html`<div class="mt-1 text-white/60">
        ${translateText("ww1936.aid.pick_country")}
      </div>
      <ul
        class="m-0 flex max-h-48 list-none flex-col gap-0.5 overflow-y-auto p-0"
      >
        ${llCountries(game, me).map(
          (c) =>
            html`<li>
              <button
                type="button"
                data-ww-aid-country=${c.id}
                class="flex min-h-9 w-full items-center gap-2 rounded px-1 text-left hover:bg-white/10 disabled:opacity-50"
                ?disabled=${c.why !== null}
                @click=${() =>
                  (this.walk = { ...w, to: c.id, step: "item", item: null })}
              >
                ${c.flag === null
                  ? nothing
                  : html`<img
                      src=${c.flag}
                      alt=""
                      class="h-3 w-4 shrink-0 rounded-sm object-cover"
                    />`}
                <span class="min-w-0 flex-1">
                  <span class="block truncate">${c.name}</span>
                  ${why(c.why)}
                </span>
              </button>
            </li>`,
        )}
      </ul>`;
  }

  private renderItems(game: EndgameGame, me: number, w: Walk) {
    const items =
      w.mode === "send"
        ? llItems(game, me).map((r) => ({
            item: r.item,
            name: r.name,
            stock: r.gens.reduce((s, [, n]) => s + n, 0),
          }))
        : llRequestItems().map((r) => ({ ...r, stock: -1 }));
    const gate = w.mode === "send" ? llGate(game, me, w.to) : null;
    return html`<div class="mt-1 text-white/60">
        ${translateText("ww1936.aid.pick_item")}
      </div>
      ${why(gate)}
      <div class="mt-1 flex flex-wrap gap-1">
        ${items.map(
          (it) =>
            html`<button
              type="button"
              data-ww-aid-item=${it.item}
              class=${BUTTON}
              @click=${() => {
                const amount = Math.max(
                  1,
                  Math.min(
                    MAX_PER_MONTH,
                    it.stock > 0 ? Math.floor(it.stock / 10) : 100,
                  ),
                );
                this.walk = {
                  ...w,
                  item: it.item,
                  step: w.mode === "send" ? "gen" : "amount",
                  gen: 1,
                  amount,
                };
              }}
            >
              ${it.name}${it.stock >= 0
                ? html` <span class="font-normal text-white/60"
                    >${it.stock.toLocaleString()}</span
                  >`
                : nothing}
            </button>`,
        )}
      </div>`;
  }

  private renderGens(game: EndgameGame, me: number, w: Walk) {
    const row = llItems(game, me).find((r) => r.item === w.item);
    return html`<div class="mt-1 text-white/60">
        ${translateText("ww1936.aid.pick_gen")}
      </div>
      <div class="mt-1 flex flex-wrap gap-1">
        ${(row?.gens ?? []).map(
          ([gen, n]) =>
            html`<button
              type="button"
              data-ww-aid-gen=${gen}
              class=${BUTTON}
              @click=${() =>
                (this.walk = {
                  ...w,
                  gen,
                  step: "amount",
                  amount: Math.max(
                    1,
                    Math.min(MAX_PER_MONTH, Math.floor(n / 10)),
                  ),
                })}
            >
              ${llGenName(w.item!, gen) || "—"}
              <span class="font-normal text-white/60"
                >${n.toLocaleString()}</span
              >
            </button>`,
        )}
      </div>`;
  }

  private renderAmount(game: EndgameGame, me: number, w: Walk) {
    const set = (n: number) =>
      (this.walk = {
        ...w,
        amount: Math.max(1, Math.min(MAX_PER_MONTH, n)),
      });
    const gate = w.mode === "send" ? llGate(game, me, w.to) : null;
    const item = w.item!;
    const order: WwOrder =
      w.mode === "send"
        ? {
            kind: "lend_lease",
            to: w.to,
            item,
            gen: item === "fuel" ? 0 : w.gen,
            perMonth: w.amount,
          }
        : {
            kind: "lend_lease_request",
            from: w.to,
            item,
            perMonth: w.amount,
          };
    return html`<div class="mt-1 text-white/60">
        ${translateText("ww1936.aid.per_month")}
      </div>
      <div class="mt-1 flex items-center gap-1">
        <button
          type="button"
          data-ww-aid-minus
          class="${BUTTON} w-9"
          aria-label="−"
          @click=${() => set(w.amount - amountStep(w.amount - 1))}
        >
          −
        </button>
        <span data-ww-aid-amount class="min-w-16 text-center tabular-nums"
          >${w.amount.toLocaleString()}</span
        >
        <button
          type="button"
          data-ww-aid-plus
          class="${BUTTON} w-9"
          aria-label="+"
          @click=${() => set(w.amount + amountStep(w.amount))}
        >
          +
        </button>
        <button
          type="button"
          data-ww-aid-submit
          class="${BUTTON} ml-auto bg-amber-700/60"
          ?disabled=${gate !== null}
          @click=${() => {
            this.send(order);
            this.walk = null;
          }}
        >
          ${w.mode === "send"
            ? translateText("ww1936.aid.send")
            : translateText("ww1936.aid.request")}
        </button>
      </div>
      ${why(gate)}`;
  }

  // ---- What comes to me, volunteers ----

  private renderReceived(
    game: EndgameGame,
    aid: NonNullable<ReturnType<typeof myAid>>,
  ) {
    if (aid.incoming.length === 0) return nothing;
    return html`<div class=${HEADING}>
        ${translateText("ww1936.aid.received")}
      </div>
      <ul
        data-ww-aid-incoming
        class="m-0 flex list-none flex-col gap-0.5 p-0 text-xs"
      >
        ${aid.incoming.map(
          (t) =>
            html`<li class="flex items-center gap-1.5">
              ${this.flag(egFlag(game, t.from))}
              <span class="min-w-0"
                >${translateText("ww1936.aid.incoming_line", {
                  from: egName(game, t.from),
                  item: llItemName(t.item),
                  n: t.count.toLocaleString(),
                  date: dateLabel(t.arriveDay),
                })}</span
              >
            </li>`,
        )}
      </ul>`;
  }

  private renderVolunteers(
    game: EndgameGame,
    aid: NonNullable<ReturnType<typeof myAid>>,
  ) {
    const land = game.wwLand?.() ?? null;
    const name = (army: number) => {
      const a = land?.armies.get(army);
      return a === undefined ? String(army) : armyName(a.nameNo);
    };
    const me = game.myPlayer()?.smallID() ?? 0;
    return html`${aid.volunteersOut.length === 0
      ? nothing
      : html`<div class=${HEADING}>
            ${translateText("ww1936.aid.volunteers_sent")}
          </div>
          <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
            ${aid.volunteersOut.map((v) => {
              const key = `recall:${v.army}`;
              const armed = this.armed(key);
              return html`<li
                data-ww-aid-volunteer=${v.army}
                class="flex items-center gap-2"
              >
                <span class="min-w-0 flex-1"
                  >${translateText("ww1936.aid.volunteers_line", {
                    army: name(v.army),
                    to: egName(game, v.to),
                    n: v.divisions,
                  })}</span
                >
                <button
                  type="button"
                  data-ww-aid-recall=${v.army}
                  data-armed=${String(armed)}
                  class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
                  @click=${() =>
                    this.confirmTap(key, () =>
                      this.send({ kind: "volunteers_recall", army: v.army }),
                    )}
                >
                  ${armed
                    ? translateText("ww1936.pol.tap_again")
                    : translateText("ww1936.aid.volunteers_recall")}
                </button>
              </li>`;
            })}
          </ul>`}
    ${aid.volunteersIn.length === 0
      ? nothing
      : html`<div class=${HEADING}>
            ${translateText("ww1936.aid.volunteers_received")}
          </div>
          <ul class="m-0 flex list-none flex-col gap-0.5 p-0 text-xs">
            ${aid.volunteersIn.map(
              (v) =>
                html`<li class="flex items-center gap-1.5">
                  ${this.flag(egFlag(game, v.from))}
                  <span class="min-w-0"
                    >${translateText("ww1936.aid.volunteers_line", {
                      army: `${egName(game, v.from)} ${name(v.army)}`,
                      to: egName(game, me),
                      n: v.divisions,
                    })}</span
                  >
                </li>`,
            )}
          </ul>`}`;
  }

  private flag(url: string | null) {
    return url === null
      ? nothing
      : html`<img
          src=${url}
          alt=""
          class="h-3 w-4 shrink-0 rounded-sm object-cover"
        />`;
  }
}

/** The player panel's aid pickers (spec §20.7). */
type AidPick = "volunteers" | "air" | "ships" | null;

/**
 * World War 1936 P5 (spec §20.7): the aid actions the player panel adds to
 * P3's list for another country — send lend-lease (the aid tab's new
 * contract with that country), ask it for lend-lease, send volunteers (pick
 * an army, the limit shown), a volunteer air group (type, count, zone),
 * transfer ships (a whole fleet), and the subject decisions on it. Blocked
 * ones are grey with one reason; irreversible ones take two taps.
 */
export class AidActions {
  private pick: AidPick = null;
  private pickFor = 0;
  private airType: AirType | null = null;
  private airCount = 10;
  private airZone = 0;
  private readonly twoTap = new TwoTap();

  render(
    game: EndgameGame,
    bus: EventBus,
    target: number,
    redraw: () => void,
  ): TemplateResult | typeof nothing {
    const me = game.myPlayer()?.smallID() ?? 0;
    if (
      game.wwEndgame?.() === null ||
      game.wwEndgame === undefined ||
      me === 0 ||
      target === me ||
      !wwActive(game, me) ||
      !wwActive(game, target)
    ) {
      return nothing;
    }
    if (this.pickFor !== target) {
      this.pickFor = target;
      this.pick = null;
    }
    const send = (o: WwOrder) => bus.emit(new SendWwOrderIntentEvent(o));
    const confirm = (key: string, act: () => void) => {
      if (this.twoTap.tap(key, Date.now())) act();
      redraw();
      setTimeout(redraw, TWO_TAP_MS + 50);
    };
    const armed = (key: string) => this.twoTap.isArmed(key, Date.now());
    const toggle = (p: AidPick) => {
      this.pick = this.pick === p ? null : p;
      redraw();
    };
    const ll = llGate(game, me, target);
    const vol = volunteerInputs(game, me, target, 0);
    const room = volunteerRoom(vol);
    const air = airVolunteerWhy(game, me, target);
    const ships = llGate(game, me, target, false);
    return html`<div data-ww-aid-actions class="flex flex-col gap-1.5">
      ${this.button(
        "aid_send",
        translateText("ww1936.aid.panel_send"),
        ll,
        () => bus.emit(new OpenWwAidEvent(target, "send")),
      )}
      ${this.button(
        "aid_request",
        translateText("ww1936.aid.request"),
        null,
        () => bus.emit(new OpenWwAidEvent(target, "request")),
      )}
      ${this.button(
        "volunteers_send",
        `${translateText("ww1936.aid.volunteers_send")} · ${translateText(
          "ww1936.aid.volunteers_cap",
          { n: room },
        )}`,
        null,
        () => toggle("volunteers"),
        this.pick === "volunteers",
      )}
      ${this.pick === "volunteers"
        ? this.renderArmies(game, me, target, send, confirm, armed)
        : nothing}
      ${this.button(
        "air_volunteers",
        translateText("ww1936.aid.air_volunteers"),
        air,
        () => toggle("air"),
        this.pick === "air",
      )}
      ${this.pick === "air" && air === null
        ? this.renderAir(game, me, target, send, confirm, armed, redraw)
        : nothing}
      ${this.button(
        "ships_transfer",
        translateText("ww1936.aid.ships"),
        ships,
        () => toggle("ships"),
        this.pick === "ships",
      )}
      ${this.pick === "ships" && ships === null
        ? this.renderShips(game, me, target, send, confirm, armed)
        : nothing}
      ${subjectActionsOn(game, me, target).map((a) => {
        const key = `subject:${a.decision}:${target}`;
        const on = a.state === 0 && armed(key);
        return html`<div class="flex flex-col">
          <button
            type="button"
            data-ww-act=${`subject_${a.id}`}
            data-armed=${String(on)}
            class="min-h-9 w-full rounded-lg border border-white/10 bg-white/4 px-2 py-1 text-left text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40 ${on
              ? "ring-2 ring-red-400"
              : ""}"
            ?disabled=${a.state !== 0}
            @click=${(e: MouseEvent) => {
              e.stopPropagation();
              confirm(key, () =>
                send({
                  kind: "decision_take",
                  decision: a.decision,
                  target,
                }),
              );
            }}
          >
            ${on ? translateText("ww1936.pol.tap_again") : a.label}
          </button>
          ${a.state === 0 || a.reason === null
            ? nothing
            : html`<span class="text-xs text-red-300">${a.reason}</span>`}
        </div>`;
      })}
    </div>`;
  }

  private button(
    id: string,
    label: string,
    block: Why | null,
    onClick: () => void,
    pressed = false,
  ): TemplateResult {
    return html`<div class="flex flex-col">
      <button
        type="button"
        data-ww-act=${id}
        aria-pressed=${String(pressed)}
        class="min-h-9 w-full rounded-lg border px-2 py-1 text-left text-sm font-semibold disabled:opacity-40 ${pressed
          ? "border-amber-300 bg-white/10"
          : "border-white/10 bg-white/4"} text-white/90 hover:bg-white/10"
        ?disabled=${block !== null}
        @click=${(e: MouseEvent) => {
          e.stopPropagation();
          onClick();
        }}
      >
        ${label}
      </button>
      ${why(block)}
    </div>`;
  }

  private renderArmies(
    game: EndgameGame,
    me: number,
    target: number,
    send: (o: WwOrder) => void,
    confirm: (key: string, act: () => void) => void,
    armed: (key: string) => boolean,
  ) {
    const armies = volunteerArmies(game, me, target);
    return html`<ul
      data-ww-aid-armies
      class="m-0 flex list-none flex-col gap-1 p-0 pl-2 text-xs"
    >
      ${armies.map((a) => {
        const key = `volunteers:${a.army}:${target}`;
        const on = a.why === null && armed(key);
        return html`<li class="flex flex-col">
          <button
            type="button"
            data-ww-aid-army=${a.army}
            data-armed=${String(on)}
            class="${BUTTON} text-left ${on ? "ring-2 ring-red-400" : ""}"
            ?disabled=${a.why !== null}
            @click=${(e: MouseEvent) => {
              e.stopPropagation();
              confirm(key, () =>
                send({ kind: "volunteers_send", army: a.army, to: target }),
              );
            }}
          >
            ${on
              ? translateText("ww1936.pol.tap_again")
              : translateText("ww1936.aid.volunteers_line", {
                  army: armyName(a.nameNo),
                  to: egName(game, target),
                  n: a.divisions,
                })}
          </button>
          ${why(a.why)}
        </li>`;
      })}
    </ul>`;
  }

  private renderAir(
    game: EndgameGame,
    me: number,
    target: number,
    send: (o: WwOrder) => void,
    confirm: (key: string, act: () => void) => void,
    armed: (key: string) => boolean,
    redraw: () => void,
  ) {
    const types = airVolunteerTypes(game, me);
    const zones = airVolunteerZones(game, target);
    const t = types.find((x) => x.type === this.airType) ?? types[0] ?? null;
    if (t === null || zones.length === 0) {
      return html`<p class="m-0 pl-2 text-xs text-red-300">
        ${translateText("ww1936.aid.why.volunteer_conditions")}
      </p>`;
    }
    const zone = zones.includes(this.airZone) ? this.airZone : zones[0];
    const count = Math.max(1, Math.min(t.cap, this.airCount));
    const key = `air:${target}:${t.type}:${zone}:${count}`;
    const on = armed(key);
    const set = (n: number) => {
      this.airCount = Math.max(1, Math.min(t.cap, n));
      redraw();
    };
    const sc = game.worldWarScenario();
    return html`<div data-ww-aid-air class="flex flex-col gap-1 pl-2 text-xs">
      <div class="flex flex-wrap gap-1">
        ${types.map(
          (x) =>
            html`<button
              type="button"
              data-ww-aid-plane=${x.type}
              aria-pressed=${String(x.type === t.type)}
              class="${BUTTON} ${x.type === t.type ? "border-amber-300" : ""}"
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.airType = x.type;
                redraw();
              }}
            >
              ${x.name}
            </button>`,
        )}
      </div>
      <div class="flex flex-wrap gap-1">
        ${zones.slice(0, 6).map(
          (z) =>
            html`<button
              type="button"
              data-ww-aid-zone=${z}
              aria-pressed=${String(z === zone)}
              class="${BUTTON} ${z === zone ? "border-amber-300" : ""}"
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.airZone = z;
                redraw();
              }}
            >
              ${sc === null ? String(z) : srName(sc, z)}
            </button>`,
        )}
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="${BUTTON} w-9"
          aria-label="−"
          @click=${(e: MouseEvent) => {
            e.stopPropagation();
            set(count - 10);
          }}
        >
          −
        </button>
        <span class="min-w-12 text-center tabular-nums"
          >${count} / ${t.cap}</span
        >
        <button
          type="button"
          class="${BUTTON} w-9"
          aria-label="+"
          @click=${(e: MouseEvent) => {
            e.stopPropagation();
            set(count + 10);
          }}
        >
          +
        </button>
        <button
          type="button"
          data-ww-aid-air-send
          data-armed=${String(on)}
          class="${BUTTON} ml-auto ${on ? "ring-2 ring-red-400" : ""}"
          @click=${(e: MouseEvent) => {
            e.stopPropagation();
            confirm(key, () =>
              send({
                kind: "air_volunteers",
                to: target,
                zone,
                plane: t.type,
                count,
              }),
            );
          }}
        >
          ${on
            ? translateText("ww1936.pol.tap_again")
            : translateText("ww1936.aid.air_volunteers")}
        </button>
      </div>
    </div>`;
  }

  private renderShips(
    game: EndgameGame,
    me: number,
    target: number,
    send: (o: WwOrder) => void,
    confirm: (key: string, act: () => void) => void,
    armed: (key: string) => boolean,
  ) {
    const fleets = shipFleets(game, me);
    return html`<ul
      data-ww-aid-fleets
      class="m-0 flex list-none flex-col gap-1 p-0 pl-2 text-xs"
    >
      ${fleets.map((f) => {
        const key = `ships:${f.fleet}:${target}`;
        const on = armed(key);
        return html`<li>
          <button
            type="button"
            data-ww-aid-fleet=${f.fleet}
            data-armed=${String(on)}
            class="${BUTTON} w-full text-left ${on
              ? "ring-2 ring-red-400"
              : ""}"
            @click=${(e: MouseEvent) => {
              e.stopPropagation();
              confirm(key, () =>
                send({ kind: "ships_transfer", to: target, ships: f.ships }),
              );
            }}
          >
            ${on
              ? translateText("ww1936.pol.tap_again")
              : `⚓ ${f.name} · ${f.count}`}
          </button>
        </li>`;
      })}
    </ul>`;
  }
}
