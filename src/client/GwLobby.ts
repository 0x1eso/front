import type { GwCalendarId } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_TIMER_MAX_SEC,
  GW_TIMER_MIN_SEC,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_SEAT_TAGS,
  GW_WRITTEN_TAGS,
  gwCountry,
  GwTag,
} from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { assetUrl } from "@openfront/shared/AssetUrls";
import type { GwResumeInfo } from "@openfront/shared/WireSchemas";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "./Utils";

/**
 * Calendar rows that have scenes to play, in the order the lobby lists them.
 * A row without writing in its war chapters is not offered; the world lane
 * appends "full" here when its chapters have content.
 */
export const GW_PLAYABLE_CALENDARS: readonly GwCalendarId[] = ["y1914"];

/** The lobby's length choice for the Great War: one button per row with content. */
export function gwCalendarPicker(
  selected: GwCalendarId,
  pick: (id: GwCalendarId) => void,
  showCountry = true,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-calendar>
    ${showCountry
      ? html`<div class="text-sm text-white">
          ${translateText("gw.country.DEU")}
        </div>`
      : nothing}
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
            ${holder !== undefined
              ? (names.get(holder.clientID) ?? "?")
              : GW_WRITTEN_TAGS.includes(tag)
                ? translateText("gw.lobby.seat_free")
                : translateText("gw.lobby.seat_unwritten")}
          </span>
        </button>`;
      })}
    </div>
  </div>`;
}

/** The host's chapter timer: the table's times, or one of these for all. */
const TIMER_STEPS = [GW_TIMER_MIN_SEC, 90, 120, 180, GW_TIMER_MAX_SEC];

export function gwTimerPicker(
  selected: number | undefined,
  pick: (sec: number | undefined) => void,
): TemplateResult {
  const button = (sec: number | undefined, label: string) =>
    html`<button
      type="button"
      data-gw-timer-row=${sec ?? "table"}
      class="rounded border px-3 py-1.5 text-sm text-white ${sec === selected
        ? "border-amber-300/80 bg-amber-300/20"
        : "border-white/25 bg-white/10 hover:bg-white/20"}"
      @click=${() => pick(sec)}
    >
      ${label}
    </button>`;
  return html`<div class="space-y-1.5" data-gw-timer-setting>
    <div class="text-xs text-white/70">
      ${translateText("gw.lobby.timer_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${button(undefined, translateText("gw.lobby.timer_table"))}
      ${TIMER_STEPS.map((sec) =>
        button(sec, translateText("gw.lobby.timer_sec", { n: sec })),
      )}
    </div>
  </div>`;
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
