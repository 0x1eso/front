// ww177 (Imjin design §10): the Imjin War's lobby rows. Two seats, Joseon
// and Japan (Ming and the Jurchen are the AI's), and the calendar rows. In
// the existing lobby frame, with the Great War's row style.
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { ImjinCalendarId } from "@openfront/engine-api/ww1936/ScenarioIds";
import {
  IMJIN_AI_ONLY,
  IMJIN_LOBBY_CALENDARS,
  IMJIN_SEATS,
} from "@openfront/engine-lib/ww1936/scenario/Profile";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, TemplateResult } from "lit";
import { translateText } from "./Utils";

/** ww183: the owner closed the Imjin War for now; set true to reopen it. */
export const IMJIN_OPEN = false;

const rowClass = (on: boolean, shut = false) =>
  `rounded border px-3 py-1.5 text-left text-sm text-white ${
    on
      ? "border-amber-300/80 bg-amber-300/20"
      : "border-white/25 bg-white/10 hover:bg-white/20"
  } ${shut ? "opacity-50" : ""}`;

export interface ImjinSeatPick {
  clientID: string;
  tag: CountryTag;
}

const flag = (tag: CountryTag) =>
  html`<img
    class="h-3.5 w-5 rounded-sm object-cover"
    src=${assetUrl(`flags/${COUNTRIES[tag].flag}.svg`)}
    alt=""
  />`;

/**
 * The seats, then the calendar rows. `picks` (a friends' lobby): a seat
 * someone else holds shows their name and is shut; tapping mine gives it up.
 */
export function imjinLobby(opts: {
  seat: CountryTag | null;
  pickSeat: (tag: CountryTag | null) => void;
  calendar: ImjinCalendarId;
  pickCalendar: (id: ImjinCalendarId) => void;
  picks?: readonly ImjinSeatPick[];
  me?: string;
  names?: ReadonlyMap<string, string>;
}): TemplateResult {
  const picks = opts.picks ?? [];
  return html`<div class="space-y-1.5" data-imjin-lobby>
    <div class="text-xs text-white/70">
      ${translateText("imjin.lobby.seat_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${IMJIN_SEATS.map((tag) => {
        const holder = picks.find(
          (p) => p.tag === tag && p.clientID !== opts.me,
        );
        const on = tag === opts.seat;
        return html`<button
          type="button"
          data-imjin-seat=${tag}
          aria-pressed=${on}
          ?disabled=${holder !== undefined}
          class=${rowClass(on, holder !== undefined)}
          @click=${() => opts.pickSeat(on && picks.length > 0 ? null : tag)}
        >
          <span class="flex items-center gap-1.5 font-bold"
            >${flag(tag)}${translateText(`ww1936.country.${tag}`)}</span
          >
          <span class="block text-xs text-white/70"
            >${holder === undefined
              ? translateText(`imjin.lobby.seat_note.${tag}`)
              : (opts.names?.get(holder.clientID) ?? "")}</span
          >
        </button>`;
      })}
    </div>
    <div class="text-xs text-white/60" data-imjin-ai>
      ${translateText("imjin.lobby.ai_note", {
        countries: IMJIN_AI_ONLY.map((t) =>
          translateText(`ww1936.country.${t}`),
        ).join(", "),
      })}
    </div>
    <div class="text-xs text-white/70">
      ${translateText("imjin.lobby.calendar_label")}
    </div>
    <div class="flex flex-wrap gap-2">
      ${IMJIN_LOBBY_CALENDARS.map(
        (id) =>
          html`<button
            type="button"
            data-imjin-calendar=${id}
            class=${rowClass(id === opts.calendar)}
            @click=${() => opts.pickCalendar(id)}
          >
            <span class="block font-bold"
              >${translateText(`imjin.lobby.calendar.${id}`)}</span
            >
            <span class="block text-xs text-white/70"
              >${translateText(`imjin.lobby.calendar_note.${id}`)}</span
            >
          </button>`,
      )}
    </div>
  </div>`;
}
