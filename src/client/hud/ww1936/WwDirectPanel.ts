// World War 1936 ww42: the army card's direct-attack panel — the three
// settings, [중지], how the army is divided (counted by the engine) and why
// part of it waits. Pure rendering: the card gives it the data and callbacks.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  DIRECT_ADVANCE,
  DIRECT_ALL_IN,
  DIRECT_FAVORABLE,
} from "@openfront/engine-api/ww1936/LandTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { WwLandView } from "../../view/WwLandView";
import {
  ArmyCardData,
  directBreakdown,
  DirectPart,
  directSettings,
  regionName,
} from "./LandModel";

export interface DirectPanelDeps {
  view: WwLandView;
  card: ArmyCardData;
  send: (o: LandOrder) => void;
  /** Move the camera to a region. */
  goTo: (region: number) => void;
}

const PART_KEYS: Readonly<Record<DirectPart["kind"], string>> = {
  atk: "ww1936.direct.part_atk",
  hold: "ww1936.direct.part_hold",
  wait: "ww1936.direct.part_wait",
  rec: "ww1936.direct.part_rec",
  walk: "ww1936.direct.part_walk",
};
const PART_DOT: Readonly<Record<DirectPart["kind"], string>> = {
  atk: "bg-red-500",
  hold: "bg-sky-400",
  wait: "bg-amber-400",
  rec: "bg-violet-400",
  walk: "bg-gray-300",
};

/** The text of one breakdown chip: "공격 9 (바르샤바 6, 크라쿠프 3)". */
export function partText(view: WwLandView, p: DirectPart): string {
  if (p.kind !== "atk" || p.regions.length === 0) {
    return translateText(PART_KEYS[p.kind], { n: p.n });
  }
  return translateText("ww1936.direct.part_atk_where", {
    n: p.n,
    where: p.regions
      .map(([r, n]) => `${regionName(view.scenario, r)} ${n}`)
      .join(", "),
  });
}

function toggle(
  id: string,
  label: string,
  on: boolean,
  act: () => void,
): TemplateResult {
  return html`<button
    type="button"
    data-ww-direct-toggle=${id}
    aria-pressed=${String(on)}
    class="min-h-10 rounded-md border px-1.5 text-xs leading-tight ${on
      ? "border-amber-300 bg-amber-700/50"
      : "border-white/15 bg-white/10 hover:bg-white/20"}"
    @click=${act}
  >
    ${label}
  </button>`;
}

/** The panel: the breakdown and its reasons (while a direct attack runs), then the toggles. */
export function renderDirectPanel(d: DirectPanelDeps): TemplateResult {
  const { card } = d;
  const army = card.row.id;
  const flags = card.direct?.flags ?? 0;
  const dv = card.directOn ? card.direct : null;
  const parts = dv === null ? [] : directBreakdown(dv);
  const favorable = (flags & DIRECT_FAVORABLE) !== 0;
  return html`<div data-ww-direct class="flex shrink-0 flex-col gap-1">
    ${dv === null
      ? nothing
      : html`<div data-ww-direct-parts class="flex shrink-0 flex-wrap gap-1">
          ${card.directOn
            ? html`<button
                type="button"
                data-ww-direct-stop
                class="min-h-10 rounded-md border border-red-400 bg-red-900/60 px-3 text-xs font-semibold"
                @click=${() => d.send({ kind: "army_halt", army })}
              >
                ■ ${translateText("ww1936.land.btn_stop")}
              </button>`
            : nothing}
          ${parts.map(
            (p) =>
              html`<button
                type="button"
                data-ww-direct-part=${p.kind}
                class="flex min-h-10 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-xs hover:bg-white/20"
                @click=${() => {
                  if (p.regions.length > 0) d.goTo(p.regions[0][0]);
                }}
              >
                <span
                  class="h-2.5 w-2.5 rounded-full ${PART_DOT[p.kind]}"
                ></span>
                ${partText(d.view, p)}
              </button>`,
          )}
        </div>`}
    ${card.directOn && card.lowPct !== null
      ? html`<div
          data-ww-direct-warn
          class="shrink-0 text-xs font-semibold text-red-300"
        >
          ⚠ ${translateText("ww1936.direct.warn_low", { pct: card.lowPct })}
        </div>`
      : nothing}
    ${dv !== null && dv.why === 1
      ? html`<div
          data-ww-direct-why="odds"
          class="flex shrink-0 flex-wrap items-center gap-1 text-xs text-amber-300"
        >
          ${translateText("ww1936.direct.why_odds", {
            ratio: (dv.ratioPm / 1000).toFixed(2),
          })}
          <button
            type="button"
            data-ww-direct-off
            class="min-h-10 rounded-md border border-amber-300/60 bg-amber-900/40 px-2 font-semibold"
            @click=${() => d.send(directSettings(army, { favorable: false }))}
          >
            ${translateText("ww1936.direct.turn_off")}
          </button>
        </div>`
      : nothing}
    ${dv !== null && dv.why === 2
      ? html`<div
          data-ww-direct-why="org"
          class="shrink-0 text-xs text-amber-300"
        >
          ${translateText("ww1936.direct.why_org", { n: dv.rec })}
        </div>`
      : nothing}
    <div data-ww-direct-settings class="grid shrink-0 grid-cols-3 gap-1">
      ${toggle(
        "favorable",
        translateText("ww1936.direct.favorable"),
        favorable,
        () => d.send(directSettings(army, { favorable: !favorable })),
      )}
      ${toggle(
        "border",
        translateText(
          (flags & DIRECT_ALL_IN) !== 0
            ? "ww1936.direct.border_all"
            : "ww1936.direct.border_keep",
        ),
        (flags & DIRECT_ALL_IN) !== 0,
        () =>
          d.send(
            directSettings(army, { allIn: (flags & DIRECT_ALL_IN) === 0 }),
          ),
      )}
      ${toggle(
        "advance",
        translateText("ww1936.direct.advance"),
        (flags & DIRECT_ADVANCE) !== 0,
        () =>
          d.send(
            directSettings(army, { advance: (flags & DIRECT_ADVANCE) === 0 }),
          ),
      )}
    </div>
  </div>`;
}
