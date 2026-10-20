import {
  COUNTRIES,
  COUNTRY_GROUPS,
  COUNTRY_TAGS,
  CountryTag,
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

  render() {
    return html`
      <div class="space-y-4">
        <p class="text-sm text-white/70">
          ${translateText("ww1936.lobby.pick_hint")}
        </p>
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
                  (t) => COUNTRIES[t].group === g && !COUNTRIES[t].major,
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
