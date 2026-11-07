import {
  GW_RESEARCH,
  GW_THEATRES,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwFrontView,
  GwProposal,
} from "@openfront/engine-api/ww1914/GwWorldView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { theatreSpot } from "./GwModel";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { frontLine, personName } from "./GwText";

const TRENCH_MAX = 5;

function lastBattle(f: GwFrontView): TemplateResult | typeof nothing {
  if (f.last === null) return nothing;
  return html`<p class=${MUTED} data-gw-battle>
    ${translateText("gw.ui.front_last", {
      result: translateText(`gw.result.${f.last.result}`),
      ours: f.last.ours,
      theirs: f.last.theirs,
    })}
  </p>`;
}

function frontCard(c: GwCtx, f: GwFrontView): TemplateResult {
  const spot = theatreSpot(f.id, f.lineIndex, f.progress);
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
    <div class="relative h-2 rounded bg-white/15" aria-hidden="true">
      <div
        class="absolute left-0 top-0 h-2 rounded bg-amber-300/80"
        style="width:${Math.round(spot.at * 100)}%"
      ></div>
    </div>
    <div class="flex justify-between gap-1 text-[11px] text-white/60">
      ${spot.names.map(
        (n, i) =>
          html`<span class=${i === spot.line ? "font-bold text-amber-200" : ""}
            >${frontLine(f.id, n)}</span
          >`,
      )}
    </div>
    <div class=${MUTED}>
      ${translateText("gw.ui.trench", { n: f.trench, max: TRENCH_MAX })} ·
      ${translateText(`gw.ui.trench_word.${Math.min(f.trench, TRENCH_MAX)}`)}
    </div>
    ${lastBattle(f)}
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
  const fronts = c.seat.world.fronts;
  const open = new Set(fronts.map((f) => f.id));
  const shut = GW_THEATRES.filter(
    (id) => !open.has(id) && c.seat.theatres.some((t) => t.id === id && t.open),
  );
  return html`<div class="space-y-2.5" data-gw-fronts>
    ${fronts.length === 0
      ? html`<p class="text-sm text-white/65" data-gw-nofronts>
          ${translateText("gw.ui.no_fronts")}
        </p>`
      : fronts.map((f) => frontCard(c, f))}
    ${shut.length === 0
      ? nothing
      : html`<div class=${MUTED}>
          ${translateText("gw.ui.quiet_fronts")}:
          ${shut.map(
            (id) =>
              html`<span class="${CHIP} mr-1"
                >${translateText(`gw.ui.theatre.${id}`)}</span
              >`,
          )}
        </div>`}
    ${papers(c)}
  </div>`;
}
