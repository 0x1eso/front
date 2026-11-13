// Great War 1914 (ww207 §9, U1): the bottom of the screen. One chip a party
// in the house, by seats (our own SVG mark, or a shield in its bloc colour
// with its short name; the standing bar, up to three red fervour marks, an
// amber dot while its ability can be asked, a thin ring of its tree's fill;
// ww212: 사기 and 질서 are back in the band, as before). A tap on a chip opens
// its card: its ideals in words, its support, its leader, its tree (연다), its
// ability (부탁한다), the lobby and 지지한다 / 규탄한다. Words, not numbers.
import {
  axesOf,
  GW_NODE_TIERS,
  type GwAxis,
  type GwNodeView,
  type GwStripFactionView,
  type GwTreeTemplate,
} from "@openfront/engine-api/ww1914/GwSociety";
import { html, nothing, svg, TemplateResult } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { factionName } from "./GwHouse";
import {
  axisName as axisNameOf,
  axisSide,
  chipWord,
  kindWord,
  nodeText,
  supportWord,
  tierWord,
  trustWord as trustWordOf,
  utopiaName as utopiaNameOf,
  utopiaNote,
  utopiaWhy,
} from "./GwSocietyWords";
import {
  factionColour,
  fervourMarks,
  ringFill,
  shieldLetters,
  STANDING_SEGMENTS,
  standingFilled,
  stripFactions,
} from "./GwStripModel";
import { BTN, BTN_ON, GLASS, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";
import { markOf } from "./marks/GwMarks";

/** A key's text, or null while no lane has written it yet. */
export function known(
  key: string,
  params?: Record<string, string | number>,
): string | null {
  const t = translateText(key, params);
  return t === key ? null : t;
}

// The words are lane C's (GwSocietyWords); these read them for the seat.

/** An axis side's word: 의회, 노동, 협조… */
export function sideWord(c: GwCtx, axis: GwAxis, side: number): string {
  return axisSide(c.seat.tag, axis, side < 0 ? -1 : 1);
}

export function axisName(c: GwCtx, axis: GwAxis): string {
  return axisNameOf(c.seat.tag, axis);
}

export function trustText(trust: number): string {
  return trustWordOf(trust);
}

/** A tree's name: the pack's own (사회민주 독일), else its template's. */
export function utopiaName(
  c: GwCtx,
  tree: { utopia: string; template: GwTreeTemplate },
): string {
  return utopiaNameOf(c.pack, tree.utopia, tree.template);
}

// ---- Marks ----

/** The fallback shield: the bloc's colour, two or three letters. */
function shield(c: GwCtx, f: { id: string; bloc: string }) {
  const letters = shieldLetters(c.pack, f.id);
  const size = Array.from(letters).length > 2 ? 6.5 : 8.5;
  return svg`<path d="M3 2.5h18v8.5c0 6-4 9.6-9 11.2C7 20.6 3 17 3 11z"
      fill=${factionColour(f)} stroke="rgba(15,23,42,0.6)" stroke-width="0.8" />
    <text x="12" y="13.6" text-anchor="middle" dominant-baseline="middle"
      font-size=${size} font-weight="700" fill="#0f172a">${letters}</text>`;
}

/** The mark in a ring of its tree's fill; `ring` null draws none. */
export function markSvg(
  c: GwCtx,
  f: { id: string; bloc: string },
  ring: number | null,
  cls: string,
): TemplateResult {
  const m = markOf(f.id);
  return html`<svg
    viewBox="-4 -4 32 32"
    class=${cls}
    aria-hidden="true"
    data-gw-mark=${m === null ? "shield" : "mark"}
  >
    ${ring === null
      ? nothing
      : svg`<circle cx="12" cy="12" r="15" fill="none"
            stroke="rgba(255,255,255,0.15)" stroke-width="1.6" />
          <circle cx="12" cy="12" r="15" fill="none" stroke="#fcd34d"
            stroke-width="1.6" pathLength="100" stroke-linecap="round"
            stroke-dasharray=${`${Math.round(ring * 100)} 100`}
            transform="rotate(-90 12 12)" data-gw-ring=${Math.round(ring * 100)} />`}
    ${m === null ? shield(c, f) : svg`<g>${unsafeSVG(m.svg)}</g>`}
  </svg>`;
}

// ---- The chips ----

function standingBar(trust: number, cls = "h-1 w-1 sm:w-2"): TemplateResult {
  const filled = standingFilled(trust);
  return html`<span class="flex gap-px" data-gw-standing=${filled}>
    ${Array.from(
      { length: STANDING_SEGMENTS },
      (_, i) =>
        html`<span
          class="${cls} rounded-sm ${i < filled
            ? filled <= 2
              ? "bg-red-400"
              : filled <= 3
                ? "bg-yellow-200"
                : "bg-emerald-300"
            : "bg-white/15"}"
        ></span>`,
    )}
  </span>`;
}

/** ww209: its word on the money bill on the agenda, by colour. */
const PURSE_COLOUR: Readonly<Record<string, string>> = {
  for: "bg-emerald-300 text-slate-900",
  against: "bg-red-400 text-slate-900",
  waver: "bg-yellow-200 text-slate-900",
  unknown: "bg-slate-500 text-white",
};

function chipTitle(c: GwCtx, f: GwStripFactionView): string {
  const parts = [
    factionName(c, f.id),
    trustText(f.trust),
    translateText(`gw.house.temper.${Math.min(4, Math.max(0, f.temper))}`),
  ];
  if (f.ability?.ready === true) parts.push(translateText("gw.strip.ready"));
  if (f.purse !== undefined && f.purse !== null) {
    parts.push(
      translateText("gw.strip.purse", {
        word: translateText(`gw.lobby.word.${f.purse}`),
      }),
    );
  }
  return parts.join(" · ");
}

function chip(c: GwCtx, f: GwStripFactionView): TemplateResult {
  const gone = f.status === "gone";
  const marks = fervourMarks(f.temper);
  return html`<button
    class="relative flex h-11 min-w-11 shrink-0 items-center gap-1 rounded-md border border-white/15 bg-slate-900/85 py-1 pl-1 pr-1.5 sm:gap-1.5 sm:pr-2 text-left text-white shadow hover:bg-slate-700/90 ${gone
      ? "opacity-40 grayscale"
      : ""} ${f.born ? "gw-born border-amber-300/60" : ""}"
    data-gw-chip=${f.id}
    data-gw-chip-status=${f.status}
    title=${chipTitle(c, f)}
    @click=${() => {
      c.ui.factionOpen = f.id;
      c.ui.condemnArmed = null;
      c.redraw();
    }}
  >
    <span class="relative h-9 w-9 shrink-0">
      ${markSvg(c, f, gone ? null : ringFill(f.affinity), "h-9 w-9")}
      ${f.ability?.ready === true && !gone
        ? html`<span
            class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-slate-900 bg-amber-300"
            data-gw-ability-ready
          ></span>`
        : nothing}
      ${f.purse === undefined || f.purse === null || gone
        ? nothing
        : html`<span
            class="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-slate-900 px-0.5 text-[9px] font-bold leading-tight ${PURSE_COLOUR[
              f.purse
            ]}"
            data-gw-purse=${f.purse}
            >${translateText(`gw.lobby.word.${f.purse}`)}</span
          >`}
    </span>
    <span class="flex min-w-0 flex-col items-start gap-1">
      <span class="max-w-[7rem] truncate text-xs font-bold leading-none">
        <span class="sm:hidden">${shieldLetters(c.pack, f.id)}</span>
        <span class="hidden sm:inline">${factionName(c, f.id)}</span>
      </span>
      ${gone
        ? html`<span class="text-[10px] leading-none text-white/70"
            >${chipWord("gone")}</span
          >`
        : html`<span class="flex items-center gap-1">
            ${standingBar(f.trust)}
            ${marks === 0
              ? nothing
              : html`<span class="flex gap-px" data-gw-fervour=${marks}>
                  ${Array.from(
                    { length: marks },
                    () =>
                      html`<span
                        class="h-1.5 w-1 rounded-sm bg-red-500"
                      ></span>`,
                  )}
                </span>`}
          </span>`}
    </span>
    ${f.born && !gone
      ? html`<span
          class="absolute -top-2 left-1 rounded bg-amber-300 px-1 text-[10px] font-bold leading-4 text-slate-900"
          data-gw-born
          >${chipWord("new")}</span
        >`
      : nothing}
  </button>`;
}

const STRIP_STYLE = html`<style>
  @keyframes gwborn {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  [data-gw-strip] .gw-born {
    animation: gwborn 600ms ease-out both;
  }
  [data-gw-strip-chips] {
    scrollbar-width: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [data-gw-strip] .gw-born {
      animation: none;
    }
  }
</style>`;

/**
 * The bottom strip: the party chips. `fit` is the drawer's: on a phone the
 * chips stand on top of the folded sheet and are gone while it is open.
 * ww212: 사기 and 질서 are back in the band, as before ww208.
 */
export function strip(
  c: GwCtx,
  fit: "full" | "low" | "fold",
  hidden: boolean,
): TemplateResult | typeof nothing {
  const chips = stripFactions(c.seat.world.society);
  if (chips.length === 0) return nothing;
  return html`${STRIP_STYLE}
    <div
      data-gw-strip
      class="pointer-events-none fixed inset-x-0 bottom-9 z-[896] flex flex-col gap-1 px-1.5 pb-1 sm:bottom-0 sm:pb-1.5 ${fit ===
      "fold"
        ? "sm:left-0"
        : "max-sm:hidden sm:left-[400px]"} sm:px-2 ${hidden ? "invisible" : ""}"
    >
      <div
        class="pointer-events-auto flex gap-1.5 overflow-x-auto pt-2"
        data-gw-strip-chips
        role="list"
        aria-label=${translateText("gw.strip.label")}
      >
        ${chips.map((f) => chip(c, f))}
      </div>
    </div>`;
}

// ---- The faction card ----

function openRule(c: GwCtx, group: string, power: string | null): void {
  const prev = c.ui.rule ?? null;
  const groups = prev?.groups ?? [];
  c.ui.rule = {
    open: power,
    target: null,
    picks: {},
    groups: groups.includes(group) ? groups : [...groups, group],
  };
  c.ui.tab = "rule";
  c.ui.folded = false;
  c.ui.factionOpen = null;
  c.redraw();
}

function idealsLine(c: GwCtx, f: GwStripFactionView): TemplateResult {
  const words = axesOf(c.seat.tag)
    .filter((a) => (f.ideals[a] ?? 0) !== 0)
    .map((a) => sideWord(c, a, f.ideals[a] ?? 0));
  return html`<div class="space-y-1" data-gw-card-ideals>
    <p class=${MUTED}>${translateText("gw.strip.card.ideals")}</p>
    ${words.length === 0
      ? html`<p class="text-sm text-white/80">
          ${translateText("gw.strip.card.no_ideals")}
        </p>`
      : html`<div class="flex flex-wrap gap-1">
          ${words.map(
            (w) =>
              html`<span
                class="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-sm"
                >${w}</span
              >`,
          )}
        </div>`}
  </div>`;
}

function standingLines(c: GwCtx, f: GwStripFactionView): TemplateResult {
  const row = (k: string, v: string, extra: unknown = nothing) =>
    html`<div class="flex items-center gap-2 text-sm">
      <span class="w-14 shrink-0 text-xs text-white/55"
        >${translateText(`gw.strip.card.${k}`)}</span
      >
      <span class="text-white/90">${v}</span>${extra}
    </div>`;
  return html`<div class="space-y-1" data-gw-card-standing>
    ${row("support", supportWord(f.support))}
    ${row(
      "trust",
      trustText(f.trust),
      html`<span class="ml-auto">${standingBar(f.trust, "h-1.5 w-3")}</span>`,
    )}
    ${row(
      "temper",
      translateText(`gw.house.temper.${Math.min(4, Math.max(0, f.temper))}`),
    )}
    ${f.leader === null ? nothing : row("leader", personName(c.pack, f.leader))}
  </div>`;
}

function abilityBox(c: GwCtx, f: GwStripFactionView) {
  const a = f.ability;
  if (a === null) return nothing;
  const p = c.pack?.powers?.[a.power];
  const why =
    a.why === null
      ? null
      : (p?.why?.[a.why] ?? known(`gw.power.why.${a.why}`) ?? a.why);
  return html`<section
    class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
    data-gw-card-ability=${a.power}
  >
    <h4 class=${HEAD}>${translateText("gw.strip.card.ability")}</h4>
    <p class="text-sm text-white/90">${p?.name ?? a.power}</p>
    ${p?.note === undefined ? nothing : html`<p class=${MUTED}>${p.note}</p>`}
    ${a.turned
      ? html`<p class="text-xs text-red-300" data-gw-ability-turned>
          ${translateText("gw.strip.card.turned")}
        </p>`
      : nothing}
    ${why === null
      ? nothing
      : html`<p class="${MUTED} italic" data-gw-ability-why>${why}</p>`}
    <button
      class="${a.ready ? BTN_ON : BTN} w-full !text-center"
      ?disabled=${!a.ready}
      data-gw-ability-ask
      @click=${() => openRule(c, "factions", a.power)}
    >
      ${translateText("gw.strip.card.ask")}
    </button>
  </section>`;
}

function nodeCell(
  c: GwCtx,
  f: GwStripFactionView,
  tree: NonNullable<GwStripFactionView["tree"]>,
  n: GwNodeView,
): TemplateResult {
  const why = n.open || n.can || n.why === null ? null : utopiaWhy(n.why);
  return html`<div
    class="flex min-h-[4.5rem] flex-col gap-1 rounded border p-1.5 text-xs ${n.open
      ? "border-amber-300/70 bg-amber-300/15"
      : n.can
        ? "border-white/40 bg-white/10"
        : "border-white/10 bg-black/30 text-white/60"}"
    data-gw-node=${n.id}
    data-gw-node-state=${n.open ? "open" : n.can ? "can" : "shut"}
  >
    <span class="font-bold leading-tight text-white/90"
      >${nodeText(c.pack, tree.utopia, tree.template, n.id).name}</span
    >
    <span class="text-[10px] text-white/50">${kindWord(n.kind)}</span>
    ${n.open
      ? html`<span class="mt-auto text-amber-200"
          >${translateText("gw.strip.card.opened")}</span
        >`
      : n.can
        ? html`<button
            class="${BTN_ON} mt-auto min-h-8 !px-2 !py-1 !text-center !text-xs"
            data-gw-node-open
            @click=${() => {
              c.send({ kind: "node_open", faction: f.id, node: n.id });
              c.redraw();
            }}
          >
            ${translateText("gw.strip.card.open")}
          </button>`
        : why === null
          ? nothing
          : html`<span class="mt-auto italic leading-tight">${why}</span>`}
  </div>`;
}

function treeBox(c: GwCtx, f: GwStripFactionView) {
  const tree = f.tree;
  if (tree === null) return nothing;
  const note = utopiaNote(c.pack, tree.utopia, tree.template);
  return html`<section
    class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
    data-gw-card-tree=${tree.utopia}
  >
    <div class="flex items-center gap-2">
      <h4 class=${HEAD}>${translateText("gw.strip.card.tree")}</h4>
      <span class="text-sm text-amber-100">${utopiaName(c, tree)}</span>
    </div>
    ${html`<p class=${MUTED}>${note}</p>`}
    <div class="flex items-center gap-2">
      <span class="h-1.5 flex-1 overflow-hidden rounded bg-white/10"
        ><span
          class="block h-1.5 rounded bg-amber-300"
          style="width:${Math.round(ringFill(f.affinity) * 100)}%"
        ></span
      ></span>
      <span class=${MUTED}
        >${translateText(
          `gw.strip.affinity.${Math.min(4, Math.floor(ringFill(f.affinity) * 5))}`,
        )}</span
      >
    </div>
    ${GW_NODE_TIERS.map((tier) => {
      const nodes = tree.nodes.filter((n) => n.tier === tier);
      if (nodes.length === 0) return nothing;
      return html`<div class="space-y-1" data-gw-tier=${tier}>
        <p class=${MUTED}>${tierWord(tier)}</p>
        <div class="grid grid-cols-3 gap-1">
          ${nodes.map((n) => nodeCell(c, f, tree, n))}
        </div>
      </div>`;
    })}
    ${tree.ready
      ? html`<button
          class="${BTN_ON} w-full !text-center font-bold"
          data-gw-realise
          @click=${() => {
            c.send({ kind: "utopia_realise", faction: f.id });
            c.ui.factionOpen = null;
            c.redraw();
          }}
        >
          ${translateText("gw.strip.card.realise")}
        </button>`
      : nothing}
  </section>`;
}

function actions(c: GwCtx, f: GwStripFactionView) {
  const armed = c.ui.condemnArmed === f.id;
  return html`<div class="flex flex-wrap gap-1.5" data-gw-card-acts>
    ${f.promote
      ? html`<button
          class="${BTN} min-h-10 flex-1 !text-center"
          data-gw-promote
          @click=${() => {
            c.send({ kind: "faction_promote", faction: f.id });
            c.ui.condemnArmed = null;
            c.redraw();
          }}
        >
          ${translateText("gw.strip.card.promote")}
        </button>`
      : nothing}
    ${f.condemn
      ? html`<button
          class="${armed
            ? "rounded border border-red-400 bg-red-500/30 px-3 py-1.5 text-sm text-white"
            : BTN} min-h-10 flex-1 !text-center"
          data-gw-condemn=${armed ? "armed" : "idle"}
          @click=${() => {
            if (armed) {
              c.send({ kind: "faction_condemn", faction: f.id });
              c.ui.condemnArmed = null;
            } else {
              c.ui.condemnArmed = f.id;
            }
            c.redraw();
          }}
        >
          ${translateText(
            armed ? "gw.strip.card.condemn_again" : "gw.strip.card.condemn",
          )}
        </button>`
      : nothing}
    <button
      class="${BTN} min-h-10 flex-1 !text-center"
      data-gw-card-lobby
      @click=${() => openRule(c, "house", null)}
    >
      ${translateText("gw.strip.card.lobby")}
    </button>
  </div>`;
}

/** The card a chip opens; nothing while none is open or its party left the strip. */
export function factionCard(c: GwCtx): TemplateResult | typeof nothing {
  const id = c.ui.factionOpen ?? null;
  if (id === null) return nothing;
  const f = c.seat.world.society?.factions.find((x) => x.id === id);
  if (f === undefined) return nothing;
  const close = () => {
    c.ui.factionOpen = null;
    c.ui.condemnArmed = null;
    c.redraw();
  };
  const gone = f.status === "gone";
  const note = c.pack?.factions?.[f.id]?.note;
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 sm:items-center sm:p-3"
    data-gw-faction-card=${f.id}
    @click=${(e: Event) => {
      if (e.target === e.currentTarget) close();
    }}
  >
    <div
      class="${GLASS} max-h-[85vh] w-full space-y-2.5 overflow-y-auto rounded-t-lg p-3 text-white sm:max-w-lg sm:rounded-lg"
    >
      <div class="flex items-start gap-3">
        ${markSvg(
          c,
          f,
          gone ? null : ringFill(f.affinity),
          "h-14 w-14 shrink-0",
        )}
        <div class="min-w-0 flex-1 space-y-0.5">
          <h3 class="${HEAD} !text-base">${factionName(c, f.id)}</h3>
          <p class=${MUTED}>
            ${c.pack?.press?.blocs[f.bloc]?.name ?? f.bloc} ·
            ${translateText("gw.lobby.seats", { n: f.seats })}
          </p>
          ${f.born && !gone
            ? html`<p class="text-xs text-amber-200">
                ${translateText("gw.strip.card.born")}
              </p>`
            : nothing}
        </div>
        <button
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
          aria-label=${translateText("gw.strip.card.close")}
          data-gw-card-close
          @click=${close}
        >
          ✕
        </button>
      </div>
      ${note === undefined
        ? nothing
        : html`<p class="text-sm text-white/75">${note}</p>`}
      ${gone
        ? html`<p class="text-sm text-white/80" data-gw-card-gone>
            ${translateText("gw.strip.card.gone")}
          </p>`
        : html`${idealsLine(c, f)} ${standingLines(c, f)} ${abilityBox(c, f)}
          ${treeBox(c, f)} ${actions(c, f)}`}
    </div>
  </div>`;
}
