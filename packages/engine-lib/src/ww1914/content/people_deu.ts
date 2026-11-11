import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * Germany from 1915: who arrives (plan /home/eser/dev/ww135-plan-deu.md). Names,
 * lean and bio are in resources/ww1914/ko/DEU.cast.json. `arrives` keeps them
 * off the people screen and the lists of successors until their day. Office
 * is null for all of them: they come in by `fit`, a vacancy or a scene.
 * Admirals carry no "military" camp, or People.armyCommander hands them a
 * land front. `source`: "(memory)" marks facts not checked against a page.
 *
 * Wild is not here: the 1914 lane put him in people.ts on w130-gw.
 *
 * Order matters to the seed rolls: append.
 */
export const GW_PEOPLE_DEU: readonly GwPersonDef[] = [
  {
    id: "deu_helfferich",
    tag: "DEU",
    office: null,
    fit: ["finance", "interior"],
    camps: ["civil", "moderate"],
    temperaments: ["arrogant", "cold"],
    rivals: ["deu_erzberger", "deu_tirpitz"],
    allies: ["deu_bethmann"],
    fame: 3,
    source:
      "b. 22 Jul 1872, Neustadt; Treasury 21 Jan 1915-22 May 1916; Interior and vice-chancellor 22 May 1916-23/24 Oct 1917; war paid by loans, not taxes, in hope of indemnities; the 1920 libel case with Erzberger (en.wikipedia Karl Helfferich). Deutsche Bank before office; argued against unrestricted U-boat war in 1916 (memory)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_groener",
    tag: "DEU",
    office: null,
    fit: ["chief_of_staff", "war"],
    camps: ["military", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["deu_ludendorff", "deu_bauer"],
    allies: ["deu_ebert"],
    fame: 2,
    source:
      "b. 22 Nov 1867, Ludwigsburg, Württemberg; head of the General Staff railway section 1914; food from Romania Dec 1915, War Food Office May 1916; Kriegsamt Nov 1916, deputy war minister; treated unions as partners; recalled Aug 1917; I Corps and Army Group Kiev in Ukraine 1918; First Quartermaster General 29 Oct 1918; pact with Ebert 10 Nov (en.wikipedia Wilhelm Groener). Son of an NCO paymaster (memory)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_bauer",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["military", "west", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["deu_falkenhayn", "deu_bethmann", "deu_groener"],
    allies: ["deu_ludendorff", "deu_heir"],
    fame: 1,
    source:
      "b. 31 Jan 1869, Quedlinburg; OHL operations, section II, heavy artillery; 42 cm mortars with Krupp, Pour le Mérite; against the Verdun plan, lobbied against Falkenhayn; set the Hindenburg Programme targets; lobbied against Bethmann with Ludendorff; friend of the Crown Prince from Fifth Army headquarters (en.wikipedia Max Bauer)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_rathenau",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cold", "anxious"],
    rivals: ["deu_bauer"],
    allies: ["deu_ballin"],
    fame: 3,
    source:
      "b. 29 Sep 1867, Berlin; War Raw Materials Department Aug 1914-Mar 1915; AEG president from Jun 1915 on his father's death; felt a second-class citizen as a Jew, a German of Jewish origin by his own 1918 words (en.wikipedia Walther Rathenau). His 1 Oct 1918 appeal for a levée en masse (memory). Rivalry with Bauer is inference",
    arrives: "1915-01-01",
  },
  {
    id: "deu_ballin",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["anxious", "weary"],
    rivals: ["deu_tirpitz"],
    allies: ["deu_rathenau", "deu_muller"],
    fame: 2,
    source:
      "b. 15 Aug 1857, Hamburg; HAPAG general director 1899; received at court, respected by the Kaiser; mediated in the 1912 Haldane Mission; urged U-boat blockade after Nov 1914 (en.wikipedia Albert Ballin). Later doubts about unrestricted war and loss of the Kaiser's ear (memory). Died 9 Nov 1918: never a scene's choice, record text only",
    arrives: "1915-01-01",
  },
  {
    id: "deu_erzberger",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "stubborn"],
    rivals: ["deu_helfferich", "deu_ludendorff", "deu_stresemann"],
    allies: ["deu_ebert"],
    fame: 3,
    source:
      "b. 20 Sep 1875, Buttenhausen, Württemberg; Centre Party; Sep 1914 memorandum for annexing Belgium and part of Lorraine; ran foreign propaganda, Catholic and Holy See channels; 6 Jul 1917 attack on the U-boat war, Peace Resolution 19 Jul, 212 to 126; headed the armistice delegation, signed 11 Nov 1918 (en.wikipedia Matthias Erzberger; Crisis of July 1917). Bauer's talk with him 10 Jun 1917 (one search summary, unchecked)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_ebert",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["stubborn", "weary", "cold"],
    rivals: ["deu_haase", "deu_liebknecht"],
    allies: ["deu_scheidemann", "deu_groener"],
    fame: 3,
    source:
      "b. 4 Feb 1871, Heidelberg; saddler; SPD joint chairman 20 Sep 1913 with Haase; sons Heinrich (Feb 1917, Macedonia) and Georg (May 1917, France) killed; joined the Berlin strike leadership Jan 1918 to end it; took the party into government Oct 1918; chancellor from Max 9 Nov; pact with Groener 10 Nov (en.wikipedia Friedrich Ebert)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_scheidemann",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "weary"],
    rivals: ["deu_liebknecht"],
    allies: ["deu_ebert"],
    fame: 2,
    source:
      "b. 26 Jul 1865, Kassel; printer, editor; SPD Reichstag group co-chair with Haase 1913-1918; vice president of the Reichstag 1912, not able to take the chair until 1918; the 'Scheidemann peace' without annexations; state secretary without portfolio 4 Oct-9 Nov 1918; proclaimed the republic from a Reichstag window 9 Nov (en.wikipedia Philipp Scheidemann)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_liebknecht",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["stubborn", "arrogant"],
    rivals: ["deu_ebert", "deu_heir"],
    allies: [],
    fame: 3,
    source:
      "b. 13 Aug 1871, Leipzig; alone against the credits 2 Dec 1914; called up Feb 1915 to a construction battalion; arrested 1 May 1916 near Potsdamer Platz; 23 Aug 1916 four years one month; amnesty 23 Oct 1918; proclaimed a socialist republic from the palace 9 Nov (en.wikipedia Karl Liebknecht)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_holtzendorff",
    tag: "DEU",
    office: null,
    fit: ["navy"],
    camps: ["west", "hard"],
    temperaments: ["cold", "anxious"],
    rivals: ["deu_tirpitz"],
    allies: ["deu_muller"],
    fame: 2,
    source:
      "b. 9 Jan 1853, Berlin; High Seas Fleet 1909-1913, retired over the pace of naval expansion; Chief of the Admiralty Staff 1915-Aug 1918; memorandum of 22 Dec 1916: Britain sues for peace within six months; Pless Jan 1917; replaced by Scheer (en.wikipedia Henning von Holtzendorff). Rivalry with Tirpitz, closeness to Müller and first caution on U-boats (memory). No 'military' camp on purpose: an admiral is not an army commander (People.armyCommander)",
    arrives: "1915-09-01",
  },
  {
    id: "deu_capelle",
    tag: "DEU",
    office: null,
    fit: ["navy"],
    camps: ["civil", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["deu_holtzendorff"],
    allies: ["deu_tirpitz"],
    fame: 1,
    source:
      "b. 10 Oct 1855, Celle; head of the Navy Office's administration, Tirpitz's deputy by 1914, acting in the July Crisis; State Secretary 15 Mar 1916-6 Oct 1918; banned socialist literature from the fleet in Aug 1917 (en.wikipedia Eduard von Capelle). His Reichstag words on American troops (memory). Rivalry is inference",
    arrives: "1915-01-01",
  },
  {
    id: "deu_scheer",
    tag: "DEU",
    office: null,
    fit: ["navy"],
    camps: ["west", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["deu_holtzendorff"],
    allies: ["deu_tirpitz"],
    fame: 3,
    source:
      "b. 30 Sep 1863, Obernkirchen; III Battle Squadron 1915; High Seas Fleet Jan 1916; Jutland 31 May-1 Jun 1916; 'man with the iron mask'; after Jutland only unrestricted U-boat war can beat Britain; Chief of the Naval Staff 11 Aug 1918; the fleet sortie plan of Oct 1918, mutiny from 29 Oct (en.wikipedia Reinhard Scheer). No 'military' camp on purpose, as for Holtzendorff",
    arrives: "1915-01-01",
  },
  {
    id: "deu_kuhlmann",
    tag: "DEU",
    office: null,
    fit: ["foreign", "ambassador_london"],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "cold"],
    rivals: ["deu_ludendorff", "deu_zimmermann"],
    allies: ["deu_bethmann", "deu_hoffmann"],
    fame: 2,
    source:
      "b. 3 May 1873, Constantinople; embassy councillor in London 1908-1914, African and Baghdad treaties, warned on Tirpitz's fleet; The Hague Apr 1915-Oct 1916; Constantinople Sep 1916-Aug 1917; State Secretary 6 Aug 1917-9 Jul 1918; led at Brest-Litovsk; 'not by arms alone' speech Jun 1918, forced out (en.wikipedia Richard von Kühlmann). Alliance with Hoffmann at Brest is an inference from the same page",
    arrives: "1915-04-01",
  },
  {
    id: "deu_hintze",
    tag: "DEU",
    office: null,
    fit: ["foreign", "ambassador_petersburg"],
    camps: ["civil", "hard"],
    temperaments: ["cunning", "cold"],
    rivals: ["deu_kuhlmann"],
    allies: ["deu_ludendorff"],
    fame: 1,
    source:
      "b. 13 Feb 1864, Schwedt; navy from 1882; naval attaché in Petersburg 1903, the Kaiser's man with the Tsar; Mexico 1911-1914; China 1914-Mar 1917; Norway 1917-1918; foreign secretary 8/9 Jul-3 Oct 1918; part in the decision for an armistice (en.wikipedia Paul von Hintze). Liked by the OHL, the disguised journey to Peking (memory)",
    arrives: "1917-03-01",
  },
  {
    id: "deu_valentini",
    tag: "DEU",
    office: null,
    fit: ["court"],
    camps: ["civil", "moderate"],
    temperaments: ["weary", "cold"],
    rivals: ["deu_ludendorff", "deu_bauer"],
    allies: ["deu_bethmann", "deu_muller"],
    fame: 1,
    source:
      "b. 1 Oct 1855, Crussow; Civil Cabinet from 1899, chief from 1908; backed Bethmann's appointment and was his closest helper, against the fleet policy; resigned Jan 1918 under Ludendorff's pressure, succeeded by Friedrich von Berg (de.wikipedia Rudolf von Valentini)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_hertling",
    tag: "DEU",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "moderate"],
    temperaments: ["weary", "stubborn"],
    rivals: ["deu_ludendorff"],
    allies: ["deu_rupprecht"],
    fame: 2,
    source:
      "b. 31 Aug 1843, Darmstadt; philosophy professor at Munich; Centre; Bavarian minister president 9 Feb 1912-Nov 1917; chancellor 1 Nov 1917-30 Sep 1918, aged 74, frail; resisted parliamentary government until the OHL demanded it 28 Sep 1918 at Spa (en.wikipedia Georg von Hertling)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_michaelis",
    tag: "DEU",
    office: null,
    fit: ["chancellor", "interior"],
    camps: ["civil", "hard"],
    temperaments: ["stubborn", "anxious"],
    rivals: ["deu_erzberger"],
    allies: ["deu_hindenburg"],
    fame: 1,
    source:
      "b. 8 Sep 1857, Haynau; law teacher in Tokyo 1885-1889; Prussian finance under-secretary 1909; Imperial Grain Office 1915; chancellor 14 Jul-Oct 1917, the OHL's surprise choice; told the Crown Prince he had drawn the Peace Resolution's teeth 'by my interpretation'; blamed the socialists for the fleet unrest, fell after the parties went to the Kaiser 24 Oct (en.wikipedia Georg Michaelis). His piety (memory)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_max_baden",
    tag: "DEU",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "moderate"],
    temperaments: ["anxious", "weary"],
    rivals: ["deu_ludendorff"],
    allies: ["deu_bethmann"],
    fame: 2,
    source:
      "b. 10 Jul 1867, Baden-Baden; heir of Baden; Baden Red Cross from Oct 1914, prisoners of war through Russian and Swedish courts and Switzerland; chancellor 3 Oct-9 Nov 1918; armistice request 4 Oct; seriously ill with influenza 6 Nov; announced the abdication 9 Nov without authority, handed over to Ebert (en.wikipedia Prince Maximilian of Baden)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_buelow",
    tag: "DEU",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["deu_bethmann", "deu_valentini"],
    allies: ["deu_erzberger"],
    fame: 3,
    source:
      "b. 3 May 1849, Klein-Flottbek; chancellor 1900-1909; took the Rome embassy 19 Dec 1914 to hold Italy, left 24 May 1915; wife Maria Beccadelli; Erzberger and others hoped for him in 1917, unacceptable to most (en.wikipedia Bernhard von Bülow). The Kaiser's grudge over the 1908 Daily Telegraph affair (memory)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_stein",
    tag: "DEU",
    office: null,
    fit: ["war"],
    camps: ["military", "east", "hard"],
    temperaments: ["stubborn", "weary"],
    rivals: ["deu_groener"],
    allies: ["deu_ludendorff"],
    fame: 1,
    source:
      "b. 1854; Prussian war minister 29 Oct 1916-9 Oct 1918 (en.wikipedia Hermann von Stein (1854-1927); list of Prussian war ministers). Quartermaster of the General Staff in Aug 1914, the daily communiqués (memory)",
    arrives: "1916-01-01",
  },
  {
    id: "deu_mackensen",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["military", "east", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["auh_conrad"],
    allies: ["deu_hindenburg", "deu_falkenhayn"],
    fame: 4,
    source:
      "b. 6 Dec 1849; farm secretary's son, ennobled 27 Jan 1899; 1st Life Hussars, the death's head uniform; Gorlice-Tarnów 1915; field marshal 22 Jun 1915; Serbia Oct 1915; Romania 1916, Bucharest fell on his 67th birthday; governor of occupied Wallachia (en.wikipedia August von Mackensen). Friction with Conrad is inference",
    arrives: "1915-01-01",
  },
  {
    id: "deu_hoffmann",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["military", "east", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["deu_ludendorff"],
    allies: ["deu_kuhlmann"],
    fame: 2,
    source:
      "b. 25 Jan 1869, Homberg; Russia to learn the language, General Staff Russia desk; Eighth Army at Tannenberg, named the battle; chief of staff in the east under Prince Leopold; Brest-Litovsk beside Kühlmann; Ludendorff tried to have him sent to a division, the Kaiser refused (en.wikipedia Max Hoffmann). The fist on the table at Brest (memory)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_rupprecht",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["military", "west", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["deu_heir", "deu_ludendorff"],
    allies: ["deu_hertling"],
    fame: 3,
    source:
      "b. 18 May 1869, Munich; Sixth Army 2 Aug 1914-Aug 1916, then Army Group to 11 Nov 1918; field marshal Jul 1916; spring 1915 wanted Belgium tied to Germany and Prussia's weight reduced; by late 1917 thought the war could not be won; eldest son Luitpold d. 27 Aug 1914 (en.wikipedia Rupprecht, Crown Prince of Bavaria). Rivalries are inference",
    arrives: "1915-01-01",
  },
  {
    id: "deu_bernstorff",
    tag: "DEU",
    office: null,
    fit: ["foreign"],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "anxious"],
    rivals: ["deu_tirpitz", "deu_holtzendorff"],
    allies: ["deu_bethmann"],
    fame: 2,
    source:
      "b. 14 Nov 1862, London; Washington 1908-3 Feb 1917; thought the U-boat war against Germany's interest, acted beyond instructions in the Arabic crisis; House's 'so near to peace'; Constantinople 1917-1918 (en.wikipedia Johann Heinrich von Bernstorff)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_batocki",
    tag: "DEU",
    office: null,
    fit: ["interior"],
    camps: ["civil", "moderate"],
    temperaments: ["stubborn", "weary"],
    rivals: ["deu_michaelis"],
    allies: ["deu_bethmann"],
    fame: 1,
    source:
      "b. 1868; first head of the War Food Office 22 May 1916-6 Aug 1917, called food dictator in the press; Oberpräsident of East Prussia before (en.wikipedia Adolf Tortilowicz von Batocki-Friebe; Heidelberg University article; New Zealand press 1916). Rivalry with Michaelis is inference",
    arrives: "1916-01-01",
  },
  {
    id: "deu_stresemann",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["deu_erzberger", "deu_bethmann"],
    allies: ["deu_ludendorff"],
    fame: 2,
    source:
      "National Liberal; annexationist with moderate home reform; for unrestricted U-boat war; leading part in Bethmann's fall July 1917, with Ludendorff and Hindenburg; opposed the Peace Resolution; led the group from 1917 (Britannica, 1914-1918-online, nobelprize.org). b. 10 May 1878, Berlin (memory)",
    arrives: "1915-01-01",
  },
  {
    id: "deu_empress",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["hard"],
    temperaments: ["anxious", "stubborn"],
    rivals: ["deu_bethmann"],
    allies: ["deu_heir"],
    fame: 2,
    source:
      "Augusta Victoria of Schleswig-Holstein, b. 22 Oct 1858 (en.wikipedia). Her dislike of Bethmann and her heart trouble in 1918 were NOT confirmed by search: memory, so scenes keep them as court talk, stamped by a person's word, never as fact",
    arrives: "1915-01-01",
  },
  {
    id: "deu_parvus",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["deu_ebert"],
    allies: ["deu_zimmermann"],
    fame: 1,
    source:
      "Alexander Helphand: arranged contacts with the Bolsheviks through Brockdorff-Rantzau in Copenhagen and Romberg in Bern, and is remembered for the sealed train (spartacus-educational; Spectator 1958; the-berliner). The sum of money is disputed: no figure in any text. b. 1867 (memory)",
    arrives: "1915-01-01",
  },
];

/** How each talks, as GW_VOICE_NOTES: the fixed habit, for whoever writes them. */
export const GW_VOICE_NOTES_DEU: Readonly<Record<string, string>> = {
  deu_helfferich:
    "제일 똑똑한 사람이 방 안에 있다는 것을 먼저 알린다. 말이 빠르고 도표처럼 정리되어 있다. 반박을 끝까지 안 듣고 답을 낸다. '계산은 끝났습니다.' 패전국 배상금을 장부에 미리 적어 둔다.",
  deu_groener:
    "슈바벤 억양이 남은 실무자. 시간표, 화차 수, 톤수로 말한다. 할 수 없는 일은 할 수 없다고 먼저 적는다. 장군이면서 '협의'라는 말을 쓴다. 조용하고 비꼬지 않으며, 틀린 숫자 앞에서만 날카롭다.",
  deu_bauer:
    "대령인데 장관처럼 말한다. 생산 목표를 두 배, 세 배로 부르고 근거는 '해 보면 됩니다'다. 남의 이름을 낮게 흘리고 문을 닫는다. '각하께서는 모르시겠지만'을 즐겨 쓴다. 공장 얘기를 할 때만 진심이 묻어난다.",
  deu_rathenau:
    "수필가의 문장으로 공장을 말한다. 먼 데서 시작해 정확한 숫자로 내려온다. 남의 잘못을 말할 때도 목소리가 고르다. 자기가 이 나라에 어떤 사람인지 불쑥 묻고는 바로 거둔다.",
  deu_ballin:
    "함부르크 상인의 농담과 근심이 섞인 말. 톤수와 보험료로 세상을 잰다. 황제를 어려워하지 않고, 그래서 더 조심한다. 영국 사람들 이름을 친구처럼 부르다가 멈춘다.",
  deu_erzberger:
    "지치지 않는 수다. 서류 뭉치를 들고 다니고, 어제 누가 누구에게 뭐라 했는지 안다. 뜻을 바꾼 일을 부끄러워하지 않는다. '각하, 숫자를 보십시오'. 말을 끊어도 아랑곳 않고 처음부터 다시 한다.",
  deu_ebert:
    "말이 무겁고 느리다. 큰 말을 안 쓴다. 조직, 표, 회비, 다음 회의. 분노는 낮은 목소리가 된다. 황제 앞에서도 기술자가 작업장을 설명하듯 말한다. 아들 얘기는 먼저 꺼내지 않는다.",
  deu_scheidemann:
    "기자의 말. 한 문장으로 머리기사를 만든다. 재치 있고 사람을 웃기며, 웃기는 동안 표를 센다. 에베르트를 '의장 동지'라 부른다.",
  deu_liebknecht:
    "법정의 말과 거리의 말을 번갈아 쓴다. 질문을 던지고 답을 기다리지 않는다. 당의 동지들을 먼저 친다. 위협이 안 먹히는 사람의 말투. 호칭을 쓰지 않는다.",
  deu_holtzendorff:
    "노제독의 교과서 말투. 톤수, 달, 곡물 시세를 줄을 맞춰 말한다. 표가 틀릴 수 있다는 말을 스스로 안 한다. 티르피츠 이름이 나오면 입술만 웃는다.",
  deu_capelle:
    "차관의 말. 전임자의 이름을 앞세우고 자기 뜻은 각주로 단다. 예산 항목을 번호로 부른다. 묻지 않은 것은 말하지 않는다.",
  deu_scheer:
    "짧고 건조한 명령체. 표정이 없어 농담인지 모른다. 전함을 사람처럼 부르지 않는다. '나갑니다'와 '안 나갑니다' 사이의 말은 쓰지 않는다.",
  deu_kuhlmann:
    "느긋한 세계인의 말. 그림과 식탁 얘기로 시작해서 가장 위험한 문장을 가볍게 놓는다. 장군들을 존칭으로 깎는다. 서두르는 법이 없고 그것이 군부를 화나게 한다.",
  deu_hintze:
    "장교의 절도와 대사의 완곡함이 반씩이다. 지도에서 먼 곳의 예를 든다. 군부가 듣고 싶은 말을 먼저 하고, 다 들은 뒤에 사실을 내놓는다.",
  deu_valentini:
    "오래된 궁정 관리의 말. 사람을 직접 평하지 않고 그 사람의 서류를 평한다. 절차로 반대하고 절차로 돕는다. '전례가 없습니다'가 가장 강한 말이다.",
  deu_hertling:
    "강의하는 노교수. 스콜라 철학의 구분법으로 말을 나눈다. 숨이 차서 문장 사이가 길다. 프로이센 장군을 학생 보듯 하다가 곧 피곤해한다.",
  deu_michaelis:
    "경건한 관리의 말. 하느님과 곡물 할당량을 같은 어조로 말한다. '제가 해석하는 한'을 붙인다. 의원을 처음 본 사람처럼 대한다.",
  deu_max_baden:
    "교양 있는 귀족의 말. 조심스럽고 뜻은 곧다. 포로수용소에서 본 것을 낮은 목소리로 전한다. 황제를 '폐하'라 부르며 친척의 말을 섞는다.",
  deu_buelow:
    "오페라 같은 사교 말투. 인용, 칭찬, 그 뒤의 칼. 자기가 재상이었으면 없었을 일을 차례로 말한다. 폐하 앞에서 폐하의 옛 말씀을 외워 보인다.",
  deu_stein:
    "공보문의 말. 무엇이든 짧고 좋게 적는다. 어려운 일은 사령부의 뜻을 받들겠다고 한다.",
  deu_mackensen:
    "늙은 기병의 정중함. 폐하께 말할 때 두 발이 붙어 있다. 동맹군 이야기는 예의 바르게 하고 믿지 않는다. 땅과 말과 날씨를 말한다.",
  deu_hoffmann:
    "장난기 있는 냉소. 큰 사람들 이름에 작은 일화를 붙여 깎는다. 지도 없이 러시아 철도를 외운다. 그러고 나서 정말 맞는 말을 한다.",
  deu_rupprecht:
    "교양 있는 남부 귀족의 말. 프로이센식 고함을 싫어한다. 그림과 여행 얘기를 하던 입으로 사단의 소모를 정확히 말한다.",
  deu_bernstorff:
    "암호 전보의 말과 뉴욕 사교계의 말을 함께 쓴다. '이곳 여론은'으로 시작한다. 훈령보다 반 발 앞서 움직이고 뒤에 보고한다.",
  deu_batocki:
    "지주의 상식. 감자 몇 톤, 돼지 몇 마리. 독재자 소리를 들으면 쓰게 웃는다. 권한이 없다는 말을 자주 한다.",
  deu_stresemann:
    "잘 나가는 젊은 의원의 말. 괴테를 인용하고 합병을 말한다. 사령부의 말을 전하며 자기가 그 안에 있다는 것을 알린다.",
  deu_empress:
    "남편에게만 쓰는 말. '당신'과 '아이들'. 정치 말을 하는 줄 모르고 정치 말을 한다. 기도와 병원 방문을 말하다가 재상 이름에서 입을 닫는다.",
  deu_parvus:
    "살찐 사업가의 혁명 이론. 계산서처럼 봉기를 말한다. 시가를 쥐고 마르크스를 인용한다. 자기 말이 믿기지 않는 것을 즐긴다.",
};

/**
 * ww179: names for the vacancy box of an office that had none. Appended after
 * every other list in Content.ts, so the seed rolls of the cast before them
 * stay as they were.
 */
export const DEU_POSTS: readonly GwPersonDef[] = [
  {
    id: "deu_gempp",
    tag: "DEU",
    office: null,
    fit: ["intelligence"],
    camps: ["military", "east", "hard"],
    temperaments: ["cold", "cunning"],
    rivals: [],
    allies: ["deu_nicolai", "deu_ludendorff"],
    fame: 1,
    source:
      "Friedrich Gempp, b. 6 Jul 1873, Freiburg im Breisgau; on mobilisation the intelligence officer of the Eighth Army's staff and of Ober Ost; Nicolai's deputy, his successor in 1920, first chief of the Reichswehr's Abwehr 1921-1927 (en.wikipedia Friedrich Gempp, Walter Nicolai)",
  },
];
