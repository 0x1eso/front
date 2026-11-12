// Great War 1914 (ww199): the plain logic behind a beaten country's fate on
// the screens (no DOM): which fates a place can take, how a chip cycles, the
// words and inks for each, and the name a country goes by once a table has
// made it a new state or a vassal.
import type { GwSide } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwCountry, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_FATES,
  GwClient,
  GwFate,
  GwFateMark,
  gwRealmName,
  GwRealmView,
  GwRuledView,
} from "@openfront/engine-api/ww1914/GwFate";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwSeatView } from "@openfront/engine-api/ww1914/GwView";
import {
  GW_CLIENT_ROWS,
  GW_REGENCY,
} from "@openfront/engine-lib/ww1914/FateRows";
import { translateText } from "../../Utils";

type Rgb = readonly [number, number, number];

// ---- Names ----

let realms: readonly GwRealmView[] = [];
let realmsKey = "";

/**
 * The countries named by their fate, as the last view sent them. True when
 * that changed (the map's labels are written again).
 */
export function setGwRealms(next: readonly GwRealmView[] | undefined): boolean {
  const key = JSON.stringify(next ?? []);
  if (key === realmsKey) return false;
  realmsKey = key;
  realms = next ?? [];
  return true;
}

const plainName = (tag: string) => translateText(`gw.country.${tag}`);

/**
 * A country's name on every screen: a new state by its form ("폴란드 왕국"),
 * a vassal as its overlord's ("독일령 프랑스"), anything else as itself.
 */
export function gwName(tag: string): string {
  const r = realms.find((x) => x.tag === tag);
  const n = r === undefined ? null : gwRealmName(r);
  if (n === null) return plainName(tag);
  const params = {
    by: n.by === undefined ? "" : plainName(n.by),
    of: n.of === undefined ? "" : plainName(n.of),
  };
  const own = translateText(n.key, params);
  if (own !== n.key) return own;
  if (n.fallback === undefined) return plainName(tag);
  const back = translateText(n.fallback, params);
  return back === n.fallback ? plainName(tag) : back;
}

/** A state's name before or after it stands: its first form's, else its tag's. */
export function clientName(id: GwClient): string {
  const row = GW_CLIENT_ROWS.find((r) => r.id === id)!;
  const found = realms.find((x) => x.client?.id === id);
  if (found !== undefined) return gwName(found.tag);
  const key = `gw.client.${id}.${row.forms[0]}`;
  const own = translateText(key);
  return own === key ? plainName(row.tag) : own;
}

/** Who sits on a state's throne, in words. */
export function crownName(pick: string | null | undefined): string {
  if (pick === null || pick === undefined) {
    return translateText("gw.fate.crown_empty");
  }
  for (const key of [`gw.crown.${pick}`, `gw.fate.crown.${pick}`]) {
    const own = translateText(key);
    if (own !== key) return own;
  }
  return translateText(
    pick === GW_REGENCY ? "gw.fate.regency" : "gw.fate.crown_set",
  );
}

// ---- What a place can become ----

/** The places of a land the seat could paint (not its own of 1914). */
export function landPlaces(tag: GwTag, group: string): GwPlace[] {
  return (Object.keys(GW_PLACES) as GwPlace[]).filter(
    (p) => GW_PLACES[p].group === group && GW_PLACES[p].owner !== tag,
  );
}

/** The states that could be made of any of these places, for this side. */
export function statesFor(
  places: readonly GwPlace[],
  side: GwSide | null,
): GwClient[] {
  return GW_CLIENT_ROWS.filter(
    (r) =>
      (side === null || r.sides.includes(side)) &&
      r.places.some((p) => places.includes(p)),
  ).map((r) => r.id);
}

/** The seat's partners in the war, who could be given the land. */
export function alliesFor(seat: GwSeatView, places: readonly GwPlace[]) {
  const side = seat.world.side;
  if (side === null) return [];
  const owners = new Set<GwTag>(places.map((p) => GW_PLACES[p].owner));
  return seat.world.countries
    .filter(
      (c) =>
        c.side === side && !c.out && c.tag !== seat.tag && !owners.has(c.tag),
    )
    .map((c) => c.tag);
}

export interface GwFateChoices {
  fates: readonly GwFate[];
  states: readonly GwClient[];
  allies: readonly GwTag[];
}

/** What the seat could make of these places. */
export function choicesFor(
  seat: GwSeatView,
  places: readonly GwPlace[],
): GwFateChoices {
  const states = statesFor(places, seat.world.side);
  const allies = alliesFor(seat, places);
  return {
    fates: GW_FATES.filter(
      (f) =>
        (f !== "state" || states.length > 0) &&
        (f !== "ally" || allies.length > 0),
    ),
    states,
    allies,
  };
}

/** A fate with the first of what it needs: a state, an ally, a term. */
export function markOf(fate: GwFate, ch: GwFateChoices): GwFateMark {
  switch (fate) {
    case "state":
      return { fate, client: ch.states[0] };
    case "ally":
      return { fate, for: ch.allies[0] };
    case "occupy":
      return { fate, term: "short" };
    default:
      return { fate };
  }
}

/**
 * The chip's next fate: annex, occupy, state, ally, return, vassal, then
 * nothing painted (null), and round again.
 */
export function nextFate(
  now: GwFateMark | null,
  ch: GwFateChoices,
): GwFateMark | null {
  const at = now === null ? -1 : ch.fates.indexOf(now.fate);
  if (at === ch.fates.length - 1) return null;
  return markOf(ch.fates[at + 1], ch);
}

/** The second chip: the next state, ally or term; null when the fate needs none. */
export function nextDetail(
  now: GwFateMark,
  ch: GwFateChoices,
): GwFateMark | null {
  const turn = <T>(list: readonly T[], v: T | undefined): T =>
    list[(list.indexOf(v as T) + 1) % list.length];
  switch (now.fate) {
    case "state":
      return ch.states.length < 2
        ? null
        : { fate: "state", client: turn(ch.states, now.client) };
    case "ally":
      return ch.allies.length < 2
        ? null
        : { fate: "ally", for: turn(ch.allies, now.for) };
    case "occupy":
      return {
        fate: "occupy",
        term: now.term === "long" ? "short" : "long",
      };
    default:
      return null;
  }
}

/** The one mark a land's places share; "mixed" when they differ, null for none. */
export function landMark(
  fates: Readonly<Partial<Record<GwPlace, GwFateMark>>> | undefined,
  places: readonly GwPlace[],
): GwFateMark | "mixed" | null {
  const marks = places.map((p) => fates?.[p] ?? null);
  const first = JSON.stringify(marks[0] ?? null);
  if (marks.every((m) => JSON.stringify(m) === first)) return marks[0] ?? null;
  return "mixed";
}

export const sameMark = (a: GwFateMark | null, b: GwFateMark | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The order that paints a mark (null clears) on a place or a whole land. */
export function fateOrder(
  at: { place: GwPlace } | { group: string },
  mark: GwFateMark | null,
) {
  return {
    kind: "fate_paint" as const,
    place: "place" in at ? at.place : null,
    group: "group" in at ? at.group : null,
    fate: mark?.fate ?? null,
    for: mark?.for ?? null,
    client: mark?.client ?? null,
    term: mark?.term ?? null,
  };
}

// ---- Words ----

/** The chip's short word: 합병, 군정, 나라, 동맹, 돌려줌, 속국. */
export const fateChip = (f: GwFate) => translateText(`gw.fate.chip.${f}`);

/** The button's verb: 합병한다, 군정으로 둔다 … */
export const fateDo = (f: GwFate) => translateText(`gw.fate.do.${f}`);

/** What the mark needs, in words: the state's name, the ally's, the term. */
export function detailWord(m: GwFateMark): string | null {
  if (m.fate === "state" && m.client !== undefined) return clientName(m.client);
  if (m.fate === "ally" && m.for !== undefined) return gwName(m.for);
  if (m.fate === "occupy") {
    return translateText(`gw.fate.term.${m.term ?? "short"}`);
  }
  return null;
}

/** A mark in a few words: "군정, 오래", "나라: 폴란드 왕국". */
export function markWord(m: GwFateMark): string {
  const d = detailWord(m);
  return d === null
    ? fateChip(m.fate)
    : translateText("gw.fate.with", { fate: fateChip(m.fate), what: d });
}

/** A ruled land's or a state's standing, in words (the 통치 tab). */
export function ruledWords(r: GwRuledView): string[] {
  const out: string[] = [];
  if (r.kind === "rule" && r.policy !== undefined) {
    out.push(translateText(`gw.fate.policy.${r.policy}`));
  }
  if (r.term !== undefined) {
    out.push(translateText(`gw.fate.term.${r.term}`));
  }
  if (r.loyalty !== undefined) {
    out.push(translateText(`gw.fate.loyalty_${r.loyalty}`));
  }
  if (r.resist !== undefined) {
    const at = Math.max(0, Math.min(3, r.resist));
    out.push(translateText(`gw.fate.resist_${at}`));
  }
  return out;
}

// ---- Inks ----

/** The map's ink for a painted fate. */
export const GW_FATE_INK: Readonly<Record<string, Rgb>> = {
  annex: [90, 205, 130],
  occupy: [235, 160, 45],
  return: [255, 255, 255],
};

/**
 * What a painted place looks like on the map: annex green, occupy amber, a
 * state its own colour, an ally the ally's, a vassal its old country's, a
 * return plain.
 */
export function fateRgb(m: GwFateMark, place: GwPlace): Rgb {
  switch (m.fate) {
    case "state": {
      const row = GW_CLIENT_ROWS.find((r) => r.id === m.client);
      return row === undefined ? GW_FATE_INK.annex : gwCountry(row.tag).color;
    }
    case "ally":
      return m.for === undefined ? GW_FATE_INK.annex : gwCountry(m.for).color;
    case "vassal":
      return gwCountry(GW_PLACES[place].owner).color;
    default:
      return GW_FATE_INK[m.fate];
  }
}
