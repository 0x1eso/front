import {
  GW_PACE_PCT,
  GW_PACES,
  type GwCalendarId,
  type GwPace,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_SEAT_TAGS,
  GW_TAGS,
  GW_WRITTEN_TAGS,
  gwCountry,
  GwTag,
} from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { assetUrl } from "@openfront/shared/AssetUrls";
import type { GwResumeInfo } from "@openfront/shared/WireSchemas";
import { html, TemplateResult } from "lit";
import { gwProloguePicks } from "./GwRecentRuns";
import { translateText } from "./Utils";

/**
 * Calendar rows that have scenes to play, in the order the lobby lists them.
 * The war's own scenes run to the end of `full` and `standard`.
 */
export const GW_PLAYABLE_CALENDARS: readonly GwCalendarId[] = [
  "y1914",
  "friends",
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
    ${calendarRows(selected, pick)}
    ${prologuePicker(prologue, pickPrologue, gwProloguePicks(seat).length > 0)}
  </div>`;
}

/** The friends' lobby: the length alone, seats and the timer are their own. */
export function gwFriendsCalendarPicker(
  selected: GwCalendarId,
  pick: (id: GwCalendarId) => void,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-calendar>
    ${calendarRows(selected, pick)}
  </div>`;
}

function calendarRows(
  selected: GwCalendarId,
  pick: (id: GwCalendarId) => void,
): TemplateResult {
  return html`<div class="text-xs text-white/70">
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
    </div>`;
}

/** The countries the AI runs: every country of 1914 nobody sits in. */
export function gwAiCountries(humans: number): number {
  return Math.max(0, GW_TAGS.length - humans);
}

export interface GwSeatPick {
  clientID: string;
  tag: GwTag;
}

/**
 * The seats of a friends' game. A seat someone holds shows their name and is
 * shut; tapping my own gives it up. A resumed lobby offers the saved seats.
 */
export function gwSeatPicker(
  picks: readonly GwSeatPick[],
  me: string,
  names: ReadonlyMap<string, string>,
  pick: (tag: GwTag | null) => void,
  saved: readonly GwTag[] | null = null,
): TemplateResult {
  const seats = saved ?? GW_SEAT_TAGS;
  const mine = picks.find((p) => p.clientID === me)?.tag ?? null;
  return html`<div class="space-y-1.5" data-gw-seats>
    <div class="text-xs text-white/70">
      ${translateText("gw.lobby.seats_hint")}
    </div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      ${seats.map((tag) => {
        const holder = picks.find((p) => p.tag === tag && p.clientID !== me);
        const on = tag === mine;
        return html`<button
          type="button"
          data-gw-seat=${tag}
          aria-pressed=${on}
          ?disabled=${holder !== undefined}
          class="rounded border px-2 py-1.5 text-left text-sm text-white ${on
            ? "border-amber-300/80 bg-amber-300/20"
            : "border-white/25 bg-white/10 hover:bg-white/20"} ${holder ===
          undefined
            ? ""
            : "opacity-50"}"
          @click=${() => pick(on ? null : tag)}
        >
          <span class="flex items-center gap-1.5 font-bold">
            <img
              class="h-3.5 w-5 rounded-sm object-cover"
              src=${assetUrl(`flags/${gwCountry(tag).flag}.svg`)}
              alt=""
            />
            ${translateText(`gw.country.${tag}`)}
          </span>
          <span class="block text-xs text-white/70">
            ${on
              ? (names.get(me) ?? "")
              : holder !== undefined
                ? (names.get(holder.clientID) ?? "?")
                : translateText("gw.lobby.seat_free")}
          </span>
        </button>`;
      })}
    </div>
  </div>`;
}

/** The pace's chapter clocks for a row, shortest and longest, in seconds. */
export function gwPaceRange(
  calendar: GwCalendarId,
  pace: GwPace,
): { min: number; max: number } {
  const secs = gwChapters(calendar).map((ch) =>
    Math.floor((ch.timerSec * GW_PACE_PCT[pace]) / 100),
  );
  return { min: Math.min(...secs), max: Math.max(...secs) };
}

/** The host's pace (owner's ww160 call 2): the row's timer ×0.75, ×1, ×1.5. */
export function gwPacePicker(
  calendar: GwCalendarId,
  selected: GwPace,
  pick: (pace: GwPace) => void,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-pace>
    <div class="text-xs text-white/70">
      ${translateText("gw.lobby.pace_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${GW_PACES.map(
        (pace) =>
          html`<button
            type="button"
            data-gw-pace-row=${pace}
            class=${rowClass(pace === selected)}
            @click=${() => pick(pace)}
          >
            ${translateText(`gw.lobby.pace.${pace}`)}
          </button>`,
      )}
    </div>
    <div class="text-xs text-white/60" data-gw-pace-note>
      ${translateText("gw.lobby.pace_note", gwPaceRange(calendar, selected))}
    </div>
  </div>`;
}

/** What a friend who joined reads of the host's length and pace. */
export function gwTableNote(
  calendar: GwCalendarId,
  pace: GwPace,
): TemplateResult {
  return html`<p class="text-sm text-white/80" data-gw-table-note>
    ${translateText("gw.lobby.table_note", {
      length: translateText(`gw.ui.calendar.${calendar}`),
      n: gwChapters(calendar).length,
      time: translateText(`gw.ui.calendar_time.${calendar}`),
      pace: translateText(`gw.lobby.pace.${pace}`),
    })}
  </p>`;
}

/** What everyone in a resume lobby reads: which save, how far it got. */
export function gwResumeNote(info: GwResumeInfo): TemplateResult {
  return html`<p
    class="rounded border border-amber-300/40 bg-amber-300/10 p-2 text-sm text-white"
    data-gw-resume-note
  >
    ${translateText("gw.lobby.resume_note", {
      date: info.date,
      n: info.chapter + 1,
    })}
  </p>`;
}
