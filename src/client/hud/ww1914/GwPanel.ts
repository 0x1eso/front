import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwCardView,
  GwOptionView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { EventBus } from "@openfront/shared/EventBus";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendGwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  cardBody,
  cardTitle,
  fillGw,
  optionText,
  personName,
  saysText,
  tellText,
  voices,
} from "./GwText";

const BUTTON =
  "w-full rounded border border-white/30 bg-white/10 px-2 py-1 text-left text-sm text-white hover:bg-white/20 disabled:opacity-40";

/**
 * Great War 1914: a plain placeholder so a game can be clicked through end to
 * end: the chapter, the desk, the talks, the people and "ready". The screens
 * lane replaces it; every engine read is in GreatWarData.
 */
@customElement("gw-panel")
export class GwPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private data: GreatWarData | null = null;
  @state() private pack: GwPack | null = null;
  private asked = false;

  createRenderRoot() {
    return this;
  }

  init() {}

  getTickIntervalMs() {
    return 100;
  }

  tick() {
    const data = this.game?.greatWarData?.() ?? null;
    if (data === this.data) return;
    this.data = data;
    const seat = this.seat();
    if (seat !== null && !this.asked) {
      this.asked = true;
      loadGwPack(seat.tag).then(
        (p) => (this.pack = p),
        (e) => console.error("Great War text pack", e),
      );
    }
  }

  private seat(): GwSeatView | null {
    const me = this.game?.myPlayer()?.smallID();
    return this.data?.seats.find((s) => s.smallID === me) ?? null;
  }

  private send(order: GwOrder): void {
    this.eventBus.emit(new SendGwOrderIntentEvent(order));
  }

  private optionRow(
    card: GwCardView,
    o: GwOptionView,
    pick: () => void,
  ): TemplateResult {
    const why = o.open ? undefined : this.pack?.scenes[card.scene]?.why?.[o.id];
    return html`<button
        class=${BUTTON}
        data-gw-option=${o.id}
        ?disabled=${!o.open}
        @click=${pick}
      >
        ${optionText(this.pack, card, o.id)}
        ${o.tell.length === 0
          ? nothing
          : html`<span class="block text-xs text-white/60"
              >${o.tell.map(tellText).join(" · ")}</span
            >`}
      </button>
      ${why === undefined
        ? nothing
        : html`<div class="text-xs text-white/50">${why}</div>`}`;
  }

  private card(seat: GwSeatView, c: GwCardView): TemplateResult {
    const fill = (t: string) => fillGw(t, this.pack, c, seat, this.data!.date);
    const read = c.options.length === 0 && c.node === null;
    return html`<section
      data-gw-card=${c.scene}
      class="space-y-1 rounded bg-black/40 p-2"
    >
      <h3 class="font-bold">${cardTitle(this.pack, c)}</h3>
      <p class="text-sm">${fill(cardBody(this.pack, c))}</p>
      ${voices(this.pack, c).map(
        (v) => html`<p class="text-sm text-white/80">${fill(v)}</p>`,
      )}
      ${c.node === null
        ? nothing
        : html`<p class="text-sm italic">
            ${personName(this.pack, c.who ?? "")}:
            ${fill(saysText(this.pack, c))}
          </p>`}
      ${c.options.map((o) =>
        this.optionRow(c, o, () =>
          this.send({ kind: "choose", card: c.uid, option: o.id }),
        ),
      )}
      ${c.replies.map((r) =>
        this.optionRow(c, r, () =>
          this.send({ kind: "reply", card: c.uid, reply: r.id }),
        ),
      )}
      ${read
        ? html`<button
            class=${BUTTON}
            @click=${() => this.send({ kind: "read", card: c.uid })}
          >
            ${translateText("gw.panel.read")}
          </button>`
        : nothing}
    </section>`;
  }

  private people(seat: GwSeatView): TemplateResult {
    return html`<section class="space-y-1 rounded bg-black/40 p-2">
      <h3 class="font-bold">
        ${translateText("gw.panel.people", { n: seat.audiences })}
      </h3>
      ${seat.people.map(
        (p) =>
          html`<div class="text-sm">
            ${personName(this.pack, p.id)}
            ${p.office === null
              ? nothing
              : html`<span class="text-white/60"
                  >${translateText(`gw.office.${p.office}`)}</span
                >`}
            ${p.topics.map(
              (t) =>
                html`<button
                  class=${BUTTON}
                  data-gw-topic=${t}
                  ?disabled=${seat.audiences <= 0}
                  @click=${() =>
                    this.send({ kind: "summon", person: p.id, topic: t })}
                >
                  ${this.pack?.scenes[t]?.topic ?? t}
                </button>`,
            )}
          </div>`,
      )}
    </section>`;
  }

  render() {
    const d = this.data;
    const seat = this.seat();
    if (d === null || seat === null) return nothing;
    return html`<div
      class="fixed left-0 top-0 z-[900] max-h-full w-full max-w-sm space-y-2 overflow-y-auto bg-gray-900/90 p-2 text-white"
    >
      <h2 class="font-bold">
        ${translateText("gw.panel.chapter", {
          date: d.date,
          n: d.chapter + 1,
          total: d.chapterCount,
        })}
      </h2>
      ${d.ended !== null
        ? html`<p>${translateText("gw.panel.ended")}</p>`
        : html`${seat.desk.map((c) => this.card(seat, c))}${this.people(seat)}
            <button
              class=${BUTTON}
              data-gw-ready
              ?disabled=${seat.readyBlock !== null}
              @click=${() =>
                this.send({
                  kind: "ready",
                  chapter: d.chapter,
                  on: !seat.ready,
                })}
            >
              ${translateText(
                seat.ready ? "gw.panel.not_ready" : "gw.panel.ready",
              )}
            </button>`}
    </div>`;
  }
}
