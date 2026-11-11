import {
  GW_RESEARCH,
  type GwSide,
  type GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwTheatreView } from "@openfront/engine-api/ww1914/GwView";
import type {
  GwFrontView,
  GwProposal,
} from "@openfront/engine-api/ww1914/GwWorldView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { frontMove, frontRead, frontTone, type FrontRead } from "./GwModel";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { factText, frontLine, personName } from "./GwText";

const TRENCH_MAX = 5;

const TONE = ["text-red-300", "text-white/80", "text-emerald-300"] as const;
const ARROW: Readonly<Record<-1 | 0 | 1, string>> = {
  [-1]: "←",
  [0]: "=",
  [1]: "→",
};

/** The latest fighting in words, from `side`'s end, with the losses. */
export function lastBattle(
  f: GwFrontView,
  side: GwSide | null,
): TemplateResult | typeof nothing {
  if (f.last === null) return nothing;
  const move = frontMove(f.last, side ?? "central");
  const tone = frontTone(move);
  return html`<div data-gw-battle=${move}>
    <p class="text-sm ${TONE[tone + 1]}">
      <span class="font-bold" aria-hidden="true">${ARROW[tone]}</span>
      ${translateText("gw.ui.front_latest", {
        what: translateText(`gw.ui.front_move.${move}`),
      })}
    </p>
    ${f.last.by === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.ui.front_losses", {
            ours: f.last.ours,
            theirs: f.last.theirs,
          })}
        </p>`}
  </div>`;
}

type FrontKind = "ours" | "bloc" | "neutral";

/** Fill colours of the two halves: the reader's side, and the other. */
const HALVES: Readonly<Record<FrontKind, readonly [string, string]>> = {
  ours: ["bg-emerald-400/85", "bg-red-400/45"],
  bloc: ["bg-emerald-400/45", "bg-red-400/25"],
  neutral: ["bg-amber-200/60", "bg-sky-300/40"],
};

/**
 * The tug of war: the reader's side holds the bar from the left, so its
 * advance always moves the mark right, towards the enemy's end.
 */
function frontBar(
  id: GwTheatre,
  r: FrontRead,
  kind: FrontKind,
): TemplateResult {
  const [mine, theirs] = HALVES[kind];
  const pct = Math.round(r.fill * 1000) / 10;
  const n = r.names.length - 1;
  const end = (s: GwSide, at: "left" | "right") => {
    const name = translateText(`gw.ui.side.${s}`);
    if (kind === "neutral") {
      return translateText("gw.ui.front_end", { side: name });
    }
    const key =
      at === "right"
        ? "gw.ui.front_end_them"
        : kind === "bloc"
          ? "gw.ui.front_end_bloc"
          : "gw.ui.front_end_us";
    return translateText(key, { side: name });
  };
  const endTone = (at: "left" | "right") =>
    kind === "neutral"
      ? "text-white/70"
      : at === "left"
        ? "text-emerald-300"
        : "text-red-300";
  return html`<div class="space-y-0.5" data-gw-bar>
    <div class="flex justify-between gap-2 text-[11px] font-bold">
      <span class=${endTone("left")} data-gw-end="left"
        >${end(r.left, "left")}</span
      >
      <span class="${endTone("right")} text-right" data-gw-end="right"
        >${end(r.right, "right")}</span
      >
    </div>
    <div
      class="relative h-3 overflow-hidden rounded ${theirs}"
      aria-hidden="true"
    >
      <div
        class="absolute inset-y-0 left-0 ${mine}"
        style="width:${pct}%"
      ></div>
      ${r.names
        .slice(1, -1)
        .map(
          (_, i) =>
            html`<div
              class="absolute inset-y-0 w-px bg-black/30"
              style="left:${Math.round(((i + 1) / n) * 1000) / 10}%"
            ></div>`,
        )}
    </div>
    <div class="relative h-0">
      <div
        class="absolute -top-[15px] h-[18px] w-1 -translate-x-1/2 rounded bg-white shadow"
        style="left:${pct}%"
        aria-hidden="true"
      ></div>
    </div>
    <div class="flex justify-between gap-2 text-[11px] text-white/50">
      <span>${frontLine(id, r.names[0])}</span>
      <span class="text-right">${frontLine(id, r.names[n])}</span>
    </div>
  </div>`;
}

/** Where the line is and how it stands against the start, in words. */
function standingLine(
  id: GwTheatre,
  r: FrontRead,
  kind: FrontKind,
): TemplateResult {
  const tone = kind === "neutral" ? 0 : frontTone(r.standing);
  const who =
    kind === "ours"
      ? translateText("gw.ui.front_who_us")
      : kind === "bloc"
        ? translateText("gw.ui.front_who_bloc")
        : translateText(`gw.ui.side.${r.left}`);
  return html`<p
    class="text-sm ${TONE[tone + 1]}"
    data-gw-standing=${r.standing}
  >
    ${translateText("gw.ui.front_now", {
      line: frontLine(id, r.names[r.at]),
      who,
      how: translateText(`gw.ui.front_standing.${r.standing}`),
    })}
  </p>`;
}

/**
 * ww173: "적의 사정": the newest report on the foe's strain, with its stamp,
 * or "알 수 없다"; "암호를 읽고 있다" while the seat reads his codes.
 */
function foeLine(f: GwFrontView): TemplateResult | typeof nothing {
  if (f.foe === undefined) return nothing;
  const what =
    f.foe === null
      ? translateText("gw.ui.front_foe_unknown")
      : translateText("gw.ui.front_foe_word", {
          word: factText("strain", f.foe.word),
          stamp: translateText(`gw.ui.stamp.${f.foe.stamp}`),
        });
  return html`<p class="text-sm text-white/80" data-gw-foe>
    ${translateText("gw.ui.front_foe", { what })}
    ${f.reading === true
      ? html`<span class=${MUTED} data-gw-reading
          >${translateText("gw.ui.front_reading")}</span
        >`
      : nothing}
  </p>`;
}

function frontCard(c: GwCtx, f: GwFrontView): TemplateResult {
  const side = c.seat.world.side;
  const r = frontRead(f.id, f.lineIndex, f.progress, side);
  return html`<section
    data-gw-theatre=${f.id}
    class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
  >
    <div class="flex items-center gap-2">
      <h3 class=${HEAD}>${translateText(`gw.ui.theatre.${f.id}`)}</h3>
      ${f.commander === null
        ? nothing
        : html`<span class="${MUTED} ml-auto truncate"
            >${translateText("gw.ui.front_commander", {
              name: personName(c.pack, f.commander),
            })}</span
          >`}
    </div>
    ${frontBar(f.id, r, "ours")} ${standingLine(f.id, r, "ours")}
    ${lastBattle(f, side)}
    <div class=${MUTED}>
      ${translateText("gw.ui.trench_now", {
        what: translateText(
          `gw.ui.trench_word.${Math.max(0, Math.min(f.trench, TRENCH_MAX))}`,
        ),
      })}
    </div>
    ${foeLine(f)}
  </section>`;
}

/** A front the seat's country is not fighting on: where it stands, plainly. */
function otherCard(t: GwTheatreView, side: GwSide | null): TemplateResult {
  const kind: FrontKind = side === null ? "neutral" : "bloc";
  const r = frontRead(t.id, t.line, t.progress, side);
  return html`<section
    data-gw-other=${t.id}
    class="space-y-1 rounded border border-white/10 bg-black/25 p-2.5"
  >
    <div class="flex flex-wrap items-center gap-x-2">
      <h3 class="text-sm font-bold text-white/85">
        ${translateText(`gw.ui.theatre.${t.id}`)}
      </h3>
      ${side === null
        ? nothing
        : html`<span class="${CHIP} ml-auto">
            ${translateText("gw.ui.front_not_ours")}
          </span>`}
    </div>
    ${frontBar(t.id, r, kind)} ${standingLine(t.id, r, kind)}
  </section>`;
}

function paper(c: GwCtx, p: GwProposal): TemplateResult {
  const signed = c.seat.world.signed;
  const research = c.ui.research ?? c.seat.alloc.research;
  return html`<div
    class="space-y-1 rounded border border-white/10 bg-white/5 p-2"
    data-gw-paper=${p.id}
  >
    <div class="flex items-center gap-2">
      <span class="text-sm font-bold">${translateText(`gw.plan.${p.id}`)}</span>
      <span class="${MUTED} ml-auto truncate"
        >${translateText(`gw.ui.theatre.${p.main}`)}</span
      >
    </div>
    <div class="flex flex-wrap gap-1">
      <span class=${CHIP}>${translateText(`gw.ui.posture.${p.posture}`)}</span>
      <span class=${CHIP}>${translateText(`gw.ui.scale.${p.scale}`)}</span>
    </div>
    ${p.by === null
      ? nothing
      : html`<p class="text-sm text-white/80">
          ${translateText("gw.ui.paper_odds", {
            name: personName(c.pack, p.by),
            odds: translateText(`gw.odds.${p.estimate}`),
          })}
        </p>`}
    ${(p.claimed ?? []).length === 0
      ? nothing
      : html`<p class="text-sm text-amber-100" data-gw-paper-claimed>
          ${translateText("gw.ui.paper_claimed", {
            list: (p.claimed ?? []).map((x) => GW_PLACES[x].nameKo).join(", "),
          })}
        </p>`}
    ${p.open
      ? html`<button
          class="${BTN} w-full text-center"
          data-gw-sign-paper=${p.id}
          ?disabled=${signed}
          @click=${() => {
            c.ui.notes.push({
              chapter: c.data.chapter,
              title: translateText("gw.ui.paper_title"),
              pick: translateText(`gw.plan.${p.id}`),
              rest: "",
              tell: p.tell,
            });
            c.send({
              kind: "allocate",
              main: p.main,
              posture: p.posture,
              scale: p.scale,
              allyShare: p.allyShare,
              research,
            });
          }}
        >
          ${translateText("gw.ui.sign")}
        </button>`
      : html`<p class=${MUTED} data-gw-paper-why>
          ${translateText(`gw.plan_why.${p.why}`)}
        </p>`}
  </div>`;
}

/** The chief of staff's papers: one is signed a chapter (design §4.2). */
function papers(c: GwCtx): TemplateResult | typeof nothing {
  const { proposals, signed } = c.seat.world;
  if (proposals.length === 0) return nothing;
  const cur = c.seat.alloc;
  const research = c.ui.research ?? cur.research;
  return html`<section
    data-gw-alloc
    class="space-y-2 rounded border border-white/15 bg-black/35 p-2.5"
  >
    <h3 class=${HEAD}>${translateText("gw.ui.alloc_title")}</h3>
    <p class=${MUTED}>
      ${translateText(signed ? "gw.ui.paper_signed" : "gw.ui.paper_hint")}
    </p>
    ${proposals.map((p) => paper(c, p))}
    <div class="space-y-1">
      <div class=${MUTED}>${translateText("gw.ui.alloc_research")}</div>
      <div class="flex flex-wrap gap-1">
        ${GW_RESEARCH.map(
          (v) =>
            html`<button
              class="${v === research ? BTN_ON : BTN} !px-2 !py-1"
              data-gw-pick=${`research:${v}`}
              ?disabled=${signed}
              @click=${() => {
                c.ui.research = v;
                c.redraw();
              }}
            >
              ${translateText(`gw.ui.research.${v}`)}
            </button>`,
        )}
      </div>
    </div>
    <p class=${MUTED}>
      ${translateText("gw.ui.alloc_now", {
        main: translateText(`gw.ui.theatre.${cur.main}`),
        posture: translateText(`gw.ui.posture.${cur.posture}`),
        scale: translateText(`gw.ui.scale.${cur.scale}`),
      })}
    </p>
  </section>`;
}

/** The fronts tab: every theatre's line, then the papers to sign. */
export function frontsTab(c: GwCtx): TemplateResult {
  const side = c.seat.world.side;
  const fronts = c.seat.world.fronts;
  const mine = new Set(fronts.map((f) => f.id));
  const others = c.seat.theatres.filter((t) => t.open && !mine.has(t.id));
  return html`<div class="space-y-2.5" data-gw-fronts>
    ${fronts.length + others.length === 0
      ? nothing
      : html`<p class=${MUTED} data-gw-front-key>
          ${translateText(
            side === null ? "gw.ui.front_key_neutral" : "gw.ui.front_key",
          )}
        </p>`}
    ${fronts.length > 0
      ? fronts.map((f) => frontCard(c, f))
      : side === null && others.length > 0
        ? nothing
        : html`<p class="text-sm text-white/65" data-gw-nofronts>
            ${translateText(
              side === null
                ? "gw.ui.no_fronts_neutral"
                : others.length > 0
                  ? "gw.ui.no_fronts_ours"
                  : "gw.ui.no_fronts",
            )}
          </p>`}
    ${others.length === 0
      ? nothing
      : html`<h3 class="${HEAD} pt-1" data-gw-others>
            ${translateText(
              side === null ? "gw.ui.fronts_watched" : "gw.ui.fronts_not_ours",
            )}
          </h3>
          ${others.map((t) => otherCard(t, side))}`}
    ${papers(c)}
  </div>`;
}
