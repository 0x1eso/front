// Great War 1914: the house and its factions on the screens (ww158). The country
// tab's "의회" box (the moving bill, the whip's word, the factions of its house,
// the calls), the factions under their blocs on the 정국 tab, the band's chip
// while one is out. Words only: no count, no hidden side.
import type {
  GwBillFactionView,
  GwBillView,
  GwFactionView,
  GwHouseView,
} from "@openfront/engine-api/ww1914/GwHouse";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { BTN, CHIP, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

export function factionName(c: GwCtx, id: string): string {
  return c.pack?.factions?.[id]?.name ?? id;
}

const billName = (c: GwCtx, id: string): string =>
  c.pack?.scenes[`gw_law_${id}`]?.title ?? id;

const houseOf = (c: GwCtx): GwHouseView | null => c.seat.world.house ?? null;

/** A faction's reason line: its own pack words, else the common one. */
function whyLine(c: GwCtx, f: GwFactionView): string | null {
  if (f.why === null) return null;
  return c.pack?.factions?.[f.id]?.why?.[f.why] ?? null;
}

function saidWord(said: number): string {
  const k = said > 0 ? "for" : said < 0 ? "against" : "away";
  return translateText(`gw.house.said.${k}`);
}

function callButton(
  c: GwCtx,
  h: GwHouseView,
  f: GwBillFactionView,
): TemplateResult | typeof nothing {
  if (f.call === null || f.leader === null) return nothing;
  const who = f.leader;
  const topic = f.call;
  return html`<button
    class="${BTN} shrink-0"
    data-gw-house-call=${f.id}
    ?disabled=${c.seat.audiences <= 0 && h.calls <= 0}
    @click=${() => {
      c.send({ kind: "summon", person: who, topic });
      c.ui.summoned = Date.now();
    }}
  >
    ${translateText("gw.law.call", { name: personName(c.pack, who) })}
  </button>`;
}

function factionLine(
  c: GwCtx,
  h: GwHouseView,
  f: GwBillFactionView,
): TemplateResult {
  return html`<div
    class="flex items-center gap-2"
    data-gw-house-faction=${f.id}
  >
    <div class="min-w-0 flex-1">
      <div class="text-sm text-white">
        ${factionName(c, f.id)}${f.deal
          ? html` <span class=${CHIP} data-gw-house-deal
              >${translateText("gw.house.deal")}</span
            >`
          : nothing}
      </div>
      <p class=${MUTED}>
        ${[
          f.leader === null ? null : personName(c.pack, f.leader),
          f.said === null ? null : saidWord(f.said),
        ]
          .filter((x) => x !== null)
          .join(" · ")}
      </p>
    </div>
    ${callButton(c, h, f)}
  </div>`;
}

function billBox(c: GwCtx, h: GwHouseView, b: GwBillView): TemplateResult {
  const chambers = b.chambers
    .map((x) => translateText(`gw.house.chamber.${x}`))
    .join(", ");
  return html`<div class="space-y-1" data-gw-house-bill=${b.law}>
    <div class="flex justify-between gap-2 text-sm">
      <span class="font-bold">${billName(c, b.law)}</span>
      <span class="shrink-0 text-white/70"
        >${translateText(`gw.house.stage.${b.stage}`)}</span
      >
    </div>
    <p class=${MUTED}>
      ${translateText(`gw.house.origin.${b.origin}`)}${b.sponsor === null
        ? ""
        : ` · ${translateText("gw.house.sponsor", {
            name: personName(c.pack, b.sponsor),
          })}`}
    </p>
    <p class=${MUTED}>
      ${translateText("gw.house.chambers", { list: chambers })}
    </p>
    ${b.whip === null
      ? nothing
      : html`<p
          class="text-sm text-amber-100/90"
          data-gw-house-whip=${b.whip.word}
        >
          ${translateText("gw.house.whip_line", {
            name:
              b.whip.person === null ? "" : personName(c.pack, b.whip.person),
            word: translateText(`gw.house.whip.${b.whip.word}`),
          })}
        </p>`}
    ${b.delayTo === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.house.delay", { n: b.delayTo + 1 })}
        </p>`}
    ${b.stage === "draft"
      ? nothing
      : html`<p class=${MUTED} data-gw-house-calls>
          ${translateText("gw.house.calls", { n: h.calls })}
        </p>`}
    ${b.factions.map((f) => factionLine(c, h, f))}
  </div>`;
}

/** The country tab's "의회" box: only the moving bill's house, folded short. */
export function houseSection(c: GwCtx): TemplateResult | typeof nothing {
  const h = houseOf(c);
  if (h === null) return nothing;
  return html`<section class=${BOX} data-gw-house>
    <h3 class=${HEAD}>${translateText("gw.house.title")}</h3>
    ${h.bill === null
      ? html`<p class=${MUTED}>${translateText("gw.house.none")}</p>`
      : billBox(c, h, h.bill)}
    ${h.record.right + h.record.wrong === 0
      ? nothing
      : html`<p class=${MUTED} data-gw-house-record>
          ${translateText("gw.house.record", {
            right: h.record.right,
            wrong: h.record.wrong,
          })}
        </p>`}
  </section>`;
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
  return html`<span class=${CHIP} data-gw-house-out=${out.id}
    >${translateText(`gw.house.out.${out.bloc}`)}</span
  >`;
}
