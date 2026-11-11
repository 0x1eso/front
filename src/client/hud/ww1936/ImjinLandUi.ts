// ww177 I3b (Imjin design §4, §5 "Readable on the map"): the Imjin land
// battle's part of the battle card (the phase clock, the order pair, the
// ambush and the crossing, the volley clock, the order chips) and the siege
// panel, shared by the battle card and the region card. The existing card
// frames and chip style; the words come from ImjinLandModel.
import type { BattleSummary } from "@openfront/engine-api/ww1936/LandTypes";
import {
  ATTACK_ORDERS,
  DEFENCE_STANCES,
} from "@openfront/engine-lib/imjin/LandRules";
import type { EventBus } from "@openfront/shared/EventBus";
import { html, nothing, type TemplateResult } from "lit";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  ambushLockTicks,
  crossingView,
  phaseClock,
  siegeOrderIndex,
  siegePanel,
  type VolleyLine,
  volleyView,
} from "./ImjinLandModel";
import { landSidesOf } from "./LandModel";
import { imjinMonth } from "./LensModel";
import { wwSeconds } from "./WorldWarModel";

const CHIP =
  "h-8 max-sm:h-10 rounded-md border px-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
const CHIP_PENDING = "border-amber-300 bg-amber-700/50";
const CHIP_CURRENT = "border-white/40 bg-white/20";
const CHIP_IDLE = "border-white/15 bg-white/5 hover:bg-white/15";

const orderName = (k: string) => translateText(`imjin.battle.order.${k}`);

function sendOrder(
  bus: EventBus,
  region: number,
  attack: boolean,
  index: number,
): void {
  bus.emit(
    new SendWwOrderIntentEvent({ kind: "imjin_battle", region, attack, index }),
  );
}

function volleyText(who: "mine" | "foe", v: VolleyLine): string {
  const beat =
    v.beat === "fire"
      ? translateText("imjin.battle.volley.fire")
      : v.beat === "reload"
        ? translateText("imjin.battle.volley.reload", { n: v.nextFire })
        : translateText("imjin.battle.volley.rolling");
  return translateText("imjin.battle.volley.line", {
    who: translateText(`imjin.battle.volley.${who}`),
    beat,
  });
}

/** The Imjin rows of a battle's card; nothing outside the Imjin War. */
export function imjinBattleBlock(
  game: GameView,
  bus: EventBus,
  b: BattleSummary,
): TemplateResult | typeof nothing {
  const navy = game.wwNavy?.() ?? null;
  const im = navy?.imjin ?? null;
  const s = game.worldWarScenario();
  if (navy === null || im === null || s === null) return nothing;
  const o = im.orders.find((x) => x.region === b.region);
  const me = game.myPlayer()?.smallID() ?? 0;
  const sides = landSidesOf(game);
  const attack = me !== 0 && sides.sameSide(me, b.attacker);
  const defend = !attack && me !== 0 && sides.sameSide(me, b.defender);
  const tick = game.ticks();
  const first = navy.imjinClock.firstRound(b.region);
  const clock = first === undefined ? null : phaseClock(first, tick);
  const lock =
    o === undefined || first === undefined
      ? 0
      : ambushLockTicks(o.ambushed !== 0, first, tick);
  const crossing =
    o === undefined || clock === null
      ? null
      : crossingView(o.edge, imjinMonth(game), clock.round);
  const tagOf = (id: number) => s.tagOfSmallId(id) ?? "";
  const volley =
    o === undefined || clock === null || (!attack && !defend)
      ? null
      : attack
        ? volleyView(
            tagOf(b.attacker),
            ATTACK_ORDERS[o.att] ?? "advance",
            tagOf(b.defender),
            DEFENCE_STANCES[o.def] ?? "hold",
            clock.round,
          )
        : volleyView(
            tagOf(b.defender),
            DEFENCE_STANCES[o.def] ?? "hold",
            tagOf(b.attacker),
            ATTACK_ORDERS[o.att] ?? "advance",
            clock.round,
          );
  const siege = im.sieges.find((x) => x.region === b.region);
  return html`<div data-ww-imjin-orders class="flex flex-col gap-1">
    ${clock === null
      ? nothing
      : html`<div data-ww-imjin-phase class="text-white/80">
          ${translateText("imjin.battle.phase_line", {
            phase: clock.phase,
            step: translateText(`imjin.battle.step.${clock.step}`),
            secs: wwSeconds(game, clock.ticksLeft),
          })}
        </div>`}
    ${o === undefined
      ? nothing
      : html`<div class="text-white/80">
          ${translateText("imjin.battle.orders_line", {
            att: orderName(ATTACK_ORDERS[o.att]),
            def: orderName(DEFENCE_STANCES[o.def]),
          })}
        </div>`}
    ${o !== undefined && o.ambushed !== 0
      ? html`<div data-ww-imjin-ambush class="text-amber-300">
          ${lock > 0
            ? translateText("imjin.battle.ambush_locked", {
                secs: wwSeconds(game, lock),
              })
            : translateText("imjin.battle.ambushed")}
        </div>`
      : nothing}
    ${crossing === null
      ? nothing
      : html`<div
          data-ww-imjin-crossing=${crossing.phasesLeft}
          class=${crossing.phasesLeft > 0 ? "text-sky-300" : "text-white/70"}
        >
          ${crossing.phasesLeft > 0
            ? translateText("imjin.battle.crossing_line", {
                edge: translateText(`imjin.battle.edge.${crossing.edge}`),
                n: crossing.phasesLeft,
                pct: `${crossing.attackerPct < 0 ? "−" : "+"}${Math.abs(crossing.attackerPct)}`,
                w: `${crossing.widthNum}/${crossing.widthDen}`,
              })
            : translateText("imjin.battle.crossing_done", {
                edge: translateText(`imjin.battle.edge.${crossing.edge}`),
              })}
          ${crossing.frozen
            ? html`<span class="text-white/60"
                >${translateText("imjin.battle.crossing_frozen")}</span
              >`
            : nothing}
        </div>`}
    ${volley === null ? nothing : renderVolley(volley.mine, volley.foe)}
    ${siege === undefined
      ? nothing
      : imjinSiegeBlock(game, b.region, { bus, battle: b })}
    ${attack || defend
      ? renderChips(bus, b.region, attack, o, lock > 0)
      : nothing}
  </div>`;
}

function renderVolley(
  mine: VolleyLine | null,
  foe: VolleyLine | "hidden" | null,
): TemplateResult | typeof nothing {
  if (mine === null && foe === null) return nothing;
  return html`<div data-ww-imjin-volley class="flex flex-col">
    ${mine === null
      ? nothing
      : html`<span
          data-ww-imjin-volley-mine=${mine.beat}
          class=${mine.beat === "reload" ? "text-amber-300" : "text-white/80"}
          >${volleyText("mine", mine)}</span
        >`}
    ${foe === null
      ? nothing
      : foe === "hidden"
        ? html`<span data-ww-imjin-volley-foe="hidden" class="text-white/50"
            >${translateText("imjin.battle.volley.foe_hidden")}</span
          >`
        : html`<span
            data-ww-imjin-volley-foe=${foe.beat}
            class=${foe.beat === "reload" ? "text-amber-300" : "text-white/80"}
            >${volleyText("foe", foe)}</span
          >`}
  </div>`;
}

function renderChips(
  bus: EventBus,
  region: number,
  attack: boolean,
  o: { att: number; def: number; pendAtt: number; pendDef: number } | undefined,
  locked: boolean,
): TemplateResult {
  const list = attack ? ATTACK_ORDERS : DEFENCE_STANCES;
  const pending = o === undefined ? -1 : attack ? o.pendAtt : o.pendDef;
  const current = o === undefined ? -1 : attack ? o.att : o.def;
  return html`<div data-ww-imjin-chips class="flex flex-col gap-0.5">
    <div class="text-[11px] text-white/60">
      ${translateText(
        locked ? "imjin.battle.chips_locked" : "imjin.battle.chips_title",
      )}
      ${pending >= 0
        ? html`<span class="text-amber-300"
            >${translateText("imjin.battle.pending_line", {
              order: orderName(list[pending]),
            })}</span
          >`
        : nothing}
    </div>
    <div class="flex flex-wrap gap-1">
      ${list.map(
        (k, i) =>
          html`<button
            type="button"
            data-ww-imjin-chip=${k}
            aria-pressed=${String(i === current || i === pending)}
            title=${translateText(`imjin.battle.hint.${k}`)}
            ?disabled=${locked}
            class="${CHIP} ${i === pending
              ? CHIP_PENDING
              : i === current
                ? CHIP_CURRENT
                : CHIP_IDLE}"
            @click=${() => sendOrder(bus, region, attack, i)}
          >
            ${orderName(k)}
          </button>`,
      )}
    </div>
  </div>`;
}

/**
 * The siege panel (design §5 "Sieges"): the grain, the walls and the
 * garrison's morale; what the besiegers do (cannon breach, else they
 * starve it out); and, in the battle card, the assault (storm the walls)
 * or the sortie (the sally: a counter-charge) for the next phase.
 */
export function imjinSiegeBlock(
  game: GameView,
  region: number,
  opts: { bus?: EventBus; battle?: BattleSummary | null } = {},
): TemplateResult | typeof nothing {
  const im = game.wwNavy?.()?.imjin ?? null;
  const land = game.wwLand?.() ?? null;
  const s = game.worldWarScenario();
  if (im === null || land === null || s === null) return nothing;
  const raw = im.sieges.find((x) => x.region === region);
  if (raw === undefined) return nothing;
  const me = game.myPlayer()?.smallID() ?? 0;
  const sides = landSidesOf(game);
  const p = siegePanel(raw, s, land.controller, me, (a, b) =>
    sides.isEnemy(a, b),
  );
  const battle = opts.battle ?? null;
  const bus = opts.bus;
  const methodKey =
    p.method === "breach"
      ? p.role === "besieger"
        ? "imjin.siege.method_breach_mine"
        : "imjin.siege.method_breach"
      : p.role === "besieger"
        ? "imjin.siege.method_starve_mine"
        : "imjin.siege.method_starve";
  const methodChip = (m: "breach" | "starve") =>
    html`<span
      data-ww-imjin-siege-method=${m}
      aria-current=${String(p.method === m)}
      title=${translateText(`imjin.siege.${m}_hint`)}
      class="inline-flex h-8 max-sm:h-10 items-center rounded-md border px-1.5 ${p.method ===
      m
        ? CHIP_CURRENT
        : "border-white/10 text-white/40"}"
      >${translateText(`imjin.siege.${m}`)}</span
    >`;
  const action = (kind: "assault" | "sortie") => {
    const attack = kind === "assault";
    const index = siegeOrderIndex(kind);
    const ready = battle !== null && bus !== undefined;
    return html`<button
      type="button"
      data-ww-imjin-siege-action=${kind}
      ?disabled=${!ready}
      title=${translateText(
        ready ? `imjin.siege.${kind}_hint` : `imjin.siege.${kind}_wait`,
      )}
      class="${CHIP} ${CHIP_IDLE}"
      @click=${() => {
        if (ready) sendOrder(bus!, region, attack, index);
      }}
    >
      ${translateText(`imjin.siege.${kind}`)}
    </button>`;
  };
  return html`<div
    data-ww-imjin-siege=${region}
    class="flex flex-col gap-1 rounded-md border border-amber-300/30 bg-amber-900/20 p-1.5"
  >
    <div class="font-semibold text-amber-300">
      ${translateText("imjin.battle.siege_line", {
        days: p.grainDays,
        fort: p.fort,
      })}
    </div>
    <div class="text-white/80">
      ${p.starving
        ? html`<span class="text-red-300"
            >${translateText("imjin.siege.starving")}</span
          >`
        : translateText("imjin.siege.grain_hint")}
      ·
      ${translateText("imjin.siege.morale", { pct: Math.round(p.morale / 10) })}
    </div>
    <div class="text-white/80">
      ${translateText(methodKey, { days: p.breachEvery })}
    </div>
    <div class="flex flex-wrap items-center gap-1">
      ${p.role === "besieger" ? action("assault") : nothing}
      ${methodChip("breach")} ${methodChip("starve")}
      ${p.role === "defender" ? action("sortie") : nothing}
    </div>
    ${p.role === "watcher" || battle !== null
      ? nothing
      : html`<div class="text-[11px] text-white/60">
          ${translateText(
            p.role === "besieger"
              ? "imjin.siege.assault_wait"
              : "imjin.siege.sortie_wait",
          )}
        </div>`}
  </div>`;
}
