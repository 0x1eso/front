import type { GwPersonView } from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { appointable, topicLabel, trustIndex } from "./GwModel";
import { BTN, BTN_ON, CHIP, MUTED } from "./GwStyle";
import { personBio, personLean, personName } from "./GwText";

/** Seven pips for trust -3..3. */
function pips(trust: number): TemplateResult {
  const at = trustIndex(trust);
  return html`<span class="inline-flex gap-0.5" aria-hidden="true"
    >${Array.from({ length: 7 }, (_, i) => {
      const on = i === at;
      return html`<span
        class="h-2 w-2 rounded-full ${on ? "bg-amber-300" : "bg-white/20"}"
      ></span>`;
    })}</span
  >`;
}

function row(c: GwCtx, p: GwPersonView): TemplateResult {
  const open = c.ui.openPerson === p.id;
  const lean = personLean(c.pack, p.id);
  const bio = personBio(c.pack, p.id);
  const offices = appointable(c.seat, p);
  const armed = c.ui.armedDismiss === p.id;
  return html`<section
    data-gw-person=${p.id}
    class="rounded border border-white/15 bg-black/35 p-2.5"
  >
    <button
      class="flex w-full items-center gap-2 text-left"
      @click=${() => {
        c.ui.openPerson = open ? null : p.id;
        c.ui.armedDismiss = null;
        c.redraw();
      }}
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-bold"
          >${personName(c.pack, p.id)}</span
        >
        <span class="${MUTED} block truncate"
          >${p.office === null
            ? translateText("gw.ui.no_office")
            : translateText(`gw.office.${p.office}`)}${lean === ""
            ? nothing
            : html` · ${lean}`}</span
        >
      </span>
      <span class="flex flex-col items-end gap-0.5">
        ${pips(p.trust)}
        <span class=${MUTED}
          >${translateText(`gw.ui.trust.${trustIndex(p.trust)}`)}</span
        >
      </span>
    </button>
    ${open
      ? html`<div class="mt-2 space-y-2 border-t border-white/10 pt-2">
          ${bio === ""
            ? nothing
            : html`<p class="text-sm text-white/80">${bio}</p>`}
          ${p.rivals.length === 0
            ? nothing
            : html`<p class=${MUTED}>
                ${translateText("gw.ui.rivals")}:
                ${p.rivals.map((r) => personName(c.pack, r)).join(", ")}
              </p>`}
          <div class="space-y-1">
            ${p.topics.length === 0
              ? html`<p class=${MUTED}>${translateText("gw.ui.no_topics")}</p>`
              : p.topics.map(
                  (t) =>
                    html`<button
                      class="${BTN} w-full"
                      data-gw-topic=${t}
                      ?disabled=${c.seat.audiences <= 0}
                      @click=${() => {
                        c.send({ kind: "summon", person: p.id, topic: t });
                        c.ui.summoned = Date.now();
                      }}
                    >
                      ${topicLabel(c.pack, t)}
                    </button>`,
                )}
          </div>
          ${offices.map(
            (o) =>
              html`<button
                class="${BTN} w-full"
                data-gw-appoint=${o}
                @click=${() =>
                  c.send({ kind: "appoint", person: p.id, office: o })}
              >
                ${translateText("gw.ui.appoint", {
                  office: translateText(`gw.office.${o}`),
                })}
              </button>`,
          )}
          ${p.office === null
            ? nothing
            : html`<button
                class="${armed ? BTN_ON : BTN} w-full"
                data-gw-dismiss=${p.id}
                @click=${() => {
                  if (!armed) {
                    c.ui.armedDismiss = p.id;
                    c.redraw();
                    return;
                  }
                  c.ui.armedDismiss = null;
                  c.send({ kind: "dismiss", person: p.id });
                }}
              >
                ${translateText(armed ? "gw.ui.dismiss_sure" : "gw.ui.dismiss")}
              </button>`}
        </div>`
      : nothing}
  </section>`;
}

/** The people tab: the cabinet and the court, summons left, who to call. */
export function peopleTab(c: GwCtx): TemplateResult {
  const { seat } = c;
  const office = seat.people.filter((p) => p.office !== null);
  const rest = seat.people.filter((p) => p.office === null);
  return html`<div class="space-y-2.5" data-gw-people>
    <div class="flex items-center gap-2">
      <span class=${CHIP} data-gw-audiences
        >${translateText("gw.ui.audiences", { n: seat.audiences })}</span
      >
      <span class=${MUTED}>${translateText("gw.ui.audiences_hint")}</span>
    </div>
    ${office.map((p) => row(c, p))}
    ${rest.length === 0
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.ui.outside")}</div>
          ${rest.map((p) => row(c, p))}`}
  </div>`;
}
