// World War 1936 P5 (plan Task 11, lane U3; spec §3.5, §3.7, §20.6,
// §20.8): the endgame's names — a civil-war slot's or a renamed country's
// name on the map and on the screens, the leaderboard's rows (no dormant
// slot, a gone country struck through, an exile badged, a human's name on
// the country they play after a takeover) and the P5 notices' params,
// the daily batches' "a:b:n" items among them.
import {
  COUNTRIES,
  type CountryTag,
  isCountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEY_COUNT,
  EQUIP_KEYS,
  EQUIPMENT_TYPES,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwCountryView } from "@openfront/engine-api/ww1936/EndgameTypes";
import { GROUND_EQUIP_KEYS } from "@openfront/engine-api/ww1936/LandTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import { assetUrl } from "@openfront/shared/AssetUrls";
import IntlMessageFormat from "intl-messageformat";
import en from "../../../../resources/lang/en.json";
import { translateText } from "../../Utils";
import type { GameView, PlayerView } from "../../view";
import { EQUIPMENT_KEYS } from "./EconomyModel";
import { regionName } from "./LandModel";
import { countryName, wwActive, type WwGame } from "./WorldWarModel";

/** What the endgame's names read from the game (a fake in tests). */
export type NameGame = WwGame & Partial<Pick<GameView, "myClientID">>;

/**
 * The English text of a translation key. The map labels are English
 * country names (mode spec §5.4: the map font draws Latin letters only),
 * so a civil-war slot's label is formatted from en.json whatever the UI
 * language; the screens use translateText.
 */
export function englishText(
  key: string,
  params: Record<string, string> = {},
): string {
  let node: unknown = en;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== "string") return key;
  try {
    return new IntlMessageFormat(node, "en").format(params) as string;
  } catch {
    return node;
  }
}

/**
 * Spec §3.5: the map label of a country the endgame names — a civil-war
 * slot ("Free Spain") or a renamed one ("Serbia") — in English, like every
 * map label; null when the endgame gives it no name (its PlayerInfo name,
 * the English country name, stays).
 */
export function wwMapName(c: WwCountryView | undefined): string | null {
  if (c === undefined || !c.nameKey) return null;
  const arg = c.nameArg;
  return englishText(
    c.nameKey,
    arg && isCountryTag(arg) ? { country: COUNTRIES[arg].name } : {},
  );
}

function tagOf(game: WwGame, id: number): CountryTag | null {
  return game.worldWarScenario()?.tagOfSmallId(id) ?? null;
}

/**
 * A country's name on the screens (spec §3.5): the endgame's — a
 * civil-war slot, a rename — before P0's translated country name.
 */
export function countryText(game: WwGame, id: number): string {
  const tag = tagOf(game, id);
  const eg = game.wwEndgame?.() ?? null;
  if (eg !== null && tag !== null) {
    return eg.displayName(id, () => tag);
  }
  return tag === null ? "" : countryName(tag);
}

/** Spec §3.5: a country's flag file — a civil-war slot flies its ideology's. */
export function countryFlagUrl(game: WwGame, id: number): string {
  const flag = game.wwEndgame?.()?.countries.get(id)?.flag;
  if (flag) return assetUrl(`flags/${flag}.svg`);
  const tag = tagOf(game, id);
  return tag === null ? "" : assetUrl(`flags/${COUNTRIES[tag].flag}.svg`);
}

/**
 * Spec §3.6: the client that plays `id` now — a takeover moves a human to
 * another country; null for a country nobody plays.
 */
export function controllerClient(game: WwGame, id: number): string | null {
  const eg = game.wwEndgame?.() ?? null;
  if (eg !== null) {
    for (const [client, c] of eg.controllers) if (c === id) return client;
  }
  let p: ReturnType<WwGame["playerBySmallID"]>;
  try {
    p = game.playerBySmallID(id);
  } catch {
    return null;
  }
  if (!p.isPlayer()) return null;
  const own = (p as PlayerView).clientID();
  if (own === null) return null;
  // Its first human took over another country (or spectates).
  const moved = eg !== null && eg.controlledBy(own) !== null;
  return moved ? null : own;
}

/**
 * "Free Spain · minsu": a country with the name of the human who plays it
 * now (spec §3.6: the leaderboard follows the controller); the country
 * alone for an AI.
 */
export function endgameLabel(game: WwGame, p: PlayerView): string {
  const name = countryText(game, p.smallID()) || p.displayName();
  const client = controllerClient(game, p.smallID());
  const user = client === null ? null : game.usernameOf(client);
  return user === null ? name : `${name} · ${user}`;
}

/** Spec §3.7, §20.6: how a country's row is marked. */
export type EndgameMark = "exile" | "gone" | null;

export function endgameMark(game: WwGame, id: number): EndgameMark {
  const eg = game.wwEndgame?.() ?? null;
  if (eg?.isExile(id) === true) return "exile";
  // Gone (annexed, capitulated, a lost civil war) while its last tiles
  // change hands: struck through, as P0's diplomacy drawer does.
  if (eg?.countryState(id) === "gone" || !wwActive(game, id)) return "gone";
  return null;
}

/**
 * Spec §3.7: the leaderboard lists the countries with land and the
 * governments in exile (no land, still playing), never a dormant slot.
 */
export function onLeaderboard(game: WwGame, p: PlayerView): boolean {
  const eg = game.wwEndgame?.() ?? null;
  const id = p.smallID();
  if (eg === null) {
    return p.isAlive() && game.worldWarScenario()?.isDormantSlot(id) !== true;
  }
  if (eg.countries.has(id) ? eg.isDormant(id) : isDormantStart(game, id)) {
    return false;
  }
  return p.isAlive() || eg.isExile(id);
}

function isDormantStart(game: WwGame, id: number): boolean {
  return game.worldWarScenario()?.isDormantSlot(id) === true;
}

// ---- Notices (spec §20.8, plan decision 24) ----

/**
 * The P5 notices the engine sends (plan decision 24; spec §22 params), by
 * their full keys so the translation check sees each one read. Batch 21:
 * `ww1936_subject_restricted` (lane S) added; `ww1936_ll_blocked` and
 * `ww1936_ll_contract_stopped` gone (lane A sends one
 * `ww1936_ll_stopped_<reason>` key per reason, which needs no params).
 */
export const ENDGAME_NOTICES: ReadonlySet<string> = new Set([
  "events_display.ww1936_exiled",
  "events_display.ww1936_exile_returned",
  "events_display.ww1936_exile_ended",
  "events_display.ww1936_conference_opened",
  "events_display.ww1936_conference_round",
  "events_display.ww1936_conference_result",
  "events_display.ww1936_country_created",
  "events_display.ww1936_subject_level",
  "events_display.ww1936_subject_restricted",
  "events_display.ww1936_autonomy_request",
  "events_display.ww1936_occ_law",
  "events_display.ww1936_garrison_short",
  "events_display.ww1936_uprising",
  "events_display.ww1936_ll_arrived",
  "events_display.ww1936_volunteers_arrived",
  "events_display.ww1936_volunteers_recalled",
  "events_display.ww1936_captured",
  "events_display.ww1936_takeover",
  "events_display.ww1936_spectating",
]);

/**
 * Notices the engine addresses to a human's country as it leaves their
 * hands (spec §11.2: "no country to take over — spectating"): shown to
 * the client whose first country it was, though it plays it no more.
 */
const HANDOFF_NOTICES: ReadonlySet<string> = new Set([
  "events_display.ww1936_spectating",
]);

/**
 * True when a notice addressed to `playerID` is for this client although
 * it no longer plays that country (a handoff notice to its first one).
 */
export function isHandoffNotice(
  game: NameGame,
  message: string,
  playerID: number,
): boolean {
  if (!HANDOFF_NOTICES.has(message)) return false;
  const client = game.myClientID?.();
  if (!client) return false;
  return game.playerByClientID(client)?.smallID() === playerID;
}

/** Plan decision 24: "a:b:n,…" → [a, b, n] rows (a bad row is skipped). */
export function parseNoteItems(items: string): [number, number, number][] {
  const rows: [number, number, number][] = [];
  for (const part of items.split(",")) {
    const xs = part.split(":").map((s) => Number(s));
    if (xs.length !== 3 || xs.some((x) => !Number.isInteger(x))) continue;
    rows.push([xs[0], xs[1], xs[2]]);
  }
  return rows;
}

/** An item of the notices: an equipment type (generations summed) or fuel. */
type NoteItem = EquipmentType | "fuel";

/** "Infantry equipment 640 · Artillery 22", in EQUIPMENT_TYPES order, fuel last. */
export function itemsText(counts: ReadonlyMap<NoteItem, number>): string {
  const parts: string[] = [];
  for (const t of [...EQUIPMENT_TYPES, "fuel" as const]) {
    const n = counts.get(t) ?? 0;
    if (n <= 0) continue;
    const name =
      t === "fuel"
        ? translateText("ww1936.aid.item_fuel")
        : translateText(EQUIPMENT_KEYS[t]);
    parts.push(`${name} ${renderNumber(n)}`);
  }
  return parts.join(" · ");
}

function addCount(m: Map<NoteItem, number>, t: NoteItem, n: number): void {
  m.set(t, (m.get(t) ?? 0) + n);
}

/** An EQUIP_KEYS index (any other: fuel, which has no stock slot). */
function stockItem(key: number): NoteItem {
  return key >= 0 && key < EQUIP_KEY_COUNT ? EQUIP_KEYS[key][0] : "fuel";
}

/** Names joined in the order given, each once. */
function joinNames(names: string[]): string {
  return [...new Set(names.filter((n) => n !== ""))].join(", ");
}

/** A country param: its tag (or smallID) → the country's name on the screens. */
function countryParam(game: WwGame, v: string | number): string {
  if (typeof v === "number") return countryText(game, v);
  if (!isCountryTag(v)) return v;
  const id = game.worldWarScenario()?.smallIdOf(v) ?? 0;
  return id > 0 ? countryText(game, id) : countryName(v);
}

/** Params that name a country (spec §22). */
const COUNTRY_PARAMS = ["tag", "hostTag", "fromTag", "toTag"] as const;

/**
 * Occupation notices (uprising, law, garrison): `region` is a numeric region
 * id and `law` the raw law id; return their display texts, so no one reads
 * "Uprising in 563". Only the keys present are returned.
 */
export function occupationParams(
  game: WwGame,
  params: Record<string, string | number>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const scenario = game.worldWarScenario();
  const r = params.region;
  if (scenario !== null && r !== undefined && /^\d+$/.test(String(r))) {
    out.region = regionName(scenario, Number(r));
  }
  if (typeof params.law === "string") {
    out.law = translateText(`ww1936.occ_law.${params.law}`);
  }
  return out;
}

/**
 * Spec §20.8: a P5 notice's params in the viewer's words — countries by
 * their names on the screens (a civil-war slot's too), the losers, the
 * subject level, the occupation law, the reason, and the three daily
 * batches' items (plan decision 24):
 * - captured: "slot:region:n" (slot: a division's GROUND_EQUIP_KEYS index)
 *   → "Infantry equipment 640 · Artillery 22" at "Smolensk";
 * - lend-lease arrived: "from:key:n" (key: an EQUIP_KEYS index, any other
 *   fuel) → the items, from the senders;
 * - garrison short: "0:0:n" → n regions.
 */
export function endgameNoticeParams(
  message: string,
  params: Record<string, string | number>,
  game: WwGame,
): Record<string, string | number> {
  const out: Record<string, string | number> = { ...params };
  for (const k of COUNTRY_PARAMS) {
    const v = params[k];
    if (v !== undefined) out[k] = countryParam(game, v);
  }
  const losers = params.losers;
  if (losers !== undefined) {
    out.losers = joinNames(
      String(losers)
        .split(",")
        .map((x) => x.trim())
        .map((x) => countryParam(game, /^\d+$/.test(x) ? Number(x) : x)),
    );
  }
  if (typeof params.level === "string") {
    out.level = translateText(`ww1936.subject_level.${params.level}`);
  }
  Object.assign(out, occupationParams(game, params));
  if (typeof params.reason === "string") {
    out.reason = translateText(`ww1936.aid.why.${params.reason}`);
  }
  if (typeof params.items !== "string") return out;
  const rows = parseNoteItems(params.items);
  const scenario = game.worldWarScenario();
  if (message === "events_display.ww1936_captured") {
    const counts = new Map<NoteItem, number>();
    const regions: string[] = [];
    for (const [slot, region, n] of rows) {
      const key = GROUND_EQUIP_KEYS[slot];
      if (key !== undefined) addCount(counts, EQUIP_KEYS[key][0], n);
      if (scenario !== null) regions.push(regionName(scenario, region));
    }
    out.items = itemsText(counts);
    out.region = joinNames(regions);
  } else if (message === "events_display.ww1936_ll_arrived") {
    const counts = new Map<NoteItem, number>();
    const from: string[] = [];
    for (const [sender, key, n] of rows) {
      addCount(counts, stockItem(key), n);
      from.push(countryText(game, sender));
    }
    out.items = itemsText(counts);
    out.fromTag = joinNames(from);
  } else if (message === "events_display.ww1936_garrison_short") {
    out.n = rows.reduce((s, r) => s + r[2], 0);
  }
  return out;
}
