import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * Foreign figures any seat can meet (plan /home/eser/dev/ww135-plan-common.md).
 * Text is in resources/ww1914/ko/common.people.json, which every seat loads. A
 * scene casts them by name: AI countries change no offices, so `office` stays
 * null. The four seats' own heads of state are not here: a seat must never
 * see its own head on its people screen, so they are prose in other seats.
 * `source`: "(memory)" marks facts not checked against a page.
 *
 * Order matters to the seed rolls: append.
 */
export const GW_PEOPLE_COMMON: readonly GwPersonDef[] = [
  {
    id: "fra_poincare",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "centre", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["fra_clemenceau"],
    allies: ["fra_joffre"],
    fame: 4,
    source:
      "b. 20 Aug 1860, Bar-le-Duc; president Feb 1913-1920; Petersburg visit Jul 1914; the sacred union (memory; design 15 no. 5 makes him France's seat in a later wave)",
  },
  {
    id: "fra_briand",
    tag: "FRA",
    office: null,
    fit: ["chancellor", "foreign"],
    camps: ["civil", "radical", "moderate", "east"],
    temperaments: ["cunning", "weary"],
    rivals: ["fra_clemenceau"],
    allies: ["fra_poincare"],
    fame: 3,
    source:
      "b. 28 Mar 1862; prime minister Oct 1915-Mar 1917, Salonika's advocate; Lancken sounding 1917 (memory)",
  },
  {
    id: "fra_clemenceau",
    tag: "FRA",
    office: null,
    fit: ["chancellor", "war"],
    camps: ["civil", "radical", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["fra_poincare", "fra_briand"],
    allies: ["fra_foch"],
    fame: 5,
    source:
      "b. 28 Sep 1841, Mouilleron-en-Pareds; the Tiger; prime minister 16 Nov 1917-Jan 1920; hard line on Caillaux and Malvy; 377 to 110 in spring 1918; published Karl's letter Apr 1918 (en.wikipedia Georges Clemenceau; Sixtus Affair)",
  },
  {
    id: "fra_joffre",
    tag: "FRA",
    office: "chief_of_staff",
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["fra_foch"],
    allies: ["fra_poincare"],
    fame: 4,
    source:
      "b. 12 Jan 1852; commander in chief to Dec 1916; the Marne; marshal Dec 1916 (memory)",
  },
  {
    id: "fra_foch",
    tag: "FRA",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["fra_joffre"],
    allies: ["fra_clemenceau"],
    fame: 4,
    source:
      "b. 2 Oct 1851, Tarbes; Ninth Army 1914; Chief of the General Staff 16 May 1917; Doullens 26 Mar 1918, supreme command; marshal 6 Aug 1918; accepted the armistice at Compiègne; son Germain killed Aug 1914 (en.wikipedia Ferdinand Foch)",
  },
  {
    id: "fra_petain",
    tag: "FRA",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["fra_foch"],
    allies: [],
    fame: 4,
    source:
      "b. 24 Apr 1856; Second Army at Verdun Feb 1916; commander in chief May 1917; rest, leave, moderate discipline after the mutinies, 3,400 courts-martial, 554 death sentences, most commuted; 'I am waiting for the tanks and the Americans' (en.wikipedia Philippe Pétain, WWI only)",
  },
  {
    id: "ita_salandra",
    tag: "ITA",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["cold", "cunning"],
    rivals: ["ita_giolitti"],
    allies: ["ita_sonnino"],
    fame: 3,
    source:
      "Prime minister Mar 1914-Jun 1916; 'sacred egoism' phrase Oct 1914; offered resignation 13 May 1915, not accepted (en.wikipedia Giovanni Giolitti; phrase and dates of office from memory)",
  },
  {
    id: "ita_sonnino",
    tag: "ITA",
    office: null,
    fit: [],
    camps: ["hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["ita_giolitti"],
    allies: ["ita_salandra"],
    fame: 3,
    source:
      "b. 11 Mar 1847, Pisa; Welsh mother; foreign minister 5 Nov 1914-23 Jun 1919; approved the Treaty of London Apr 1915, left Fiume out (en.wikipedia Sidney Sonnino)",
  },
  {
    id: "ita_giolitti",
    tag: "ITA",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["weary", "cunning"],
    rivals: ["ita_salandra", "ita_sonnino"],
    allies: [],
    fame: 4,
    source:
      "b. 27 Oct 1842, Mondovì; neutralist, thought Italy unprepared; held the parliamentary majority; refused to succeed Salandra May 1915; retired to Cavour 18 May (en.wikipedia Giovanni Giolitti)",
  },
  {
    id: "ita_cadorna",
    tag: "ITA",
    office: null,
    fit: [],
    camps: ["military", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["ita_salandra"],
    allies: [],
    fame: 3,
    source:
      "b. 4 Sep 1850; chief of staff 27 Jul 1914-Nov 1917; Isonzo battles, Gorizia Aug 1916; Caporetto from 24 Oct 1917, about 275,000 captured; removed Nov 1917 (en.wikipedia Luigi Cadorna). Discipline only as record text",
  },
  {
    id: "vat_benedict",
    tag: "ITA",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["weary", "stubborn"],
    rivals: [],
    allies: [],
    fame: 4,
    source:
      "Giacomo della Chiesa, b. 21 Nov 1854, Genoa; elected 3 Sep 1914; peace note 1 Aug 1917, seven points; prisoner exchanges from Nov 1914, Opera dei Prigionieri, about 600,000 pieces of correspondence (en.wikipedia Pope Benedict XV). Tagged ITA only because GW_TAGS has no Holy See: scenes cast him by name",
  },
  {
    id: "ott_talat",
    tag: "OTT",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cunning", "cold"],
    rivals: ["ott_cemal"],
    allies: ["ott_enver"],
    fame: 4,
    source:
      "b. 1 Sep 1874, Kırcaali; postal telegraph clerk; interior minister 12 Jun 1913-8 Oct 1918; grand vizier 4 Feb 1917-8 Oct 1918; fled 2-3 Nov 1918 (en.wikipedia Talaat Pasha). The Armenian genocide appears only as neutral record text under design 15 no. 2",
  },
  {
    id: "ott_cemal",
    tag: "OTT",
    office: null,
    fit: [],
    camps: ["military", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["ott_talat"],
    allies: [],
    fame: 3,
    source:
      "Navy minister from 1914, Fourth Army in Syria; Suez attack Feb 1915; approach to the Entente Dec 1915 (memory, the last disputed)",
  },
  {
    id: "ott_hussein",
    tag: "OTT",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "stubborn"],
    rivals: ["ott_enver"],
    allies: [],
    fame: 3,
    source:
      "b. about 1853; Sharif of Mecca from Nov 1908; McMahon correspondence 14 Jul 1915-10 Mar 1916; revolt 10 Jun 1916, king of the Arab lands by his own title (en.wikipedia Hussein bin Ali)",
  },
  {
    id: "usa_wilson",
    tag: "USA",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["stubborn", "cold"],
    rivals: ["usa_bryan"],
    allies: ["usa_house"],
    fame: 5,
    source:
      "b. 28 Dec 1856, Staunton; Ellen Wilson d. 1914; married Edith Bolling 1915; 'He kept us out of war' 1916; asked for war Apr 1917 (en.wikipedia Woodrow Wilson). 'Peace without victory' 22 Jan 1917 and the Fourteen Points 8 Jan 1918 (memory)",
  },
  {
    id: "usa_house",
    tag: "USA",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["cunning", "weary"],
    rivals: ["usa_bryan"],
    allies: ["usa_wilson"],
    fame: 3,
    source:
      "b. 26 Jul 1858, Houston; Wilson's unofficial agent in Europe 1915-1916; assembled the Inquiry; armistice details Oct 1918 (en.wikipedia Edward M. House). House-Grey memorandum Feb 1916, Berlin visits (memory)",
  },
  {
    id: "usa_bryan",
    tag: "USA",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["stubborn", "anxious"],
    rivals: ["usa_lansing"],
    allies: [],
    fame: 2,
    source:
      "Secretary of State to Jun 1915, resigned over the Lusitania note (memory)",
  },
  {
    id: "usa_lansing",
    tag: "USA",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["cold", "cunning"],
    rivals: ["usa_bryan"],
    allies: ["usa_wilson"],
    fame: 2,
    source:
      "Counselor, then Secretary of State Jun 1915-1920; pro-Entente neutrality (memory)",
  },
  {
    id: "usa_pershing",
    tag: "USA",
    office: null,
    fit: [],
    camps: ["military", "west", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["fra_foch"],
    allies: ["usa_wilson"],
    fame: 3,
    source:
      "AEF commander from May 1917; refused to feed Americans piecemeal into Allied armies (memory)",
  },
  {
    id: "srb_pasic",
    tag: "SRB",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cunning", "stubborn"],
    rivals: ["srb_apis"],
    allies: ["rus_nicholas"],
    fame: 4,
    source:
      "b. 18 Dec 1845, Zaječar; prime minister from 1912 through the war; Corfu Declaration 1917; historians differ on what he knew of the plot (en.wikipedia Nikola Pašić)",
  },
  {
    id: "srb_apis",
    tag: "SRB",
    office: null,
    fit: [],
    camps: ["military", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["srb_pasic", "srb_alexander"],
    allies: [],
    fame: 3,
    source:
      "Dragutin Dimitrijević, b. Aug 1876, Belgrade; leader of Unification or Death; court-martial at Salonika spring 1917, executed 26 Jun 1917 (en.wikipedia Dragutin Dimitrijević)",
  },
  {
    id: "srb_alexander",
    tag: "SRB",
    office: null,
    fit: [],
    camps: ["military", "moderate"],
    temperaments: ["cold", "cunning"],
    rivals: ["srb_apis"],
    allies: ["srb_pasic"],
    fame: 2,
    source:
      "Regent of Serbia from Jun 1914; the retreat of 1915; Corfu; Salonika trial (memory)",
  },
  {
    id: "rou_bratianu",
    tag: "ROU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "cold"],
    rivals: ["bgr_radoslavov"],
    allies: ["rou_marie"],
    fame: 3,
    source:
      "b. 1 Sep 1864, Florica; prime minister Jan 1914-Jan 1918; neutrality, entry tied to Romanian-majority lands; war Aug 1916; government to Iași; peace of May 1918 denounced Oct (en.wikipedia Ion I. C. Brătianu)",
  },
  {
    id: "rou_marie",
    tag: "ROU",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["stubborn", "arrogant"],
    rivals: ["bgr_ferdinand"],
    allies: ["rou_bratianu"],
    fame: 3,
    source:
      "b. 29 Oct 1875, Kent; granddaughter of Victoria and of Alexander II; pressed for the Entente; nursed at Iași from Dec 1916 (en.wikipedia Marie of Romania)",
  },
  {
    id: "bgr_ferdinand",
    tag: "BGR",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["rou_marie"],
    allies: ["bgr_radoslavov"],
    fame: 3,
    source:
      "b. 26 Feb 1861, Vienna; tsar from 1908; treaty with Germany and Austria-Hungary, attacked Serbia 11 Oct 1915; abdicated 3 Oct 1918 (en.wikipedia Ferdinand I of Bulgaria). His love of locomotives and plants (memory)",
  },
  {
    id: "bgr_radoslavov",
    tag: "BGR",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cold", "cunning"],
    rivals: ["rou_bratianu"],
    allies: ["bgr_ferdinand"],
    fame: 2,
    source:
      "b. 27 Jul 1854, Lovech; prime minister 17 Jul 1913-21 Jun 1918; German and Austrian loan Jul 1914 (en.wikipedia Vasil Radoslavov)",
  },
  {
    id: "grc_venizelos",
    tag: "GRC",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "stubborn"],
    rivals: ["grc_constantine"],
    allies: [],
    fame: 4,
    source:
      "b. 23 Aug 1864, Crete; pro-Allied; National Schism; provisional government at Thessaloniki 27 Sep 1916-14 Jun 1917; prime minister again under Alexander (en.wikipedia Eleftherios Venizelos)",
  },
  {
    id: "grc_constantine",
    tag: "GRC",
    office: null,
    fit: [],
    camps: ["military", "moderate"],
    temperaments: ["stubborn", "cold"],
    rivals: ["grc_venizelos"],
    allies: [],
    fame: 3,
    source:
      "b. 2 Aug 1868, Athens; wife Sophia, the Kaiser's sister; refused to join Germany, blocked Venizelos; left 11 Jun 1917, Alexander succeeded (en.wikipedia Constantine I of Greece)",
  },
  {
    id: "jpn_kato",
    tag: "JPN",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 3 Jan 1860; ambassador in London 1908-1912; foreign minister Apr 1914-Aug 1915, pushed entry in 1914; Twenty-One Demands Jan 1915 (en.wikipedia Katō Takaaki)",
  },
  {
    id: "esp_alfonso",
    tag: "ESP",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["weary", "cunning"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "b. 17 May 1886, Madrid; Spain neutral; office for prisoners in the Royal Palace; gravely ill in the 1918 flu (en.wikipedia Alfonso XIII)",
  },
  {
    id: "dnk_andersen",
    tag: "DNK",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "weary"],
    rivals: [],
    allies: ["deu_ballin"],
    fame: 1,
    source:
      "b. 10 Sep 1852, Nakskov; founded the East Asiatic Company 1897; sent to several capitals to seek an end to the war, German authorities had proposed it, cousin kings in mind (en.wikipedia Hans Niels Andersen). Link to Ballin confirmed by the 1914 people share",
  },
  {
    id: "che_ador",
    tag: "CHE",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["stubborn", "weary"],
    rivals: [],
    allies: [],
    fame: 2,
    source:
      "Gustave Ador, president of the International Committee of the Red Cross from 1910; Prisoners of War Agency at Geneva 1914; Federal Council 1917 after the Grimm-Hoffmann affair (memory)",
  },
];

/** How each talks, as GW_VOICE_NOTES. */
export const GW_VOICE_NOTES_COMMON: Readonly<Record<string, string>> = {
  fra_poincare:
    "변호사의 정밀한 말. 서류의 날짜를 틀리지 않는다. 감정을 안 보이려 애쓰고, 알자스 얘기에서만 낮아진다.",
  fra_briand:
    "첼로 같은 목소리, 서류 없는 연설. 약속처럼 들리는데 약속이 아니다.",
  fra_clemenceau:
    "독설. 짧은 문장에 이름을 찍어 찌른다. 나이를 농담으로 쓴다. 타협이라는 말을 쓰레기 치우듯 한다.",
  fra_joffre:
    "말이 적다. 끄덕이고 다음 안건으로 간다. 공세라는 단어를 날씨처럼 말한다.",
  fra_foch:
    "손을 흔들며 짧은 말을 던지고 문장을 안 끝낸다. '공격!'이 답인 질문이 많다.",
  fra_petain:
    "비관을 정확한 문장으로 적는다. 웃지 않는다. 병사의 편지를 읽은 사람의 말.",
  ita_salandra:
    "교수의 말. 이익을 신성한 말처럼 쓴다. 대답을 다음 주로 미룬다.",
  ita_sonnino: "조항 번호로 말한다. 웃음이 없다. 한 번 부른 값을 안 내린다.",
  ita_giolitti:
    "피에몬테 관리의 마른 말. 표 계산으로 답한다. 군중을 숫자로 안 친다.",
  ita_cadorna: "교범을 읽는 말. 패배는 후방 탓이다. 내각에는 통보만 한다.",
  vat_benedict:
    "교서의 말. '쓸데없는 살육'을 말할 때만 어조가 올라간다. 편을 들지 않는 것 자체로 양쪽의 미움을 받는다.",
  ott_talat:
    "전신 기사처럼 요점만. 웃는 얼굴로 말한다. 약속을 두 개로 갈라서 준다.",
  ott_cemal: "장교의 허세. 파리 얘기를 한다. 큰 소리 뒤에 계산이 있다.",
  ott_hussein: "예의 바른 시구로 시작해 땅의 경계를 줄로 그어 달라고 한다.",
  usa_wilson: "교실의 말. 원칙을 번호로 매긴다. 상대를 학생으로 대한다.",
  usa_house:
    "낮은 목소리의 친구. 상대가 듣고 싶은 말을 먼저 한다. 돌아가서 다르게 보고한다.",
  usa_bryan: "천막 집회의 설교. 양쪽에 똑같이 엄하자고 한다.",
  usa_lansing: "법률 의견서의 말. 각주로 사람을 찌른다.",
  usa_pershing: "변경 군인의 말. 안 된다는 말을 세 번 같은 어조로 한다.",
  srb_pasic:
    "말끝을 흐린다. '내일 봅시다'가 답이다. 듣는 쪽이 지쳐서 양보한다.",
  srb_apis: "큰 몸, 조용한 말. 비밀을 비밀로 말하지 않는다.",
  srb_alexander: "짧고 조심스러운 궁정 말. 러시아어를 섞는다.",
  rou_bratianu:
    "프랑스어로 생각하는 사람의 정중함. 지도 위 땅을 손가락으로 천천히 짚는다.",
  rou_marie: "편지의 말. 친척을 애칭으로 부르고 대포를 달라고 쓴다.",
  bgr_ferdinand: "곤충학자의 시선으로 대사를 관찰한다. 비꼬는 프랑스어.",
  bgr_radoslavov: "재판정의 말. 차관 금액과 마케도니아 지명을 번갈아 말한다.",
  grc_venizelos:
    "열정적인 변호사. 안경 뒤에서 웃으며 나라의 지도를 다시 그린다.",
  grc_constantine: "장군의 짧은 말. 그리스는 그리스 편이라고 한다.",
  jpn_kato: "영국식 절제 뒤의 요구서. 조항이 스물한 개다.",
  esp_alfonso:
    "친절한 왕의 편지. 어느 편 얘기도 안 한다. 이름 하나를 찾아 주겠다고 한다.",
  dnk_andersen: "친절한 뱃사람. 값을 말하지 않고 날씨를 말한다.",
  che_ador: "칼뱅의 도시 사람. 숫자와 이름만 적는다.",
};
