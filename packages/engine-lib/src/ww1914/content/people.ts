import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * The cast of the test build "독일 1914년": 16 Germans who can be summoned, 8
 * foreigners who come through visits and wires. Names, lean and bio are in
 * the packs: Germans in DEU.json, foreigners in common.json, so a later
 * country's seat has them too.
 *
 * Offices are those of June 1914. `fit` is the offices they can be appointed
 * to. `temperaments` is the recorded range; the seed picks one a game.
 * `rivals` and `allies` may name people of another country: they say who is
 * set against whom in a scene, whatever the engine does with trust.
 * `source`: "(memory)" marks facts not checked against a page.
 *
 * Order matters to the seed rolls (Roll.ts walks this list by index): append.
 */
export const GW_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "deu_bethmann",
    tag: "DEU",
    office: "chancellor",
    fit: ["chancellor", "interior"],
    camps: ["civil", "east", "moderate"],
    temperaments: ["weary", "anxious"],
    rivals: ["deu_moltke", "deu_tirpitz", "deu_heir"],
    allies: ["deu_jagow", "deu_delbruck", "deu_muller"],
    fame: 3,
    source:
      "Chancellor 14 Jul 1909-13 Jul 1917; Zabern censure Dec 1913, 293 to 54; son killed 9 Dec 1914 (en.wikipedia Theobald von Bethmann Hollweg, Zabern Affair). Wife Martha d. 11 May 1914 (de.wikipedia Martha von Bethmann Hollweg). Secretary of the Interior before 1909 (en.wikipedia Clemens von Delbrück)",
  },
  {
    id: "deu_moltke",
    tag: "DEU",
    office: "chief_of_staff",
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["anxious", "weary"],
    rivals: ["deu_bethmann", "deu_falkenhayn"],
    allies: ["deu_ludendorff", "deu_hindenburg"],
    fame: 4,
    source:
      "b. 25 May 1848; poor health and a stroke before the war; refused the Kaiser's turn east; replaced 14 Sep 1914; theosophy (en.wikipedia Helmuth von Moltke the Younger). Cure at Karlsbad, June-July 1914 (Mombauer, War in History 1999, as cited). Chief from 1906 (memory)",
  },
  {
    id: "deu_jagow",
    tag: "DEU",
    office: "foreign",
    fit: ["foreign"],
    camps: ["civil", "east", "moderate"],
    temperaments: ["cold", "weary", "anxious"],
    rivals: ["deu_lichnowsky", "deu_zimmermann"],
    allies: ["deu_bethmann", "deu_pourtales"],
    fame: 2,
    source:
      "State secretary 11 Jan 1913-22 Nov 1916; ambassador in Rome 1909-1913; poor Reichstag speaker; expected localisation, Russia not ready; ill and exhausted by late July (en.wikipedia Gottlieb von Jagow). Married 18 Jun 1914, away 5 Jul (en.wikipedia Hoyos Mission)",
  },
  {
    id: "deu_zimmermann",
    tag: "DEU",
    office: null,
    fit: ["foreign", "ambassador_vienna"],
    camps: ["civil", "east", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["deu_jagow", "deu_lichnowsky"],
    allies: ["deu_tschirschky"],
    fame: 2,
    source:
      "b. 5 Oct 1864; under-secretary from 1911; commoner; Casement late 1914; plans for rebellion in India; foreign secretary 22 Nov 1916 (en.wikipedia Arthur Zimmermann). Saw Hoyos 5 Jul 1914 (en.wikipedia Alexander Graf von Hoyos); the 90 per cent remark is from one forum transcription of a dispatch, unconfirmed. Consular start (memory)",
  },
  {
    id: "deu_delbruck",
    tag: "DEU",
    office: "interior",
    fit: ["interior", "chancellor", "finance"],
    camps: ["civil", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["deu_kuhn", "deu_haase"],
    allies: ["deu_bethmann"],
    fame: 2,
    source:
      "Secretary of the Interior and vice-chancellor from Jul 1909 to May 1916, removed in the quarrel with the military (en.wikipedia Clemens von Delbrück). His part in the enabling law of 4 Aug 1914 and in grain buying (memory)",
  },
  {
    id: "deu_kuhn",
    tag: "DEU",
    office: "finance",
    fit: ["finance", "interior"],
    camps: ["civil", "moderate"],
    temperaments: ["stubborn", "cold"],
    rivals: ["deu_tirpitz", "deu_delbruck"],
    allies: ["deu_bethmann"],
    fame: 1,
    source:
      "b. 17 May 1851, Schlawe; state secretary of the Treasury 1912-Jan 1915; followed Wermuth, who left over funding the arms bills (de.wikipedia Hermann Kühn; Finance Minister of Germany list; press of Mar 1912 on paperspast). Rivalries are a plain inference from the budget, not recorded",
  },
  {
    id: "deu_tirpitz",
    tag: "DEU",
    office: "navy",
    fit: ["navy", "chancellor"],
    camps: ["military", "west", "hard"],
    temperaments: ["cunning", "stubborn", "arrogant"],
    rivals: ["deu_bethmann", "deu_muller", "deu_kuhn"],
    allies: ["deu_falkenhayn", "deu_heir"],
    fame: 5,
    source:
      "b. 19 Mar 1849; state secretary of the Navy Office 18 Jun 1897-15 Mar 1916; the war came too soon for the fleet, 1900 act on a 17-year timetable; no command from his post; for unrestricted U-boat war (en.wikipedia Alfred von Tirpitz). Against Müller (Neue Deutsche Biographie). Forked beard, wish for a unified naval command (memory)",
  },
  {
    id: "deu_falkenhayn",
    tag: "DEU",
    office: "war",
    fit: ["war", "chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["cold", "arrogant", "cunning"],
    rivals: ["deu_moltke", "deu_hindenburg", "deu_ludendorff"],
    allies: ["deu_tirpitz"],
    fame: 3,
    source:
      "b. 11 Sep 1861; China from 1896 and with Waldersee; war minister 7 Jul 1913-20 Jan 1915; Zabern conference; at the 5 Jul 1914 meeting; chief of staff 14 Sep 1914; Nov 1914 no decisive win, mild peace with Russia (en.wikipedia Erich von Falkenhayn). Alliance with Tirpitz over a Russian peace (memory)",
  },
  {
    id: "deu_hindenburg",
    tag: "DEU",
    office: null,
    fit: ["chief_of_staff", "war"],
    camps: ["military", "east", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["deu_falkenhayn"],
    allies: ["deu_ludendorff", "deu_moltke"],
    fame: 3,
    source:
      "b. 2 Oct 1847, Posen; retired 1911, lived in Hannover; recalled 22 Aug 1914 to the Eighth Army; commander in the east and field marshal 1 Nov 1914 (en.wikipedia Paul von Hindenburg). 1866 and 1870, the Masurian ground from staff rides (memory)",
  },
  {
    id: "deu_ludendorff",
    tag: "DEU",
    office: null,
    fit: ["chief_of_staff", "war"],
    camps: ["military", "east", "hard"],
    temperaments: ["arrogant", "anxious", "stubborn"],
    rivals: ["deu_falkenhayn", "deu_bethmann"],
    allies: ["deu_hindenburg", "deu_moltke", "deu_heir"],
    fame: 2,
    source:
      "Sent from the General Staff to the 39th Fusiliers, Düsseldorf, after pressing the 1913 army bill; 85th Brigade, Strasbourg, Apr 1914; Liège; chief of staff of the Eighth Army (en.wikipedia Erich Ludendorff; 1914-1918-online). Head of the deployment section, author of the Liège coup plan (memory)",
  },
  {
    id: "deu_muller",
    tag: "DEU",
    office: "court",
    fit: ["court", "navy"],
    camps: ["military", "moderate"],
    temperaments: ["cold", "cunning", "weary"],
    rivals: ["deu_tirpitz"],
    allies: ["deu_bethmann"],
    fame: 2,
    source:
      "Chief of the Naval Cabinet 1906-1918; once Tirpitz's protégé, then at odds; against unrestricted U-boat war; diaries; noted Moltke's absence at Karlsbad (en.wikipedia Georg Alexander von Müller; Neue Deutsche Biographie). Close to Bethmann (memory)",
  },
  {
    id: "deu_lichnowsky",
    tag: "DEU",
    office: "ambassador_london",
    fit: ["ambassador_london", "foreign"],
    camps: ["civil", "moderate"],
    temperaments: ["anxious", "stubborn", "arrogant"],
    rivals: ["deu_jagow", "deu_zimmermann", "deu_tirpitz"],
    allies: ["gbr_grey"],
    fame: 3,
    source:
      "b. 8 Mar 1860; London 1912-4 Aug 1914; warned Britain would intervene; 27 Jul cable kept from the Kaiser; 1916 memorandum, expelled from the Prussian upper house; estates Kuchelna and Grätz (en.wikipedia Karl Max, Prince Lichnowsky). The 1 Aug neutrality telegram (en.wikipedia Edward Grey)",
  },
  {
    id: "deu_pourtales",
    tag: "DEU",
    office: "ambassador_petersburg",
    fit: ["ambassador_petersburg"],
    camps: ["civil", "moderate"],
    temperaments: ["anxious", "weary"],
    rivals: ["deu_moltke"],
    allies: ["deu_jagow", "rus_nicholas"],
    fame: 2,
    source:
      "b. 24 Oct 1853; ambassador Dec 1907-1 Aug 1914; handed the declaration to Sazonov after asking three times, in a shaken state (en.wikipedia Friedrich von Pourtalès; Mental Floss centennial piece). That he told Berlin Russia would not fight, and the note with two versions (memory)",
  },
  {
    id: "deu_tschirschky",
    tag: "DEU",
    office: "ambassador_vienna",
    fit: ["ambassador_vienna", "foreign", "ambassador_london"],
    camps: ["civil", "hard"],
    temperaments: ["arrogant", "cold"],
    rivals: ["deu_lichnowsky"],
    allies: ["deu_zimmermann", "auh_hoyos"],
    fame: 2,
    source:
      "b. 15 Aug 1858; state secretary 1906-1907; ambassador in Vienna 25 Oct 1907 to his death 15 Nov 1916 (en.wikipedia Heinrich von Tschirschky). The 30 Jun 1914 report with the Kaiser's 'now or never' in the margin; report of 10 Jul (GHDI; firstworldwar.com). Lichnowsky's hostility (memory)",
  },
  {
    id: "deu_heir",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["military", "west", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["deu_bethmann", "deu_haase"],
    allies: ["deu_tirpitz", "deu_ludendorff"],
    fame: 4,
    source:
      "b. 6 May 1882; 1st Leib Hussars, Danzig, 1911; applauded attacks on Bethmann from the royal box 9 Nov 1911 and was made to make amends; Zabern telegrams; Fifth Army 2 Aug 1914 with no larger command before (en.wikipedia Wilhelm, German Crown Prince; wehd.com biography; press of Jan 1914)",
  },
  {
    id: "deu_haase",
    tag: "DEU",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["stubborn", "anxious", "weary"],
    rivals: ["deu_heir", "deu_delbruck"],
    allies: [],
    fame: 3,
    source:
      "b. 29 Sep 1863, Allenstein; lawyer in Königsberg; SPD co-chairman with Ebert 1913-1916; Reichstag group chairman with Scheidemann; lost the caucus vote 78 to 14 and read the declaration 4 Aug 1914; led anti-war protests in July (en.wikipedia Hugo Haase, Burgfriedenspolitik; 1914-1918-online). 110 seats (memory)",
  },
  // Foreigners: reached by visits and wires, not by summons.
  {
    id: "auh_hoyos",
    tag: "AUH",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["deu_lichnowsky"],
    allies: ["deu_zimmermann", "deu_tschirschky"],
    fame: 1,
    source:
      "b. 13 May 1876, Fiume; Berchtold's chef de cabinet 1912-1917; Berlin 5 Jul 1914 with memorandum and Franz Joseph's letter; grandson of Whitehead; sister married Herbert von Bismarck (en.wikipedia Alexander Graf von Hoyos)",
  },
  {
    id: "auh_conrad",
    tag: "AUH",
    office: "chief_of_staff",
    fit: ["chief_of_staff"],
    camps: ["military", "east", "hard"],
    temperaments: ["arrogant", "anxious", "stubborn"],
    rivals: ["deu_falkenhayn"],
    allies: ["deu_moltke"],
    fame: 4,
    source:
      "b. 11 Nov 1852; chief 1906-1911 and Dec 1912-1 Mar 1917; 25 proposals of war on Serbia in 1913; Galicia, loss of Lemberg; blamed the Germans after Tannenberg; bad terms with Falkenhayn; Limanowa Dec 1914; Virginia von Reininghaus (en.wikipedia Franz Conrad von Hötzendorf)",
  },
  {
    id: "rus_nicholas",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["weary", "stubborn", "anxious"],
    rivals: ["deu_moltke"],
    allies: ["deu_pourtales"],
    fame: 5,
    source:
      "Ten telegrams 29 Jul-1 Aug 1914, in English; the Hague proposal of 29 Jul; cancelled general mobilisation 29 Jul, resumed under Sazonov two days later (en.wikipedia Willy-Nicky correspondence)",
  },
  {
    id: "gbr_grey",
    tag: "GBR",
    office: "foreign",
    fit: ["foreign"],
    camps: ["civil", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["deu_tirpitz"],
    allies: ["deu_lichnowsky"],
    fame: 5,
    source:
      "b. 25 Apr 1862; foreign secretary 10 Dec 1905-10 Dec 1916; fly fishing, birds; conference proposed 24 and 26 Jul; 1 Aug talk with Lichnowsky; lamps remark 3 Aug (en.wikipedia Edward Grey, 1st Viscount Grey of Fallodon)",
  },
  {
    id: "gbr_goschen",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["weary", "cold"],
    rivals: ["deu_jagow"],
    allies: ["deu_bethmann"],
    fame: 2,
    source:
      "1847-1924; ambassador in Berlin 1908-1914, Vienna and Copenhagen before; asked Jagow about Belgium; last interview with Bethmann 4 Aug, 'scrap of paper'; in Berlin to 6 Aug, diary (en.wikipedia Sir Edward Goschen, 1st Baronet; Bethmann's own note; firstworldwar.com). Terms with Bethmann and Jagow (memory)",
  },
  {
    id: "fra_cambon",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "moderate"],
    temperaments: ["cunning", "cold"],
    rivals: ["deu_moltke"],
    allies: [],
    fame: 3,
    source:
      "b. 5 Apr 1845; ambassador in Berlin 1907-1914, worked for détente; brother Paul in London (en.wikipedia Jules Cambon). Passed on the Potsdam talk of Nov 1913 (press on the Graham biography, Mental Floss). Jagow denied to him knowing the note (firstworldwar.com). How he left Berlin not checked",
  },
  {
    id: "ott_enver",
    tag: "OTT",
    office: "war",
    fit: ["war"],
    camps: ["military", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["deu_jagow"],
    allies: ["deu_moltke"],
    fame: 4,
    source:
      "b. 23 Nov 1881; attaché in Berlin 1909-1911; war minister 3 Jan 1914; began the German alliance; let Goeben and Breslau in without the cabinet; Sarıkamış (en.wikipedia Enver Pasha). Treaty of 2 Aug, doubts in the Foreign Office (memory)",
  },
  {
    id: "bel_albert",
    tag: "BEL",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["stubborn", "cold"],
    rivals: ["deu_moltke"],
    allies: [],
    fame: 4,
    source:
      "b. 8 Apr 1875; king from 23 Dec 1909; mother a Hohenzollern-Sigmaringen; wife Elisabeth of Bavaria (en.wikipedia Albert I of Belgium). Potsdam Nov 1913, told by the Kaiser and Moltke that war was near (Mental Floss; press on the Graham biography). Commanded in person, the 3 Aug refusal (memory)",
  },
];

/**
 * How each person talks, for whoever writes them (/home/eser/dev/ww131-style.md
 * has the rest). The fixed habit: the seed's temperament changes the day's
 * mood, not this. The screen doesn't read it.
 */
export const GW_VOICE_NOTES: Readonly<Record<string, string>> = {
  deu_bethmann:
    "철학 책을 읽은 관료. 조건절을 겹치며 긴 문장으로 가다가 끝에서 한풀 꺾인다. '운명', '책임', '계산'을 쓴다. 남보다 자기를 먼저 탓한다. 큰 소리를 내지 않는다.",
  deu_moltke:
    "큰아버지의 이름을 지고 사는 사람. 시간표와 날짜를 붙들고 말한다. 숫자는 정확한데 목소리가 흔들린다. 때로 뜻밖에 먼 얘기, 문명의 흥망 같은 말이 샌다.",
  deu_jagow:
    "작은 목소리의 학자풍. 말을 고쳐 가며 하고, 연설을 못 한다. 낙관을 말한 다음 바로 단서를 단다. 영국 얘기를 할 때는 남의 희망을 말하듯 한다.",
  deu_zimmermann:
    "평민 출신의 호탕한 동프로이센 사람. 큰 웃음, 맥주 자리의 말투로 위험한 소리를 쉽게 한다. 어려운 일을 쉬운 일처럼 말한다. 윗사람 야고를 웃으며 깎는다.",
  deu_delbruck:
    "서류를 다 읽은 사람의 말. 법 조문과 부처 이름을 대고, 다음 달 일을 먼저 묻는다. 말은 느리고 끊기지 않는다. 곡물과 실업을 장군들보다 먼저 걱정한다.",
  deu_kuhn:
    "장부의 사람. 숫자 뒤에 '입니다'만 붙인다. 정치 얘기는 못 들은 척한다. '그 돈은 없습니다'를 여러 꼴로 말한다. 드물게 하는 농담은 아무도 못 알아듣는다.",
  deu_tirpitz:
    "갈라진 수염의 노련한 싸움꾼. 함대법 연도와 척수를 외우듯 말한다. 남의 책임을 먼저 적어 두고 시작한다. 묻는 말에 답하지 않고 자기 말로 돌아온다. '영국'이 거의 모든 문장에 있다.",
  deu_falkenhayn:
    "멋쟁이 군인. 말이 짧고 매끄럽고 차다. 중국에서 본 일을 불쑥 예로 든다. 남의 패를 먼저 읽고 말한다. 감정을 드러내지 않아서 믿기 어렵다.",
  deu_hindenburg:
    "1866년과 1870년을 겪은 노병. 말이 적고 느리고 무겁다. '네, 폐하.' 다음에 한 문장. 교범처럼 말한다. 어려운 얘기는 참모에게 넘긴다. 사냥과 땅 얘기를 한다.",
  deu_ludendorff:
    "일하는 기계 같은 참모. 말이 빠르고 날카롭고 앞뒤 인사가 없다. 숫자를 대고 곧바로 남을 친다. 1913년의 일을 잊지 않았다. 일이 틀어지면 목소리가 먼저 높아진다.",
  deu_muller:
    "목사 같은 궁정 해군 장교. 낮고 고른 목소리. '폐하께서 들으셔야 할 말이 있다면'으로 돌려 말한다. 본 것은 일기에 적고 말은 절반만 한다. 사람의 건강과 기분을 잘 안다.",
  deu_lichnowsky:
    "슐레지엔 대귀족. 런던 사교계와 예술 얘기를 자연스럽게 섞는다. 베를린 관리들을 내려다본다. 경고를 되풀이하다 지친 사람의 다급함. '제 보고를 읽으셨습니까'가 입에 붙었다.",
  deu_pourtales:
    "차르 궁정에 오래 산 노신사. 격식 있고 다정하며 사람을 좋게 말한다. 사조노프의 표정까지 옮긴다. 믿고 싶은 대로 판단하는 버릇이 있다. 틀렸다고 알면 무너진다.",
  deu_tschirschky:
    "빈이 지겨운 대사. 오스트리아 사람들을 비웃듯 말한다. 짧은 평가, 험담에 가까운 인물평. 한때 외무대신이었던 사람답게 베를린의 속셈을 먼저 짚는다.",
  deu_heir:
    "젊고 가볍고 칭찬을 좋아한다. 기병과 사냥의 말, 친구에게 하듯 툭툭 던진다. 신문 제목 같은 소리를 그대로 옮긴다. 아버지 앞에서는 잠깐 아이가 된다. 그러다 뜻밖에 정곡을 찌른다.",
  deu_haase:
    "쾨니히스베르크의 변호사. 조용하고 논리적이고 물러서지 않는다. 사실, 조항, 반론의 차례로 말한다. 호칭을 아낀다. 당의 다수와 자기 생각이 다를 때 그것을 숨기지 않는다.",
  auh_hoyos:
    "젊은 백작. 자기 임무를 대단하게 여긴다. 잘 다듬은 궁정 독일어, 강한 말을 웃는 얼굴로 한다. 비스마르크 집안과의 인연을 슬쩍 꺼낸다. 어뢰를 만든 외할아버지 얘기는 안 한다.",
  auh_conrad:
    "스물다섯 번 전쟁을 건의한 사람. 앉지 않는다. 짜증 섞인 일정표의 말. 동맹의 약속을 조항처럼 들이댄다. 잘못은 늘 다른 곳에 있다. 어느 편지의 끝에서 불쑥 쓸쓸해진다.",
  rus_nicholas:
    "전보 속의 사촌. 영어 애칭으로 부르는 다정한 말투에 고집이 숨어 있다. 짧고 공손하고 구체적인 약속은 피한다. '하느님', '내 백성'을 쓴다. 신하의 말을 그대로 옮기는 것처럼 들린다.",
  gbr_grey:
    "말수 적은 시골 신사. 절제된 문장, 단정 대신 '말씀드릴 수 없습니다'. 낚시와 새 이야기를 드물게 한다. 약속을 안 하는 것으로 약속한다. 화내는 대신 더 조용해진다.",
  gbr_goschen:
    "은퇴를 앞둔 늙은 대사. 예의 바르다. 훈령대로 말하고, 자기 말을 덧붙일 때는 미리 밝힌다. 마지막 면담에서는 사람으로 말한다.",
  fra_cambon:
    "작고 노련한 공화국 관리. 프랑스식 재치로 치고 빠진다. 듣는 것이 일이고, 들은 것을 아는 척 안 한다. 프로이센 관리들의 말끝을 수집하듯 되풀이한다.",
  ott_enver:
    "서른둘의 영웅. 베를린 시절의 독일어가 자랑이다. 큰 지도를 말한다. 약속은 크고 조건은 뒤에 숨어 있다. 내각을 건너뛰는 일을 아무렇지 않게 말한다.",
  bel_albert:
    "말이 없는 왕. 군더더기 없는 문장, 법과 조약의 말. 호엔촐레른의 친척으로 대접받기를 거절한다. 위협에 답하지 않고 사실을 다시 적는다.",
};
