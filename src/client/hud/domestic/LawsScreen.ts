import {
  DomesticData,
  GovernmentId,
  LAW_IDS,
  LAW_OPTIONS,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  GOVERNMENT_TIER_THRESHOLDS,
  MILLI,
} from "@openfront/engine-lib/domestic/Balance";
import {
  GovernmentBlock,
  governmentBlock,
  GovernmentDef,
  GOVERNMENTS,
  GOVERNMENTS_BY_TIER,
  MAX_GOVERNMENT_TIER,
} from "@openfront/engine-lib/domestic/Governments";
import { LAWS } from "@openfront/engine-lib/domestic/Laws";
import { shortfallGold } from "@openfront/engine-lib/domestic/Research";
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { DomesticClientView } from "../../view/DomesticClientView";
import {
  ConfirmTap,
  confirmTapClass,
  confirmTapHandler,
  confirmTapLabel,
} from "./ConfirmTap";
import { clockSvg, ringSvg } from "./Dial";
import { LawsDial, lawsDial } from "./DomesticStatus";

// The Book of Laws screen (spec §14d, after Frostpunk): the government and
// its tier bar on top, then political power, the next law's cost and the
// cooldown dial, then one row per law with its two options side by side.

/**
 * A law and a government are permanent. A law takes a tap on its card,
 * which shows the "proclaim (cost)" button, and a tap on that; a
 * government's adopt button confirms with a second tap. `armed` holds the
 * card or button waiting.
 */
export interface LawsScreenContext extends ConfirmTap {
  view: DomesticClientView;
  gold: bigint;
  /** Config.hasInfiniteGold: the engine charges this player no gold. */
  infiniteGold: boolean;
  nowTick: number;
  proclaim(law: LawId, option: LawOption, payWithGold: boolean): void;
  choose(government: GovernmentId): void;
}

/** How an option card looks: proclaimed, discarded, waiting on a tech or the cooldown, or open. */
export type LawCardState =
  | "proclaimed"
  | "discarded"
  | "locked"
  | "cooldown"
  | "open";

export function lawCardState(
  view: DomesticClientView,
  law: LawId,
  option: LawOption,
  coolingDown: boolean,
): LawCardState {
  const chosen = view.laws().get(law);
  if (chosen === option) return "proclaimed";
  if (chosen !== undefined) return "discarded";
  const requires = LAWS[law].requires;
  if (requires !== null && !view.hasTech(requires)) return "locked";
  return coolingDown ? "cooldown" : "open";
}

/** The armed key of a law option's card. */
export function lawCardKey(law: LawId, option: LawOption): string {
  return `law:${law}:${option}`;
}

export function renderLawsScreen(ctx: LawsScreenContext): TemplateResult {
  const dial = lawsDial(ctx.view, ctx.nowTick);
  return html`
    <div class="flex flex-col gap-3">
      ${renderGovernmentSection(ctx, dial.government)}
      ${renderLawStatus(ctx, dial)}
      <div class="flex flex-col gap-2">
        ${LAW_IDS.map((law) => renderLaw(ctx, law, dial))}
      </div>
    </div>
  `;
}

function renderGovernmentSection(
  ctx: LawsScreenContext,
  choosable: boolean,
): TemplateResult {
  const d = ctx.view.data;
  const openTier = Math.min(d.governmentTier, MAX_GOVERNMENT_TIER);
  const previewTier =
    d.governmentTier < MAX_GOVERNMENT_TIER ? d.governmentTier + 1 : null;
  return html`
    <section
      data-government-section
      data-choosable=${String(choosable)}
      class="flex flex-col gap-2 rounded-lg border p-3 ${choosable
        ? "border-violet-400 bg-violet-950/60 ring-2 ring-violet-400/60"
        : "border-white/10 bg-gray-800/80"}"
    >
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="text-base font-bold">
          👑
          ${translateText("domestic.gov_current", {
            name: translateText(`domestic.gov.${d.government}.name`),
          })}
        </span>
        <span class="text-xs text-gray-400"
          >${translateText("domestic.gov_tier", {
            tier: d.governmentTier,
          })}</span
        >
      </div>
      ${renderTierProgress(d)}
      ${choosable
        ? html`<div data-government-choice class="flex flex-col gap-2">
            <div class="text-sm font-bold text-violet-200">
              ${translateText("domestic.book.choose_government")}
            </div>
            ${GOVERNMENTS_BY_TIER[openTier].map((g) =>
              renderGovernment(ctx, g),
            )}
          </div>`
        : previewTier === null
          ? nothing
          : html`<details data-government-preview class="text-sm">
              <summary
                class="min-h-9 flex items-center cursor-pointer text-gray-300"
              >
                ${translateText("domestic.book.preview", {
                  tier: previewTier,
                })}
              </summary>
              <div class="flex flex-col gap-2 mt-1">
                ${GOVERNMENTS_BY_TIER[previewTier].map((g) =>
                  renderGovernment(ctx, g),
                )}
              </div>
            </details>`}
    </section>
  `;
}

function renderTierProgress(d: DomesticData): TemplateResult {
  if (d.governmentTier >= GOVERNMENT_TIER_THRESHOLDS.length) {
    return html`<div class="text-sm text-green-400">
      ${translateText("domestic.gov_max_tier")}
    </div>`;
  }
  const next = GOVERNMENT_TIER_THRESHOLDS[d.governmentTier];
  const done = Math.min(1, d.cumulativePolitical / next);
  return html`
    <div data-tier-progress class="flex flex-col gap-1">
      <div class="h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-violet-500 rounded-full"
          style="width: ${Math.round(done * 100)}%"
        ></div>
      </div>
      <div class="text-xs text-gray-300 tabular-nums">
        ${translateText("domestic.gov_progress", {
          value: d.cumulativePolitical,
          next,
          tier: d.governmentTier + 1,
        })}
      </div>
    </div>
  `;
}

function renderGovernment(
  ctx: LawsScreenContext,
  government: GovernmentId,
): TemplateResult {
  const d = ctx.view.data;
  const def = GOVERNMENTS[government];
  let status: TemplateResult | string;
  let border = "border-gray-600";
  if (d.government === government) {
    status = translateText("domestic.gov_active");
    border = "border-green-500";
  } else {
    const key = `gov:${government}`;
    const block = governmentBlock(
      d.governmentTier,
      d.government,
      ctx.view.laws(),
      government,
    );
    if (block === null) border = "border-violet-400";
    status =
      block === null
        ? html`<button
            type="button"
            class="min-h-11 px-4 rounded-md text-sm font-semibold bg-violet-700 hover:bg-violet-600 ${confirmTapClass(
              ctx,
              key,
            )}"
            @click=${confirmTapHandler(ctx, key, () => ctx.choose(government))}
          >
            ${confirmTapLabel(ctx, key, translateText("domestic.gov_adopt"))}
          </button>`
        : governmentBlockText(block, def);
  }
  return html`
    <div
      class="border ${border} rounded-md p-2 text-sm flex flex-col gap-1 bg-gray-900/60"
      data-government=${government}
    >
      <div class="font-bold">
        ${translateText(`domestic.gov.${government}.name`)}
      </div>
      <div class="text-xs text-gray-300">
        ${translateText(`domestic.gov.${government}.desc`)}
      </div>
      <div class="text-xs text-gray-400">${status}</div>
    </div>
  `;
}

function governmentBlockText(
  block: GovernmentBlock,
  def: GovernmentDef,
): string {
  switch (block) {
    case "tierNotReached":
      return translateText("domestic.gov_needs_tier", { tier: def.tier });
    case "tierPassed":
      return translateText("domestic.gov_passed");
    case "chosen":
      return translateText("domestic.gov_locked");
    case "requires": {
      const req = def.requiresLaw;
      return translateText("domestic.gov_requires_law", {
        law:
          req === null
            ? ""
            : translateText(`domestic.law.${req.law}.${req.option}.name`),
      });
    }
  }
}

/** Political power, the next law's cost and the cooldown dial. */
function renderLawStatus(
  ctx: LawsScreenContext,
  dial: LawsDial,
): TemplateResult {
  const d = ctx.view.data;
  const svg =
    dial.kind === "cooldown"
      ? clockSvg(dial.progress, "cooldown")
      : ringSvg(
          dial.kind === "short"
            ? dial.progress
            : dial.kind === "available"
              ? 1
              : 0,
          dial.kind === "available" ? "political" : "grey",
        );
  let text: string;
  let color = "text-gray-300";
  switch (dial.kind) {
    case "cooldown":
      text = translateText("domestic.law_cooldown", {
        seconds: dial.seconds ?? 0,
      });
      color = "text-amber-300";
      break;
    case "available":
      text = translateText("domestic.book.ready");
      color = "text-violet-200 font-semibold";
      break;
    case "short":
      text =
        dial.seconds === null
          ? translateText("domestic.book.no_income")
          : translateText("domestic.ready_in", { seconds: dial.seconds });
      break;
    case "none":
      text = translateText(
        ctx.view.laws().size === LAW_IDS.length
          ? "domestic.book.all_proclaimed"
          : "domestic.book.none_open",
      );
      break;
  }
  return html`
    <section
      data-law-status=${dial.kind}
      class="flex items-center gap-3 rounded-lg bg-gray-800/80 border border-white/10 p-2"
    >
      <div class="relative size-12 shrink-0">
        ${svg}
        <span
          class="relative flex items-center justify-center w-full h-full text-sm font-bold tabular-nums"
          >${dial.kind === "cooldown"
            ? translateText("domestic.dial.seconds", {
                seconds: dial.seconds ?? 0,
              })
            : "📜"}</span
        >
      </div>
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <div class="text-sm">
          <span class="text-gray-400"
            >${translateText("domestic.political")}</span
          >
          <b class="tabular-nums">${d.political}</b>
          <span class="text-xs text-violet-300 tabular-nums"
            >${translateText("domestic.per_sec", {
              value: d.politicalPerSec.toFixed(1),
            })}</span
          >
        </div>
        <div class="text-sm">
          ${translateText("domestic.law_next_cost", { cost: dial.cost })}
        </div>
        <div data-law-status-text class="text-xs ${color}">${text}</div>
      </div>
    </section>
  `;
}

function renderLaw(
  ctx: LawsScreenContext,
  law: LawId,
  dial: LawsDial,
): TemplateResult {
  const requires = LAWS[law].requires;
  const locked =
    ctx.view.laws().get(law) === undefined &&
    requires !== null &&
    !ctx.view.hasTech(requires);
  return html`
    <div
      data-law=${law}
      data-locked=${String(locked)}
      class="flex flex-col gap-1.5 rounded-lg p-2 border ${locked
        ? "bg-gray-900/60 border-white/5"
        : "bg-gray-800/50 border-white/10"}"
    >
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="text-sm font-bold ${locked ? "text-gray-400" : ""}"
          >${translateText(`domestic.law.${law}.name`)}</span
        >
        ${locked && requires !== null
          ? html`<span data-law-condition class="text-xs text-red-300"
              >🔒
              ${translateText("domestic.locked_requires", {
                tech: translateText(`domestic.tech.${requires}.name`),
              })}</span
            >`
          : nothing}
      </div>
      <div class="grid grid-cols-2 gap-2">
        ${LAW_OPTIONS.map((option) =>
          renderOption(
            ctx,
            law,
            option,
            lawCardState(ctx.view, law, option, dial.kind === "cooldown"),
            dial.cost,
          ),
        )}
      </div>
    </div>
  `;
}

const CARD_LOOK: Readonly<Record<LawCardState, string>> = {
  proclaimed: "border-emerald-400 bg-emerald-950/60",
  discarded: "border-gray-700 bg-gray-900 opacity-40 grayscale",
  locked: "border-gray-700 bg-gray-900 opacity-60",
  cooldown: "border-gray-600 bg-gray-800 opacity-70",
  open: "border-gray-500 bg-gray-800 hover:border-violet-300",
};

function renderOption(
  ctx: LawsScreenContext,
  law: LawId,
  option: LawOption,
  state: LawCardState,
  cost: number,
): TemplateResult {
  const key = lawCardKey(law, option);
  const armed = state === "open" && ctx.armed === key;
  const name = `domestic.law.${law}.${option}`;
  const stamp =
    state === "proclaimed"
      ? html`<span
          data-stamp
          class="absolute top-1 right-1 -rotate-12 rounded border-2 border-emerald-400 bg-gray-900/80 px-1 text-[11px] font-black text-emerald-300 pointer-events-none"
          >${translateText("domestic.proclaimed")}</span
        >`
      : state === "discarded"
        ? html`<span
            data-stamp
            class="absolute top-1 right-1 -rotate-12 rounded border-2 border-gray-400 px-1 text-[11px] font-black text-gray-300 pointer-events-none"
            >${translateText("domestic.rejected")}</span
          >`
        : state === "cooldown" || state === "locked"
          ? html`<span
              class="absolute top-1 right-1 text-xs pointer-events-none"
              aria-hidden="true"
              >🔒</span
            >`
          : nothing;
  return html`
    <div
      data-option=${option}
      data-state=${state}
      class="relative flex flex-col rounded-md border ${CARD_LOOK[
        state
      ]} ${armed ? "ring-2 ring-white" : ""}"
    >
      <button
        type="button"
        data-law-pick
        aria-pressed=${String(armed)}
        ?disabled=${state !== "open"}
        class="flex flex-col gap-1 min-h-11 p-2 pr-12 text-left disabled:cursor-default"
        @click=${() => ctx.arm(armed ? null : key)}
      >
        <span
          class="text-sm font-bold ${state === "discarded"
            ? "line-through"
            : ""}"
          >${translateText(`${name}.name`)}</span
        >
        <span class="text-xs text-gray-300"
          >${translateText(`${name}.desc`)}</span
        >
      </button>
      ${stamp} ${armed ? renderProclaim(ctx, law, option, cost) : nothing}
    </div>
  `;
}

/** The armed card's confirm: political power, or the rest in gold. */
function renderProclaim(
  ctx: LawsScreenContext,
  law: LawId,
  option: LawOption,
  cost: number,
): TemplateResult {
  const political = ctx.view.data.political;
  const proclaim = (payWithGold: boolean) => () => {
    ctx.arm(null);
    ctx.proclaim(law, option, payWithGold);
  };
  let button: TemplateResult;
  if (political >= cost) {
    button = html`<button
      type="button"
      data-law-confirm
      class="h-11 px-3 rounded-md text-sm font-bold bg-violet-600 hover:bg-violet-500"
      @click=${proclaim(false)}
    >
      ${translateText("domestic.book.proclaim", { cost })}
    </button>`;
  } else {
    const gold = ctx.infiniteGold
      ? 0n
      : shortfallGold(
          (cost - political) * MILLI,
          ctx.view.pct("goldPaymentCost"),
        );
    const affordable = ctx.gold >= gold;
    button = html`<button
        type="button"
        data-law-confirm
        class="h-11 px-3 rounded-md text-sm font-bold bg-amber-700 hover:bg-amber-600 disabled:opacity-40"
        ?disabled=${!affordable}
        @click=${proclaim(true)}
      >
        ${translateText("domestic.proclaim_with_gold", {
          gold: renderNumber(gold),
        })}
      </button>
      ${affordable
        ? nothing
        : html`<span data-reason class="text-xs text-red-300"
            >${translateText("build_menu.not_enough_money")}</span
          >`}`;
  }
  return html`<div class="flex flex-col gap-1 px-2 pb-2">
    ${button}
    <span class="text-[11px] leading-snug text-amber-200"
      >${translateText("domestic.book.permanent")}</span
    >
  </div>`;
}
