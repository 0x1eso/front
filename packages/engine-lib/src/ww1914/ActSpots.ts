// Great War 1914: where a schedule entry happens on the map, so it can be started
// from there. `place`: this place. `tag`: any land of that country.
// `theatre`: any land of that front. `pick` fills a field for the entry.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";

export interface GwActSpot {
  act: string;
  place?: GwPlace;
  tag?: GwTag;
  theatre?: GwTheatre;
  pick?: Readonly<Record<string, string>>;
}

const at = (place: GwPlace, ...acts: string[]): GwActSpot[] =>
  acts.map((act) => ({ act, place }));
const to = (tag: GwTag, ...acts: string[]): GwActSpot[] =>
  acts.map((act) => ({ act, tag }));
const front = (theatre: GwTheatre, ...acts: string[]): GwActSpot[] =>
  acts.map((act) => ({ act, theatre }));
/** One choice of the `where` field: an envoy or an agent to that country. */
const where = (tag: GwTag, act: string, option: string): GwActSpot => ({
  act,
  tag,
  pick: { where: option },
});

export const GW_ACT_SPOTS: readonly GwActSpot[] = [
  // Germany
  ...at("rhineland", "deu_a_krupp", "deu_a_ruhr", "deu_a_sp_krupp"),
  ...at("heligoland", "deu_a_fleet"),
  ...at("hamburg", "deu_a_hamburg", "deu_a_sp_kiel"),
  ...at("strasbourg", "deu_a_alsace"),
  ...at("konigsberg", "deu_a_prussia"),
  ...at("munich", "deu_a_zeppelin"),
  ...at("saarbrucken", "deu_a_oppau"),
  ...at(
    "berlin",
    "deu_a_hospital",
    "deu_a_market",
    "deu_a_staff",
    "deu_a_sp_balcony",
    "deu_a_sp_reichstag",
    "deu_a_sp_dom",
  ),
  ...front("west", "deu_a_west", "deu_a_heir", "deu_a_sp_troops"),
  ...front("east", "deu_a_east", "deu_a_sp_troops"),
  ...to("RUS", "deu_a_nicky"),
  ...to("GBR", "deu_a_georgie"),
  ...to("AUH", "deu_a_vienna"),
  ...to("USA", "deu_a_wilson"),
  where("ITA", "deu_a_envoy", "rome"),
  where("OTT", "deu_a_envoy", "stamboul"),
  where("AUH", "deu_a_envoy", "vienna"),
  where("FRA", "deu_a_guelph", "paris"),
  where("USA", "deu_a_guelph", "newyork"),
  where("RUS", "deu_a_rebels", "russia"),
  ...to("DNK", "deu_a_copenhagen"),
  // Britain
  ...at("scapa_flow", "gbr_a_fleet"),
  ...at("glasgow", "gbr_a_clyde", "gbr_a_gretna"),
  ...at("portsmouth", "gbr_a_netley", "gbr_a_salisbury"),
  ...at("dublin", "gbr_a_dublin", "gbr_a_belfast", "gbr_a_s_ireland"),
  ...at("manchester", "gbr_a_liverpool", "gbr_a_seat", "gbr_a_s_labour"),
  ...at("calais", "gbr_a_dover"),
  ...at(
    "london",
    "gbr_a_woolwich",
    "gbr_a_city",
    "gbr_a_room40",
    "gbr_a_s_commons",
    "gbr_a_s_guildhall",
    "gbr_a_s_recruit",
    "gbr_a_s_seat",
  ),
  ...front("west", "gbr_a_gq"),
  ...to("RUS", "gbr_a_l_nicky"),
  ...to("DEU", "gbr_a_l_willy"),
  ...to("USA", "gbr_a_l_wilson"),
  ...to("FRA", "gbr_a_l_poincare"),
  where("FRA", "gbr_a_o_envoy", "paris"),
  where("USA", "gbr_a_o_envoy", "washington"),
  where("ITA", "gbr_a_o_envoy", "rome"),
  where("USA", "gbr_a_i_agents", "newyork"),
  where("CHE", "gbr_a_i_agents", "geneva"),
  where("RUS", "gbr_a_i_agents", "petrograd"),
  // Austria-Hungary
  ...at("pilsen", "auh_a_skoda"),
  ...at(
    "budapest",
    "auh_a_csepel",
    "auh_a_mills",
    "auh_a_s_budapest",
    "auh_a_i_opposition",
  ),
  ...at(
    "vienna",
    "auh_a_queue",
    "auh_a_ward",
    "auh_a_barracks",
    "auh_a_s_vienna",
    "auh_a_s_house",
    "auh_a_s_peoples",
    "auh_a_i_rumour",
  ),
  ...at("prague", "auh_a_prague", "auh_a_s_prague"),
  ...at("teschen", "auh_a_hq", "auh_a_s_army"),
  ...at("przemysl", "auh_a_przemysl"),
  ...at("ungvar", "auh_a_pass"),
  ...at("novi_sad", "auh_a_semlin"),
  ...at("pola", "auh_a_pola"),
  ...at("sarajevo", "auh_a_bosnia", "auh_a_o_inquiry"),
  ...front("italy", "auh_a_isonzo"),
  ...to("BGR", "auh_a_l_ferdinand"),
  ...at("rome", "auh_a_l_pope"),
  ...to("ESP", "auh_a_l_alfonso"),
  ...to("DEU", "auh_a_o_berlin"),
  ...to("CHE", "auh_a_i_swiss"),
  where("ITA", "auh_a_o_envoy", "rome"),
  where("ROU", "auh_a_o_envoy", "bucharest"),
  where("OTT", "auh_a_o_envoy", "constantinople"),
  where("ROU", "auh_a_i_agent", "bucharest"),
  where("ITA", "auh_a_i_agent", "rome"),
  where("GRC", "auh_a_i_agent", "salonika"),
  // Russia
  ...at(
    "petrograd",
    "rus_a_v_putilov",
    "rus_a_v_kronstadt",
    "rus_a_v_hospital",
    "rus_a_v_depots",
    "rus_a_v_archangel",
    "rus_a_s_duma",
    "rus_a_s_review",
    "rus_a_s_workers",
    "rus_a_s_zemstvo",
    "rus_a_s_cathedral",
  ),
  ...at(
    "moscow",
    "rus_a_v_tula",
    "rus_a_v_moscow",
    "rus_a_v_volga",
    "rus_a_v_lavra",
    "rus_a_s_kremlin",
  ),
  ...at("kiev", "rus_a_v_don"),
  ...at("sevastopol", "rus_a_v_sevastopol"),
  ...at("lemberg", "rus_a_v_galicia"),
  ...at("tiflis", "rus_a_v_caucasus"),
  ...front("east", "rus_a_v_northwest"),
  {
    act: "rus_a_o_aide",
    theatre: "east",
    pick: { front: "northwest" },
  },
  {
    act: "rus_a_o_aide",
    theatre: "caucasus",
    pick: { front: "caucasus" },
  },
  ...to("DEU", "rus_a_l_willy"),
  ...to("GBR", "rus_a_l_georgie"),
  ...to("FRA", "rus_a_l_poincare"),
  ...to("BGR", "rus_a_l_ferdinand"),
  ...to("DNK", "rus_a_i_feeler"),
  where("FRA", "rus_a_o_envoy", "paris"),
  where("GBR", "rus_a_o_envoy", "london"),
  where("ROU", "rus_a_o_envoy", "bucharest"),
];

/** What can be started at a place: its own entries, its country's, its front's. */
export function actSpotsAt(
  place: GwPlace | null,
  tag: GwTag | null,
  theatre: GwTheatre | null,
): GwActSpot[] {
  return GW_ACT_SPOTS.filter(
    (s) =>
      (place !== null && s.place === place) ||
      (tag !== null && s.tag === tag) ||
      (theatre !== null && s.theatre === theatre),
  );
}
