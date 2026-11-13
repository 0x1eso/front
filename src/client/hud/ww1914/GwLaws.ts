// Great War 1914: the day's card strip (the count in words). The bills
// themselves are the 통치 tab's book (GwBook, ww203).
import type { GwLawView } from "@openfront/engine-api/ww1914/GwLaw";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { instName } from "./GwOffice";
import { MUTED } from "./GwStyle";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

/** What a moving bill looks like today, and who can stop it. */
function standing(v: GwLawView, tag: string): TemplateResult | typeof nothing {
  if (v.body === null) return nothing;
  const body = instName(tag, v.body);
  const stops =
    v.second === null
      ? translateText("gw.law.stops", { body })
      : translateText("gw.law.stops_two", {
          body,
          second: instName(tag, v.second),
        });
  return html`<p class=${MUTED} data-gw-law-stops>
    ${stops}${v.outlook === null
      ? nothing
      : html` ·
          <span data-gw-law-outlook=${v.outlook}
            >${translateText(`gw.law.outlook.${v.outlook}`)}</span
          >`}${v.decree
      ? html` · <span>${translateText("gw.law.by_decree")}</span>`
      : nothing}
  </p>`;
}

/** Under the day's card: how the count stands as it is read. */
export function lawStrip(c: GwCtx, scene: string): TemplateResult {
  const v = c.seat.world.laws.find((x) => `gw_lv_${x.id}` === scene);
  if (v === undefined) return html``;
  return html`<div class=${BOX} data-gw-law-strip>
    ${standing(v, c.seat.tag)}
  </div>`;
}
