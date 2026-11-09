// Great War 1914: the plain logic behind the painted map and the peace table
// (no DOM): what is painted on which region, what is said in whose voice.
import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwTableClaimView,
  GwTableLine,
  GwTableView,
} from "@openfront/engine-api/ww1914/GwTable";
import type { GwSeatView } from "@openfront/engine-api/ww1914/GwView";
import { applyJosa } from "../../Josa";
import {
  OCC_BLINK,
  OCC_HATCH,
  type OccupationCell,
} from "../../render/gl/passes/OccupationPass";
import { translateText } from "../../Utils";
import { officeTitle } from "./GwOffice";

type Rgb = readonly [number, number, number];

/** Paint on the map: gold what is wanted, the rest by how it went. */
export const GW_MAP_INK: Readonly<Record<string, Rgb>> = {
  free: [255, 255, 255],
  wanted: [245, 190, 60],
  open: [255, 214, 90],
  agreed: [90, 205, 130],
  imposed: [205, 70, 55],
  traded: [95, 155, 240],
  refused: [225, 110, 80],
};

const LEVEL = { free: 14, wanted: 40, faint: 20, open: 46, settled: 30 };

const PLACES = Object.keys(GW_PLACES) as GwPlace[];
const BY_REGION: ReadonlyMap<number, GwPlace> = new Map(
  PLACES.map((p) => [GW_PLACES[p].id, p]),
);

/** The place on a region; null for land with no name on this map. */
export function placeOfRegion(region: number): GwPlace | null {
  return BY_REGION.get(region) ?? null;
}

/** What can be painted: land that wasn't the seat's in 1914. */
export function paintable(tag: GwTag): GwPlace[] {
  return PLACES.filter((p) => GW_PLACES[p].owner !== tag);
}

/** The draft with a place added or taken off. */
export function togglePlace(draft: readonly GwPlace[], p: GwPlace): GwPlace[] {
  return draft.includes(p) ? draft.filter((x) => x !== p) : [...draft, p];
}

/** The draft with a whole land added, or taken off when it is all there. */
export function toggleLand(
  draft: readonly GwPlace[],
  group: string,
  tag: GwTag,
): GwPlace[] {
  const land = paintable(tag).filter((p) => GW_PLACES[p].group === group);
  const all = land.every((p) => draft.includes(p));
  if (all) return draft.filter((p) => !land.includes(p));
  return [...draft, ...land.filter((p) => !draft.includes(p))];
}

/** The lands with something paintable, in the order of the map's west to east. */
export function landsOf(tag: GwTag): string[] {
  const west = new Map<string, number>();
  for (const p of paintable(tag)) {
    const g = GW_PLACES[p].group;
    const x = GW_PLACES[p].center[0];
    west.set(g, Math.min(west.get(g) ?? x, x));
  }
  return [...west.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
}

const cell = (
  p: GwPlace,
  ink: keyof typeof GW_MAP_INK,
  level: number,
  flags = 0,
): OccupationCell => ({
  region: GW_PLACES[p].id,
  rgb: GW_MAP_INK[ink],
  level,
  flags,
});

/** The map while painting: every place faint, the draft in gold. */
export function paintCells(
  tag: GwTag,
  draft: readonly GwPlace[],
): OccupationCell[] {
  return paintable(tag).map((p) =>
    draft.includes(p)
      ? cell(p, "wanted", LEVEL.wanted)
      : cell(p, "free", LEVEL.free),
  );
}

function claimCell(c: GwTableClaimView): OccupationCell | null {
  switch (c.state) {
    case "open":
      return cell(c.place, "open", LEVEL.open, OCC_BLINK);
    case "agreed":
      return cell(c.place, "agreed", LEVEL.settled);
    case "imposed":
      return cell(c.place, "imposed", LEVEL.settled, OCC_HATCH);
    case "traded":
      return cell(c.place, "traded", LEVEL.settled, OCC_HATCH);
    case "refused":
      return cell(c.place, "refused", LEVEL.faint);
    case "dropped":
      return null;
  }
}

/** The map at the table: what was wanted, what is on it, how it went. */
export function tableCells(
  t: GwTableView,
  wanted: readonly GwPlace[],
  picked: GwPlace | null,
): OccupationCell[] {
  const out = new Map<number, OccupationCell>();
  if (t.due?.kind === "turn") {
    for (const p of t.due.places) {
      out.set(GW_PLACES[p].id, cell(p, "free", LEVEL.free));
    }
  }
  for (const p of wanted) {
    out.set(GW_PLACES[p].id, cell(p, "wanted", LEVEL.faint));
  }
  for (const c of t.claims) {
    const x = claimCell(c);
    if (x !== null) out.set(x.region, x);
  }
  if (picked !== null) {
    out.set(GW_PLACES[picked].id, cell(picked, "open", LEVEL.open, OCC_BLINK));
  }
  return [...out.values()];
}

/** The claims with a name worth writing on the map, newest first. */
export function tagged(t: GwTableView): GwTableClaimView[] {
  return t.claims
    .filter((c) => c.state !== "dropped")
    .slice()
    .reverse();
}

/** A country's name, or a place's. */
export const countryName = (tag: GwTag) => translateText(`gw.country.${tag}`);
export const placeName = (p: GwPlace) => GW_PLACES[p].nameKo;

function fill(line: string, c: GwTableClaimView | undefined, who: GwTag) {
  const hole: Record<string, string> = {
    country: countryName(who),
    place: c === undefined ? "" : placeName(c.place),
    by: c === undefined ? "" : countryName(c.by),
    against: c === undefined ? "" : countryName(c.against),
    trade:
      c?.offer === null || c?.offer === undefined
        ? ""
        : translateText(`gw.table.trade.${c.offer}`),
  };
  return applyJosa(line.replace(/\{(\w+)\}/g, (m, k) => hole[k] ?? m));
}

/** The envoy's row: its own, or the small countries' common one. */
function envoyOf(pack: GwPack | null, who: GwTag) {
  const rows = pack?.table?.envoys;
  return rows?.[who] ?? rows?.minor;
}

/** How that country itself came to the table. */
function ownRole(t: GwTableView, who: GwTag): "won" | "lost" | "even" {
  if (t.losers.length === 0) return "even";
  return t.losers.includes(who) ? "lost" : "won";
}

/** Who speaks for a country: the seat's own foreign minister for the seat. */
export function envoyName(
  pack: GwPack | null,
  who: GwTag,
  t: GwTableView,
  seat: GwSeatView,
): string {
  const own = seat.people.find((p) => p.office === "foreign");
  if (who === seat.tag && own !== undefined) {
    return pack?.people[own.id]?.name ?? own.id;
  }
  const row = pack?.table?.envoys?.[who];
  if (row === undefined) return countryName(who);
  return row.nameBy?.[ownRole(t, who)] ?? row.name;
}

/** Whose face speaks for each country at the table (the pack's envoys). */
const ENVOY_PERSON: Readonly<Partial<Record<GwTag, string>>> = {
  FRA: "fra_clemenceau",
  GBR: "gbr_lloyd_george",
  USA: "usa_wilson",
  ITA: "ita_sonnino",
  RUS: "rus_sazonov",
  JPN: "jpn_saionji",
  DEU: "deu_kuhlmann",
  AUH: "auh_czernin",
  OTT: "ott_talat",
};

/**
 * The person behind an envoy's line, for the face: the seat's own foreign
 * minister, Brockdorff-Rantzau for a beaten Germany, null for the small
 * countries' shared chair.
 */
export function envoyPerson(
  who: GwTag,
  t: GwTableView,
  seat: GwSeatView,
): string | null {
  const own = seat.people.find((p) => p.office === "foreign");
  if (who === seat.tag && own !== undefined) return own.id;
  if (who === "DEU" && ownRole(t, who) === "lost") return "deu_brockdorff";
  return ENVOY_PERSON[who] ?? null;
}

export function envoyTitle(
  pack: GwPack | null,
  who: GwTag,
  seat: GwSeatView,
): string {
  if (who === seat.tag) return officeTitle(seat.tag, "foreign");
  const rows = pack?.table?.envoys;
  return rows?.[who]?.title ?? rows?.minor?.title ?? countryName(who);
}

/** What was said, in that man's words. */
export function lineText(
  pack: GwPack | null,
  t: GwTableView,
  line: GwTableLine,
): string {
  const c = t.claims.find((x) => x.id === line.claim);
  const group = c === undefined ? null : GW_PLACES[c.place].group;
  const known =
    group === null ? undefined : pack?.table?.on?.[group]?.[line.who];
  const spec = known?.[line.word];
  if (spec !== undefined) return fill(spec, c, line.who);
  const rows = envoyOf(pack, line.who)?.lines;
  const last = t.session === t.sessions - 1;
  const list =
    (line.word === "open" ? rows?.[`open_${t.role}`] : undefined) ??
    (line.word === "close" && last ? rows?.close_last : undefined) ??
    rows?.[line.word] ??
    [];
  if (list.length === 0) return fill(plainLine(line.word), c, line.who);
  // A month's opening is that month's; everything else goes round the list.
  const at = line.word === "open" ? t.session : line.n;
  return fill(list[at % list.length], c, line.who);
}

/** A line nobody wrote out: the secretary's minute. */
function plainLine(word: string): string {
  return translateText(`gw.table.minute.${word}`);
}

/** Who stands beside the seat, by moment; office rows in `pack.table.aides`. */
export const GW_AIDE_OFFICES: readonly GwOffice[] = [
  "foreign",
  "chief_of_staff",
  "finance",
];

/** What the moment is for the people beside the seat; null when they keep quiet. */
export function aideMoment(t: GwTableView): string | null {
  const due = t.due;
  if (due === null) {
    const last = t.lines[t.lines.length - 1];
    if (last === undefined) return null;
    return last.word === "open" || last.word === "over" ? last.word : null;
  }
  if (due.kind === "turn") return "turn";
  const c = t.claims.find((x) => x.id === due.claim)!;
  if (due.words.includes("no")) {
    if (c.step === "offered") return "their_offer";
    return c.step === "pressed" ? "pressed" : "asked";
  }
  return c.step === "offered" ? "countered" : "refused";
}

export interface GwAideLine {
  office: GwOffice;
  who: string;
  text: string;
}

/** One or two of the seat's people, leaning over. */
export function aideLines(
  pack: GwPack | null,
  seat: GwSeatView,
  t: GwTableView,
): GwAideLine[] {
  const moment = aideMoment(t);
  if (moment === null) return [];
  const rows = pack?.table?.aides?.[moment] ?? {};
  const claim =
    t.due?.kind === "word"
      ? t.claims.find((x) => x.id === (t.due as { claim: number }).claim)
      : undefined;
  const out: GwAideLine[] = [];
  for (const office of GW_AIDE_OFFICES) {
    const list = rows[office];
    const person = seat.people.find((p) => p.office === office);
    if (list === undefined || list.length === 0 || person === undefined) {
      continue;
    }
    const n = t.lines.length + out.length;
    out.push({
      office,
      who: person.id,
      text: fill(list[n % list.length], claim, seat.tag),
    });
  }
  // Two voices at most: the one whose moment it is first.
  return out.slice(0, 2);
}

/** Painted places not yet on the table: where the seat might start. */
export function stillWanted(
  seat: GwSeatView,
  t: GwTableView,
): readonly GwPlace[] {
  const on = new Set(
    t.claims
      .filter((c) => c.session === t.session || c.state !== "dropped")
      .filter((c) => c.state !== "refused" || c.session === t.session)
      .map((c) => c.place),
  );
  const open = t.due?.kind === "turn" ? t.due.places : [];
  return (seat.claims?.places ?? []).filter(
    (p) => !on.has(p) && open.includes(p),
  );
}
