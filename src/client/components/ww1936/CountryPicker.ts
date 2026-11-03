import {
  COUNTRIES,
  COUNTRY_GROUPS,
  COUNTRY_TAGS,
  CountryTag,
  isDormantTag,
  MAJOR_TAGS,
} from "@openfront/engine-api/ww1936/Countries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { translateText } from "../../Utils";
import { FACTION_DOT_CLASS } from "./FactionDot";

/**
 * World War 1936 lobby (spec §8.1): the seven majors as cards, then every
 * country by region. A country another player holds is greyed out with
 * their name. Tapping a free country picks it; tapping my own gives it up.
 */
@customElement("ww-country-picker")
export class CountryPicker extends LitElement {
  @property({ attribute: false }) picks: {
    clientID: string;
    tag: CountryTag;
  }[] = [];
  @property({ attribute: false }) myClientID = "";
  @property({ attribute: false }) usernames: Map<string, string> = new Map();
  @property({ attribute: false }) selected: CountryTag | null = null;

  createRenderRoot() {
    return this;
  }

  private holderOf(tag: CountryTag): string | null {
    const p = this.picks.find(
      (x) => x.tag === tag && x.clientID !== this.myClientID,
    );
    return p === undefined ? null : (this.usernames.get(p.clientID) ?? "?");
  }

  private onPick(tag: CountryTag) {
    const next = this.selected === tag ? null : tag;
    this.dispatchEvent(
      new CustomEvent("country-picked", {
        detail: { tag: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private flag(tag: CountryTag, size: string): TemplateResult {
    return html`<img
      src=${assetUrl(`flags/${COUNTRIES[tag].flag}.svg`)}
      alt=""
      class="${size} shrink-0 rounded-sm object-cover"
    />`;
  }

  private card(tag: CountryTag): TemplateResult {
    const holder = this.holderOf(tag);
    const mine = this.selected === tag;
    const faction = COUNTRIES[tag].faction;
    return html`<button
      data-tag=${tag}
      aria-pressed=${mine}
      ?disabled=${holder !== null}
      @click=${() => this.onPick(tag)}
      class="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${mine
        ? "border-amber-400 bg-amber-400/15"
        : "border-white/10 bg-white/5 hover:bg-white/10"} ${holder !== null
        ? "opacity-40"
        : ""}"
    >
      <span class="flex items-center gap-2">
        ${this.flag(tag, "h-5 w-8")}
        <span class="text-sm font-bold text-white">
          ${translateText(`ww1936.country.${tag}`)}
        </span>
      </span>
      <span class="text-xs text-white/70">
        ${translateText(`ww1936.leader.${tag}`)}
      </span>
      ${faction === null
        ? nothing
        : html`<span class="flex items-center gap-1 text-xs text-white/70">
            <span
              class="size-2 rounded-full ${FACTION_DOT_CLASS[faction]}"
            ></span>
            ${translateText(`ww1936.faction.${faction}`)}
          </span>`}
      ${holder === null
        ? nothing
        : html`<span class="text-xs text-white/60">
            ${translateText("ww1936.lobby.taken_by", { name: holder })}
          </span>`}
    </button>`;
  }

  private row(tag: CountryTag): TemplateResult {
    const holder = this.holderOf(tag);
    const mine = this.selected === tag;
    return html`<button
      data-tag=${tag}
      aria-pressed=${mine}
      ?disabled=${holder !== null}
      @click=${() => this.onPick(tag)}
      class="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${mine
        ? "border-amber-400 bg-amber-400/15"
        : "border-white/10 bg-white/5 hover:bg-white/10"} ${holder !== null
        ? "opacity-40"
        : ""}"
    >
      ${this.flag(tag, "h-3.5 w-5")}
      <span class="font-semibold text-white">
        ${translateText(`ww1936.country.${tag}`)}
      </span>
      ${holder === null
        ? nothing
        : html`<span class="ml-auto text-white/60">${holder}</span>`}
    </button>`;
  }

  /** Opens the preparation screen of the picked country (loaded on demand: it carries the designers). */
  private async openPrep() {
    const tag = this.selected;
    if (tag === null || document.querySelector("ww-lobby-prep") !== null) {
      return;
    }
    await import("../../hud/ww1936/WwLobbyPrep");
    const el = document.createElement("ww-lobby-prep");
    el.tag = tag;
    document.body.appendChild(el);
  }

  render() {
    return html`
      <div class="space-y-4">
        <p class="text-sm text-white/70">
          ${translateText("ww1936.lobby.pick_hint")}
        </p>
        ${this.selected === null
          ? nothing
          : html`<button
              type="button"
              data-ww-prep-open
              class="min-h-11 w-full rounded-xl border border-sky-400/60 bg-sky-500/20 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500/30"
              @click=${() => void this.openPrep()}
            >
              ${translateText("ww1936.prep.button")}
            </button>`}
        <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
          ${MAJOR_TAGS.map((t) => this.card(t))}
        </div>
        ${COUNTRY_GROUPS.map(
          (g) =>
            html`<section data-group=${g} class="space-y-2">
              <div
                class="text-xs font-bold uppercase tracking-widest text-white/40"
              >
                ${translateText(`ww1936.group.${g}`)}
              </div>
              <div class="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                ${COUNTRY_TAGS.filter(
                  // P5 plan decision 3: never a dormant slot.
                  (t) =>
                    COUNTRIES[t].group === g &&
                    !COUNTRIES[t].major &&
                    !isDormantTag(t),
                ).map((t) => this.row(t))}
              </div>
            </section>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ww-country-picker": CountryPicker;
  }
}
