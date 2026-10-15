import {
  LAW_IDS,
  LAW_OPTIONS,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  LawBlock,
  lawBlock,
  lawCost,
  LAWS,
} from "@openfront/engine-lib/domestic/Laws";
import { shortfallGold } from "@openfront/engine-lib/domestic/Research";
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { DomesticClientView } from "../../view/DomesticClientView";

export interface LawsTabContext {
  view: DomesticClientView;
  gold: bigint;
  nowTick: number;
  proclaim(law: LawId, option: LawOption, payWithGold: boolean): void;
}

const BUTTON =
  "min-h-11 px-4 rounded-md text-sm font-semibold disabled:opacity-40";

/** The Book of Laws (spec §10.7): eleven laws, two options each. */
export function renderLawsTab(ctx: LawsTabContext): TemplateResult {
  const d = ctx.view.data;
  const cost = lawCost(ctx.view.laws().size, ctx.view.pct("lawCost"));
  const cooldownTicks = Math.max(0, d.lawCooldownUntilTick - ctx.nowTick);
  return html`
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-4 text-base">
        <span>${translateText("domestic.law_next_cost", { cost })}</span>
        ${cooldownTicks > 0
          ? html`<span class="text-amber-400"
              >${translateText("domestic.law_cooldown", {
                seconds: Math.ceil(cooldownTicks / 10),
              })}</span
            >`
          : null}
      </div>
      ${LAW_IDS.map((law) => renderLaw(ctx, law, cost))}
    </div>
  `;
}

function renderLaw(
  ctx: LawsTabContext,
  law: LawId,
  cost: number,
): TemplateResult {
  const d = ctx.view.data;
  const chosen = ctx.view.laws().get(law);
  const block = lawBlock(
    law,
    chosen,
    ctx.view.researchedTechs(),
    d.lawCooldownUntilTick,
    ctx.nowTick,
  );
  const requires = LAWS[law].requires;
  return html`
    <div class="border border-gray-600 rounded-md p-3" data-law=${law}>
      <div class="text-base font-bold">
        ${translateText(`domestic.law.${law}.name`)}
        ${block === "requires" && requires !== null
          ? html`<span class="text-sm font-normal text-red-300">
              ·
              ${translateText("domestic.locked_requires", {
                tech: translateText(`domestic.tech.${requires}.name`),
              })}</span
            >`
          : null}
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        ${LAW_OPTIONS.map((option) =>
          renderOption(ctx, law, option, chosen, block, cost),
        )}
      </div>
    </div>
  `;
}

function renderOption(
  ctx: LawsTabContext,
  law: LawId,
  option: LawOption,
  chosen: LawOption | undefined,
  block: LawBlock | null,
  cost: number,
): TemplateResult {
  const key = `domestic.law.${law}.${option}`;
  let status: TemplateResult | string;
  let border = "border-gray-600";
  if (chosen === option) {
    status = translateText("domestic.proclaimed");
    border = "border-green-500";
  } else if (chosen !== undefined) {
    status = translateText("domestic.rejected");
    border = "border-gray-700 opacity-40";
  } else {
    status = proclaimButton(ctx, law, option, block, cost);
  }
  return html`
    <div
      class="border ${border} rounded-md p-3 text-sm flex flex-col gap-2"
      data-option=${option}
    >
      <div class="font-bold">${translateText(`${key}.name`)}</div>
      <div class="text-gray-300">${translateText(`${key}.desc`)}</div>
      <div>${status}</div>
    </div>
  `;
}

function proclaimButton(
  ctx: LawsTabContext,
  law: LawId,
  option: LawOption,
  block: LawBlock | null,
  cost: number,
): TemplateResult {
  const available = ctx.view.data.political;
  if (available >= cost) {
    return html`<button
      type="button"
      class="${BUTTON} bg-sky-700 hover:bg-sky-600"
      ?disabled=${block !== null}
      @click=${() => ctx.proclaim(law, option, false)}
    >
      ${translateText("domestic.proclaim")}
    </button>`;
  }
  const gold = shortfallGold(
    (cost - available) * MILLI,
    ctx.view.pct("goldPaymentCost"),
  );
  const affordable = ctx.gold >= gold;
  return html`<button
      type="button"
      class="${BUTTON} bg-amber-700 hover:bg-amber-600"
      ?disabled=${block !== null || !affordable}
      @click=${() => ctx.proclaim(law, option, true)}
    >
      ${translateText("domestic.proclaim_with_gold", {
        gold: renderNumber(gold),
      })}
    </button>
    ${block === null && !affordable
      ? html`<span data-reason class="block mt-1 text-red-300"
          >${translateText("build_menu.not_enough_money")}</span
        >`
      : null}`;
}
