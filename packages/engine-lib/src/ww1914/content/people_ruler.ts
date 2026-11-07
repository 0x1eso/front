import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * The people of the ruler's own life (ww142): those who see the person, not
 * the office. None holds a desk or can be given one. Text is in
 * resources/ww1914/ko/common.ruler.json. `source`: "(memory)" marks facts not
 * checked against a page. Append: order matters to the seed rolls.
 */
export const GW_PEOPLE_RULER: readonly GwPersonDef[] = [
  {
    id: "gbr_margot",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["civil", "liberal"],
    temperaments: ["arrogant", "anxious"],
    rivals: ["gbr_lloyd_george", "gbr_northcliffe"],
    allies: ["gbr_haldane"],
    fame: 3,
    source:
      "Asquith's second wife. The Weekly London Mail apologised and paid damages for saying she played tennis with German officers at Donington; Asquith v. the Globe, judgment for 1,000 pounds and costs, Mar 1916 (Papers Past, Dec 1915 to Mar 1916). Campaigned against conscription; broke the news of Raymond's death to him (en.wikipedia H. H. Asquith; Papers Past, Sep 1916)",
  },
  {
    id: "auh_schratt",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["civil", "dynasty"],
    temperaments: ["weary", "cunning"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "Actress of the Vienna stage; met Franz Joseph 1885, his friend and confidante to the end; the villa at Bad Ischl, a small palace in Vienna (en.wikipedia Franz Joseph I)",
  },
  {
    id: "auh_ketterl",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["civil", "dynasty"],
    temperaments: ["stubborn", "weary"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "Eugen Ketterl, valet de chambre from 1894 to the Emperor's death; his day began as early as the Emperor's (habsburger.net, the valet de chambre). Last words to the valet: tomorrow morning, half past three (en.wikipedia Franz Joseph I)",
  },
  {
    id: "rus_fedorov",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "court"],
    temperaments: ["cold", "anxious"],
    rivals: ["rus_rasputin"],
    allies: [],
    fame: 2,
    source:
      "Sergei Fedorov, court surgeon; called the boy's recovery of 1912 inexplicable (en.wikipedia Alexei Nikolaevich). Told Nicholas in Mar 1917 that the boy could not be cured (memory)",
  },
];
