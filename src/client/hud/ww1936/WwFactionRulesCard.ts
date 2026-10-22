import type { WwOrder } from "@openfront/engine-api/Schemas";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { FactionRuleRow, GoalSlot, RelationRow } from "./DepthMiscModel";

const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";

export interface RulesCtx {
  armed: (key: string) => boolean;
  tap: (key: string, order: WwOrder) => void;
  send: (order: WwOrder) => void;
}

/** P6 (spec §14): the faction's three rules (the leader toggles: two taps) and goal slots. */
export function renderFactionRules(
  rules: readonly FactionRuleRow[],
  goals: readonly GoalSlot[],
  ctx: RulesCtx,
): TemplateResult {
  if (rules.length === 0) return html`${nothing}`;
  return html`<section data-ww-faction-rules class="mt-2">
    <div class="mb-1 text-xs font-bold uppercase text-white/70">
      ${translateText("ww1936.faction_ui.rules")}
    </div>
    <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      ${rules.map((r) => {
        const key = `rule:${r.rule}`;
        const armed = ctx.armed(key);
        return html`<li
          data-ww-faction-rule=${r.rule}
          class="flex items-center gap-2"
        >
          <span class="min-w-0 flex-1">
            <b class="block"
              >${translateText(`ww1936.faction_rule.${r.rule}`)}</b
            >
            <span class="block text-white/60"
              >${translateText(`ww1936.faction_ui.rule_desc.${r.rule}`)}</span
            >
          </span>
          <span class=${r.on ? "text-emerald-300" : "text-white/50"}
            >${translateText(
              r.on ? "ww1936.faction_ui.on" : "ww1936.faction_ui.off",
            )}</span
          >
          ${r.canToggle
            ? html`<button
                type="button"
                data-ww-rule-toggle=${r.rule}
                data-armed=${String(armed)}
                class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
                @click=${() => ctx.tap(key, r.order)}
              >
                ${armed
                  ? translateText("ww1936.pol.tap_again")
                  : translateText("ww1936.faction_ui.toggle")}
              </button>`
            : nothing}
        </li>`;
      })}
    </ul>
    <div class="mb-1 mt-2 text-xs font-bold uppercase text-white/70">
      ${translateText("ww1936.faction_ui.goals")}
    </div>
    <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      ${goals.map(
        (g) =>
          html`<li data-ww-goal-slot=${g.slot} class="flex flex-wrap gap-1">
            ${g.goal !== null
              ? html`<span class=${g.achieved ? "text-emerald-300" : ""}
                  >${g.achieved ? "✓ " : ""}${translateText(
                    `ww1936.faction_goal.${g.goal}`,
                  )}</span
                >`
              : g.canPick
                ? g.options.map(
                    (o) =>
                      html`<button
                        type="button"
                        data-ww-goal-pick=${o}
                        class=${BUTTON}
                        @click=${() =>
                          ctx.send({
                            kind: "faction_goal",
                            slot: g.slot,
                            goal: o,
                          })}
                      >
                        ${translateText(`ww1936.faction_goal.${o}`)}
                      </button>`,
                  )
                : html`<span class="text-white/50"
                    >${translateText("ww1936.faction_ui.goal_empty")}</span
                  >`}
          </li>`,
      )}
    </ul>
  </section>`;
}

/** P6 (spec §20.10): the world tab's relation lines — the five best and five worst. */
export function renderRelations(
  best: readonly RelationRow[],
  worst: readonly RelationRow[],
  flag: (tag: RelationRow["tag"]) => TemplateResult,
): TemplateResult {
  if (best.length === 0) return html`${nothing}`;
  const list = (id: string, key: string, rows: readonly RelationRow[]) =>
    html`<div data-ww-relations=${id}>
      <div class="mb-1 mt-2 text-xs font-bold uppercase text-white/70">
        ${translateText(key)}
      </div>
      <ul class="m-0 list-none p-0 text-xs">
        ${rows.map(
          (r) =>
            html`<li class="flex items-center gap-1">
              ${flag(r.tag)}
              <span class="min-w-0 flex-1 truncate">${r.name}</span>
              <span
                class="tabular-nums ${r.value < 0
                  ? "text-red-300"
                  : "text-emerald-300"}"
                >${r.value > 0 ? "+" : ""}${r.value}</span
              >
            </li>`,
        )}
      </ul>
    </div>`;
  return html`${list("best", "ww1936.faction_ui.relations_best", best)}
  ${list("worst", "ww1936.faction_ui.relations_worst", worst)}`;
}
