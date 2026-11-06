import type { GwCalendarId } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_WRITTEN_TAGS,
  GwTag,
} from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { html, TemplateResult } from "lit";
import { translateText } from "./Utils";

/**
 * Calendar rows that have scenes to play, in the order the lobby lists them.
 * The war's own scenes run to the end of `full` and `standard`.
 */
export const GW_PLAYABLE_CALENDARS: readonly GwCalendarId[] = [
  "y1914",
  "standard",
  "full",
];

const rowClass = (on: boolean) =>
  `rounded border px-3 py-1.5 text-left text-sm text-white ${
    on
      ? "border-amber-300/80 bg-amber-300/20"
      : "border-white/25 bg-white/10 hover:bg-white/20"
  }`;

/** The lobby's seat and length for the Great War: one button per choice. */
export function gwCalendarPicker(
  seat: GwTag,
  pickSeat: (tag: GwTag) => void,
  selected: GwCalendarId,
  pick: (id: GwCalendarId) => void,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-calendar>
    <div class="text-xs text-white/70">
      ${translateText("gw.ui.seat_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${GW_WRITTEN_TAGS.map(
        (tag) =>
          html`<button
            type="button"
            data-gw-seat=${tag}
            class=${rowClass(tag === seat)}
            @click=${() => pickSeat(tag)}
          >
            ${translateText(`gw.country.${tag}`)}
          </button>`,
      )}
    </div>
    <div class="text-xs text-white/70">
      ${translateText("gw.ui.calendar_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${GW_PLAYABLE_CALENDARS.map(
        (id) =>
          html`<button
            type="button"
            data-gw-calendar-row=${id}
            class=${rowClass(id === selected)}
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
