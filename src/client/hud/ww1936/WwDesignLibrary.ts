// World War 1936: the library screen (a tab of the designer drawer): saved
// designs and division templates grouped tank, plane, ship, division. Each
// card shows what it is and its status, with load, an auto-create switch,
// share and a two-tap delete. Below: export all and paste-to-import.
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  BattalionId,
  SupportId,
} from "@openfront/engine-api/ww1936/LandTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { LibEntry, LibraryStore } from "./DesignLibrary";
import {
  entryName,
  entryStatus,
  EntryStatus,
  existingKeys,
} from "./DesignLibraryStatus";
import { DesignerGame, DesignerModel, numText } from "./DesignerModel";
import { battalionSummary } from "./LandModel";

export interface LibraryUi {
  /** `del:<id>` of the card armed for a second tap, or "". */
  armed: string;
  /** A one-line result (saved, imported, refused). */
  message: string;
  /** The share code shown, and what it is of. */
  code: string;
  importText: string;
}

export interface LibraryEnv {
  store: LibraryStore;
  game: DesignerGame & Parameters<typeof existingKeys>[0];
  ui: LibraryUi;
  load: (e: LibEntry, s: EntryStatus) => void;
  del: (e: LibEntry) => void;
  toggleAuto: (e: LibEntry) => void;
  share: (ids?: readonly string[]) => void;
  copy: () => void;
  doImport: () => void;
  setImportText: (t: string) => void;
}

const GROUPS: readonly {
  id: string;
  key: string;
  match: (e: LibEntry) => boolean;
}[] = [
  {
    id: "tank",
    key: "ww1936.design.tab_tank",
    match: (e) => e.type === "design" && e.def.kind === "tank",
  },
  {
    id: "plane",
    key: "ww1936.design.tab_plane",
    match: (e) => e.type === "design" && e.def.kind === "plane",
  },
  {
    id: "ship",
    key: "ww1936.design.tab_ship",
    match: (e) => e.type === "design" && e.def.kind === "ship",
  },
  {
    id: "division",
    key: "ww1936.library.group_division",
    match: (e) => e.type === "template",
  },
  {
    id: "army",
    key: "ww1936.army_tpl.group",
    match: (e) => e.type === "army",
  },
];

const BTN =
  "h-10 min-w-10 shrink-0 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold hover:bg-white/10";

function summary(e: LibEntry, s: EntryStatus, model: DesignerModel): string {
  if (s.state === "stale") {
    return e.type === "design" ? `${e.def.kind} · ${e.def.base}` : "";
  }
  if (e.type === "army") {
    return e.items.map((i) => `${i.name} ×${i.count}`).join(" · ");
  }
  if (e.type === "template") {
    return battalionSummary({
      name: e.name,
      battalions: e.battalions as BattalionId[],
      support: e.support as SupportId[],
    });
  }
  const def = e.def as DesignDef;
  const stats = model
    .statsOf(def)
    .map(
      (x) =>
        `${translateText(`ww1936.design.stat.${x.id}`)} ${numText(x.raw, x.div)}`,
    )
    .join(" · ");
  return `${model.baseLabel(def)} · ${stats}`;
}

function renderCard(
  env: LibraryEnv,
  e: LibEntry,
  have: ReadonlySet<string>,
  model: DesignerModel,
): TemplateResult {
  const s = entryStatus(e, env.game, have);
  const armed = env.ui.armed === `del:${e.id}`;
  const tone =
    s.state === "ready"
      ? "text-emerald-300"
      : s.state === "have"
        ? "text-white/60"
        : "text-amber-300";
  const line = (() => {
    try {
      return summary(e, s, model);
    } catch {
      return "";
    }
  })();
  return html`<li
    data-ww-lib-card=${e.id}
    data-state=${s.state}
    class="flex flex-col gap-1 rounded-md border border-white/10 bg-white/5 p-2 text-xs ${s.state ===
    "stale"
      ? "opacity-70"
      : ""}"
  >
    <div class="truncate text-sm font-bold">${entryName(e)}</div>
    ${line === "" ? nothing : html`<div class="text-white/70">${line}</div>`}
    <div data-ww-lib-status class="${tone}">
      ${s.state === "ready" ? "" : s.state === "have" ? "" : "🔒 "}${s.reason}
    </div>
    <div class="flex flex-wrap gap-1">
      ${e.type === "army"
        ? nothing
        : html` <button
              type="button"
              data-ww-lib-load
              aria-disabled=${String(s.order === null)}
              class="${BTN} flex-1 ${s.order === null
                ? "opacity-40"
                : "border-emerald-400/60 bg-emerald-800/50"}"
              @click=${() => {
                if (s.order !== null) env.load(e, s);
              }}
            >
              ${translateText("ww1936.library.load")}
            </button>
            <button
              type="button"
              role="switch"
              data-ww-lib-auto
              aria-checked=${String(e.auto)}
              aria-disabled=${String(s.state === "stale")}
              class="${BTN} flex items-center gap-1 ${e.auto
                ? "border-emerald-400/70 bg-emerald-900/50"
                : ""} ${s.state === "stale" ? "opacity-40" : ""}"
              @click=${() => {
                if (s.state !== "stale") env.toggleAuto(e);
              }}
            >
              ${translateText("ww1936.library.auto")}
              ${translateText(e.auto ? "ww1936.auto.on" : "ww1936.auto.off")}
            </button>`}
      <button
        type="button"
        data-ww-lib-share
        class="${BTN}"
        @click=${() => env.share([e.id])}
      >
        ${translateText("ww1936.library.share")}
      </button>
      <button
        type="button"
        data-ww-lib-delete
        class="${BTN} ${armed
          ? "border-red-400 bg-red-900/70"
          : "border-red-400/40"}"
        @click=${() => env.del(e)}
      >
        ${translateText(
          armed ? "ww1936.land.tap_again" : "ww1936.library.delete",
        )}
      </button>
    </div>
  </li>`;
}

export function renderLibrary(env: LibraryEnv): TemplateResult {
  const entries = env.store.entries;
  const have = existingKeys(env.game);
  const model = new DesignerModel(env.game);
  return html`<div data-ww-library class="flex flex-col gap-3">
    ${env.ui.message === ""
      ? nothing
      : html`<p data-ww-lib-message class="m-0 text-xs text-sky-200">
          ${env.ui.message}
        </p>`}
    ${entries.length === 0
      ? html`<p data-ww-lib-empty class="m-0 text-xs text-white/60">
          ${translateText("ww1936.library.empty")}
        </p>`
      : GROUPS.map((g) => {
          const list = entries.filter(g.match);
          if (list.length === 0) return nothing;
          return html`<section data-ww-lib-group=${g.id}>
            <h3 class="m-0 mb-1 text-xs font-bold text-white/70">
              ${translateText(g.key)} (${list.length})
            </h3>
            <ul class="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
              ${list.map((e) => renderCard(env, e, have, model))}
            </ul>
          </section>`;
        })}
    <section class="flex flex-col gap-1 border-t border-white/10 pt-2">
      <h3 class="m-0 text-xs font-bold text-white/70">
        ${translateText("ww1936.library.share_title")}
      </h3>
      <div class="flex gap-1">
        <button
          type="button"
          data-ww-lib-export
          class="${BTN} flex-1"
          ?disabled=${entries.length === 0}
          @click=${() => env.share()}
        >
          ${translateText("ww1936.library.export_all")}
        </button>
        <button
          type="button"
          data-ww-lib-copy
          class="${BTN} flex-1"
          ?disabled=${env.ui.code === ""}
          @click=${env.copy}
        >
          ${translateText("ww1936.library.copy")}
        </button>
      </div>
      ${env.ui.code === ""
        ? nothing
        : html`<textarea
            data-ww-lib-code
            readonly
            rows="2"
            class="w-full rounded-md border border-white/15 bg-black/30 p-1 text-[11px]"
            .value=${env.ui.code}
          ></textarea>`}
      <textarea
        data-ww-lib-import-text
        rows="2"
        class="w-full rounded-md border border-white/15 bg-black/30 p-1 text-[11px]"
        placeholder=${translateText("ww1936.library.import_hint")}
        .value=${env.ui.importText}
        @input=${(ev: Event) =>
          env.setImportText((ev.target as HTMLTextAreaElement).value)}
      ></textarea>
      <button
        type="button"
        data-ww-lib-import
        class="${BTN}"
        @click=${env.doImport}
      >
        ${translateText("ww1936.library.import")}
      </button>
    </section>
  </div>`;
}
