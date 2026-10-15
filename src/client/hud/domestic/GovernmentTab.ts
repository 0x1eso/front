import {
  DomesticData,
  GovernmentId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GOVERNMENT_TIER_THRESHOLDS } from "@openfront/engine-lib/domestic/Balance";
import {
  GovernmentBlock,
  governmentBlock,
  GovernmentDef,
  GOVERNMENTS,
  GOVERNMENTS_BY_TIER,
} from "@openfront/engine-lib/domestic/Governments";
import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { DomesticClientView } from "../../view/DomesticClientView";

export interface GovernmentTabContext {
  view: DomesticClientView;
  choose(government: GovernmentId): void;
}

const CHOOSABLE_TIERS = [1, 2] as const;

/** The government tab (spec §10.7): current government, tier progress, choices. */
export function renderGovernmentTab(ctx: GovernmentTabContext): TemplateResult {
  const d = ctx.view.data;
  return html`
    <div class="flex flex-col gap-3">
      <div class="text-base">
        ${translateText("domestic.gov_current", {
          name: translateText(`domestic.gov.${d.government}.name`),
        })}
        · ${translateText("domestic.gov_tier", { tier: d.governmentTier })}
      </div>
      ${renderTierProgress(d)}
      ${CHOOSABLE_TIERS.map(
        (tier) => html`
          <h3 class="text-lg font-bold">
            ${translateText("domestic.gov_tier", { tier })}
          </h3>
          <div class="flex flex-col gap-2">
            ${GOVERNMENTS_BY_TIER[tier].map((g) => renderGovernment(ctx, g))}
          </div>
        `,
      )}
    </div>
  `;
}

function renderTierProgress(d: DomesticData): TemplateResult {
  if (d.governmentTier >= GOVERNMENT_TIER_THRESHOLDS.length) {
    return html`<div class="text-base text-green-400">
      ${translateText("domestic.gov_max_tier")}
    </div>`;
  }
  const next = GOVERNMENT_TIER_THRESHOLDS[d.governmentTier];
  const done = Math.min(1, d.cumulativePolitical / next);
  return html`
    <div class="flex flex-col gap-1">
      <div class="text-sm text-gray-300">
        ${translateText("domestic.gov_progress", {
          value: d.cumulativePolitical,
          next,
          tier: d.governmentTier + 1,
        })}
      </div>
      <div class="h-3 bg-gray-700 rounded-sm">
        <div
          class="h-3 bg-violet-500 rounded-sm"
          style="width: ${Math.round(done * 100)}%"
        ></div>
      </div>
    </div>
  `;
}

function renderGovernment(
  ctx: GovernmentTabContext,
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
    const block = governmentBlock(
      d.governmentTier,
      d.government,
      ctx.view.laws(),
      government,
    );
    status =
      block === null
        ? html`<button
            type="button"
            class="min-h-11 px-4 rounded-md text-sm font-semibold bg-violet-700 hover:bg-violet-600"
            @click=${() => ctx.choose(government)}
          >
            ${translateText("domestic.gov_adopt")}
          </button>`
        : blockText(block, def);
  }
  return html`
    <div
      class="border ${border} rounded-md p-3 text-sm flex flex-col gap-1"
      data-government=${government}
    >
      <div class="text-base font-bold">
        ${translateText(`domestic.gov.${government}.name`)}
      </div>
      <div class="text-gray-300">
        ${translateText(`domestic.gov.${government}.desc`)}
      </div>
      <div class="text-gray-400">${status}</div>
    </div>
  `;
}

function blockText(block: GovernmentBlock, def: GovernmentDef): string {
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
