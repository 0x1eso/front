// Great War 1914 (ww218 §5): the card a tapped army token opens. Beside the
// map on a wide screen, a bottom sheet (42 % high) on a phone; the same lines
// in both. Counts are shown as information; how sure and how full read as
// words; the only choice is "다른 전선으로 옮기자고 한다", whose result
// comes later, through the chief of staff's war papers.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwFleetTokenView,
  GwSeaArea,
} from "@openfront/engine-api/ww1914/GwFleets";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import {
  gwEtaWord,
  type GwTokenMove,
  type GwTokenView,
} from "@openfront/engine-api/ww1914/GwTokens";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, type TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { gwName } from "./GwFateModel";
import { gwFleetKey } from "./GwFleetModel";
import { BTN, GLASS, HEAD, MUTED } from "./GwStyle";
import { placeName } from "./GwTableModel";
import { frontLine, personName, textOrNull } from "./GwText";
import { gwTokenKey } from "./GwTokenModel";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

const theatre = (t: GwTheatre) => translateText(`gw.theatre.${t}`);

/** 0 nearly empty .. 3 full, from fill 0..100. */
export function fillWord(fill: number): number {
  return fill >= 90 ? 3 : fill >= 65 ? 2 : fill >= 40 ? 1 : 0;
}

/** 0 near breaking .. 3 in good order, from order 0..100. */
export function orderWord(order: number): number {
  return order >= 75 ? 3 : order >= 50 ? 2 : order >= 25 ? 1 : 0;
}

/** "독일군 68개 사단", "프랑스군 40~55개 사단", "영국군 · 규모를 모른다". */
export function tokenCount(t: GwTokenView): string {
  const army = translateText("gw.token.army", { country: gwName(t.tag) });
  if (t.divs === null || t.sure <= 0) {
    return translateText("gw.token.count_unknown", { army });
  }
  if (t.rel !== "own" && t.lo !== t.hi) {
    return translateText("gw.token.count_range", {
      army,
      lo: t.lo,
      hi: t.hi,
    });
  }
  return translateText("gw.token.count", { army, n: t.divs });
}

/** The words after the count: how full, in what order, how sure and why. */
export function tokenWords(t: GwTokenView): string[] {
  const out: string[] = [];
  if (t.fill !== null) {
    out.push(translateText(`gw.token.fill.${fillWord(t.fill)}`));
  }
  if (t.order !== null) {
    out.push(translateText(`gw.token.order.${orderWord(t.order)}`));
  }
  if (t.rel !== "own") {
    out.push(
      translateText("gw.token.sure_seen", {
        sure: translateText(
          `gw.token.sure.${Math.max(0, Math.min(3, t.sure))}`,
        ),
        seen: translateText(`gw.token.seen.${t.seen}`),
      }),
    );
  }
  return out;
}

/** The card's title: the front and its line, the reserve, the rails, the land held. */
export function tokenTitle(c: GwCtx, t: GwTokenView): string {
  if (t.kind === "front" && t.theatre !== null) {
    const f = c.seat.world.fronts.find((x) => x.id === t.theatre);
    return f === undefined
      ? theatre(t.theatre)
      : translateText("gw.token.title_front", {
          front: theatre(t.theatre),
          line: frontLine(t.theatre, f.line),
        });
  }
  if (t.kind === "garrison" && t.group !== undefined) {
    return translateText("gw.token.title_garrison", {
      land: translateText(`gw.land.${t.group}`),
    });
  }
  return translateText(`gw.token.title_${t.kind}`);
}

/** A destination's line: "동부 전선 · 철도로 한 달쯤". */
export function moveLine(m: GwTokenMove): string {
  return translateText("gw.token.move_to", {
    front: theatre(m.to),
    eta: translateText(`gw.token.eta.${gwEtaWord(m.eta)}`),
  });
}

function flag(tag: GwTag): TemplateResult {
  return html`<img
    class="h-4 w-6 shrink-0 rounded-sm object-cover"
    src=${assetUrl(`flags/${gwCountry(tag).flag}.svg`)}
    alt=""
  />`;
}

function row(t: GwTokenView, on: boolean): TemplateResult {
  return html`<div
    class="flex items-start gap-2 text-sm ${on ? "text-amber-100" : ""}"
    data-gw-token-row=${gwTokenKey(t)}
  >
    ${flag(t.tag)}
    <div class="min-w-0">
      <div>${tokenCount(t)}</div>
      <div class=${MUTED}>${tokenWords(t).join(" · ")}</div>
    </div>
  </div>`;
}

/** The tokens the card lists: a front's both ends, or the token alone. */
function rowsOf(all: readonly GwTokenView[], t: GwTokenView) {
  if (t.kind !== "front") return { ours: [t], theirs: [] };
  const here = all.filter((x) => x.kind === "front" && x.theatre === t.theatre);
  return {
    ours: here.filter((x) => x.rel !== "foe"),
    theirs: here.filter((x) => x.rel === "foe"),
  };
}

/** What the moving token and the reserve add: where to, and when. */
function whenLine(t: GwTokenView): TemplateResult | typeof nothing {
  if (t.eta === undefined) return nothing;
  const w = gwEtaWord(t.eta);
  if (t.kind === "moving" && t.to !== undefined) {
    return html`<p class="text-sm" data-gw-token-when>
      ${translateText("gw.token.on_rails", {
        from:
          t.theatre === null
            ? translateText("gw.token.title_reserve")
            : theatre(t.theatre),
        to: theatre(t.to),
        when: translateText(`gw.token.arrive.${w}`),
      })}
    </p>`;
  }
  if (t.kind === "reserve") {
    return html`<p class="${MUTED}" data-gw-token-when>
      ${translateText(`gw.token.due.${w}`)}
    </p>`;
  }
  return nothing;
}

function close(c: GwCtx): void {
  c.ui.token = null;
  c.ui.tokenMove = false;
  c.redraw();
}

/** "다른 전선으로 옮기자고 한다" and, once pressed, where to. */
function moveBox(c: GwCtx, t: GwTokenView): TemplateResult | typeof nothing {
  const moves = t.rel === "own" ? (t.moves ?? []) : [];
  if (moves.length === 0) return nothing;
  const asked = c.ui.tokenAsked ?? null;
  const from = t.kind === "reserve" ? null : t.theatre;
  if (asked !== null && asked.from === from) {
    return html`<p class="${BOX} text-sm" data-gw-token-asked>
      ${translateText("gw.token.asked", { front: theatre(asked.to) })}
    </p>`;
  }
  if (c.ui.tokenMove !== true) return nothing;
  return html`<section class=${BOX} data-gw-token-moves>
    <div class=${MUTED}>${translateText("gw.token.move_where")}</div>
    ${moves.map(
      (m) =>
        html`<button
          class="${BTN} min-h-10 w-full"
          data-gw-token-move=${m.to}
          ?disabled=${!m.open}
          @click=${() => {
            c.send({ kind: "move_band", from, to: m.to });
            c.ui.tokenAsked = { from, to: m.to };
            c.ui.tokenMove = false;
            c.redraw();
          }}
        >
          <div>${moveLine(m)}</div>
          ${m.open
            ? nothing
            : html`<div class=${MUTED}>
                ${(m.why === null
                  ? null
                  : textOrNull(`gw.ui.block.${m.why}`)) ??
                translateText("gw.token.closed")}
              </div>`}
        </button>`,
    )}
  </section>`;
}

/** The card of a tapped token; nothing when it has gone from the view. */
export function tokenSheet(
  c: GwCtx,
  tokens: readonly GwTokenView[],
  key: string,
): TemplateResult | typeof nothing {
  const t = tokens.find((x) => gwTokenKey(x) === key);
  if (t === undefined) return nothing;
  const { ours, theirs } = rowsOf(tokens, t);
  const canMove =
    t.rel === "own" &&
    (t.moves ?? []).length > 0 &&
    c.ui.tokenAsked?.from !== (t.kind === "reserve" ? null : t.theatre);
  const moveBtn = canMove
    ? html`<button
        class="${BTN} min-h-10 flex-1 text-center sm:w-full sm:flex-none"
        data-gw-token-ask
        @click=${(e: Event) => {
          c.ui.tokenMove = c.ui.tokenMove !== true;
          c.redraw();
          // On a phone the list opens below the fold of the sheet.
          const sheet = (e.currentTarget as HTMLElement).closest(
            "[data-gw-token-sheet]",
          );
          requestAnimationFrame(() =>
            sheet
              ?.querySelector("[data-gw-token-moves]")
              ?.scrollIntoView?.({ block: "nearest" }),
          );
        }}
      >
        <span class="sm:hidden">${translateText("gw.token.move_short")}</span>
        <span class="max-sm:hidden">${translateText("gw.token.move")}</span>
      </button>`
    : nothing;
  return html`<aside
    data-gw-token-sheet=${key}
    class="${GLASS} pointer-events-auto fixed inset-x-0 bottom-0 z-[905] flex h-[42vh] flex-col text-white sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-24 sm:h-auto sm:max-h-[calc(100vh-7rem)] sm:w-[320px] sm:rounded-md"
  >
    <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <header class="flex items-center gap-2">
        <h3 class="${HEAD} !text-base">${tokenTitle(c, t)}</h3>
        <button
          class="${MUTED} ml-auto min-h-10 px-2 hover:text-white max-sm:hidden"
          data-gw-token-close
          @click=${() => close(c)}
        >
          ✕
        </button>
      </header>
      <section class=${BOX} data-gw-token-ours>
        ${t.kind === "front"
          ? html`<div class=${MUTED}>${translateText("gw.token.ours")}</div>`
          : nothing}
        ${ours.map((x) => row(x, gwTokenKey(x) === key))} ${whenLine(t)}
      </section>
      ${theirs.length === 0
        ? nothing
        : html`<section class=${BOX} data-gw-token-theirs>
            <div class=${MUTED}>${translateText("gw.token.theirs")}</div>
            ${theirs.map((x) => row(x, gwTokenKey(x) === key))}
          </section>`}
      ${moveBox(c, t)}
      <div class="max-sm:hidden">${moveBtn}</div>
    </div>
    <footer class="flex shrink-0 gap-2 border-t border-white/10 p-2 sm:hidden">
      ${moveBtn}
      <button
        class="${BTN} min-h-10 flex-1 text-center"
        data-gw-token-close
        @click=${() => close(c)}
      >
        ${translateText("gw.token.close")}
      </button>
    </footer>
  </aside>`;
}

// ── ww221 §3: the fleet variant ─────────────────────────────────────────────
// The card a tapped fleet token opens, in the same frame: the sea and the
// fleet, ours and theirs in that sea in words (counts as information), the
// Admiralty's word, and two asks whose results come later through the
// Admiralty's papers: "다른 바다로 보내자고 한다" and "출격을 명한다".

const area = (a: GwSeaArea) => translateText(`gw.fleet.area.${a}`);

/** A fleet's sailing time in words: 0 this month .. 3 a season (gw.token.eta). */
export function fleetEtaWord(eta: number): number {
  return Math.max(0, Math.min(3, Math.round(eta)));
}

/** "대함대", or "순양함대" for a fleet with no name of its own. */
export function fleetName(f: GwFleetTokenView): string {
  return (
    textOrNull(`gw.fleet.name.${f.id}`) ??
    translateText(`gw.fleet.name_kind.${f.kind}`)
  );
}

/** "독일 대양함대 전함 13~21척", "영국 대함대 전함 22척", "… · 몇 척인지 모른다". */
export function fleetCount(f: GwFleetTokenView): string {
  const fleet = translateText("gw.fleet.fleet", {
    country: gwName(f.tag),
    name: fleetName(f),
  });
  const kind = translateText(`gw.fleet.kind.${f.kind}`);
  if (f.ships === null || f.sure <= 0) {
    return translateText("gw.fleet.count_unknown", { fleet, kind });
  }
  if (f.rel !== "own" && f.lo !== f.hi) {
    return translateText("gw.fleet.count_range", {
      fleet,
      kind,
      lo: f.lo,
      hi: f.hi,
    });
  }
  return translateText("gw.fleet.count", { fleet, kind, n: f.ships });
}

/** Where it lies: "스캐파플로 항구에 있다", or for a foe last seen there "… 있는 것으로 보인다". */
export function fleetPortLine(f: GwFleetTokenView): string | null {
  if (!f.port) return null;
  const which = f.seen === "last" ? "port_seen" : "port";
  return f.homePort === null
    ? translateText(`gw.fleet.${which}_none`)
    : translateText(`gw.fleet.${which}`, { port: placeName(f.homePort) });
}

/** The words after the count: how worn, what it does, how sure and why. */
export function fleetWords(f: GwFleetTokenView): string[] {
  const out: string[] = [];
  if (f.fill !== null) {
    out.push(translateText(`gw.fleet.fill.${fillWord(f.fill)}`));
  }
  if (f.repair) out.push(translateText("gw.fleet.repair"));
  if (f.fought) out.push(translateText("gw.fleet.fought"));
  if (f.to !== undefined) {
    out.push(
      translateText("gw.fleet.sailing", {
        to: area(f.to),
        when: translateText(`gw.token.arrive.${fleetEtaWord(f.eta ?? 1)}`),
      }),
    );
  } else if (!f.port && f.mission !== null) {
    out.push(translateText(`gw.fleet.mission.${f.mission}`));
  }
  if (f.rel !== "own") {
    out.push(
      translateText("gw.token.sure_seen", {
        sure: translateText(
          `gw.token.sure.${Math.max(0, Math.min(3, f.sure))}`,
        ),
        seen: translateText(`gw.fleet.seen.${f.seen}`),
      }),
    );
  }
  return out;
}

/** The card's title: "북해 · 대함대 (스캐파플로)". */
export function fleetTitle(f: GwFleetTokenView): string {
  const t = translateText("gw.fleet.title", {
    area: area(f.area),
    name: fleetName(f),
  });
  return f.homePort === null ? t : `${t} (${placeName(f.homePort)})`;
}

/** The fleets the card lists: every fleet believed in the tapped one's sea. */
export function fleetsHere(
  all: readonly GwFleetTokenView[],
  f: GwFleetTokenView,
): { ours: GwFleetTokenView[]; theirs: GwFleetTokenView[] } {
  const here = all.filter((x) => x.area === f.area);
  return {
    ours: here.filter((x) => x.rel !== "foe"),
    theirs: here.filter((x) => x.rel === "foe"),
  };
}

/**
 * What the Admiralty says of one of our fleets, in words (no odds, no
 * result): a key under gw.fleet.say, or null when it has nothing to add.
 */
export function fleetSay(
  all: readonly GwFleetTokenView[],
  f: GwFleetTokenView,
): string | null {
  if (f.rel !== "own") return null;
  if (f.repair) return "repair";
  if (f.to !== undefined) return "sailing";
  const foes = all.filter(
    (x) => x.rel === "foe" && x.area === f.area && x.kind === "battle",
  );
  if (f.kind === "battle" && f.area === "north" && f.tag === "GBR") {
    return "blockade";
  }
  if (f.port && f.ships !== null && foes.some((x) => x.hi > f.ships!)) {
    return "wait";
  }
  if (!f.port && foes.some((x) => x.port)) return "watch";
  if (f.kind === "subs") return "subs";
  return "ready";
}

/** The Admiralty's man: the First Sea Lord where there is one, else the navy minister. */
function admiral(c: GwCtx): { id: string; office: string } | null {
  const p =
    c.seat.people.find((x) => x.office === "sea_lord") ??
    c.seat.people.find((x) => x.office === "navy");
  return p === undefined || p.office === null
    ? null
    : { id: p.id, office: p.office };
}

function fleetRow(f: GwFleetTokenView, on: boolean): TemplateResult {
  const port = fleetPortLine(f);
  return html`<div
    class="flex items-start gap-2 text-sm ${on ? "text-amber-100" : ""}"
    data-gw-fleet-row=${gwFleetKey(f)}
  >
    ${flag(f.tag)}
    <div class="min-w-0">
      <div>${fleetCount(f)}</div>
      <div class=${MUTED}>${fleetWords(f).join(" · ")}</div>
      ${port === null
        ? nothing
        : html`<div class=${MUTED} data-gw-fleet-port>${port}</div>`}
    </div>
  </div>`;
}

function closeFleet(c: GwCtx): void {
  c.ui.fleet = null;
  c.ui.fleetMove = false;
  c.redraw();
}

function askFleet(c: GwCtx, id: string, what: GwSeaArea | "sortie"): void {
  c.ui.fleetAsked = { ...(c.ui.fleetAsked ?? {}), [id]: what };
  c.ui.fleetMove = false;
  c.redraw();
}

/**
 * The orders the card sends. Their schema and handling are lane A's
 * (ww221 §4: move_fleet, and the sortie that opens the Admiralty's paper);
 * the cast goes when A's order kinds are in GwOrderSchema.
 */
export function fleetMoveOrder(fleet: string, to: GwSeaArea): GwOrder {
  return { kind: "move_fleet", fleet, to } as unknown as GwOrder;
}
export function fleetSortieOrder(fleet: string): GwOrder {
  return { kind: "sortie_fleet", fleet } as unknown as GwOrder;
}

/** A closed sea's or sortie's reason in words. */
function blockWhy(why: string | null): string {
  return (
    (why === null ? null : textOrNull(`gw.ui.block.${why}`)) ??
    translateText("gw.fleet.closed")
  );
}

/** Once 다른 바다로 보내자고 한다 is pressed: the seas, with how long. */
function fleetMoveBox(
  c: GwCtx,
  f: GwFleetTokenView,
): TemplateResult | typeof nothing {
  if (c.ui.fleetMove !== true || f.rel !== "own") return nothing;
  const moves = f.moves ?? [];
  if (moves.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-fleet-moves>
    <div class=${MUTED}>${translateText("gw.fleet.move_where")}</div>
    ${moves.map(
      (m) =>
        html`<button
          class="${BTN} min-h-10 w-full"
          data-gw-fleet-move=${m.to}
          ?disabled=${!m.open}
          @click=${() => {
            c.send(fleetMoveOrder(f.id, m.to));
            askFleet(c, f.id, m.to);
          }}
        >
          <div>
            ${translateText("gw.fleet.move_to", {
              area: area(m.to),
              eta: translateText(`gw.token.eta.${fleetEtaWord(m.eta)}`),
            })}
          </div>
          ${m.open
            ? nothing
            : html`<div class=${MUTED}>${blockWhy(m.why)}</div>`}
        </button>`,
    )}
  </section>`;
}

/** The card of a tapped fleet token; nothing when it has gone from the view. */
export function fleetSheet(
  c: GwCtx,
  fleets: readonly GwFleetTokenView[],
  key: string,
): TemplateResult | typeof nothing {
  const f = fleets.find((x) => gwFleetKey(x) === key);
  if (f === undefined) return nothing;
  const { ours, theirs } = fleetsHere(fleets, f);
  const asked = c.ui.fleetAsked?.[f.id] ?? null;
  const own = f.rel === "own";
  const canMove = own && asked === null && (f.moves ?? []).length > 0;
  const sortie = own && asked === null ? (f.sortie ?? null) : null;
  const say = fleetSay(fleets, f);
  const man = say === null ? null : admiral(c);
  const moveBtn = canMove
    ? html`<button
        class="${BTN} min-h-10 flex-1 text-center sm:w-full sm:flex-none"
        data-gw-fleet-ask
        @click=${(e: Event) => {
          c.ui.fleetMove = c.ui.fleetMove !== true;
          c.redraw();
          const sheet = (e.currentTarget as HTMLElement).closest(
            "[data-gw-fleet-sheet]",
          );
          requestAnimationFrame(() =>
            sheet
              ?.querySelector("[data-gw-fleet-moves]")
              ?.scrollIntoView?.({ block: "nearest" }),
          );
        }}
      >
        <span class="sm:hidden">${translateText("gw.fleet.move_short")}</span>
        <span class="max-sm:hidden">${translateText("gw.fleet.move")}</span>
      </button>`
    : nothing;
  const sortieBtn =
    sortie === null
      ? nothing
      : html`<button
          class="${BTN} min-h-10 flex-1 text-center sm:w-full sm:flex-none"
          data-gw-fleet-sortie
          title=${sortie.open ? "" : blockWhy(sortie.why)}
          ?disabled=${!sortie.open}
          @click=${() => {
            c.send(fleetSortieOrder(f.id));
            askFleet(c, f.id, "sortie");
          }}
        >
          <span class="sm:hidden"
            >${translateText("gw.fleet.sortie_short")}</span
          >
          <span class="max-sm:hidden">${translateText("gw.fleet.sortie")}</span>
        </button>`;
  return html`<aside
    data-gw-fleet-sheet=${key}
    class="${GLASS} pointer-events-auto fixed inset-x-0 bottom-0 z-[905] flex h-[42vh] flex-col text-white sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-24 sm:h-auto sm:max-h-[calc(100vh-7rem)] sm:w-[340px] sm:rounded-md"
  >
    <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <header class="flex items-center gap-2">
        <h3 class="${HEAD} !text-base">${fleetTitle(f)}</h3>
        <button
          class="${MUTED} ml-auto min-h-10 px-2 hover:text-white max-sm:hidden"
          data-gw-fleet-close
          @click=${() => closeFleet(c)}
        >
          ✕
        </button>
      </header>
      ${ours.length === 0
        ? nothing
        : html`<section class=${BOX} data-gw-fleet-ours>
            <div class=${MUTED}>${translateText("gw.token.ours")}</div>
            ${ours.map((x) => fleetRow(x, gwFleetKey(x) === key))}
          </section>`}
      ${theirs.length === 0
        ? nothing
        : html`<section class=${BOX} data-gw-fleet-theirs>
            <div class=${MUTED}>${translateText("gw.token.theirs")}</div>
            ${theirs.map((x) => fleetRow(x, gwFleetKey(x) === key))}
          </section>`}
      ${say === null || man === null
        ? nothing
        : html`<p class="text-sm italic" data-gw-fleet-say=${say}>
            ${translateText("gw.fleet.say_by", {
              office: translateText(`gw.office.${man.office}`),
              name: personName(c.pack, man.id),
              say: translateText(`gw.fleet.say.${say}`),
            })}
          </p>`}
      ${asked === null
        ? nothing
        : html`<p class="${BOX} text-sm" data-gw-fleet-asked>
            ${asked === "sortie"
              ? translateText("gw.fleet.asked_sortie")
              : translateText("gw.fleet.asked", { area: area(asked) })}
          </p>`}
      ${fleetMoveBox(c, f)}
      <div class="flex flex-col gap-2 max-sm:hidden">
        ${moveBtn} ${sortieBtn}
      </div>
    </div>
    <footer class="flex shrink-0 gap-2 border-t border-white/10 p-2 sm:hidden">
      ${moveBtn} ${sortieBtn}
      <button
        class="${BTN} min-h-10 flex-1 text-center"
        data-gw-fleet-close
        @click=${() => closeFleet(c)}
      >
        ${translateText("gw.token.close")}
      </button>
    </footer>
  </aside>`;
}
