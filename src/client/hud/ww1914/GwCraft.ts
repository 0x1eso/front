// Great War 1914: statecraft on the screen (ww157). The country tab's
// footing, inventions and the year's project; the band's word for the footing.
// Words only: no numbers, and nothing said of a choice before it is made.
import {
  GW_FOOTINGS,
  GwCraftView,
  GwInventionView,
  GwProjectView,
} from "@openfront/engine-api/ww1914/GwCraft";
import type { GwResearchTrackView } from "@openfront/engine-api/ww1914/GwWorldView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

const footingWord = (level: number): string =>
  translateText(`gw.craft.footing.${GW_FOOTINGS[level] ?? "peace"}`);

/** An invention's or a project's name: the pack's, else its paper's title. */
export function craftName(c: GwCtx, id: string): string {
  return c.pack?.craft?.[id]?.name ?? c.pack?.scenes[id]?.title ?? id;
}
const craftNote = (c: GwCtx, id: string): string | null =>
  c.pack?.craft?.[id]?.note ?? null;
/** ww179: what a project works on, before and while it runs. */
export const craftAim = (c: GwCtx, id: string): string | null =>
  c.pack?.craft?.[id]?.aim ?? null;
/** ww179: what a project changed once done. */
export const craftDone = (c: GwCtx, id: string): string | null =>
  c.pack?.craft?.[id]?.done ?? null;

/** The band's word: shown once the country has moved off its peacetime footing. */
export function footingChip(c: GwCtx): TemplateResult | typeof nothing {
  const v = c.seat.world.craft;
  if (v === undefined || v.footing === 0) return nothing;
  return html`<span class=${CHIP} data-gw-footing-chip=${v.footing}
    >${footingWord(v.footing)}</span
  >`;
}

function raiseButton(
  c: GwCtx,
  v: GwCraftView,
): TemplateResult | typeof nothing {
  const r = v.raise;
  if (r === null) return nothing;
  const to = GW_FOOTINGS[v.footing + 1];
  return html`<button
      class="${BTN} w-full"
      data-gw-footing-raise=${v.footing + 1}
      ?disabled=${!r.open || r.asked}
      @click=${() => c.send({ kind: "footing" })}
    >
      ${translateText(`gw.craft.raise.${to}`)}
    </button>
    ${r.open && !r.asked
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText(
            r.asked ? "gw.craft.raise_asked" : "gw.craft.raise_closed",
          )}
        </p>`}`;
}

function footingBox(c: GwCtx, v: GwCraftView): TemplateResult | typeof nothing {
  const short = v.shortages.filter((s) => !s.solved);
  const solved = v.shortages.filter((s) => s.solved);
  if (v.raise === null && v.footing === 0 && v.shortages.length === 0) {
    return nothing;
  }
  return html`<section class=${BOX} data-gw-footing=${v.footing}>
    <div class="flex justify-between gap-2 text-sm">
      <h3 class=${HEAD}>${translateText("gw.craft.footing_title")}</h3>
      <span>${footingWord(v.footing)}</span>
    </div>
    ${v.footing === 0
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText(`gw.craft.terms.${GW_FOOTINGS[v.footing]}`)}
        </p>`}
    ${short.length === 0
      ? nothing
      : html`<p class="text-sm text-amber-200" data-gw-shortages>
          ${translateText("gw.craft.short_of", {
            list: short
              .map((s) => translateText(`gw.craft.shortage.${s.id}`))
              .join(", "),
          })}
        </p>`}
    ${solved.map(
      (s) =>
        html`<p class=${MUTED} data-gw-shortage-solved=${s.id}>
          ${translateText("gw.craft.shortage_solved", {
            name: translateText(`gw.craft.shortage.${s.id}`),
          })}
        </p>`,
    )}
    ${raiseButton(c, v)}
  </section>`;
}

function fieldButton(c: GwCtx, x: GwInventionView): TemplateResult {
  const armed = c.ui.armedField === x.id;
  return html`<button
    class="${armed ? BTN_ON : BTN} w-full"
    data-gw-field=${x.id}
    @click=${() => {
      if (!armed) {
        c.ui.armedField = x.id;
        c.redraw();
        return;
      }
      c.ui.armedField = null;
      c.send({ kind: "field", invention: x.id });
    }}
  >
    ${translateText(armed ? "gw.craft.field_sure" : "gw.craft.field")}
  </button>`;
}

function invention(c: GwCtx, x: GwInventionView): TemplateResult {
  const note = craftNote(c, x.id);
  const stage =
    x.stage === "ready" && x.ripe
      ? translateText("gw.craft.ripe")
      : translateText(`gw.craft.stage.${x.stage}`);
  return html`<div class="space-y-1" data-gw-invention=${x.id}>
    <div class="flex justify-between gap-2 text-sm">
      <span class="font-bold">${craftName(c, x.id)}</span>
      <span class="shrink-0 text-white/70">${stage}</span>
    </div>
    <p class=${MUTED}>
      ${translateText("gw.craft.inventor", {
        name: personName(c.pack, x.inventor),
      })}${note === null ? "" : ` · ${note}`}
    </p>
    ${x.stage === "fielded" && x.early
      ? html`<p class=${MUTED} data-gw-early>
          ${translateText("gw.craft.early")}
        </p>`
      : nothing}
    ${x.stage === "ready" ? fieldButton(c, x) : nothing}
  </div>`;
}

function inventionsBox(
  c: GwCtx,
  v: GwCraftView,
): TemplateResult | typeof nothing {
  if (v.inventions.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-inventions>
    <h3 class=${HEAD}>${translateText("gw.craft.inventions_title")}</h3>
    ${v.inventions.map((x) => invention(c, x))}
  </section>`;
}

const RUNNING_PHASES: readonly string[] = ["prep", "opp", "exec"];

/**
 * ww179: what a project is about and how far it has come, in words. Running:
 * what it works on and which of its three steps it is at. Done: what it
 * changed. Failed or dropped: that nothing came of it.
 */
function projectLines(c: GwCtx, p: GwProjectView): TemplateResult {
  const aim = craftAim(c, p.id);
  const done = craftDone(c, p.id);
  if (RUNNING_PHASES.includes(p.phase)) {
    return html`${aim === null
        ? nothing
        : html`<p class="text-sm text-white/80" data-gw-project-aim>
            ${translateText("gw.craft.aim", { text: aim })}
          </p>`}
      <p class=${MUTED} data-gw-project-step=${p.phase}>
        ${translateText(`gw.craft.progress.${p.phase}`)}
      </p>`;
  }
  if (p.phase === "done") {
    return done === null
      ? html``
      : html`<p class="text-sm text-emerald-100/90" data-gw-project-changed>
          ${translateText("gw.craft.changed", { text: done })}
        </p>`;
  }
  return html`<p class=${MUTED} data-gw-project-ended=${p.phase}>
    ${translateText(`gw.craft.ended.${p.phase}`)}
  </p>`;
}

function project(c: GwCtx, p: GwProjectView): TemplateResult {
  const aim = craftAim(c, p.id);
  return html`<div class="space-y-0.5" data-gw-project=${p.id}>
    <div class="flex justify-between gap-2 text-sm">
      <span class="font-bold" title=${aim ?? ""}>${craftName(c, p.id)}</span>
      <span class="shrink-0 text-white/70"
        >${translateText(`gw.craft.phase.${p.phase}`)}</span
      >
    </div>
    ${p.lead === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.craft.lead", {
            name: personName(c.pack, p.lead),
          })}
        </p>`}
    ${RUNNING_PHASES.includes(p.phase) && craftNote(c, p.id) !== null
      ? html`<p class=${MUTED}>${craftNote(c, p.id)}</p>`
      : nothing}
    ${projectLines(c, p)}
  </div>`;
}

function projectBox(c: GwCtx, v: GwCraftView): TemplateResult | typeof nothing {
  if (v.project === null && v.past.length === 0 && v.agenda === undefined)
    return nothing;
  return html`<section class=${BOX} data-gw-projects>
    <h3 class=${HEAD}>${translateText("gw.craft.project_title")}</h3>
    ${v.project === null
      ? v.agenda === undefined
        ? html`<p class=${MUTED}>${translateText("gw.craft.project_none")}</p>`
        : html`<p class="text-sm text-white/80" data-gw-agenda=${v.agenda}>
            ${translateText(`gw.craft.agenda.${v.agenda}`)}
          </p>`
      : project(c, v.project)}
    ${v.past.length === 0
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.craft.past_title")}</div>
          ${[...v.past].reverse().map((p) => project(c, p))}`}
  </section>`;
}

/** The country tab's statecraft: footing and shortages, inventions, the project. */
export function craftSection(c: GwCtx): TemplateResult | typeof nothing {
  const v = c.seat.world.craft;
  if (v === undefined) return nothing;
  return html`${footingBox(c, v)} ${projectBox(c, v)} ${inventionsBox(c, v)}`;
}

function track(c: GwCtx, t: GwResearchTrackView, now: boolean): TemplateResult {
  const name = translateText(`gw.ui.research.${t.id}`);
  const state = t.none
    ? translateText("gw.ui.research_none")
    : t.next === null
      ? translateText("gw.ui.research_all")
      : translateText("gw.ui.research_next", {
          tech: translateText(`gw.tech.${t.next}`),
          step: translateText(`gw.ui.research_step.${t.step}`),
        });
  return html`<div
    class="space-y-0.5"
    data-gw-research-track=${t.id}
    title=${translateText(`gw.ui.research_aim.${t.id}`)}
  >
    <div class="flex justify-between gap-2 text-sm">
      <span class=${now ? "font-bold" : "text-white/70"}>${name}</span>
      ${now
        ? html`<span class=${CHIP}>${translateText("gw.ui.research_on")}</span>`
        : nothing}
    </div>
    <p class=${MUTED}>${state}</p>
  </div>`;
}

/**
 * ww179: the country's research on the country tab: what it works on now,
 * how far each track has come in words, what was reached and what that does.
 */
export function researchBox(c: GwCtx): TemplateResult | typeof nothing {
  const w = c.seat.world.war;
  const r = w.research;
  if (r === undefined) return nothing;
  return html`<section class=${BOX} data-gw-research>
    <h3 class=${HEAD}>${translateText("gw.ui.research_title")}</h3>
    <p class="text-sm text-white/80" data-gw-research-now=${r.track}>
      ${translateText("gw.ui.research_now", {
        track: translateText(`gw.ui.research.${r.track}`),
        aim: translateText(`gw.ui.research_aim.${r.track}`),
      })}
    </p>
    <p class=${MUTED}>
      ${translateText(r.active ? "gw.ui.research_how" : "gw.ui.research_peace")}
    </p>
    ${r.tracks.map((t) => track(c, t, t.id === r.track))}
    <div class=${MUTED}>${translateText("gw.ui.research_reached")}</div>
    ${w.techs.length === 0
      ? html`<p class=${MUTED}>
          ${translateText("gw.ui.research_reached_none")}
        </p>`
      : html`${w.techs.map(
            (t) =>
              html`<p class="text-sm" data-gw-tech=${t}>
                ${translateText("gw.ui.research_got", {
                  tech: translateText(`gw.tech.${t}`),
                  does: translateText(`gw.tech_does.${t}`),
                })}
              </p>`,
          )}
          <p class=${MUTED}>${translateText("gw.ui.research_shared")}</p>`}
  </section>`;
}
