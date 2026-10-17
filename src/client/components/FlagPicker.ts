import { assetUrl } from "@openfront/shared/AssetUrls";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import Countries from "resources/countries.json" with { type: "json" };
import { FLAG_KEY, UserSettings } from "../UserSettings";
import { translateText } from "../Utils";

interface FlagEntry {
  code: string;
  /** Shown name: Korean when the runtime knows it, otherwise English. */
  label: string;
  /** Lower-cased haystack: code, English and Korean names. */
  search: string;
}

let koNames: Intl.DisplayNames | null | undefined;
function koreanName(code: string): string | null {
  if (!/^[a-z]{2}$/.test(code)) return null;
  try {
    koNames ??= new Intl.DisplayNames(["ko"], { type: "region" });
    const name = koNames.of(code.toUpperCase());
    return name && name !== code.toUpperCase() ? name : null;
  } catch {
    koNames = null;
    return null;
  }
}

let entries: FlagEntry[] | null = null;
function flagEntries(): FlagEntry[] {
  entries ??= Countries.filter(
    (c) =>
      c.code !== "xx" && (c as { restricted?: boolean }).restricted !== true,
  ).map((c) => {
    const ko = koreanName(c.code);
    return {
      code: c.code,
      label: ko ?? c.name,
      search: `${c.code} ${c.name} ${ko ?? ""}`.toLowerCase(),
    };
  });
  return entries;
}

/** Filter the flag list by a free-text query (code, English or Korean name). */
export function filterFlags(query: string): FlagEntry[] {
  const q = query.trim().toLowerCase();
  const all = flagEntries();
  return q ? all.filter((e) => e.search.includes(q)) : all;
}

/**
 * Homepage flag button plus its picker. Country flags are free, so the choice
 * is stored straight in UserSettings and travels with the join's cosmetics.
 */
@customElement("flag-picker")
export class FlagPicker extends LitElement {
  @state() private open = false;
  @state() private query = "";
  @state() private current: string | null = null;

  private readonly settings = new UserSettings();
  private readonly onSettings = () => this.refresh();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.refresh();
    window.addEventListener(
      `event:user-settings-changed:${FLAG_KEY}`,
      this.onSettings,
    );
  }

  disconnectedCallback() {
    window.removeEventListener(
      `event:user-settings-changed:${FLAG_KEY}`,
      this.onSettings,
    );
    super.disconnectedCallback();
  }

  private refresh() {
    const flag = this.settings.getFlag();
    this.current = flag?.startsWith("country:") ? flag.slice(8) : null;
  }

  private choose(code: string | null) {
    if (code === null) this.settings.clearFlag(true);
    else this.settings.setFlag(`country:${code}`);
    this.refresh();
    this.close();
  }

  private close() {
    this.open = false;
    this.query = "";
  }

  private img(code: string, cls: string) {
    return html`<img
      class=${cls}
      src=${assetUrl(`flags/${code}.svg`)}
      alt=""
      loading="lazy"
      draggable="false"
    />`;
  }

  private renderPicker() {
    const list = filterFlags(this.query);
    return html`
      <div
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-2"
        @click=${(e: Event) => e.target === e.currentTarget && this.close()}
      >
        <div
          role="dialog"
          aria-modal="true"
          class="flex flex-col w-full max-w-[34rem] max-h-[calc(100dvh-1rem)] rounded-lg bg-white text-neutral-900 shadow-2xl"
        >
          <div class="flex items-center gap-2 p-2 border-b border-black/10">
            <h2 class="shrink-0 px-1 text-base font-bold">
              ${translateText("main.flag_picker_title")}
            </h2>
            <input
              type="search"
              data-flag-search
              class="min-w-0 flex-1 h-10 px-3 rounded border border-black/20 bg-white text-base"
              placeholder=${translateText("main.flag_search")}
              aria-label=${translateText("main.flag_search")}
              .value=${this.query}
              @input=${(e: Event) =>
                (this.query = (e.target as HTMLInputElement).value)}
            />
            <button
              type="button"
              data-flag-close
              class="shrink-0 h-10 px-3 rounded border border-black/20 text-sm font-semibold"
              @click=${() => this.close()}
            >
              ${translateText("main.flag_close")}
            </button>
          </div>
          <div class="p-2 overflow-y-auto overscroll-contain min-h-0">
            <button
              type="button"
              data-flag-none
              class="w-full mb-2 h-10 rounded border border-black/20 text-sm font-semibold ${this
                .current === null
                ? "bg-neutral-200"
                : ""}"
              @click=${() => this.choose(null)}
            >
              ${translateText("main.flag_none")}
            </button>
            ${list.length === 0
              ? html`<p class="py-6 text-center text-sm">
                  ${translateText("main.flag_no_results")}
                </p>`
              : html`<div
                  class="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2"
                >
                  ${list.map(
                    (f) =>
                      html`<button
                        type="button"
                        data-flag-code=${f.code}
                        class="flex flex-col items-center gap-1 p-1 rounded border text-xs leading-tight ${this
                          .current === f.code
                          ? "border-red-800 bg-neutral-200"
                          : "border-black/10"}"
                        @click=${() => this.choose(f.code)}
                      >
                        ${this.img(f.code, "h-8 w-12 object-contain")}
                        <span class="w-full break-words text-center"
                          >${f.label}</span
                        >
                      </button>`,
                  )}
                </div>`}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <button
        type="button"
        data-flag-button
        class="shrink-0 flex items-center justify-center h-11 w-14 mr-1 rounded border border-black/10 bg-white/60"
        aria-label=${translateText("main.flag_button")}
        title=${translateText("main.flag_button")}
        @click=${() => (this.open = true)}
      >
        ${this.current
          ? this.img(this.current, "h-7 w-10 object-contain")
          : html`<span
              class="px-1 text-[10px] font-semibold leading-tight text-center text-neutral-600"
              >${translateText("main.flag_none")}</span
            >`}
      </button>
      ${this.open ? this.renderPicker() : nothing}
    `;
  }
}
