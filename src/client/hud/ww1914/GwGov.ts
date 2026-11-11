import type { GwGovView } from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { govWord } from "./GwModel";
import { CHIP, HEAD, MUTED } from "./GwStyle";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

function threat(g: GwGovView): TemplateResult {
  return html`<div class="space-y-0.5" data-gw-gov=${g.id}>
    <div class="flex items-center justify-between gap-2 text-sm">
      <span class="text-white/85">${translateText(`gw.gov.name.${g.id}`)}</span>
      <span class=${CHIP}>${translateText(`gw.gov.word.${govWord(g)}`)}</span>
    </div>
    ${g.feeds.map(
      (k) => html`<p class=${MUTED}>${translateText(`gw.gov.feed.${k}`)}</p>`,
    )}
  </div>`;
}

function poll(c: GwCtx): TemplateResult | typeof nothing {
  const p = c.seat.poll;
  if (p === null || p === undefined) return nothing;
  return html`<div class="space-y-0.5" data-gw-poll>
    <p class="text-sm text-white/85">
      ${translateText("gw.gov.poll_line", { seats: p.seats, need: p.need })}
    </p>
    ${p.friends.map(
      (f) =>
        html`<p class=${MUTED}>
          ${translateText(f.with ? "gw.gov.poll_with" : "gw.gov.poll_without", {
            party: translateText(`gw.gov.party.${f.id}`),
            seats: f.seats,
          })}
        </p>`,
    )}
    ${p.lines.map(
      (l) =>
        html`<p class=${MUTED}>
          ${l.seats > 0 ? "▲" : "▼"} ${translateText(`gw.gov.swing.${l.key}`)}
          ${Math.abs(l.seats)}
        </p>`,
    )}
  </div>`;
}

/** What threatens the government, in the country tab; nothing when all is quiet. */
export function govBox(c: GwCtx): TemplateResult | typeof nothing {
  const rows = c.seat.gov ?? [];
  if (rows.length === 0 && (c.seat.poll ?? null) === null) return nothing;
  return html`<section class=${BOX} data-gw-gov-box>
    <h3 class=${HEAD}>${translateText("gw.gov.title")}</h3>
    <p class=${MUTED} data-gw-sub>${translateText("gw.gov.sub")}</p>
    ${rows.map(threat)} ${poll(c)}
  </section>`;
}
