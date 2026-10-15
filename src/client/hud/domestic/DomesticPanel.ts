import {
  DomesticData,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  ResearchBlock,
  researchBlock,
  researchTicks,
  shortfallGold,
} from "@openfront/engine-lib/domestic/Research";
import { Branch, Era, TECHS } from "@openfront/engine-lib/domestic/Techs";
import { renderNumber } from "@openfront/engine-lib/Format";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { ResearchTechIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import { PlayerView } from "../../view/PlayerView";
import { ToggleDomesticPanelEvent } from "./DomesticEvents";

const ERAS: readonly Era[] = [1, 2, 3, 4];
const BRANCHES: readonly Branch[] = ["economy", "military", "learning"];

/** The domestic panel. Phase 1 has the technology tab only. */
@customElement("domestic-panel")
export class DomesticPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private open = false;
  @state() private data: DomesticData | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(ToggleDomesticPanelEvent, () => {
      this.open = !this.open;
    });
  }

  tick() {
    this.data = this.game?.myPlayer()?.domesticData() ?? null;
  }

  private research(tech: TechId, payWithGold: boolean) {
    this.eventBus.emit(new ResearchTechIntentEvent(tech, payWithGold));
  }

  render() {
    const me = this.game?.myPlayer();
    if (!this.open || this.data === null || !me) return null;
    const d = this.data;
    const researched = new Set<TechId>(d.techs);
    return html`
      <div
        class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
        @click=${(e: MouseEvent) => {
          if (e.target === e.currentTarget) this.open = false;
        }}
      >
        <div
          class="bg-gray-900 text-white rounded-lg p-4 max-w-[95vw] max-h-[90vh] overflow-auto shadow-xl"
        >
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold">
              ${translateText("domestic.panel_title")} ·
              ${translateText("domestic.tab_tech")}
            </h2>
            <button class="px-2" @click=${() => (this.open = false)}>✕</button>
          </div>
          ${this.renderResearch(d)}
          <div
            class="grid gap-2"
            style="grid-template-columns: auto repeat(3, minmax(11rem, 1fr));"
          >
            <div></div>
            ${BRANCHES.map(
              (b) =>
                html`<div class="font-bold text-center">
                  ${translateText(`domestic.branch.${b}`)}
                </div>`,
            )}
            ${ERAS.map(
              (era) => html`
                <div class="font-bold self-center">
                  ${translateText("domestic.era", { era })}
                </div>
                ${BRANCHES.map(
                  (b) =>
                    html`<div class="flex flex-col gap-1">
                      ${TECH_IDS.filter(
                        (id) => TECHS[id].era === era && TECHS[id].branch === b,
                      ).map((id) => this.renderTech(id, d, researched, me))}
                    </div>`,
                )}
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  private renderResearch(d: DomesticData) {
    if (d.research === null) return null;
    const done = 1 - d.research.ticksLeft / d.research.totalTicks;
    return html`
      <div class="mb-3">
        <div class="text-sm">
          ${translateText("domestic.research_progress", {
            tech: translateText(`domestic.tech.${d.research.tech}.name`),
            seconds: Math.ceil(d.research.ticksLeft / 10),
          })}
        </div>
        <div class="h-2 bg-gray-700 rounded-sm">
          <div
            class="h-2 bg-sky-500 rounded-sm"
            style="width: ${Math.round(done * 100)}%"
          ></div>
        </div>
      </div>
    `;
  }

  private renderTech(
    id: TechId,
    d: DomesticData,
    researched: ReadonlySet<TechId>,
    me: PlayerView,
  ) {
    const def = TECHS[id];
    let status: TemplateResult | string;
    let border = "border-gray-600";
    if (researched.has(id)) {
      status = translateText("domestic.researched");
      border = "border-green-500";
    } else if (d.research?.tech === id) {
      status = translateText("domestic.researching");
      border = "border-sky-500";
    } else {
      const block = researchBlock(researched, d.research !== null, id);
      if (block !== null) {
        status = this.blockText(block, id, researched);
      } else if (d.science >= def.cost) {
        status = html`<button
          class="px-2 py-0.5 rounded-sm bg-sky-700 hover:bg-sky-600"
          @click=${() => this.research(id, false)}
        >
          ${translateText("domestic.research")}
        </button>`;
      } else {
        const gold = shortfallGold(
          (def.cost - d.science) * MILLI,
          me.domestic()?.pct("goldPaymentCost") ?? 0,
        );
        status = html`<button
          class="px-2 py-0.5 rounded-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-40"
          ?disabled=${me.gold() < gold}
          @click=${() => this.research(id, true)}
        >
          ${translateText("domestic.pay_with_gold", {
            gold: renderNumber(gold),
          })}
        </button>`;
      }
    }
    return html`
      <div class="border ${border} rounded-sm p-2 text-xs flex flex-col gap-1">
        <div class="font-bold text-sm">
          ${translateText(`domestic.tech.${id}.name`)}
        </div>
        <div class="text-gray-300">
          ${translateText(`domestic.tech.${id}.desc`)}
        </div>
        <div class="text-gray-400">
          ${translateText("domestic.cost", {
            cost: def.cost,
            seconds:
              researchTicks(id, me.domestic()?.pct("researchTime") ?? 0) / 10,
          })}
        </div>
        <div>${status}</div>
      </div>
    `;
  }

  private blockText(
    block: ResearchBlock,
    id: TechId,
    researched: ReadonlySet<TechId>,
  ): string {
    switch (block) {
      case "busy":
        return translateText("domestic.blocked.busy");
      case "era":
        return translateText("domestic.blocked.era");
      case "prereq": {
        const missing = TECHS[id].prereqs.find((p) => !researched.has(p));
        return translateText("domestic.blocked.prereq", {
          tech:
            missing === undefined
              ? ""
              : translateText(`domestic.tech.${missing}.name`),
        });
      }
      case "researched":
        return translateText("domestic.researched");
    }
  }
}
