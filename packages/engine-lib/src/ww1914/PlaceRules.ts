// Great War 1914: where a paper comes from when its scene doesn't say. A scene
// can name its place (`place`), the big ones are named in GW_BIG_SCENE_PLACES,
// and the rest fall to the rules here: the theatre it speaks of, then the
// office of the person behind it, then the seat's own capital.
import {
  GW_FRONT_START,
  GW_LINES,
  GwOffice,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_FRONT_LAND } from "./FrontLand";

/** A country's seat on the map. Those with no place have no pin of their own. */
export const GW_CAPITALS: Readonly<Partial<Record<GwTag, GwPlace>>> = {
  DEU: "berlin",
  AUH: "vienna",
  RUS: "petrograd",
  FRA: "paris",
  GBR: "london",
  ITA: "rome",
  OTT: "constantinople",
  USA: "washington",
  JPN: "tokyo",
  SRB: "belgrade",
  MNE: "cetinje",
  BEL: "brussels",
  NLD: "amsterdam",
  CHE: "bern",
  SWE: "stockholm",
  ESP: "madrid",
  ROU: "bucharest",
  BGR: "sofia",
  GRC: "athens",
  ALB: "durazzo",
};

/** Offices that sit somewhere of their own; the rest sit in the capital. */
const OFFICE_PLACES: Readonly<
  Partial<Record<GwOffice, Partial<Record<GwTag, GwPlace>>>>
> = {
  navy: {
    DEU: "heligoland",
    GBR: "portsmouth",
    RUS: "sevastopol",
    AUH: "pola",
  },
  sea_lord: { GBR: "scapa_flow" },
  ireland: { GBR: "dublin" },
  hun_pm: { AUH: "budapest" },
  ambassador_london: { DEU: "london", AUH: "london", RUS: "london" },
  ambassador_paris: { DEU: "paris", AUH: "paris", RUS: "paris", GBR: "paris" },
  ambassador_petersburg: {
    DEU: "petrograd",
    AUH: "petrograd",
    GBR: "petrograd",
  },
  ambassador_vienna: { DEU: "vienna", GBR: "vienna", RUS: "vienna" },
  ambassador_washington: {
    DEU: "washington",
    AUH: "washington",
    GBR: "washington",
    RUS: "washington",
  },
};

/** Where a theatre with no land table of its own is fought from. */
const THEATRE_HOME: Readonly<Partial<Record<GwTheatre, GwPlace>>> = {
  sea: "heligoland",
  west: "verdun",
  east: "warsaw",
  balkan: "belgrade",
  italy: "gorizia",
  caucasus: "erzurum",
  straits: "gallipoli",
  mesopotamia: "basra",
  palestine: "gaza",
  colonies: "togo",
};

/** Where a theatre stands with its line at `line`: the land that line is named for. */
export function frontPlace(t: GwTheatre, line: number): GwPlace {
  const lines = GW_LINES[t];
  const step = line >= GW_FRONT_START[t] ? -1 : 1;
  for (let i = line; i >= 0 && i < lines.length; i += step) {
    const land = GW_FRONT_LAND[t][lines[i]];
    const first = land?.central?.[0] ?? land?.entente?.[0];
    if (first !== undefined) return first;
    if (i === GW_FRONT_START[t]) break;
  }
  return THEATRE_HOME[t] ?? "verdun";
}

/** The first theatre named anywhere under `node`, in reading order. */
function firstTheatre(node: unknown): GwTheatre | null {
  if (node === null || typeof node !== "object") return null;
  const own = (node as { theatre?: unknown }).theatre;
  if (typeof own === "string") return own as GwTheatre;
  for (const v of Object.values(node)) {
    const t = firstTheatre(v);
    if (t !== null) return t;
  }
  return null;
}

const SCENE_THEATRE = new WeakMap<GwScene, GwTheatre | null>();

/** The theatre a scene speaks of: its condition first, then what it does. */
export function sceneTheatre(scene: GwScene): GwTheatre | null {
  const known = SCENE_THEATRE.get(scene);
  if (known !== undefined) return known;
  const found =
    firstTheatre(scene.when) ??
    firstTheatre(scene.options) ??
    firstTheatre(scene.nodes);
  SCENE_THEATRE.set(scene, found);
  return found;
}

/** The office behind a scene: its speaker's cast rule, or the first it casts. */
function castOffice(
  scene: GwScene,
): { office: GwOffice; tag: GwTag | null } | null {
  const rules = scene.who === undefined ? [] : [scene.cast[scene.who]];
  for (const rule of [...rules, ...Object.values(scene.cast)]) {
    if (rule === undefined || !("office" in rule)) continue;
    const tag = "tag" in rule ? (rule.tag as GwTag) : null;
    return { office: rule.office, tag };
  }
  return null;
}

export interface GwPlaceSeat {
  tag: GwTag;
  /** The theatre the seat has made its main effort. */
  main: GwTheatre;
  /** Where a theatre's line stands now. */
  lineOf(t: GwTheatre): number;
}

/** The place a scene falls to by rule, for a seat. */
export function sceneNear(scene: GwScene, seat: GwPlaceSeat): GwPlace {
  const theatre = sceneTheatre(scene);
  if (theatre !== null) return frontPlace(theatre, seat.lineOf(theatre));
  const home = GW_CAPITALS[seat.tag] ?? "berlin";
  const who = castOffice(scene);
  if (who !== null) {
    if (who.tag !== null && who.tag !== seat.tag) {
      return GW_CAPITALS[who.tag] ?? home;
    }
    const own = OFFICE_PLACES[who.office]?.[seat.tag];
    if (own !== undefined) return own;
    if (who.office === "chief_of_staff" || who.office === "supreme_commander") {
      return frontPlace(seat.main, seat.lineOf(seat.main));
    }
  }
  return home;
}

/**
 * The big scenes, by hand: where they are fought or signed. A scene's own
 * `place` wins over this; a test holds the ids to real scenes.
 */
export const GW_BIG_SCENE_PLACES: Readonly<Record<string, GwPlace>> = {
  // July: Sarajevo and what it set off.
  deu_c_kiel_wire: "sarajevo",
  auh_c_ischl_wire: "sarajevo",
  auh_c_funeral: "vienna",
  auh_c_hoyos_mission: "berlin",
  auh_c_berlin_answer: "berlin",
  deu_c_blank_cheque: "vienna",
  auh_c_note_out: "belgrade",
  deu_c_ultimatum_out: "belgrade",
  rus_c_ultimatum_out: "belgrade",
  auh_c_serb_reply: "belgrade",
  deu_c_serbian_reply: "belgrade",
  deu_c_war_on_serbia: "belgrade",
  auh_c_war_serbia: "belgrade",
  deu_c_belgium_note: "brussels",
  gbr_c_cambon: "paris",
  gbr_c_ultimatum: "brussels",
  rus_c_poincare: "petrograd",
  gbr_c_bef: "mons",
  gbr_c_retreat: "mons",
  // The big nights.
  auh_big_lemberg: "lemberg",
  auh_big_trent: "trento",
  auh_big_birthday: "teschen",
  deu_big_pless: "kattowitz",
  deu_big_spa: "liege",
  deu_big_last: "liege",
  rus_b_narew: "tannenberg",
  rus_b_lemberg: "lemberg",
  rus_b_lutsk: "lutsk",
  rus_b_last_night: "minsk",
  rus_o_first: "sarajevo",
  gbr_big_march: "saint_quentin",
  // The west.
  deu_w_marne_order: "meaux",
  deu_w_ypres_boys: "ypres",
  deu_f_verdun_plan: "verdun",
  deu_f_verdun_third_month: "verdun",
  deu_f_somme_doctrine: "peronne",
  deu_f_black_day: "amiens",
  deu_f_paris_in_range: "paris",
  gbr_w_somme_first: "peronne",
  gbr_w_flanders: "ypres",
  gbr_w_doullens: "amiens",
  gbr_w_march: "saint_quentin",
  // The east.
  deu_w_tannenberg: "tannenberg",
  deu_w_prittwitz: "konigsberg",
  deu_w_east_relief: "konigsberg",
  deu_f_gorlice: "gorlice",
  auh_w_galicia_plan: "lemberg",
  auh_w_lemberg: "lemberg",
  auh_w_przemysl: "przemysl",
  auh_w_carpathian: "ungvar",
  auh_w_brusilov: "lutsk",
  rus_c_first_battles: "tannenberg",
  rus_w_carpathians: "ungvar",
  rus_w_gorlice: "gorlice",
  rus_w_warsaw: "warsaw",
  rus_w_naroch: "vilna",
  rus_w_lutsk: "lutsk",
  // The south.
  auh_w_serbia_again: "belgrade",
  auh_w_italy_war: "gorizia",
  auh_w_tyrol_strike: "trento",
  auh_w_caporetto: "udine",
  auh_w_piave: "treviso",
  gbr_w_landing: "gallipoli",
  gbr_w_evacuate: "gallipoli",
  gbr_w_gates: "canakkale",
  rus_w_bosporus_landing: "constantinople",
  // The sea, and the end of it.
  deu_s_jutland: "heligoland",
  deu_k_kiel: "hamburg",
  deu_k_last_sortie: "heligoland",
  deu_k_spa: "liege",
  deu_k_spa_again: "liege",
  auh_k_spa: "liege",
  deu_s_brest_opens: "brest_litovsk",
  deu_s_brest_no_peace: "brest_litovsk",
  rus_r_brest: "brest_litovsk",
  gbr_h_easter: "dublin",
  gbr_w_versailles: "paris",
  gw_e_conference_seat: "paris",
  gw_o_ott_ships: "constantinople",
  gw_o_ita_london: "london",
  gw_o_rou_in: "bucharest",
};
