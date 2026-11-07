import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * The people of the budget (ww140): the bankers and the watchers of the purse
 * who hold no minister's desk. Text is in resources/ww1914/ko/common.budget.json.
 * `source`: "(memory)" marks facts not checked against a page. Append: order
 * matters to the seed rolls.
 */
export const GW_PEOPLE_MONEY: readonly GwPersonDef[] = [
  {
    id: "deu_havenstein",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["stubborn", "anxious", "cold"],
    rivals: ["deu_helfferich"],
    allies: ["deu_kuhn"],
    fame: 2,
    source:
      "Reichsbank president; built up the gold reserve before the war; objected on inflation grounds to the Darlehnskassen and was overruled (1914-1918-online, war finance Germany; search summary). Born 1857, in office to his death 1923 (memory)",
  },
  {
    id: "usa_morgan",
    tag: "USA",
    office: null,
    fit: [],
    camps: ["west"],
    temperaments: ["cold", "stubborn"],
    rivals: ["deu_helfferich"],
    allies: ["gbr_lloyd_george"],
    fame: 3,
    source:
      "J. P. Morgan Jr.; the firm's commercial agreement with the British government Jan 1915, purchases at 1 percent; the $500m Anglo-French loan, autumn 1915 (en.wikipedia J. P. Morgan Jr.; Anglo-French Financial Commission; 1914-1918-online House of Morgan)",
  },
  {
    id: "auh_teleszky",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["civil", "magyar", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["auh_bilinski"],
    allies: ["auh_tisza"],
    fame: 1,
    source:
      "János Teleszky, 1868-1939, Hungary's finance minister 1912-1917; wrote the study of Hungary's war finances, 1927 (search summary on Austria-Hungary war finance)",
  },
  {
    id: "rus_shingarev",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "liberal"],
    temperaments: ["stubborn", "weary"],
    rivals: ["rus_bark"],
    allies: ["rus_kokovtsov"],
    fame: 2,
    source:
      "Andrei Shingarev, physician, Kadet; the Duma's voice on the budget and on war finance; finance minister in the Provisional Government 1917; killed Jan 1918 (memory)",
  },
];
