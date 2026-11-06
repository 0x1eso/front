import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * The Austro-Hungarian cast. The seat is the Emperor, so he is nobody here.
 * Conrad and Hoyos are in people.ts (written for the German build) and count
 * among the sixteen who get six talks each: see AUH_PRINCIPALS. The rest are
 * successors, voices and rare doors: they hold office and come as visits.
 *
 * Offices: `chancellor` is the Austrian minister-president, `hun_pm` the
 * Hungarian one, `finance` the joint finance minister (who also ran Bosnia),
 * `court` the head of the Military Chancellery. `foreign`, `war`, `navy` and
 * `chief_of_staff` are the joint ones. Nobody holds `interior`: the empire had
 * no joint one, and a scene must not cast it for this seat.
 *
 * Third camp axis: `magyar` (Budapest's side), `dynasty` (Vienna and the
 * house), `nations` (speaks for a people of the empire). `east`/`west` is the
 * soldier's axis: `east` Galicia, `west` the Balkans and Italy.
 *
 * `rivals` and `allies` only name people who exist at this commit. Order
 * matters to the seed rolls (Roll.ts walks the list by index): append.
 * `source`: "(memory)" marks facts not checked against a page.
 */
export const AUH_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "auh_berchtold",
    tag: "AUH",
    office: "foreign",
    fit: ["foreign", "court"],
    camps: ["civil", "hard", "dynasty"],
    temperaments: ["weary", "anxious", "cunning"],
    rivals: ["auh_tisza"],
    allies: ["auh_hoyos", "auh_krobatin"],
    fame: 4,
    source:
      "b. 18 Apr 1863, d. 21 Nov 1942; ambassador to Russia 1906-1911; foreign minister 17 Feb 1912-13 Jan 1915, appointed against his wishes; sent Hoyos 5 Jul; forced out by Tisza and Conrad over offers to Italy; steward to Archduke Karl Mar 1916; very rich, charming, called indecisive (en.wikipedia Leopold Berchtold). Racing stable (memory)",
  },
  {
    id: "auh_tisza",
    tag: "AUH",
    office: "hun_pm",
    fit: ["hun_pm"],
    camps: ["civil", "moderate", "magyar"],
    temperaments: ["stubborn", "cold", "arrogant"],
    rivals: ["auh_karolyi", "auh_ff", "auh_berchtold"],
    allies: ["auh_burian"],
    fame: 5,
    source:
      "b. 22 Apr 1861, Calvinist; PM 1903-1905 and Jun 1913-Jun 1917; alone against the attack at the 7 Jul council, came round by 14 Jul; demands before mobilisation, no annexation; resigned May 1917 against wider suffrage; hussar colonel on the Italian front; sabre duel with Károlyi Jan 1913; shot in his villa 31 Oct 1918 (en.wikipedia István Tisza; ww1.habsburger.net)",
  },
  {
    id: "auh_sturgkh",
    tag: "AUH",
    office: "chancellor",
    fit: ["chancellor"],
    camps: ["civil", "hard", "dynasty"],
    temperaments: ["cold", "stubborn"],
    rivals: ["auh_adler", "auh_kramar"],
    allies: ["auh_berchtold"],
    fame: 2,
    source:
      "b. 30 Oct 1859, Graz; Austrian minister-president 3 Nov 1911 to his death; closed the Reichsrat 16 Mar 1914 and ruled by decree, censorship after the declaration of war; shot at lunch at Meissl & Schadn by Friedrich Adler 21 Oct 1916 (en.wikipedia Karl von Stürgkh). Paragraph 14 as the name of the decree power; the alliance with Berchtold is inference (memory)",
  },
  {
    id: "auh_krobatin",
    tag: "AUH",
    office: "war",
    fit: ["war"],
    camps: ["military", "hard", "dynasty"],
    temperaments: ["cold", "stubborn"],
    rivals: ["auh_tisza"],
    allies: ["auh_conrad", "auh_berchtold"],
    fame: 2,
    source:
      "b. 12 Sep 1849, Olmütz; artillery academy, taught chemistry, munitions expert; war minister 12 Dec 1912-Apr 1917; of the war party in July 1914; Tenth Army 1917, the Tyrol sector Oct 1918 (en.wikipedia Alexander von Krobatin). Rivalry with Tisza is inference from the budget",
  },
  {
    id: "auh_bilinski",
    tag: "AUH",
    office: "finance",
    fit: ["finance"],
    camps: ["civil", "moderate", "nations"],
    temperaments: ["cunning", "weary"],
    rivals: ["auh_potiorek", "auh_tisza"],
    allies: ["auh_pilsudski"],
    fame: 2,
    source:
      "b. 15 Jun 1846, Zalishchyky, a Galician Pole; Austrian finance minister twice; bank governor 1900-1909; joint finance minister and head of Bosnia 1912-1915; president of the Supreme National Committee 1914-1917 and Polish finance minister 1919 (en.wikipedia Leon Biliński, the committee marked citation needed). Koerber follows him 7 Feb 1915 (en.wikipedia Ernest von Koerber). His quarrel with Potiorek over Bosnia, and that Sarajevo's plans passed him by (memory)",
  },
  {
    id: "auh_burian",
    tag: "AUH",
    office: null,
    fit: ["foreign", "finance"],
    camps: ["civil", "hard", "magyar"],
    temperaments: ["stubborn", "cold"],
    rivals: ["auh_czernin", "auh_conrad"],
    allies: ["auh_tisza"],
    fame: 3,
    source:
      "b. 16 Jan 1851, Stomfa; consul in Sofia; joint finance minister 1903-1912; Hungary's minister by the King's person Jun 1913-Jan 1915, went between Berchtold and Tisza in July; foreign minister 13 Jan 1915-22 Dec 1916 and Apr-Oct 1918; joint finance between; Tisza's man; legalistic, doctrinaire; the note to Wilson 5 Oct 1918 (en.wikipedia Stephan Burián von Rajecz)",
  },
  {
    id: "auh_czernin",
    tag: "AUH",
    office: null,
    fit: ["foreign"],
    camps: ["civil", "moderate", "dynasty"],
    temperaments: ["anxious", "arrogant", "cunning"],
    rivals: ["auh_burian", "auh_tisza"],
    allies: ["auh_ff", "auh_karl"],
    fame: 3,
    source:
      "b. 26 Sep 1872, Dymokury; of the Belvedere circle; minister in Bucharest Oct 1913-Aug 1916; foreign minister 23 Dec 1916-14 Apr 1918; the Ukraine treaty 9 Feb 1918, Chełm given up; the Clemenceau speech and the Sixtus letter; imaginative, volatile, near breakdown at the end (en.wikipedia Ottokar Czernin; Sixtus Affair)",
  },
  {
    id: "auh_karl",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["military", "moderate", "dynasty"],
    temperaments: ["anxious", "stubborn"],
    rivals: ["auh_conrad", "auh_tisza"],
    allies: ["auh_zita", "auh_arz"],
    fame: 4,
    source:
      "b. 17 Aug 1887, Persenbeug; heir after Sarajevo; at Teschen without influence, XX Corps 1916, an army group in the east; emperor 21 Nov 1916; supreme command 2 Dec 1916; crowned at Budapest 30 Dec; devout, affable (en.wikipedia Charles I of Austria). Franz Joseph's great-nephew (memory). The person is the heir: once he takes the throne he is the seat and leaves the list",
  },
  {
    id: "auh_zita",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["moderate", "dynasty"],
    temperaments: ["stubborn", "cold"],
    rivals: ["auh_czernin"],
    allies: ["auh_karl"],
    fame: 3,
    source:
      "b. 9 May 1892, Pianore; married Karl 21 Oct 1911; brothers Sixtus and Xavier in the Belgian army, Felix and René in the Austrian; distrusted as Italian from 1915; invited Sixtus 1917; at Eckartsau refused the word abdication (en.wikipedia Zita of Bourbon-Parma). Rivalry with Czernin is inference from his fall",
  },
  {
    id: "auh_boroevic",
    tag: "AUH",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard", "dynasty"],
    temperaments: ["cold", "stubborn", "arrogant"],
    rivals: ["auh_conrad"],
    allies: [],
    fame: 4,
    source:
      "b. 13 Dec 1856, Umetić, Military Frontier, Orthodox family, called himself a Croat; VI Corps then Third Army 1 Sep 1914; relieved Przemyśl Oct 1914; Isonzo from 25 May 1915; army group Aug 1917; field marshal 1 Feb 1918; the Piave; offered to march on Vienna Nov 1918, refused (en.wikipedia Svetozar Boroević). Rivalry with Conrad (memory)",
  },
  {
    id: "auh_bolfras",
    tag: "AUH",
    office: "court",
    fit: ["court"],
    camps: ["military", "moderate", "dynasty"],
    temperaments: ["cold", "weary"],
    rivals: ["auh_ff"],
    allies: ["auh_conrad"],
    fame: 2,
    source:
      "b. 16 Apr 1838, Frankfurt; head of the Military Chancellery and adjutant general 1889-Jan 1917; proposed names for the high posts; every paper of the War Ministry and the high command passed through him; Franz Ferdinand worked against him (de.wikipedia Arthur von Bolfras). Conrad's letters to him through the war (memory)",
  },
  {
    id: "auh_kramar",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["civil", "hard", "nations"],
    temperaments: ["stubborn", "arrogant"],
    rivals: ["auh_sturgkh", "auh_tisza"],
    allies: ["auh_korosec"],
    fame: 3,
    source:
      "b. 27 Dec 1860; led the Young Czechs; Neo-Slav, Russian wife, villa in Crimea; charged with treason 21 May 1915; sentenced 3 Jun 1916, the page gives death and also fifteen years; freed by Karl's amnesty 1917; Czechoslovak premier 14 Nov 1918 (en.wikipedia Karel Kramář). The alliance with Korošec is inference from 1917",
  },
  {
    id: "auh_karolyi",
    tag: "AUH",
    office: null,
    fit: ["hun_pm"],
    camps: ["civil", "moderate", "magyar"],
    temperaments: ["stubborn", "anxious", "arrogant"],
    rivals: ["auh_tisza"],
    allies: [],
    fame: 3,
    source:
      "b. 4 Mar 1875; one of Hungary's richest houses; cleft palate, a speech trouble in childhood; Party of Independence, own party 1916; against the German alliance, for the Entente; held in France at the outbreak; hussar volunteer 1915; lost the sabre duel to Tisza Jan 1913; married Katalin Andrássy 7 Nov 1914; National Council 25 Oct 1918, premier 31 Oct (en.wikipedia Mihály Károlyi)",
  },
  {
    id: "auh_adler",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["weary", "stubborn"],
    rivals: ["auh_sturgkh"],
    allies: [],
    fame: 3,
    source:
      "b. 24 Jun 1852, Prague; physician, neurologist; founded the Social Democrats at Hainfeld 1888-1889, chairman to Nov 1918; backed the war in public with private misgivings; his son Friedrich shot Stürgkh; foreign minister 30 Oct 1918; d. 11 Nov 1918 (en.wikipedia Victor Adler). Friedrich on the party's left (memory). The party's part in ending the January strike, the Workers' Council and the party proposal (dynamic-rsnz.natlib.govt.nz, Dominion 23 Jan 1918 and en.wikipedia Austro-Hungarian strike of January 1918, as summarised by a search)",
  },
  // The second row: successors, commanders, rare doors. Visits and voices.
  {
    id: "auh_ff",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["military", "moderate", "dynasty"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["auh_tisza", "auh_bolfras", "auh_montenuovo"],
    allies: ["auh_czernin", "auh_clam"],
    fame: 5,
    source:
      "b. 18 Dec 1863, Graz; against the Hungarians and against war with Serbia, letter to Berchtold Feb 1913; morganatic marriage 1 Jul 1900; buried at Artstetten 4 Jul 1914 (en.wikipedia Archduke Franz Ferdinand). Belvedere office under Brosch; the 1911 succession programme: reform at the accession, before the Hungarian oath; Popovici's 1906 fifteen states (search: encyclopedia.com, ww1.habsburger.net, bigthink). Reigning as Franz II (memory). In play only where the opening leaves him alive",
  },
  {
    id: "auh_montenuovo",
    tag: "AUH",
    office: null,
    fit: ["court"],
    camps: ["civil", "hard", "dynasty"],
    temperaments: ["cold", "stubborn"],
    rivals: ["auh_ff"],
    allies: ["auh_bolfras"],
    fame: 2,
    source:
      "b. 16 Sep 1854; descends from Marie-Louise by Neipperg; first Obersthofmeister 1909-Feb 1917; enemy of Franz Ferdinand; Sophie's coffin set a step lower, fan and gloves, two hours in the chapel, Artstetten after dark; dismissed by Karl (de.wikipedia Alfred von Montenuovo). Holds no office in the game's list: `court` is Bolfras; a scene casts him by name",
  },
  {
    id: "auh_haus",
    tag: "AUH",
    office: "navy",
    fit: ["navy"],
    camps: ["military", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["auh_conrad"],
    allies: ["auh_horthy"],
    fame: 2,
    source:
      "b. 13 Jun 1851, Tolmein; navy commander from 24 Feb 1913, fleet commander 1914, grand admiral 1916; fleet in being against German criticism; Ancona May 1915; for unrestricted U-boats; d. Feb 1917 of pneumonia (en.wikipedia Anton Haus). Quarrel with Conrad over the fleet (memory)",
  },
  {
    id: "auh_horthy",
    tag: "AUH",
    office: null,
    fit: ["navy"],
    camps: ["military", "hard", "magyar"],
    temperaments: ["arrogant", "cold"],
    rivals: ["auh_karolyi"],
    allies: ["auh_haus"],
    fame: 3,
    source:
      "Fleet commander after the Cattaro mutiny Feb-Mar 1918 (en.wikipedia Maximilian Njegovan, Cattaro Mutiny). Aide to Franz Joseph 1909-1914, the Otranto raid May 1917, the Calvinist Hungarian gentry (memory). Njegovan, between Haus and him, is left to the prose",
  },
  {
    id: "auh_arz",
    tag: "AUH",
    office: null,
    fit: ["chief_of_staff", "war"],
    camps: ["military", "east", "moderate", "dynasty"],
    temperaments: ["cold", "weary"],
    rivals: ["auh_conrad"],
    allies: ["auh_karl"],
    fame: 2,
    source:
      "b. 16 Jun 1857, Hermannstadt, a Transylvanian Saxon; VI Corps Sep 1914; First Army for Romania Aug 1916; chief of staff 1 Mar 1917-3 Nov 1918; non-political, an adviser rather than a driver; refused the supreme command Karl wrote him 2-3 Nov 1918 (en.wikipedia Arthur Arz von Straussenburg)",
  },
  {
    id: "auh_koerber",
    tag: "AUH",
    office: null,
    fit: ["chancellor", "finance"],
    camps: ["civil", "moderate", "dynasty"],
    temperaments: ["stubborn", "cold"],
    rivals: ["auh_tisza"],
    allies: [],
    fame: 2,
    source:
      "b. 6 Nov 1850, Trento; premier 1900-1904; joint finance minister 7 Feb 1915-28 Oct 1916; premier 29 Oct-Dec 1916; clashed with Karl over calling parliament early and over concessions to Hungary in the Compromise (en.wikipedia Ernest von Koerber)",
  },
  {
    id: "auh_clam",
    tag: "AUH",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "moderate", "dynasty"],
    temperaments: ["weary", "cold"],
    rivals: ["auh_tisza"],
    allies: ["auh_ff"],
    fame: 1,
    source:
      "b. 1 Jan 1863, Vienna; Austro-Bohemian high nobility, of Franz Ferdinand's inner circle; premier Dec 1916-Jun 1917; then military governor of Montenegro (en.wikipedia Heinrich Clam-Martinic; ww1.habsburger.net via The First World War and the End of the Habsburg Monarchy)",
  },
  {
    id: "auh_wekerle",
    tag: "AUH",
    office: null,
    fit: ["hun_pm"],
    camps: ["civil", "moderate", "magyar"],
    temperaments: ["weary", "cunning"],
    rivals: ["auh_tisza"],
    allies: [],
    fame: 1,
    source:
      "b. 14 Nov 1848, Mór, son of an estate manager, Danube Swabian; first commoner premier of Hungary; three terms, the last 20 Aug 1917-Oct 1918, a figurehead for stronger men; moved late towards a wider franchise (en.wikipedia Sándor Wekerle). Esterházy, Jun-Aug 1917, is left to the prose",
  },
  {
    id: "auh_andrassy",
    tag: "AUH",
    office: null,
    fit: ["foreign", "hun_pm"],
    camps: ["civil", "moderate", "magyar"],
    temperaments: ["cold", "weary"],
    rivals: ["auh_tisza"],
    allies: [],
    fame: 2,
    source:
      "b. 30 Jun 1860; interior minister 1906-1910; led the coalition that brought down Tisza 1905; urged peace and a wider franchise 1915; last joint foreign minister 24 Oct-2 Nov 1918, declared the German alliance dissolved (en.wikipedia Gyula Andrássy the Younger). Son of the foreign minister of 1871 (memory)",
  },
  {
    id: "auh_lammasch",
    tag: "AUH",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "moderate"],
    temperaments: ["stubborn", "weary"],
    rivals: ["auh_czernin"],
    allies: [],
    fame: 2,
    source:
      "b. 21 May 1853, Seitenstetten; professor of criminal and international law; The Hague 1899 and 1907, arbitration court; House of Lords 1899; urged a separate peace Jul 1917, Czernin turned him down; last premier 27 Oct-11 Nov 1918 (en.wikipedia Heinrich Lammasch)",
  },
  {
    id: "auh_friedrich",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["military", "east", "hard", "dynasty"],
    temperaments: ["weary", "stubborn"],
    rivals: ["auh_karl"],
    allies: ["auh_conrad"],
    fame: 2,
    source:
      "b. 4 Jun 1856; supreme commander from 11 Jul 1914; left the command to Conrad, ceremonial and a go-between; Karl took the command 2 Dec 1916 (the page's text says 1917); Albrecht's estates and the Albertina (en.wikipedia Archduke Friedrich, Duke of Teschen). His rivalry with Karl is inference from that",
  },
  {
    id: "auh_potiorek",
    tag: "AUH",
    office: null,
    fit: ["chief_of_staff", "war"],
    camps: ["military", "west", "hard", "dynasty"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["auh_conrad", "auh_bilinski"],
    allies: [],
    fame: 2,
    source:
      "b. 20 Nov 1853, Bad Bleiberg; governor of Bosnia 10 May 1911-22 Dec 1914; in the third car on 28 Jun, 'I will take responsibility'; the 1914 Serbian campaign, Cer and Kolubara; removed 22 Dec 1914; rivalry with Conrad since 1906 hurt the campaign (en.wikipedia Oskar Potiorek). Rides as `west` commander until the Serbian failure retires him",
  },
  {
    id: "auh_korosec",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["civil", "moderate", "nations"],
    temperaments: ["cunning", "stubborn"],
    rivals: ["auh_tisza"],
    allies: ["auh_kramar"],
    fame: 2,
    source:
      "b. 1872, Styria; Catholic priest, doctor of theology, orator; Slovene People's Party; Reichsrat from 1907; read the May Declaration 30 May 1917; president of the National Council Oct 1918 (en.wikipedia Anton Korošec). The Yugoslav Club (memory)",
  },
  {
    id: "auh_landwehr",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["military", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["auh_tisza"],
    allies: [],
    fame: 1,
    source:
      "Ottokar Landwehr von Pragenau, major general; chairman of the joint food committee to the war's end; at the council of 24 Sep 1917; memoir Hunger, 1931 (Austrian ministerial council protocols, hw.oeaw.ac.at oe_hu_mrp_VII z30; Cambridge chapter citing him; Foreign Affairs review). The committee's weak powers (same chapter). Rivalry with Tisza is inference",
  },
  {
    id: "auh_wilhelm",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["military", "nations"],
    temperaments: ["arrogant", "anxious"],
    rivals: ["auh_pilsudski"],
    allies: ["auh_karl"],
    fame: 1,
    source:
      "Archduke Wilhelm, b. 10 Feb 1895, Lošinj; took a Ukrainian name and shirt, 'Vasyl Vyshyvanyi'; battle group of about 4,000 Sich Riflemen in southern Ukraine 1918; officers spoke of him as ruler, Karl refused for fear of Germany; recalled Oct 1918; his father Karl Stephan a Polish patriot (en.wikipedia Archduke Wilhelm of Austria). Rivalry with Piłsudski is inference from Polish against Ukrainian",
  },
  {
    id: "auh_pilsudski",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["military", "hard", "nations"],
    temperaments: ["stubborn", "cunning"],
    rivals: ["auh_wilhelm", "auh_conrad"],
    allies: ["auh_bilinski"],
    fame: 3,
    source:
      "First Cadre Company 3 Aug 1914, Kielce 12 Aug; Legions in the Austrian army 27 Aug, First Brigade; stretched orders to the utmost, told the British he fought only Russia; demanded a guarantee after Kostiuchnówka 1916; forbade the oath Jul 1917, Magdeburg, released 8 Nov 1918 (en.wikipedia Józef Piłsudski). A Russian subject by birth, the riflemen's associations at Kraków (memory); kept in this list because he stands in Austrian ranks",
  },
];

/** The sixteen with six summons talks each (plan: ww135-plan-auh.md). */
export const AUH_PRINCIPALS: readonly string[] = [
  "auh_berchtold",
  "auh_hoyos",
  "auh_bilinski",
  "auh_sturgkh",
  "auh_conrad",
  "auh_krobatin",
  "auh_boroevic",
  "auh_bolfras",
  "auh_tisza",
  "auh_burian",
  "auh_kramar",
  "auh_adler",
  "auh_karl",
  "auh_zita",
  "auh_czernin",
  "auh_karolyi",
];

/** How each person talks. Conrad and Hoyos are in GW_VOICE_NOTES. */
export const AUH_VOICE_NOTES: Readonly<Record<string, string>> = {
  auh_berchtold:
    "돈 많고 예의 바른 귀족. 부드럽고 잘 다듬은 문장으로 남의 강경한 말을 옮긴다. 결론을 말한 뒤 '폐하의 뜻대로'를 붙인다. 이 자리를 원한 적 없다는 말이 가끔 샌다. 말과 사냥철 얘기로 숨을 고른다.",
  auh_tisza:
    "칼뱅파 신자의 목소리. 낮고 곧고 굽지 않는다. 헌법 조문과 성경 구절을 같은 어조로 쓴다. 반대할 때 협박하지 않고 사실을 적는다. 한번 동의하면 누구보다 끝까지 간다. 칼을 쥐어 본 사람의 짧은 웃음.",
  auh_sturgkh:
    "법령으로 나라를 돌리는 관리. 의회라는 말을 날씨 얘기처럼 한다. '당분간'이 입에 붙었다. 낮고 지친 목소리에 조항 번호를 달아 말한다. 사람 이름보다 부처 이름을 먼저 댄다.",
  auh_krobatin:
    "포병이자 화학 교관 출신. 수량, 구경, 납기로 말한다. 정치는 남의 일이라는 얼굴로 전쟁을 지지한다. 예산이 깎였다는 말을 절대 빼놓지 않는다. 질문을 받으면 표를 내민다.",
  auh_bilinski:
    "폴란드 신사이자 은행가. 정중하게 돌려 말하고 숫자를 안주 삼아 농을 한다. 보스니아 이야기에 '제가 들은 바 없습니다'가 자주 나온다. 빈에서 폴란드 몫을 잊지 않는다. 문서보다 사람을 먼저 읽는다.",
  auh_burian:
    "법률가 같은 외교관. 조약의 조항으로 시작해 조항으로 끝난다. 양보라는 말을 입에 올리지 않고, 올려도 값으로 부르지 않는다. 문장이 길고 고르며 재미가 없다. 티서의 이름이 말끝에 늘 있다.",
  auh_czernin:
    "빠르고 화려하고 금세 돌아서는 사람. 번뜩이는 말을 던지고 다음 날 뒤집는다. 전쟁을 끝내야 한다고 말하다가 베를린 앞에서 큰소리친다. 자기 신경을 자기가 먼저 걱정한다. 체코 귀족의 자존심.",
  auh_karl:
    "젊고 다정하고 서두른다. 군인들 얘기를 좋아하고, 누구 말이든 끝까지 듣고 고개를 끄덕인다. 하느님과 평화를 부끄럼 없이 말한다. 어제 약속을 잊지 않으나 어제 누구에게 했는지 헷갈린다. 황제를 '할아버님'처럼 어려워한다.",
  auh_zita:
    "조용하고 빠르고 틀림이 없다. 프랑스어 어순이 살짝 비치는 또렷한 말. 동생들 이름을 적진의 지명처럼 담담하게 댄다. 기도와 서류를 같은 책상에서 본다. 사람을 고칠 때 칭찬으로 시작하지 않는다.",
  auh_boroevic:
    "국경 수비대 집안의 장군. 험하고 짧다. 병사들의 양말, 산의 돌, 물 이야기를 한다. 전선에서 온 사람답게 사령부를 경멸한다. 민족을 묻는 질문에 '나는 황제의 군인이오'로 끝낸다.",
  auh_bolfras:
    "여든을 바라보는 군사 시종무관장. 낮고 가지런하다. 모든 서류를 읽었으나 절반만 말한다. 사람을 고르는 말을 '후보로 올릴 이름이 있습니다'로 꺼낸다. 폐하의 습관을 폐하보다 잘 안다.",
  auh_kramar:
    "프라하의 대변인. 학자의 긴 호흡에 웅변가의 끝맺음. 슬라브와 러시아를 말할 때 목소리가 커진다. 재판정에서도 법리로 싸운다. 왕조를 욕하지 않고, 왕조가 체코를 잊었다고 말한다.",
  auh_karolyi:
    "대지주의 얼굴을 한 반대파. 말을 고를 때 잠깐 멈춘다. 어린 시절에 말을 다시 배운 사람의 또박또박한 발음. 독일 동맹을 욕하고 프랑스를 그리워한다. 땅을 나눠 주겠다는 말을 진심으로 한다.",
  auh_adler:
    "늙은 의사. 환자를 보듯 나라를 본다. 맥박, 증상, 경과로 말한다. 낮은 유머. 당이 전쟁을 지지한 것을 변명하지 않고 아파한다. 아들 이야기가 나오면 의사의 말투가 깨진다.",
  auh_ff:
    "화를 삼키지 못하는 대공. 문장이 짧고 사람 이름에 욕이 붙는다. 헝가리 얘기에 얼굴이 먼저 붉어진다. 그러나 전쟁에는 뜻밖에 조심스럽다. 아내의 자리를 묻는 말에는 대답하지 않고 눈으로 재 본다.",
  auh_montenuovo:
    "규정집이 사람이 된 궁정 대신. 작은 소리로 선례를 말한다. '전례가 없습니다'가 칼이다. 감정이 없다는 평을 칭찬으로 듣는다. 누가 몇 번째 계단에 서는지를 외운다.",
  auh_haus:
    "늙은 제독. 함대는 있는 것만으로 일을 한다고 되풀이한다. 무모한 말에 바다의 날씨로 답한다. 독일 해군의 훈수를 비꼰다. 폴라 항의 석탄량을 외운다.",
  auh_horthy:
    "폐하의 옛 시종무관. 말쑥하고 공손하고 움직이고 싶어 안달이다. 바다를 사냥터처럼 말한다. 헝가리 귀족의 억양. 수병의 불만을 군기의 문제로만 듣는다.",
  auh_arz:
    "트란실바니아 작센 사람. 온화하고 정리가 빠르다. 황제의 말을 끊지 않고 뒤에서 조용히 고친다. 나쁜 소식을 나쁜 소식이라고 부른다. 큰 계획을 묻는 말에 먼저 철도와 식량을 묻는다.",
  auh_koerber:
    "제국의 마지막 행정가. 짧고 까다롭고 서류에 강하다. 헝가리와의 거래를 '이번에도 우리가 냅니다'로 요약한다. 젊은 황제를 가르치려 드는 버릇을 못 고친다. 트리엔트 출신이라 이탈리아를 잘 안다.",
  auh_clam:
    "보헤미아 대귀족. 벨베데레에서 배운 개혁의 말을 낮은 목소리로 한다. 양쪽을 다 달래다 지친다. 대공 이름을 꺼낼 때 잠깐 쉰다. 어느 쪽 민족 의원에게나 똑같이 공손하다.",
  auh_wekerle:
    "평민 출신의 노련한 재무가. 유쾌하고 미끄럽다. 어려운 말을 숫자로 돌리고 표결을 세어 준다. 누가 진짜 주인인지 안다는 웃음. 자기 내각이 오래 못 간다는 농담을 먼저 한다.",
  auh_andrassy:
    "이름이 곧 이력인 귀족. 아버지가 만든 체제를 지키는 사람의 침착함. 긴 시야로 말하고 끝에 평화를 붙인다. 티서의 이름을 예의 바르게 깎는다.",
  auh_lammasch:
    "국제법 교수. 강의하듯 또박또박 말한다. 헤이그의 사례를 들고, 전쟁을 끝내는 절차를 조항으로 적어 온다. 궁정이 어려운 줄 모르는 학자의 순진함과 고집.",
  auh_friedrich:
    "명목상 총사령관. 온화하고 대단히 공손하다. '참모총장께서 말씀하시기를'로 시작한다. 훈장과 시찰과 영지 이야기를 안다. 자기 처지를 아는 사람의 작은 농담.",
  auh_potiorek:
    "자기 지도만 믿는 장군. 말을 잘라 먹고 남의 잘못을 먼저 적는다. 콘라트의 이름에 턱이 굳는다. 6월 28일 이야기는 절대 먼저 꺼내지 않는다. 벌충을 원한다.",
  auh_korosec:
    "슬로베니아 사제이자 의원. 설교단의 차분함으로 강한 말을 한다. 황제에 대한 충성과 남슬라브 통합을 같은 문장에 넣는다. 교구의 빵값을 안다.",
  auh_landwehr:
    "곡물표를 들고 다니는 장군. 말끝마다 톤과 일수다. 빈에 며칠 분이 남았는지 외우고 있다. 부다페스트에 다녀올 때마다 말이 짧아진다. 굶주림을 감정 없이 보고한다.",
  auh_wilhelm:
    "수놓은 셔츠의 젊은 대공. 우크라이나 말을 일부러 쓴다. 꿈을 지도처럼 말한다. 사촌 황제에게 친구처럼 굴다가 금방 군인 말투로 돌아간다.",
  auh_pilsudski:
    "말없는 사령관. 콧수염 아래로 낮게 말한다. 충성을 맹세하지 않고 조건을 적는다. 러시아를 미워한다는 말밖에 믿게 하지 않는다. 오스트리아 장교들을 보는 눈이 차갑다.",
};
