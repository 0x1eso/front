// ww221 (lane A): the Admiralty's papers on the fronts tab. A fleet moves or
// sorties only when one is signed; the admiral's word comes in words, the
// sortie's picks in words, no odds and no result before the pick.
import type { GwFleetPaperView } from "@openfront/engine-api/ww1914/GwFleetPapers";
import { gwEtaWord } from "@openfront/engine-api/ww1914/GwTokens";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { BTN, CHIP, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

function line(p: GwFleetPaperView): string {
  const area = translateText(`gw.fleet.area.${p.area}`);
  if (p.kind === "move" && p.to !== undefined) {
    return translateText("gw.fleet_paper.move_line", {
      area,
      to: translateText(`gw.fleet.area.${p.to}`),
      eta: translateText(`gw.ui.move_eta.${gwEtaWord(p.eta ?? 1)}`),
    });
  }
  if (p.kind === "sortie") {
    return translateText("gw.fleet_paper.sortie_line", { area });
  }
  return translateText("gw.fleet_paper.mission_line", {
    area,
    mission: translateText(`gw.fleet.mission.${p.mission ?? "patrol"}`),
  });
}

function signButtons(c: GwCtx, p: GwFleetPaperView): TemplateResult {
  if (!p.open) {
    return html`<p class=${MUTED} data-gw-fleet-paper-why>
      ${translateText(`gw.ui.block.${p.block ?? "closed"}`)}
    </p>`;
  }
  if (p.kind === "sortie") {
    return html`<div class="grid grid-cols-1 gap-1 sm:grid-cols-3">
      ${(p.picks ?? []).map(
        (pick) =>
          html`<button
            class="${BTN} min-h-10 w-full text-center"
            data-gw-fleet-pick=${`${p.id}:${pick}`}
            @click=${() => c.send({ kind: "fleet_paper", paper: p.id, pick })}
          >
            ${translateText(`gw.fleet_paper.pick.${pick}`)}
          </button>`,
      )}
    </div>`;
  }
  return html`<button
    class="${BTN} min-h-10 w-full text-center"
    data-gw-fleet-sign=${p.id}
    @click=${() => c.send({ kind: "fleet_paper", paper: p.id })}
  >
    ${translateText("gw.ui.sign")}
  </button>`;
}

function paper(c: GwCtx, p: GwFleetPaperView): TemplateResult {
  const tag = c.seat.tag.toLowerCase();
  return html`<div
    class="space-y-1 rounded border border-white/10 bg-white/5 p-2"
    data-gw-fleet-paper=${p.id}
  >
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-bold"
        >${translateText(`gw.fleet_paper.kind.${p.kind}`)}</span
      >
      <span class=${CHIP}>${translateText(`gw.fleet.name.${p.fleet}`)}</span>
      <span class="${MUTED} ml-auto"
        >${translateText(`gw.fleet_paper.why.${p.why}`)}</span
      >
    </div>
    <p class="text-sm text-white/85">${line(p)}</p>
    <p class=${MUTED}>
      ${translateText("gw.fleet_paper.ships", { n: p.ships })}
    </p>
    ${p.by === null
      ? nothing
      : html`<p class="text-sm text-white/80" data-gw-fleet-voice=${p.voice}>
          ${translateText("gw.fleet_paper.say_line", {
            name: personName(c.pack, p.by),
            say: translateText(`gw.fleet_paper.say.${tag}.${p.voice}`),
          })}
        </p>`}
    ${p.warned
      ? html`<p class="text-sm text-amber-100" data-gw-fleet-warned>
          ${translateText("gw.fleet_paper.warned")}
        </p>`
      : nothing}
    ${p.objects && p.open
      ? html`<p class=${MUTED} data-gw-fleet-overrule>
          ${translateText("gw.fleet_paper.overrule")}
        </p>`
      : nothing}
    ${signButtons(c, p)}
  </div>`;
}

/** The Admiralty's papers; each signed on its own, none signed: none goes. */
export function fleetPapersSection(c: GwCtx): TemplateResult | typeof nothing {
  const list = c.seat.world.fleetPapers ?? [];
  if (list.length === 0) return nothing;
  return html`<section
    data-gw-fleet-papers
    class="space-y-2 rounded border border-white/15 bg-black/35 p-2.5"
  >
    <h3 class=${HEAD}>${translateText("gw.fleet_paper.title")}</h3>
    <p class=${MUTED}>${translateText("gw.fleet_paper.hint")}</p>
    ${list.map((p) => paper(c, p))}
  </section>`;
}
