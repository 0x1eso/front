import type { GwCalendarId } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { html, TemplateResult } from "lit";
import { translateText } from "./Utils";

/**
 * Calendar rows that have scenes to play, in the order the lobby lists them.
 * The war's own scenes run to the end of `full` and `standard`; the lobby's
 * default stays on `y1914` until the 1915-18 writing is merged.
 */
export const GW_PLAYABLE_CALENDARS: readonly GwCalendarId[] = [
  "y1914",
  "standard",
  "full",
];

/** The lobby's length choice for the Great War: one button per row with content. */
export function gwCalendarPicker(
  selected: GwCalendarId,
  pick: (id: GwCalendarId) => void,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-calendar>
    <div class="text-sm text-white">${translateText("gw.country.DEU")}</div>
    <div class="text-xs text-white/70">
      ${translateText("gw.ui.calendar_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${GW_PLAYABLE_CALENDARS.map(
        (id) =>
          html`<button
            type="button"
            data-gw-calendar-row=${id}
            class="rounded border px-3 py-1.5 text-left text-sm text-white ${id ===
            selected
              ? "border-amber-300/80 bg-amber-300/20"
              : "border-white/25 bg-white/10 hover:bg-white/20"}"
            @click=${() => pick(id)}
          >
            <span class="block font-bold"
              >${translateText(`gw.ui.calendar.${id}`)}</span
            >
            <span class="block text-xs text-white/70"
              >${translateText("gw.ui.calendar_chapters", {
                n: gwChapters(id).length,
              })}
              · ${translateText(`gw.ui.calendar_time.${id}`)}</span
            >
          </button>`,
      )}
    </div>
  </div>`;
}
