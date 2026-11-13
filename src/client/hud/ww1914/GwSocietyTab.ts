// Great War 1914 (ww207 §9, U1): the society on the screens. The 정국 tab's
// axes in words and the communities under the blocs; the election card on
// the hemicycle (each election plays once); the utopia's card (decision 1B:
// end here, or play on). Words, not numbers.
import type { GwChamber } from "@openfront/engine-api/ww1914/GwHouse";
import { axesOf, type GwAxis } from "@openfront/engine-api/ww1914/GwSociety";
import { html, nothing, svg, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { factionName } from "./GwHouse";
import {
  electionCause,
  electionDue,
  electionLine,
  leanLine,
  sizeWord,
} from "./GwSocietyWords";
import { axisName, sideWord, trustText, utopiaName } from "./GwStrip";
import { axisPlace, electPlan, type GwElect } from "./GwStripModel";
import { GLASS, HEAD, MUTED } from "./GwStyle";
import { fullDate, personName } from "./GwText";
import { VOTE_H, VOTE_W } from "./GwVoteModel";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

function communityName(c: GwCtx, id: string): string {
  return c.pack?.communities?.[id]?.name ?? id;
}

function axisRow(
  c: GwCtx,
  a: { axis: GwAxis; step: number; trend: number },
): TemplateResult {
  const place = axisPlace(a.step);
  const lean = leanLine(c.seat.tag, a.axis, a.step);
  return html`<div class="space-y-1" data-gw-axis=${a.axis}>
    <div class="flex items-center gap-1.5 text-sm">
      <span class="text-white">${axisName(c, a.axis)}</span>
      ${a.trend === 0
        ? nothing
        : html`<span class=${MUTED} data-gw-axis-trend=${a.trend}
            >${translateText("gw.strip.axis_trend", {
              word: sideWord(c, a.axis, a.trend),
            })}</span
          >`}
    </div>
    <div class="flex items-center gap-2 text-xs">
      <span class="w-16 shrink-0 text-right text-white/70"
        >${sideWord(c, a.axis, -1)}</span
      >
      <span class="relative h-1.5 flex-1 rounded bg-white/15">
        <span class="absolute inset-y-0 left-1/2 w-px bg-white/30"></span>
        <span
          class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-900 bg-amber-300"
          style="left:${Math.round(place * 100)}%"
          data-gw-axis-place=${Math.round(place * 100)}
        ></span>
      </span>
      <span class="w-16 shrink-0 text-white/70">${sideWord(c, a.axis, 1)}</span>
    </div>
    <p class=${MUTED}>${lean}</p>
  </div>`;
}

/** When each chamber's next general election is due, in words. */
function dueLines(c: GwCtx): TemplateResult | typeof nothing {
  const due = c.seat.world.society?.election.due ?? {};
  const list = (Object.keys(due) as GwChamber[]).filter(
    (k) => due[k] !== undefined,
  );
  if (list.length === 0) return nothing;
  return html`<div class="space-y-0.5 border-t border-white/10 pt-1.5">
    ${list.map(
      (k) =>
        html`<p class="text-xs text-white/75" data-gw-due=${k}>
          ${translateText(`gw.house.chamber.${k}`)} ·
          ${electionDue(Math.max(0, (due[k] ?? 0) - c.data.chapter))}
        </p>`,
    )}
  </div>`;
}

/** The 정국 tab's society: the axes, then the communities. Nothing with no house. */
export function societySection(c: GwCtx): TemplateResult | typeof nothing {
  const s = c.seat.world.society;
  if (s === undefined) return nothing;
  const order = axesOf(c.seat.tag);
  const axes = [...s.axes].sort(
    (a, b) => order.indexOf(a.axis) - order.indexOf(b.axis),
  );
  return html`<section class=${BOX} data-gw-axes>
      <h3 class=${HEAD}>${translateText("gw.strip.axes_title")}</h3>
      <p class=${MUTED} data-gw-sub>${translateText("gw.strip.axes_sub")}</p>
      ${axes.map((a) => axisRow(c, a))} ${dueLines(c)}
    </section>
    ${s.communities.length === 0
      ? nothing
      : html`<section class=${BOX} data-gw-communities>
          <h3 class=${HEAD}>${translateText("gw.strip.communities_title")}</h3>
          <p class=${MUTED} data-gw-sub>
            ${translateText("gw.strip.communities_sub")}
          </p>
          ${s.communities.map((m) => {
            const note = c.pack?.communities?.[m.id]?.note;
            const words = [
              sizeWord(m.size),
              trustText(m.trust),
              translateText(
                `gw.house.temper.${Math.min(4, Math.max(0, m.temper))}`,
              ),
            ];
            return html`<div class="space-y-0.5" data-gw-community=${m.id}>
              <div class="flex items-center gap-1.5 text-sm">
                <span class="text-white/90">${communityName(c, m.id)}</span>
                <span class="rounded bg-white/10 px-1.5 text-xs text-white/70"
                  >${sideWord(c, m.ideal.axis, m.ideal.side)}</span
                >
              </div>
              <p class=${MUTED}>${words.join(" · ")}</p>
              ${note === undefined
                ? nothing
                : html`<p class=${MUTED}>${note}</p>`}
              ${m.factions.length === 0
                ? nothing
                : html`<p class=${MUTED}>
                    ${translateText("gw.strip.draws", {
                      names: m.factions
                        .map((f) => factionName(c, f))
                        .join(", "),
                    })}
                  </p>`}
            </div>`;
          })}
        </section>`}`;
}

// ---- The election card ----

const ELECT_STYLE = html`<style>
  @keyframes gwelect {
    from {
      fill: var(--b);
    }
    to {
      fill: var(--a);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-gw-elect] circle {
      animation: none !important;
      fill: var(--a) !important;
    }
  }
</style>`;

/** The dots turn left to right over this long, ms. */
const SWEEP = 1800;

/** The election overlay; nothing while none plays. */
export function electOverlay(
  c: GwCtx,
  e: GwElect,
): TemplateResult | typeof nothing {
  const el = e.election;
  if (el === null) return nothing;
  const house = c.seat.world.society?.factions ?? [];
  const plan = electPlan(
    el,
    (f) => house.find((x) => x.id === f)?.bloc ?? null,
  );
  const n = Math.max(1, plan.dots.length);
  const chamber = translateText(`gw.house.chamber.${el.chamber}`);
  return html`${ELECT_STYLE}
    <div
      class="pointer-events-auto fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 p-2"
      data-gw-elect=${el.uid}
    >
      <div
        class="${GLASS} max-h-full w-full max-w-2xl space-y-2 overflow-y-auto rounded p-3 text-white"
      >
        <div class="space-y-0.5">
          <h3 class="${HEAD} !text-base">
            ${translateText("gw.strip.elect.title", {
              chamber,
              cause: electionCause(el.cause),
            })}
          </h3>
          <p class=${MUTED}>${fullDate(c.data.date)}</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
          <svg
            viewBox="0 0 ${VOTE_W} ${VOTE_H}"
            class="block h-auto w-full min-w-0 flex-1"
            role="img"
            aria-label=${chamber}
          >
            ${plan.dots.map(
              (d, i) =>
                svg`<circle cx=${d.x} cy=${d.y} r=${plan.r}
                  style=${`--b:${d.before};--a:${d.after};fill:${d.after};animation:gwelect 300ms ${Math.round(400 + (SWEEP * i) / n)}ms both`} />`,
            )}
          </svg>
          <ul class="space-y-1 sm:w-64 sm:shrink-0">
            ${plan.rows.map((r) => {
              const delta = r.after - r.before;
              return html`<li
                class="flex items-start gap-1.5 text-xs"
                data-gw-elect-row=${r.faction}
              >
                <span
                  class="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style="background:${r.colour}"
                ></span>
                <span class="min-w-0 flex-1 text-white/85"
                  >${electionLine(
                    factionName(c, r.faction),
                    r.before,
                    r.after,
                  )}</span
                >
                <span
                  class=${delta > 0
                    ? "text-emerald-300"
                    : delta < 0
                      ? "text-red-300"
                      : "text-white/55"}
                  >${translateText("gw.strip.elect.moved", {
                    before: r.before,
                    after: r.after,
                  })}</span
                >
              </li>`;
            })}
          </ul>
        </div>
        <div class="flex justify-end pt-1">
          <button
            class="min-h-10 rounded border border-amber-300/70 bg-amber-300/20 px-4 py-2 text-sm text-white hover:bg-amber-300/30"
            data-gw-elect-close
            @click=${() => {
              e.close();
              c.redraw();
            }}
          >
            ${translateText("gw.vote.close")}
          </button>
        </div>
      </div>
    </div>`;
}

// ---- The utopia's card ----

/** A realised utopia waiting for the player's word: end here, or play on. */
export function utopiaCard(c: GwCtx): TemplateResult | typeof nothing {
  const s = c.seat.world.society;
  const u = s?.utopia ?? null;
  if (u === null || u.choice !== null) return nothing;
  const f = s?.factions.find((x) => x.id === u.faction);
  const name =
    f?.tree === null || f?.tree === undefined
      ? factionName(c, u.faction)
      : utopiaName(c, f.tree);
  const head = u.head === null ? null : personName(c.pack, u.head);
  const pick = (play: boolean) => {
    c.send({ kind: "utopia_choice", play });
    c.redraw();
  };
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1400] flex items-center justify-center bg-black/70 p-3"
    data-gw-utopia=${u.faction}
  >
    <div
      class="${GLASS} w-full max-w-md space-y-3 rounded-lg border-amber-300/50 p-4 text-white"
    >
      <p class="text-xs tracking-widest text-amber-200/80">
        ${translateText("gw.strip.utopia.kicker")}
      </p>
      <h3 class="text-lg font-bold">
        ${translateText("gw.strip.utopia.title", { name })}
      </h3>
      <p class="text-sm text-white/80">
        ${translateText("gw.strip.utopia.body")}
      </p>
      ${head === null
        ? nothing
        : html`<p class="text-sm text-white/80">
            ${translateText("gw.strip.utopia.ask", { name: head })}
          </p>`}
      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          class="min-h-10 flex-1 rounded border border-white/25 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          data-gw-utopia-pick="end"
          @click=${() => pick(false)}
        >
          ${translateText("gw.strip.utopia.end")}
        </button>
        <button
          class="min-h-10 flex-1 rounded border border-amber-300/70 bg-amber-300/20 px-3 py-2 text-sm hover:bg-amber-300/30"
          data-gw-utopia-pick="play"
          @click=${() => pick(true)}
        >
          ${head === null
            ? translateText("gw.strip.utopia.go_on")
            : translateText("gw.strip.utopia.play", { name: head })}
        </button>
      </div>
    </div>
  </div>`;
}
