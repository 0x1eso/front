import type { GwCalendarId } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_WRITTEN_TAGS,
  GwTag,
} from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { html, TemplateResult } from "lit";
import { gwProloguePicks } from "./GwRecentRuns";
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

/** Live the ruler's earlier years, or start at the first telegram. */
function prologuePicker(
  on: boolean,
  pick: (on: boolean) => void,
  kept: boolean,
): TemplateResult {
  const row = (id: string, value: boolean, label: string) =>
    html`<button
      type="button"
      data-gw-prologue=${id}
      class=${rowClass(on === value)}
      @click=${() => pick(value)}
    >
      ${label}
    </button>`;
  const note = on
    ? translateText("gw.ui.prologue_note_play")
    : kept
      ? translateText("gw.ui.prologue_note_kept")
      : translateText("gw.ui.prologue_note_neutral");
  return html`<div class="text-xs text-white/70">
      ${translateText("gw.ui.prologue_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${row("play", true, translateText("gw.ui.prologue_play"))}
      ${row("skip", false, translateText("gw.ui.prologue_skip"))}
    </div>
    <div class="text-xs text-white/60" data-gw-prologue-note>${note}</div>`;
}

/** The lobby's seat, length and prologue for the Great War. */
export function gwCalendarPicker(
  seat: GwTag,
  pickSeat: (tag: GwTag) => void,
  selected: GwCalendarId,
  pick: (id: GwCalendarId) => void,
  prologue: boolean,
  pickPrologue: (on: boolean) => void,
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
    ${prologuePicker(prologue, pickPrologue, gwProloguePicks(seat).length > 0)}
  </div>`;
}
