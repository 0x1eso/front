// Great War 1914: the house's factions on the screens (ww158): under their blocs
// on the 정국 tab, the band's chip while one is out. The bills and the lobby are
// the 통치 tab's book (GwBook, ww203). Words only: no count, no hidden side.
import type {
  GwFactionView,
  GwHouseView,
} from "@openfront/engine-api/ww1914/GwHouse";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { CHIP, MUTED } from "./GwStyle";
import { personName } from "./GwText";

export function factionName(c: GwCtx, id: string): string {
  return c.pack?.factions?.[id]?.name ?? id;
}

const houseOf = (c: GwCtx): GwHouseView | null => c.seat.world.house ?? null;

/** A faction's reason line: its own pack words, else the common one. */
function whyLine(c: GwCtx, f: GwFactionView): string | null {
  if (f.why === null) return null;
  return c.pack?.factions?.[f.id]?.why?.[f.why] ?? null;
}

function trendWord(t: number): string {
  return translateText(
    `gw.house.trend.${t > 0 ? "up" : t < 0 ? "down" : "flat"}`,
  );
}

function factionRow(c: GwCtx, f: GwFactionView): TemplateResult {
  const why = whyLine(c, f);
  return html`<div class="space-y-0.5 pl-2" data-gw-faction=${f.id}>
    <div class="flex items-center gap-1.5 text-sm">
      <span class="text-white/90">${factionName(c, f.id)}</span>
      <span class=${MUTED}>${trendWord(f.trend)}</span>
      <span class="ml-auto text-xs"
        >${f.status === "under"
          ? translateText("gw.house.under")
          : `${translateText(`gw.house.strength.${f.strength}`)} · ${translateText(
              `gw.house.temper.${f.temper}`,
            )}`}</span
      >
    </div>
    ${why === null ? nothing : html`<p class=${MUTED}>${why}</p>`}
    ${f.leader === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.house.leader", {
            name: personName(c.pack, f.leader),
          })}
        </p>`}
  </div>`;
}

/** The 정국 tab: a bloc's factions, under the bloc. */
export function blocFactions(
  c: GwCtx,
  bloc: string,
): TemplateResult | typeof nothing {
  const list = (houseOf(c)?.factions ?? []).filter((f) => f.bloc === bloc);
  if (list.length === 0) return nothing;
  return html`<div
    class="space-y-1 border-l border-white/15"
    data-gw-bloc-factions=${bloc}
  >
    ${list.map((f) => factionRow(c, f))}
  </div>`;
}

/** The band's one chip while a faction is out: 파업 중, 보이콧 중. */
export function houseChip(c: GwCtx): TemplateResult | typeof nothing {
  const out = houseOf(c)?.out ?? null;
  if (out === null) return nothing;
  return html`<span
    class=${CHIP}
    data-gw-house-out=${out.id}
    title=${translateText("gw.house.out_hint")}
    >${translateText(`gw.house.out.${out.bloc}`)}</span
  >`;
}
