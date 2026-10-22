// World War 1936 P6 lane U4 (spec §20.8): the industry drawer's MIO tab —
// six family cards (archetype, size, funds bar, points left); a tap opens
// the 3 x 3 trait grid (owned green, buyable glowing, exclusive crossed);
// one tap buys a trait, [Switch archetype 50] and [Invest 50] take two.
import {
  MIO_ARCHETYPES,
  MIO_INVEST_PP,
  MIO_SWITCH_PP,
  MIO_TRAITS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import {
  DepthIndustryModel,
  MIO_ICONS,
  mioArchKey,
  mioFamilyKey,
  mioTraitKey,
  TraitCell,
} from "./DepthIndustryModel";
import { TAB_BTN, TabUi } from "./WwTabUi";

const CELL: Record<TraitCell["state"], string> = {
  owned: "border-emerald-400 bg-emerald-900/70",
  free: "border-emerald-300 bg-emerald-950/70",
  buyable:
    "border-yellow-300 bg-gray-800 shadow-[0_0_8px_rgba(253,224,71,0.6)]",
  locked: "border-gray-700 bg-gray-900 opacity-50",
  exclusive:
    "border-gray-700 bg-[repeating-linear-gradient(45deg,#1f2937,#1f2937_6px,#374151_6px,#374151_8px)] opacity-60",
};

export function renderMioTab(m: DepthIndustryModel, ui: TabUi): TemplateResult {
  const cards = m.mioCards();
  const open = ui.pick.mio ?? -1;
  return html`<div data-ww-mio class="mt-2 flex flex-col gap-1.5">
    ${cards.map((c) => {
      const grid = open === c.family ? renderGrid(m, ui, c.family) : nothing;
      return html`<section
        data-ww-mio-card=${c.id}
        class="rounded-md border border-white/15 bg-white/5 p-2"
      >
        <button
          type="button"
          class="flex min-h-11 w-full flex-col gap-1 text-left"
          @click=${() => {
            ui.pick.mio = open === c.family ? -1 : c.family;
            ui.redraw();
          }}
        >
          <span class="flex items-baseline gap-2 text-sm font-bold">
            <span aria-hidden="true">${MIO_ICONS[c.family]}</span>
            <span class="min-w-0 flex-1 truncate"
              >${translateText(mioFamilyKey(c.family))}</span
            >
            <span class="text-xs font-normal text-white/70"
              >${c.arch < 0
                ? translateText("ww1936.mio.empty")
                : translateText(mioArchKey(c.arch), {
                    country: ui.name(ui.me),
                  })}</span
            >
          </span>
          <span class="flex items-center gap-2 text-xs">
            <span class="tabular-nums"
              >${translateText("ww1936.mio.size", { size: c.size })}</span
            >
            <span
              class="h-2 min-w-0 flex-1 overflow-hidden rounded bg-white/15"
            >
              <span
                data-ww-mio-fill
                class="block h-full bg-sky-400"
                style="width:${Math.round(c.fill * 100)}%"
              ></span>
            </span>
            <span data-ww-mio-next class="tabular-nums text-white/80"
              >${c.maxed
                ? ""
                : translateText("ww1936.mio.funds", {
                    n: renderNumber(c.toNext),
                  })}</span
            >
            <span class="tabular-nums text-amber-200"
              >${translateText("ww1936.mio.points_left", { n: c.points })}</span
            >
          </span>
        </button>
        ${grid}
      </section>`;
    })}
  </div>`;
}

function renderGrid(
  m: DepthIndustryModel,
  ui: TabUi,
  family: number,
): TemplateResult {
  const card = m.mioCards()[family];
  const cells = m.traitGrid(family);
  if (card.arch < 0) {
    return html`<div data-ww-mio-pick class="mt-2 flex flex-wrap gap-1">
      ${MIO_ARCHETYPES.map(
        (a, i) =>
          html`<button
            type="button"
            data-ww-mio-arch=${a}
            class=${TAB_BTN}
            @click=${() =>
              ui.send({
                kind: "mio_pick",
                family: card.id,
                archetype: a,
              })}
          >
            ${translateText(mioArchKey(i), { country: ui.name(ui.me) })}
          </button>`,
      )}
    </div>`;
  }
  const fam = card.id;
  const switchKey = `mio_switch:${family}`;
  const investKey = `mio_invest:${family}`;
  return html`<div class="mt-2">
    <div data-ww-mio-grid class="grid grid-cols-3 gap-1">
      ${[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => {
          const c = cells[col * 3 + row];
          return html`<button
            type="button"
            data-ww-trait=${MIO_TRAITS[c.trait]}
            data-state=${c.state}
            ?disabled=${c.state !== "buyable"}
            class="min-h-11 rounded border px-1 text-[11px] leading-tight ${CELL[
              c.state
            ]}"
            @click=${() =>
              ui.send({
                kind: "mio_trait",
                family: fam,
                trait: MIO_TRAITS[c.trait],
              })}
          >
            ${translateText(mioTraitKey(family, c.trait))}
          </button>`;
        }),
      )}
    </div>
    <div class="mt-2 flex flex-wrap gap-1">
      ${MIO_ARCHETYPES.map((a, i) =>
        i === card.arch
          ? nothing
          : html`<button
              type="button"
              data-ww-mio-switch=${a}
              class=${TAB_BTN}
              @click=${() =>
                ui.confirm(`${switchKey}:${a}`, () =>
                  ui.send({ kind: "mio_pick", family: fam, archetype: a }),
                )}
            >
              ${ui.armed(`${switchKey}:${a}`)
                ? translateText("ww1936.econ.cancel_tap")
                : translateText("ww1936.mio.change_arch", {
                    cost: MIO_SWITCH_PP,
                  })}
            </button>`,
      )}
      <button
        type="button"
        data-ww-mio-invest
        class=${TAB_BTN}
        ?disabled=${!card.investReady}
        @click=${() =>
          ui.confirm(investKey, () =>
            ui.send({ kind: "mio_invest", family: fam }),
          )}
      >
        ${ui.armed(investKey)
          ? translateText("ww1936.econ.cancel_tap")
          : translateText("ww1936.mio.invest", { cost: MIO_INVEST_PP })}
      </button>
    </div>
  </div>`;
}
