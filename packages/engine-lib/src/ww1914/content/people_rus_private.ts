import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * The Tsar's circle for the private lines (scenes/rus_private.ts). None holds
 * an office or can be given one; `camps` and `rivals` are empty so that no work
 * scene casts them by accident. They reach the people tab when a line opens
 * them. Text is in RUS.kin.json. Order matters to the seed rolls: append.
 *
 * `source`: "(memory)" marks facts not checked against a page. Details of these
 * private scenes beyond the sources are invented where history is silent.
 */
export const RUS_KIN: readonly GwPersonDef[] = [
  {
    id: "rus_botkin",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["weary", "stubborn"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 1865; volunteer in Manchuria 1904, Red Cross; court physician Apr 1908; divorced 1910, wife left for Lichinger, he kept the children; son Dmitri (1894-1914), khorunzhy of the Life Guard Cossacks, St George, killed in action (en/ru.wikipedia Eugene Botkin). Month of the death, and his kidneys and heart (memory)",
  },
  {
    id: "rus_olga_a",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "cold"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 1882; m. Peter of Oldenburg 1901, never consummated, seven years' answer on divorce; Kulikovsky met through Michael Apr 1903, made Peter's aide; Red Cross nurse at Rovno, then Kiev; St George under fire; annulled Oct 1916, m. Kulikovsky 16 Nov 1916 at Kiev, the Dowager there (en.wikipedia Grand Duchess Olga Alexandrovna). Nicholas's stop at Rovno is invented",
  },
  {
    id: "rus_olga",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "anxious"],
    rivals: [],
    allies: [],
    fame: 3,
    source:
      "b. 15 Nov 1895; long walks with her father, read the papers; Constanta Jun 1914, wanted to stay Russian; nurse at Tsarskoye Selo; broke three panes with an umbrella Sep 1915, office work and arsenic from Oct 1915; her money at twenty; 'golden Mitya' Chakh-Bagov, the letters shown (uncited); ashamed of her relatives after Rasputin's murder (en.wikipedia Grand Duchess Olga Nikolaevna)",
  },
  {
    id: "rus_kr",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["weary", "anxious"],
    rivals: [],
    allies: [],
    fame: 3,
    source:
      "b. 1858, d. Pavlovsk 15 Jun 1915; K.R., translated Hamlet, Academy president; Wildungen Aug 1914; Oleg mortally wounded, St George 28 Sep OS, d. Vilna 29 Sep OS, buried Ostashevo; son-in-law Bagration killed Mar 1915; Nicholas served in the Preobrazhensky under him 1892-94 (en.wikipedia Grand Duke Konstantin Konstantinovich, Prince Oleg; history.jes.su article). Nicholas's rank there, the walk over the border, Oleg's Pushkin (memory); whether Nicholas could go to Ostashevo is the player's",
  },
  {
    id: "rus_ella",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "weary"],
    rivals: [],
    allies: [],
    fame: 3,
    source:
      "b. 1864; Sergei killed by Kalyayev Feb 1905, she gathered him up, visited the killer, asked Nicholas to spare him; Martha and Mary convent 1909; prisoners' relief, accused of helping Germans; mob called for 'that German woman'; Moscow riots of May 1915 began with women refused work at her committee; warned Alexandra, last visit Dec 1916 (en/ru.wikipedia Elisabeth; Gilliard; alexanderpalace.org interview). The stone on the shoulder is invented",
  },
  {
    id: "rus_mathilde",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["cunning", "stubborn"],
    rivals: [],
    allies: [],
    fame: 3,
    source:
      "b. 1872; met Nicholas after her graduation performance 1890 with Alexander III there; affair to the engagement of Apr 1894; son Vladimir 1902, patronymic Sergeevich; Rodzianko on her hand in artillery orders (en/ru.wikipedia Mathilde Kschessinska). The hay barn, the last letter's words, Alexander III's remark at table: her memoirs (memory)",
  },
  {
    id: "rus_sergei_m",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["cold", "weary"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 1869; Nicholas asked him to look after Kschessinska 1894; Inspector General of Artillery 1905 to 1915-16, Rodzianko's charges and the commission; Jan 1916 field inspector at Stavka on the Tsar's train; lost hope in the war (en.wikipedia Grand Duke Sergei Mikhailovich)",
  },
  {
    id: "rus_sandro",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["arrogant", "stubborn"],
    rivals: [],
    allies: [],
    fame: 3,
    source:
      "b. 1866; childhood friend of Nicholas; m. Xenia 1894, seven children; admiral; aviation school 1910, chief of the air service, Dec 1916 field inspector; challenged the Empress's influence; early 1917 for a government of public figures, not a responsible ministry (en.wikipedia Grand Duke Alexander Mikhailovich). Kiev, Biarritz, his plea for Yusupov, Irina his daughter, his long letters (memory, Once a Grand Duke)",
  },
  {
    id: "rus_nilov",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["stubborn", "weary"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 1856; officer 1876; flag captain 8 Oct 1905, on every voyage, at Stavka through the war; frank, an 'eccentric' at court (Timiryov); wife Marianna Kochubei (ru.wikipedia Konstantin Nilov). 'Habits of intemperance', devoted, stayed until the Tsar sent him off (Mossolov, ch. III). The hanging talk is invented; no children (memory)",
  },
  {
    id: "rus_dmitri",
    tag: "RUS",
    office: null,
    fit: [],
    camps: [],
    temperaments: ["arrogant", "anxious"],
    rivals: [],
    allies: [],
    fame: 3,
    source:
      "b. 18 Sep 1891; mother d. six days on; father Paul exiled 1902 for his marriage; Sergei, then Ella, his guardians; from about 1908 on the Tsar's daily walks, nearly a foster son; 9th in the jumping, Stockholm 1912; St George 1914 for bringing in a wounded corporal; Rasputin's murder Dec 1916, Persia, clemency refused; betrothal to Olga rumoured (en.wikipedia Grand Duke Dmitri Pavlovich; alexanderpalace.org). The oath on his hands (memory)",
  },
];

/** How each talks. Same use as RUS_VOICE_NOTES. */
export const RUS_KIN_VOICE_NOTES: Readonly<Record<string, string>> = {
  rus_botkin:
    "크고 느린 의사. 묻기 전에는 자기 일을 안 말한다. 맥과 시각으로 말하고, 감정은 처방처럼 적는다. 말끝을 부드럽게 내린다.",
  rus_olga_a:
    "황제의 막내 누이. 손이 거칠고 말이 곧다. 오빠라 부르고 농담으로 찌른다. 아버지 이야기를 할 때만 천천히 말한다.",
  rus_olga:
    "책과 신문을 읽는 큰딸. 건조한 농담. 아버지에게 해요체를 쓰고, 마음이 상하면 문장이 공손해진다.",
  rus_kr:
    "시인이자 옛 연대장. 황제를 놀릴 수 있는 드문 노인. 문장이 곱고 자기를 깎는다. 아들 얘기는 교정지 이야기처럼 한다.",
  rus_ella:
    "회색 옷의 황후 언니. 서두르지 않는다. 니키라 부르고, 무서운 일을 집안일처럼 말한다. 언성을 안 높인다.",
  rus_mathilde:
    "무대에서 평생을 산 사람. 빠르고 웃는다. 폐하라 부르며 놀린다. 청은 한 번에 말하고 거절을 먼저 안다.",
  rus_sergei_m:
    "서른 해 포를 본 대공. 수로 말하고 자기 일을 셈으로 친다. 쓴 웃음이 있다. 그 사람 얘기에는 말이 짧다.",
  rus_sandro:
    "폐하를 니키, 자네라 부르는 유일한 신하. 제독의 입에 비행기 말. 끊어 말하고 놀리다가 정곡을 찌른다. 나쁜 소식을 면도 안 한 얼굴로 가져온다.",
  rus_nilov:
    "바다의 말을 하는 술꾼. 날씨로 시작한다. 입이 험하고 충성이 곧다. 낮에는 말이 없고 밤에 진짜 말을 한다.",
  rus_dmitri:
    "궁에서 큰 스물몇. 말이 빠르고 웃으면서 무서운 말을 한다. 폐하를 사랑하고, 그 말을 안 한다. 말과 동기 이야기로 돌아간다.",
};
