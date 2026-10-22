// World War 1936 P6 (spec §4.3): the field marshals the historical AI promotes
// on its own (a human country promotes whom it likes). `general` is a P2
// GENERALS id, or "title:<key>" for a marshal who appears by office only
// (name key ww1936.title.<key>). `from` is the first day the AI may promote
// him (the real promotion or appointment), `until` the day he leaves.
//
// Real names only from the P2 roster, under the P2 rules (spec §6.2): nobody
// convicted by a war-crimes court. Italy's marshal is an office since the
// roster no longer lists the 1936 holder (controller ruling, P2 roster
// revision); Japan's is an office as every Japanese person is (decisions.md).
// A titled marshal has every skill at 2 (spec §4.3); the doctrine-and-command
// lane gives the "title:" rows those skills.
//
// Source format (spec §27.7-4): "<position> <date>; <source 1>; <source 2>".
import type { StartFmDef } from "@openfront/engine-api/ww1936/DepthTypes";

export const START_FIELD_MARSHALS: readonly StartFmDef[] = [
  {
    tag: "DEU",
    general: "rundstedt",
    trait: "fm_thorough",
    source:
      "Gruppenkommando 1 in 1936, Generalfeldmarschall 1940-07-19; en.wikipedia Gerd von Rundstedt; en.wikipedia 1940 Field Marshal Ceremony",
  },
  {
    tag: "SUN",
    general: "tukhachevsky",
    trait: "fm_strategist",
    until: "1937-05-22",
    source:
      "Marshal of the Soviet Union 1935-11-20, arrested 1937-05-22; en.wikipedia Mikhail Tukhachevsky; ru.wikipedia (the P2 roster row)",
  },
  {
    tag: "SUN",
    general: "timoshenko",
    trait: "fm_defensive",
    from: "1940-05-07",
    source:
      "Marshal of the Soviet Union and People's Commissar of Defence 1940-05-07; ru.wikisource decree of the Presidium of the Supreme Soviet of 07.05.1940; liquisearch Marshal of the Soviet Union (history of the rank: three marshals named that day)",
  },
  {
    tag: "SUN",
    general: "zhukov",
    trait: "fm_offensive",
    from: "1943-01-18",
    source:
      "Marshal of the Soviet Union 1943-01-18; en.wikipedia Georgy Zhukov; tracesofwar.com Georgi K Zhukov",
  },
  {
    tag: "GBR",
    general: "wavell",
    trait: "fm_logistics",
    from: "1940-02-15",
    source:
      "Commander-in-Chief Middle East 1940-02-15 (GOC-in-C from July 1939); en.wikipedia Archibald Wavell; National Army Museum Great Commanders: Wavell (February 1940)",
  },
  {
    tag: "FRA",
    general: "gamelin",
    trait: "fm_defensive",
    until: "1940-05-19",
    source:
      "Chief of the General Staff, Allied land commander 1939, dismissed 1940-05-19; en.wikipedia Maurice Gamelin; Britannica Maurice Gamelin",
  },
  {
    tag: "USA",
    general: "macarthur",
    trait: "fm_inspiring",
    source:
      "Field Marshal of the Philippine Army 1936-08-24; en.wikipedia Field Marshal (Philippines); en.wikipedia Douglas MacArthur",
  },
  {
    // An office, not a person: the head of the Supreme General Staff.
    tag: "ITA",
    general: "title:ita_supreme_staff",
    trait: "fm_thorough",
    source:
      "office: Chief of the General Staff (Capo di Stato Maggiore Generale, from 1925), its staff renamed Comando Supremo 1941-06-27; en.wikipedia Comando Supremo; normattiva.it decree-law of 27 June 1941 n. 661",
  },
  {
    // An office, not a person: the army group formed for the southern war.
    tag: "JPN",
    general: "title:jpn_southern_army",
    trait: "fm_logistics",
    from: "1941-11-06",
    source:
      "office: Commander-in-Chief of the Southern Expeditionary Army Group, formed 1941-11-06 in Saigon; en.wikipedia Southern Expeditionary Army Group; en.wikipedia Sixteenth Army (Japan)",
  },
];
