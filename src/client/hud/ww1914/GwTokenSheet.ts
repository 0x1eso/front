// Great War 1914 (ww218 §5): the card a tapped army token opens. Beside the
// map on a wide screen, a bottom sheet (42 % high) on a phone; the same lines
// in both. Counts are shown as information; how sure and how full read as
// words; the only choice is "다른 전선으로 옮기자고 한다", whose result
// comes later, through the chief of staff's war papers.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
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
import { BTN, GLASS, HEAD, MUTED } from "./GwStyle";
import { frontLine, textOrNull } from "./GwText";
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
