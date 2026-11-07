import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwActView,
  GwCardView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwFrontView } from "@openfront/engine-api/ww1914/GwWorldView";
import { actSpotsAt } from "@openfront/engine-lib/ww1914/ActSpots";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx, GwSpot } from "./GwCtx";
import { lastBattle } from "./GwFronts";
import { deskPins, GwPin, placeOfCard, theatreOfPlace } from "./GwPlaceModel";
import { actRow } from "./GwSchedule";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import { cardTitle, frontLine, personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const GO =
  "w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-1.5 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40";

/** Opens a paper or a talk, and the map turns to where it comes from. */
export function openCard(c: GwCtx, card: GwCardView): void {
  if (card.kind === "talk") c.ui.talkUid = card.uid;
  else {
    c.ui.readerUid = card.uid;
    c.ui.armed = null;
  }
  c.ui.spot = null;
  const place = placeOfCard(card, c.pack, c.seat, c.data.date);
  if (place !== null) c.map?.fly(place);
  c.redraw();
}

/** A paper's place, as a button that shows it on the map. */
export function placeChip(
  c: GwCtx,
  card: GwCardView,
  leave?: () => void,
): TemplateResult | typeof nothing {
  if (!c.map) return nothing;
  const place = placeOfCard(card, c.pack, c.seat, c.data.date);
  if (place === null) return nothing;
  return html`<button
    class="${CHIP} hover:bg-white/25"
    data-gw-place=${place}
    title=${translateText("gw.map.to_map")}
    @click=${() => {
      leave?.();
      c.map?.fly(place);
      c.redraw();
    }}
  >
    ⌖ ${GW_PLACES[place].nameKo}
  </button>`;
}

function tapPin(c: GwCtx, pin: GwPin): void {
  if (pin.cards.length === 1) {
    openCard(c, pin.cards[0]);
    return;
  }
  c.ui.spot = c.map?.spotOfPlace(pin.place) ?? null;
  c.map?.fly(pin.place);
  c.redraw();
}

/** The desk on the map: each pin sits on its place and opens what's there. */
export function deskPinLayer(c: GwCtx): TemplateResult | typeof nothing {
  if (!c.map) return nothing;
  return html`${deskPins(c.seat, c.pack, c.data.date).map((pin) => {
    const [x, y] = GW_PLACES[pin.place].center;
    const titles = pin.cards.map((k) => cardTitle(c.pack, k)).join(" / ");
    return html`<button
      class="pointer-events-auto fixed left-0 top-0 z-[885] flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full border border-white/25 bg-slate-900/85 px-2 text-xs text-white shadow hover:bg-slate-700"
      data-gw-at=${`${x} ${y}`}
      data-gw-pin=${pin.place}
      title=${titles}
      @click=${() => tapPin(c, pin)}
    >
      <span
        class="h-2 w-2 rounded-full ${pin.waits
          ? "bg-amber-300"
          : "bg-white/60"}"
      ></span>
      ${GW_PLACES[pin.place].nameKo}${pin.cards.length > 1
        ? html`<b class="text-amber-200">${pin.cards.length}</b>`
        : nothing}
    </button>`;
  })}`;
}

function flag(tag: GwTag): TemplateResult {
  return html`<img
    class="h-4 w-6 rounded-sm object-cover"
    src=${assetUrl(`flags/${gwCountry(tag).flag}.svg`)}
    alt=""
  />`;
}

/** What that country is to the seat. */
function standing(c: GwCtx, tag: GwTag): string {
  if (tag === c.seat.tag) return translateText("gw.map.rel.own");
  const them = c.seat.world.countries.find((x) => x.tag === tag);
  if (them?.out === true) return translateText("gw.map.rel.out");
  if (them === undefined || them.side === null) {
    return translateText("gw.map.rel.neutral");
  }
  if (c.seat.world.side === null) {
    return translateText(`gw.map.rel.${them.side}`);
  }
  const friend = them.side === c.seat.world.side;
  return translateText(friend ? "gw.map.rel.ally" : "gw.map.rel.enemy");
}

function holderRow(c: GwCtx, s: GwSpot): TemplateResult | typeof nothing {
  const holder = c.map?.holderAt(s.tile) ?? null;
  if (holder === null) return nothing;
  const owner = s.place === null ? holder : GW_PLACES[s.place].owner;
  return html`<div class="flex items-center gap-2 text-sm" data-gw-holder>
      ${flag(holder)}
      <span>${translateText(`gw.country.${holder}`)}</span>
      <span class="${MUTED} ml-auto">${standing(c, holder)}</span>
    </div>
    ${owner === holder
      ? nothing
      : html`<p class=${MUTED} data-gw-held>
          ${translateText("gw.map.held", {
            owner: translateText(`gw.country.${owner}`),
          })}
        </p>`}`;
}

function movedRow(c: GwCtx, place: GwPlace | null) {
  const m = c.data.landMoves.find((x) => x.place === place);
  if (m === undefined) return nothing;
  return html`<p class="text-sm text-amber-100" data-gw-moved>
    ${translateText("gw.map.moved", {
      from: translateText(`gw.country.${m.from}`),
      to: translateText(`gw.country.${m.to}`),
    })}
  </p>`;
}

function frontRow(f: GwFrontView, c: GwCtx): TemplateResult {
  return html`<div class="space-y-0.5" data-gw-spot-front=${f.id}>
    <p class="text-sm text-white/85">
      ${translateText(`gw.ui.theatre.${f.id}`)} · ${frontLine(f.id, f.line)}
    </p>
    ${f.commander === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.ui.front_commander", {
            name: personName(c.pack, f.commander),
          })}
        </p>`}
    ${lastBattle(f)}
  </div>`;
}

function postNote(c: GwCtx, id: string, f: GwFrontView) {
  return {
    chapter: c.data.chapter,
    title: translateText("gw.map.general_title"),
    pick: translateText("gw.map.general_pick", {
      name: personName(c.pack, id),
      front: translateText(`gw.ui.theatre.${f.id}`),
    }),
    rest:
      f.commander === null
        ? ""
        : translateText("gw.map.general_relieved", {
            name: personName(c.pack, f.commander),
          }),
    tell: [],
  };
}

/** "이 전선에 장군을 보낸다": who can go, and the word to send him. */
function generalBox(c: GwCtx, f: GwFrontView): TemplateResult | typeof nothing {
  const ui = c.ui;
  const list = (c.seat.world.generals ?? []).filter((id) => id !== f.commander);
  if (f.id === "sea" || list.length === 0) return nothing;
  const open = ui.postOpen === f.id;
  const left = c.seat.actsLeft ?? 0;
  const armed = ui.postArmed;
  return html`<div class="space-y-1" data-gw-post>
    <button
      class="${open ? BTN_ON : BTN} w-full"
      data-gw-post-open
      ?disabled=${left <= 0}
      @click=${() => {
        ui.postOpen = open ? null : f.id;
        ui.postArmed = null;
        c.redraw();
      }}
    >
      ${translateText("gw.map.general")}
    </button>
    ${open
      ? html`<div class="flex flex-wrap gap-1">
            ${list.map(
              (id) =>
                html`<button
                  class="${armed === id ? BTN_ON : BTN} !px-2 !py-1"
                  data-gw-post-pick=${id}
                  @click=${() => {
                    ui.postArmed = armed === id ? null : id;
                    c.redraw();
                  }}
                >
                  ${personName(c.pack, id)}
                </button>`,
            )}
          </div>
          <button
            class=${GO}
            data-gw-post-go
            ?disabled=${armed === null}
            @click=${() => {
              if (armed === null) return;
              ui.notes.push(postNote(c, armed, f));
              c.send({ kind: "post", person: armed, theatre: f.id });
              ui.postOpen = null;
              ui.postArmed = null;
              c.redraw();
            }}
          >
            ${translateText("gw.map.general_send")}
          </button>`
      : nothing}
  </div>`;
}

/** Schedule entries that happen here, each with what the place fills in. */
function actsHere(
  c: GwCtx,
  s: GwSpot,
  holder: GwTag | null,
  theatre: GwTheatre | null,
): { a: GwActView; preset: Record<string, string[]> }[] {
  const out = new Map<
    string,
    { a: GwActView; preset: Record<string, string[]> }
  >();
  const tag = holder === c.seat.tag ? null : holder;
  for (const spot of actSpotsAt(s.place, tag, theatre)) {
    const a = c.seat.acts?.find((x) => x.id === spot.act);
    if (a === undefined || out.has(a.id)) continue;
    const fits = Object.entries(spot.pick ?? {}).every(([id, v]) =>
      a.fields.find((f) => f.id === id)?.options.includes(v),
    );
    if (!fits) continue;
    const preset = Object.fromEntries(
      Object.entries(spot.pick ?? {}).map(([k, v]) => [k, [v]]),
    );
    out.set(a.id, { a, preset });
  }
  return [...out.values()];
}

function termsButton(c: GwCtx, holder: GwTag | null) {
  const t = c.seat.terms;
  if (holder === null || t === undefined || t.sent) return nothing;
  if (!t.targets.some((x) => x.tag === holder)) return nothing;
  return html`<button
    class="${BTN} w-full"
    data-gw-spot-terms
    @click=${() => {
      c.ui.termTag = holder;
      c.ui.termGive = [];
      c.ui.termAsk = [];
      c.ui.tab = "schedule";
      c.ui.folded = false;
      c.ui.spot = null;
      c.redraw();
    }}
  >
    ${translateText("gw.map.terms")}
  </button>`;
}

function cardsHere(c: GwCtx, s: GwSpot): TemplateResult | typeof nothing {
  if (s.place === null) return nothing;
  const pin = deskPins(c.seat, c.pack, c.data.date).find(
    (p) => p.place === s.place,
  );
  if (pin === undefined) return nothing;
  return html`<div class="space-y-1" data-gw-spot-cards>
    <div class=${MUTED}>${translateText("gw.map.papers")}</div>
    ${pin.cards.map(
      (k) =>
        html`<button
          class="${BTN} w-full"
          data-gw-spot-card=${k.uid}
          @click=${() => openCard(c, k)}
        >
          ${cardTitle(c.pack, k)}
        </button>`,
    )}
  </div>`;
}

/** A place tapped on the map: what it is, what is there, what can be done. */
export function placeSheet(c: GwCtx, s: GwSpot): TemplateResult {
  const holder = c.map?.holderAt(s.tile) ?? null;
  const theatre = theatreOfPlace(s.place);
  const front = c.seat.world.fronts.find((f) => f.id === theatre);
  const rows = actsHere(c, s, holder, front === undefined ? null : front.id);
  const general = front === undefined ? nothing : generalBox(c, front);
  const terms = termsButton(c, holder);
  const none = rows.length === 0 && general === nothing && terms === nothing;
  const left = c.seat.actsLeft ?? 0;
  return html`<aside
    data-gw-sheet=${s.place ?? s.region}
    class="${GLASS} pointer-events-auto fixed inset-x-0 bottom-0 z-[899] max-h-[56vh] space-y-2 overflow-y-auto p-3 text-white sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-24 sm:max-h-[calc(100vh-7rem)] sm:w-[320px] sm:rounded-md"
  >
    <header class="flex items-center gap-2">
      <h3 class="${HEAD} !text-base">${s.name}</h3>
      <button
        class="${MUTED} ml-auto px-2 py-1 hover:text-white"
        data-gw-sheet-close
        @click=${() => {
          c.ui.spot = null;
          c.map?.ring(null);
          c.redraw();
        }}
      >
        ✕
      </button>
    </header>
    ${holderRow(c, s)} ${movedRow(c, s.place)}
    ${front === undefined ? nothing : frontRow(front, c)} ${cardsHere(c, s)}
    ${none
      ? html`<p class=${MUTED} data-gw-spot-none>
          ${translateText("gw.map.none")}
        </p>`
      : html`<section class=${BOX} data-gw-spot-acts>
          <div class="flex items-center gap-2">
            <div class=${MUTED}>${translateText("gw.map.do")}</div>
            <span class="${CHIP} ml-auto"
              >${translateText("gw.act.left", { n: left })}</span
            >
          </div>
          ${general} ${rows.map((r) => actRow(c, r.a, r.preset))} ${terms}
        </section>`}
  </aside>`;
}
