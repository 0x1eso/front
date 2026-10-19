import {
  CongressData,
  EmergencyKind,
} from "@openfront/engine-api/congress/CongressTypes";
import { html, nothing, TemplateResult } from "lit";
import {
  CongressViewer,
  CONVENE_COST,
  conveneState,
  formatClock,
  goalText,
  optionLabel,
  remainingTicks,
  ticksToSeconds,
  titleText,
  Translate,
} from "./CongressModel";

export interface CongressScreenContext {
  data: CongressData;
  viewer: CongressViewer;
  /** The drawer's clock (moves once a second). */
  now: number;
  nameOf(smallID: number): string;
  t: Translate;
  convene(kind: EmergencyKind, target: number): void;
}

const SECTION = "flex flex-col gap-1 rounded-lg bg-gray-800/80 p-2";
const HEAD = "text-sm font-bold text-gray-200";
const ROW = "flex items-center gap-2 text-sm";

/** The congress screen of the domestic drawer (spec §12): mine, the session, the rules in force, emergencies, rankings and results. */
export function renderCongressScreen(
  ctx: CongressScreenContext,
): TemplateResult {
  return html`<div data-congress-screen class="flex flex-col gap-3 pb-2">
    ${influence(ctx)} ${session(ctx)} ${active(ctx)} ${emergency(ctx)}
    ${worldGovernment(ctx)} ${ranking(ctx)} ${history(ctx)}
  </div>`;
}

function influence(ctx: CongressScreenContext): TemplateResult {
  const d = ctx.viewer.data;
  return html`<section data-congress-influence class=${SECTION}>
    <div class="flex items-baseline gap-2">
      <span class="text-lg font-bold text-amber-300"
        >${ctx.t("congress.screen.influence", {
          value: d?.influence ?? 0,
        })}</span
      >
      <span class="text-sm text-gray-300"
        >${ctx.t("congress.screen.rate", {
          rate: (d?.influencePerSec ?? 0).toFixed(2),
        })}</span
      >
    </div>
    <span class="text-sm text-gray-300"
      >${ctx.t(`congress.status.${d?.status ?? "peaceful"}`)}</span
    >
  </section>`;
}

function session(ctx: CongressScreenContext): TemplateResult {
  const s = ctx.data.session;
  return html`<section data-congress-next class=${SECTION}>
    <span class=${ROW}
      >${s === null
        ? ctx.t("congress.screen.next_session", {
            time: formatClock(ctx.data.nextSessionTick - ctx.now),
          })
        : ctx.t("congress.screen.voting_now", {
            seconds: ticksToSeconds(s.closeTick - ctx.now),
          })}</span
    >
  </section>`;
}

function active(ctx: CongressScreenContext): TemplateResult {
  const rows = ctx.data.active.map((r) => {
    const left = remainingTicks(r, ctx.data, ctx.now);
    return html`<div data-active-resolution class=${ROW}>
      <span class="flex-1"
        >${titleText(r, ctx.nameOf, ctx.t)} —
        ${optionLabel(r.resolution, r.option, ctx.t)}</span
      >
      <span class="tabular-nums text-gray-300"
        >${left === null
          ? ctx.t("congress.chip.until_project")
          : formatClock(left)}</span
      >
    </div>`;
  });
  return html`<section class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.active")}</h3>
    ${rows.length === 0
      ? html`<span class="text-sm text-gray-400"
          >${ctx.t("congress.screen.none")}</span
        >`
      : rows}
  </section>`;
}

function emergency(ctx: CongressScreenContext): TemplateResult {
  const e = ctx.data.emergency;
  const cooldown = ctx.data.cooldownUntilTick - ctx.now;
  return html`<section data-congress-emergency class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.emergency")}</h3>
    ${e === null
      ? nothing
      : html`<span class=${ROW}
          >${ctx.t("congress.band.active", {
            kind: ctx.t(`congress.emergency.${e.kind}`),
            name: ctx.nameOf(e.target),
            goal: goalText(e, ctx.t),
            time: formatClock(e.endTick - ctx.now),
          })}</span
        >`}
    ${ctx.data.available.length === 0
      ? nothing
      : html`<div data-congress-available class="flex flex-col gap-1">
          <span class="text-xs text-gray-400"
            >${ctx.t("congress.screen.available")}</span
          >
          ${ctx.data.available.map((a) => {
            const block = conveneState(
              ctx.data,
              ctx.viewer,
              a.kind,
              a.target,
              ctx.now,
            );
            return html`<div class=${ROW}>
                <span class="flex-1"
                  >${ctx.t(`congress.emergency.${a.kind}`)} ·
                  ${ctx.nameOf(a.target)}</span
                >
                <button
                  type="button"
                  data-convene=${`${a.kind}:${a.target}`}
                  class="h-11 px-3 rounded-md text-sm font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-40"
                  ?disabled=${block !== null}
                  @click=${() => ctx.convene(a.kind, a.target)}
                >
                  ${ctx.t("congress.band.convene", { cost: CONVENE_COST })}
                </button>
              </div>
              ${block === null
                ? nothing
                : html`<span data-convene-reason class="text-xs text-amber-300"
                    >${ctx.t(`congress.block.${block}`, {
                      cost: CONVENE_COST,
                    })}</span
                  >`}`;
          })}
        </div>`}
    ${cooldown > 0
      ? html`<span class="text-xs text-gray-400"
          >${ctx.t("congress.screen.cooldown", {
            time: formatClock(cooldown),
          })}</span
        >`
      : nothing}
    <span class="text-xs text-gray-400"
      >${ctx.t("congress.screen.emergencies_left", {
        count: ctx.data.emergenciesLeft,
      })}</span
    >
  </section>`;
}

function worldGovernment(
  ctx: CongressScreenContext,
): TemplateResult | typeof nothing {
  if (ctx.data.verdicts.length === 0) return nothing;
  return html`<section data-congress-worldgov class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.world_gov")}</h3>
    ${ctx.data.verdicts.map((v) =>
      // "not_ratified" carries no name: the row names the owner itself.
      v.ratified
        ? html`<span data-verdict="ratified" class=${ROW}
            >${ctx.t("congress.screen.world_gov_ratified", {
              name: ctx.nameOf(v.owner),
            })}</span
          >`
        : html`<span data-verdict="not_ratified" class=${ROW}
            ><span class="font-semibold">${ctx.nameOf(v.owner)}</span
            ><span class="text-gray-300"
              >${ctx.t("congress.screen.not_ratified")}</span
            ></span
          >`,
    )}
  </section>`;
}

function ranking(ctx: CongressScreenContext): TemplateResult {
  const list = (key: string, rows: CongressData["aggressors"]) =>
    html`<div class="flex flex-col gap-0.5">
      <span class="text-xs text-gray-400">${ctx.t(key)}</span>
      ${rows.length === 0
        ? html`<span class="text-sm text-gray-500"
            >${ctx.t("congress.screen.none")}</span
          >`
        : rows.map(
            (r) =>
              html`<span class=${ROW}
                ><span class="flex-1">${ctx.nameOf(r.id)}</span
                ><span class="tabular-nums">${r.pct}%</span></span
              >`,
          )}
    </div>`;
  return html`<section
    data-congress-ranking
    class="${SECTION} grid grid-cols-2 gap-2"
  >
    ${list("congress.screen.aggressors", ctx.data.aggressors)}
    ${list("congress.screen.victims", ctx.data.victims)}
  </section>`;
}

function history(ctx: CongressScreenContext): TemplateResult {
  const rows = [...ctx.data.history].reverse().map(
    (h) =>
      html`<div class=${ROW}>
        <span class="flex-1">${titleText(h, ctx.nameOf, ctx.t)}</span>
        <span class="text-gray-300"
          >${h.adopted === null
            ? ctx.t("congress.card.tied", { a: h.a, b: h.b })
            : ctx.t("congress.card.adopted", {
                option: optionLabel(h.resolution, h.adopted, ctx.t),
                a: h.a,
                b: h.b,
              })}</span
        >
      </div>`,
  );
  return html`<section data-congress-history class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.history")}</h3>
    ${rows.length === 0
      ? html`<span class="text-sm text-gray-400"
          >${ctx.t("congress.screen.none")}</span
        >`
      : rows}
  </section>`;
}
