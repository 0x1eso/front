// ww229 (design ww227): Manchukuo's national content, tier A. The tree
// (focuses.ts) and the rest (content.ts) are data only; core.ts holds the
// generals, the catalogue and the start arms.
//
// Mechanism (design §5, "autonomy toward the Kwantung Army"): Manchukuo is
// Japan's puppet at 20% autonomy. The Kwantung Army's grip is a staged spirit
// (iron grip -> inner guidance -> loosened -> a state of its own) whose
// autonomyGainPct slows the subject's own gain; the grip focuses, the native
// officials decision and the two loosen decisions (at 40% and 70% autonomy)
// push it, Japan's answer events and the Kwantung reaction event (when Japan
// tightens control) pull it back. Puyi's Qing claim is a restoration route
// (civil war, the Dragon Throne, set_name) with claims on Beijing and Hebei.
import type { NationDef } from "../types";
import {
  MCK_DECISIONS,
  MCK_EVENTS,
  MCK_FLAGS,
  MCK_GROUPS,
  MCK_PERSONS,
  MCK_SPIRITS,
  MCK_START_SPIRITS,
  MCK_TEMPLATES,
} from "./content";
import { MCK_BRANCH_POINTS, MCK_FOCUSES, MCK_PATH } from "./focuses";

export const NATION_MCK: NationDef = {
  tag: "MCK",
  tier: "A",
  sheet: {
    situation:
      "A state proclaimed by the Kwantung Army after the Mukden Incident, with the last Qing emperor on its throne and Japanese vice-ministers in every ministry. Its army is assembled from surrendered warlord troops, partisans hold the eastern hills, and its coal, iron and soybeans are planned for Japan's needs.",
    startSpirits: MCK_START_SPIRITS,
    dilemmas: [
      {
        branchPoint: "mck_bp_course",
        note: "The Concordia one-association state (history), Puyi's Qing restoration, or a government of the native officers?",
      },
      {
        branchPoint: "mck_bp_settlers",
        note: "Open the land to a million Japanese settler households (history) or keep it with its farmers?",
      },
      {
        branchPoint: "mck_bp_industry",
        note: "Hand industry to Ayukawa's Manchuria Heavy Industries (history) or build state firms of its own?",
      },
      {
        branchPoint: "mck_bp_border",
        note: "Hold every disputed hill on the Soviet border (history) or settle incidents in mixed commissions?",
      },
      {
        branchPoint: "mck_bp_war",
        note: "Become the empire's rear base when Japan goes to war (history) or keep the army at home?",
      },
    ],
    mechanism:
      "The Kwantung Army's grip: a staged spirit on the puppet's autonomy, loosened by decisions at 40% and 70% autonomy and by the grip focuses, pulled back when Japan tightens control; Puyi's Qing claim on Beijing.",
    patrons: ["JPN"],
    rivals: ["SUN", "CHN", "CCP"],
    unions: ["MEN"],
    claims: ["mck_qing_heartland", "inner_mongolia"],
    people: [
      "mck_zhang_jinghui",
      "mck_puyi_qing",
      "mck_zheng_xiaoxu",
      "mck_zhang_haipeng",
      "mck_zhang_xueliang",
      "mck_ma_zhanshan",
      "mck_zhou_baozhong",
      "mck_yang_jingyu",
      "mck_zhao_shangzhi",
      "mck_zang_shiyi",
      "mck_xi_qia",
      "mck_hoshino_naoki",
      "mck_kishi_nobusuke",
      "mck_ayukawa",
      "mck_amakasu",
      "mck_furumi_tadayuki",
      "mck_xie_jieshi",
      "mck_yu_zhishan_adv",
      "mck_ganjuurjab_adv",
      "mck_yu_zhishan",
      "mck_ganjuurjab",
      "mck_xing_shilian",
      "mck_zhang_wendao",
    ],
    equipment: [
      "mck_liao_type13",
      "mck_mukden_type38",
      "mck_mukden_77",
      "mck_dowa_truck",
      "mck_manshu_ki27",
      "mck_manshu_mt1",
      "fra_ft17",
      "jpn_type94_teke",
    ],
  },
  // A client of Japan. The Qing restoration is its likeliest deviation; the
  // loyalists and the United Army are possible when their movements grow.
  character: {
    lean: "client",
    patrons: ["JPN"],
    routeBias: { neutral: 2, democratic: 1, communist: 1, fascist: 1 },
  },
  politics: {
    spirits: MCK_START_SPIRITS,
    leaders: {
      democratic: "mck_zhang_xueliang",
      communist: "mck_zhou_baozhong",
      fascist: "leader_mck",
      neutral: "mck_puyi_qing",
    },
  },
  focuses: MCK_FOCUSES,
  path: MCK_PATH,
  branchPoints: MCK_BRANCH_POINTS,
  events: MCK_EVENTS,
  decisions: MCK_DECISIONS,
  spirits: MCK_SPIRITS,
  persons: MCK_PERSONS,
  flags: MCK_FLAGS,
  groups: MCK_GROUPS,
  claims: [],
  templates: MCK_TEMPLATES,
  aliases: {},
  dropped: [],
};
