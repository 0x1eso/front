// ww229 (design ww227 §5-§6): CCP's generals, own equipment and start arms,
// read before the content. Data only.
//
// Generals: the Red Army's commanders not yet in GENERALS (Zhu De, Liu
// Bocheng, He Long and Lin Biao are there). The Red Army had no ranks
// before 1955, so `from` marks only Ye Ting, who rejoined in 1937.
//
// No balance of power (CCP is not a BOP tag): the mechanism is the base
// areas behind the enemy's lines (decisions.ts).
//
// Equipment: the Communists made almost nothing heavier than rifles,
// grenades and mortar shells. Their one rifle of their own is the Huangyadong
// arsenal's carbine; everything else was captured, bought or handed over.
// The Japanese tank and fighter are designs only (count 0): the arms of the
// Kwantung Army reach the party through the decision
// ccp_dec_kwantung_arsenals, as stock.
import type { NationCore } from "../types";

export const CORE_CCP: NationCore = {
  tag: "CCP",
  generals: [
    {
      id: "peng_dehuai",
      tag: "CCP",
      att: 4,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Peng Dehuai: commanded the 3rd Red Army Corps on the Long March and the front army in northern Shaanxi in 1936; deputy commander of the Eighth Route Army, the Hundred Regiments Offensive 1940",
    },
    {
      id: "nie_rongzhen",
      tag: "CCP",
      att: 2,
      def: 4,
      plan: 3,
      log: 3,
      traits: ["guerrilla_fighter"],
      source:
        "en.wikipedia Nie Rongzhen: commissar of the 1st Red Army Corps on the Long March; built and commanded the Shanxi-Chahar-Hebei military region from late 1937",
    },
    {
      id: "xu_xiangqian",
      tag: "CCP",
      att: 4,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Xu Xiangqian: commander of the Fourth Front Army 1931-1936 and of the Western Route Army; deputy commander of the 129th Division 1937",
    },
    {
      id: "chen_yi",
      tag: "CCP",
      att: 3,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Chen Yi (marshal): led the guerrillas left behind in Jiangxi 1934-1937; New Fourth Army 1st Detachment 1938, acting army commander from 1941",
    },
    {
      id: "su_yu",
      tag: "CCP",
      att: 5,
      def: 3,
      plan: 4,
      log: 2,
      traits: ["ambusher"],
      source:
        "en.wikipedia Su Yu: guerrilla commander in southern Zhejiang 1935-1937; New Fourth Army, the battle of Huangqiao 1940, commander in central China",
    },
    {
      id: "ye_ting",
      tag: "CCP",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["offensive_doctrine"],
      from: "1937-10-12",
      source:
        "en.wikipedia Ye Ting: the Ironsides of the Northern Expedition, out of the party after 1927; commander of the New Fourth Army from its founding in October 1937 (day from memory)",
    },
  ],
  bop: [],
  equipment: [
    {
      // 7.92 mm Mauser-pattern carbine with a folding spike bayonet, built
      // in the Taihang mountains from 1940; a few thousand made.
      id: "ccp_balu_rifle",
      country: "CCP",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1940,
      source:
        "zh.wikipedia 八一式马步枪 and en.wikipedia Huangyadong arsenal (the Balu or Type 81 carbine, 7.92x57 mm, bolt action, from 1940); range and cost from memory, cost against the Type 38 and Mosin entries.",
      spec: { mm: 7.92, aimedRpm: 12, rangeM: 450, autoPct: 0, costUsd: 20 },
    },
  ],
  startArms: [
    {
      entry: "jpn_type97_chiha",
      origin: "received",
      count: 0,
      source:
        "en.wikipedia Type 97 Chi-Ha: a captured Chi-Ha (the 'Gongchen' tank) served the Communists' first tank unit in the Northeast from 1945; design only at the start",
    },
    {
      entry: "jpn_ki43_2",
      origin: "received",
      count: 0,
      source:
        "en.wikipedia People's Liberation Army Air Force (history): the Northeast aviation school at Tonghua (1946) flew captured Japanese aircraft, Ki-43 fighters among them (from memory); design only at the start",
    },
  ],
};
