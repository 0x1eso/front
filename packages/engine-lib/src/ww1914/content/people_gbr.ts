import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * Britain's cast (plan: /home/eser/dev/ww135-plan-gbr.md). Sixteen have six
 * summons talks each; the others come by visits and scenes. Grey and Goschen
 * are in people.ts already and count among them. Names, lean and bio are in
 * GBR.people.json.
 *
 * Offices are those of June 1914. `chancellor` has no British holder: it is
 * the seat. The War Office has none either: the Prime Minister held it from
 * the Curragh to 5 August 1914, so `gbr_c_war_office` fills it. French, Haig
 * and the other field commanders have no office, as Hindenburg has none: the
 * world's rule makes commanders of soldiers without a desk.
 *
 * Camps, one per axis: party (liberal, unionist, labour, irish), conduct of
 * the war (hard, moderate), where to fight (west, east). Soldiers are also
 * `military`. Sailors aren't: that word puts a man at the head of an army and
 * in the army's weight, and Fisher should do neither.
 *
 * `source`: "(memory)" marks facts not checked against a page.
 * Order matters to the seed rolls: append.
 */
export const GBR_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "gbr_asquith",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["civil", "liberal", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["gbr_lloyd_george", "gbr_bonar_law", "gbr_northcliffe"],
    allies: ["gbr_grey", "gbr_haldane", "gbr_mckenna", "gbr_venetia"],
    fame: 5,
    source:
      "Prime Minister Apr 1908-5 Dec 1916; held the War Office himself after Seely went over the Curragh; disliked the telephone, wrote by hand; Venetia Stanley's engagement 12 May 1915; coalition May 1915; son Raymond killed on the Somme 15 Sep 1916; resigned at Buckingham Palace 5 Dec 1916; declined to serve under Law; lost East Fife Dec 1918 (en.wikipedia H. H. Asquith)",
  },
  {
    id: "gbr_lloyd_george",
    tag: "GBR",
    office: "finance",
    fit: ["finance", "munitions", "war"],
    camps: ["civil", "liberal", "east", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: [
      "gbr_mckenna",
      "gbr_kitchener",
      "gbr_haig",
      "gbr_robertson",
      "gbr_asquith",
    ],
    allies: ["gbr_churchill", "gbr_bonar_law", "gbr_montagu", "gbr_hankey"],
    fame: 5,
    source:
      "b. Manchester, raised at Llanystumdwy; Chancellor 1908-May 1915; Mansion House speech 1911; Marconi affair 1913; Minister of Munitions May 1915; War Secretary Jun 1916; PM Dec 1916; raised convoys at the War Committee Nov 1916; went to Invergordon 15 Apr 1917; unknowingly misled the Commons on Haig's strength, 1918 (en.wikipedia David Lloyd George). Led the peace side until Belgium (design sample; memory for the day)",
  },
  {
    id: "gbr_churchill",
    tag: "GBR",
    office: "navy",
    fit: ["navy", "munitions", "war"],
    camps: ["civil", "liberal", "east", "hard"],
    temperaments: ["arrogant", "anxious", "stubborn"],
    rivals: ["gbr_kitchener", "gbr_fisher", "gbr_bonar_law"],
    allies: ["gbr_lloyd_george", "gbr_haldane"],
    fame: 4,
    source:
      "First Lord Oct 1911; pressed the Dardanelles; out of the Admiralty May 1915; resigned from the government 25 Nov 1915 and went to the Army in France (en.wikipedia Winston Churchill). Kept the fleet together after the test mobilisation, Jul 1914; offered to resign and command at Antwerp, Oct 1914; Munitions Jul 1917 (memory)",
  },
  {
    id: "gbr_kitchener",
    tag: "GBR",
    office: null,
    fit: ["war"],
    camps: ["military", "east", "hard"],
    temperaments: ["stubborn", "cold", "arrogant"],
    rivals: ["gbr_lloyd_george", "gbr_churchill", "gbr_french"],
    allies: ["gbr_robertson"],
    fame: 5,
    source:
      "Agent and consul-general in Egypt from 1911; Earl 29 Jun 1914; War Secretary at the outset, the post Asquith had filled as a stopgap since Seely; one of the few to foresee a long war, three years at least; found discussing military secrets with a large body of colleagues repugnant; lost with HMS Hampshire off Orkney 5 Jun 1916, bound for Russia (en.wikipedia Herbert Kitchener). Solitary, unmarried (same page). Paris visit to French, 1 Sep 1914 (memory)",
  },
  {
    id: "gbr_mckenna",
    tag: "GBR",
    office: "interior",
    fit: ["interior", "finance", "navy"],
    camps: ["civil", "liberal", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["gbr_lloyd_george", "gbr_churchill"],
    allies: ["gbr_asquith", "gbr_simon"],
    fame: 2,
    source:
      "b. 6 Jul 1863; First Lord, then Home Secretary Oct 1911; meticulous, bureaucratic, partisan; a reluctant coalitionist, Chancellor May 1915; opposed conscription for reasons of cost; on 4 Dec 1916 urged Asquith to sack Lloyd George (en.wikipedia Reginald McKenna; John Simon). The McKenna Duties Sep 1915, the warning on American credit in 1916 (memory)",
  },
  {
    id: "gbr_haldane",
    tag: "GBR",
    office: null,
    fit: ["war", "interior"],
    camps: ["civil", "liberal", "moderate"],
    temperaments: ["weary", "cold"],
    rivals: ["gbr_northcliffe", "gbr_bonar_law"],
    allies: ["gbr_asquith", "gbr_grey", "gbr_churchill"],
    fame: 3,
    source:
      "b. 30 Jul 1856; lawyer and philosopher; War Secretary from Dec 1905; his army reforms; Germanophile, the 1912 Berlin mission; Lord Chancellor 1912-1915, forced out over alleged German sympathies (en.wikipedia Richard Haldane). Lent to the War Office for a day or two in Aug 1914 (memory)",
  },
  {
    id: "gbr_simon",
    tag: "GBR",
    office: null,
    fit: ["interior", "ireland"],
    camps: ["civil", "liberal", "moderate"],
    temperaments: ["cold", "anxious"],
    rivals: ["gbr_lloyd_george", "gbr_kitchener"],
    allies: ["gbr_mckenna", "gbr_morley"],
    fame: 2,
    source:
      "b. 28 Feb 1873; barrister; thought of resigning in Aug 1914 and changed his mind; Home Secretary 25 May 1915, refused the Woolsack; resigned Jan 1916 over conscription of single men; chaired the Sheehy-Skeffington commission Aug 1916 (en.wikipedia John Simon). Attorney General in 1914 (memory)",
  },
  {
    id: "gbr_morley",
    tag: "GBR",
    office: null,
    fit: ["ireland"],
    camps: ["civil", "liberal", "moderate"],
    temperaments: ["weary", "stubborn"],
    rivals: ["gbr_churchill", "gbr_grey"],
    allies: ["gbr_simon", "gbr_asquith"],
    fame: 3,
    source:
      "b. 1838, Blackburn; editor, Gladstone's biographer, 'last of the great nineteenth-century Liberals'; Chief Secretary for Ireland, India Secretary 1905-1910 (en.wikipedia John Morley). Lord President; left the cabinet with Burns over the war (design sample, confirmed en.wikipedia John Burns for Burns on 2 Aug; Morley's date, memory)",
  },
  {
    id: "gbr_birrell",
    tag: "GBR",
    office: "ireland",
    fit: ["ireland"],
    camps: ["civil", "liberal", "moderate"],
    temperaments: ["weary", "cold"],
    rivals: ["gbr_carson"],
    allies: ["gbr_redmond", "gbr_asquith"],
    fame: 2,
    source:
      "b. 19 Jan 1850, son of a Baptist minister; KC, man of letters; Chief Secretary for Ireland 1907-1916, praised for tenant land purchase (en.wikipedia Augustine Birrell). Resigned after the Rising (memory)",
  },
  {
    id: "gbr_bonar_law",
    tag: "GBR",
    office: null,
    fit: ["finance"],
    camps: ["civil", "unionist", "hard"],
    temperaments: ["cold", "weary", "stubborn"],
    rivals: ["gbr_asquith", "gbr_churchill", "gbr_redmond"],
    allies: ["gbr_carson", "gbr_lloyd_george"],
    fame: 4,
    source:
      "b. 16 Sep 1858, New Brunswick, Scots and Ulster stock; left school at sixteen, iron merchant in Glasgow; Unionist leader against Home Rule; Colonial Secretary May 1915-Dec 1916; declined to form a government, Chancellor from Dec 1916 (en.wikipedia Andrew Bonar Law). Met Lloyd George and Carson at the Hyde Park Hotel 20 Nov 1916 (en.wikipedia H. H. Asquith). Two sons killed 1917 (memory)",
  },
  {
    id: "gbr_carson",
    tag: "GBR",
    office: null,
    fit: ["navy"],
    camps: ["civil", "unionist", "hard"],
    temperaments: ["stubborn", "arrogant", "weary"],
    rivals: ["gbr_redmond", "gbr_birrell", "gbr_asquith"],
    allies: ["gbr_bonar_law", "gbr_wilson"],
    fame: 4,
    source:
      "b. 9 Feb 1854, Dublin, Anglican; barrister; MP for Dublin University, leader of the Ulster Unionist Council; first signatory of the Covenant 28 Sep 1912, 447,197 names; Attorney-General 25 May 1915; First Lord 10 Dec 1916, then the War Cabinet; resigned early 1918 over Home Rule with Irish conscription (en.wikipedia Edward Carson). Resigned Oct 1915 over Serbia (memory)",
  },
  {
    id: "gbr_balfour",
    tag: "GBR",
    office: null,
    fit: ["foreign", "navy"],
    camps: ["civil", "unionist", "moderate"],
    temperaments: ["cold", "weary", "cunning"],
    rivals: ["gbr_lloyd_george"],
    allies: ["gbr_bonar_law", "gbr_hankey", "gbr_grey"],
    fame: 4,
    source:
      "b. 25 Jul 1848, Whittingehame, Cecil family; Prime Minister 1902-1905; Entente of 1904; First Lord in the coalition 1915-1916; Foreign Secretary Dec 1916, often left out of the inner work (en.wikipedia Arthur Balfour). Stayed on the Committee of Imperial Defence in opposition; asked Churchill to write the second Jutland communiqué; Washington mission Apr 1917 (memory)",
  },
  {
    id: "gbr_milner",
    tag: "GBR",
    office: null,
    fit: ["war"],
    camps: ["civil", "unionist", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["gbr_asquith", "gbr_redmond"],
    allies: ["gbr_lloyd_george", "gbr_carson"],
    fame: 3,
    source:
      "b. 23 Mar 1854, Giessen, Hesse, German schooling; Balliol; colonial administrator; key adviser and minister under Lloyd George; in Mar 1918 worked for the unified Allied command (en.wikipedia Alfred Milner). War Secretary Apr 1918 (memory)",
  },
  {
    id: "gbr_redmond",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["civil", "irish", "moderate"],
    temperaments: ["weary", "anxious", "stubborn"],
    rivals: ["gbr_carson", "gbr_bonar_law"],
    allies: ["gbr_birrell", "gbr_asquith"],
    fame: 4,
    source:
      "b. 1 Sep 1856, Ballytrent, Wexford, old Catholic gentry; barrister; stood by Parnell in 1890; leader of the Irish Parliamentary Party; d. 6 Mar 1918; spoke to the Volunteers at Maryborough 16 Aug 1914 (en.wikipedia John Redmond). Took the Volunteers under the party in Jun 1914; Woodenbridge 20 Sep 1914; brother Willie killed 1917 (memory)",
  },
  {
    id: "gbr_henderson",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["civil", "labour", "moderate"],
    temperaments: ["stubborn", "weary"],
    rivals: ["gbr_lloyd_george", "gbr_northcliffe"],
    allies: ["gbr_asquith"],
    fame: 2,
    source:
      "b. 13 Sep 1863, Glasgow; iron moulder from twelve; Wesleyan lay preacher; union organiser; Labour leader 1908 and again when MacDonald resigned over the war, 1914; first Labour cabinet minister; signed the Treasury Agreement 19 Mar 1915 (en.wikipedia Arthur Henderson; Treasury Agreement). Kept waiting outside the cabinet 1 Aug 1917, resigned 10 or 11 Aug over Stockholm (J. Winter, Historical Journal; press of Aug 1917)",
  },
  {
    id: "gbr_george_v",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["moderate"],
    temperaments: ["stubborn", "anxious"],
    rivals: ["gbr_lloyd_george"],
    allies: ["gbr_stamfordham", "gbr_haig", "gbr_asquith"],
    fame: 5,
    source:
      "b. 3 Jun 1865; second son, naval career; king 1910; Home Rule crisis; 4 Aug 1914 diary 'a terrible catastrophe but it is not our fault'; Windsor proclamation 17 Jul 1917 (en.wikipedia George V). Palace Conference 21-24 Jul 1914 (en.wikipedia Buckingham Palace Conference). The offer of asylum to the Tsar and its withdrawal (en.wikipedia George V). Pledge of abstinence 1915, Haig's letters (memory)",
  },
  {
    id: "gbr_stamfordham",
    tag: "GBR",
    office: "court",
    fit: ["court"],
    camps: ["moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["gbr_lloyd_george"],
    allies: ["gbr_george_v"],
    fame: 2,
    source:
      "Arthur Bigge, b. 18 Jun 1849; artillery officer, Zulu War; private secretary to Queen Victoria from 1895, then to George; backed the name Windsor 1917; son John killed near Festubert, May 1915 (en.wikipedia Arthur Bigge, 1st Baron Stamfordham)",
  },
  {
    id: "gbr_hankey",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["civil", "east"],
    temperaments: ["cold", "cunning"],
    rivals: ["gbr_robertson"],
    allies: ["gbr_lloyd_george", "gbr_balfour"],
    fame: 1,
    source:
      "b. 1 Apr 1877, Biarritz; Royal Marine Artillery; Secretary of the Committee of Imperial Defence 1912; War Council secretary Nov 1914; War Cabinet secretary Dec 1916 (en.wikipedia Maurice Hankey). His Feb 1917 memorandum on convoys (en.wikipedia David Lloyd George). Boxing Day memorandum 1914 (memory)",
  },
  {
    id: "gbr_venetia",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["liberal"],
    temperaments: ["cold", "cunning", "weary"],
    rivals: [],
    allies: ["gbr_asquith", "gbr_montagu"],
    fame: 1,
    source:
      "b. 22 Aug 1887; letters from Asquith, over 560 survive, Mar 1914-May 1915 with political and military secrets of every kind; hers are lost; nurse probationer at the London Hospital from 6 Jan 1915; refused Montagu 1912 and 1913; engagement letter reached Asquith 12 May 1915; Wimereux as a VAD May 1915; married 26 Jul 1915 (en.wikipedia Venetia Stanley (1887-1948); H. H. Asquith)",
  },
  {
    id: "gbr_montagu",
    tag: "GBR",
    office: null,
    fit: ["munitions"],
    camps: ["civil", "liberal", "moderate"],
    temperaments: ["anxious", "cunning"],
    rivals: ["gbr_balfour"],
    allies: ["gbr_lloyd_george", "gbr_hankey", "gbr_venetia"],
    fame: 2,
    source:
      "b. 6 Feb 1879; radical Liberal, practising Jew; under-secretary for India 1910-1914; a friend of Asquith; ally of Lloyd George; opposed Zionism and the Balfour Declaration; India Secretary 1917-1922 (en.wikipedia Edwin Montagu; Reginald McKenna). Minister of Munitions 1916 (memory)",
  },
  {
    id: "gbr_haig",
    tag: "GBR",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["gbr_lloyd_george", "gbr_french"],
    allies: ["gbr_george_v", "gbr_robertson"],
    fame: 4,
    source:
      "b. 19 Jun 1861, Edinburgh, whisky family; Oxford, cavalry, French's brigade major in 1899; commanded the BEF from late 1915 (en.wikipedia Douglas Haig; John French). Aldershot and I Corps; wrote privately to the King; poor speaker (memory)",
  },
  {
    id: "gbr_french",
    tag: "GBR",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["anxious", "arrogant", "stubborn"],
    rivals: ["gbr_kitchener", "gbr_haig"],
    allies: ["gbr_wilson", "gbr_churchill"],
    fame: 4,
    source:
      "Midshipman, then cavalry; hero of the Boer War; Field Marshal; CIGS until Douglas replaced him 6 Apr 1914; commanded the BEF to Dec 1915; Commander-in-Chief Home Forces 1916-1918 (en.wikipedia John French; Charles Douglas). Fed the shell story to Repington (memory; see Shell Crisis of 1915)",
  },
  {
    id: "gbr_robertson",
    tag: "GBR",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["gbr_lloyd_george", "gbr_wilson", "gbr_hankey"],
    allies: ["gbr_haig", "gbr_kitchener"],
    fame: 2,
    source:
      "The one British soldier to hold every rank from private to field marshal, 1920; CIGS Dec 1915, with Haig as Commander-in-Chief; resigned Feb 1918 over strategy and Lloyd George (Britannica; Western Front Association; forcesnews). Dropped aitches, the short answers (memory)",
  },
  {
    id: "gbr_wilson",
    tag: "GBR",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "unionist", "west", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["gbr_asquith", "gbr_robertson", "gbr_redmond"],
    allies: ["gbr_french", "gbr_bonar_law", "gbr_carson"],
    fame: 2,
    source:
      "b. 5 May 1864, Currygrane, Longford, of an Ulster Protestant family, Irish accent; wounded in Burma; Director of Military Operations 1910, planned the expeditionary force to France; links to the Conservatives through his brother; backed the Ulster Unionists; charming, theatrical; CIGS 1918 (en.wikipedia Henry Hughes Wilson). Passing War Office matters to the opposition at the Curragh; 'the frocks' (memory)",
  },
  {
    id: "gbr_douglas",
    tag: "GBR",
    office: "chief_of_staff",
    fit: ["chief_of_staff"],
    camps: ["military", "west"],
    temperaments: ["weary", "anxious"],
    rivals: ["gbr_french"],
    allies: ["gbr_kitchener"],
    fame: 1,
    source:
      "b. 17 Jul 1850, Cape of Good Hope; CIGS from 6 Apr 1914; not in the best of health, had little effect on the war; d. of strain and overwork 25 Oct 1914 (en.wikipedia Charles Douglas)",
  },
  {
    id: "gbr_fisher",
    tag: "GBR",
    office: null,
    fit: ["sea_lord"],
    camps: ["east", "hard"],
    temperaments: ["arrogant", "stubborn", "cunning"],
    rivals: ["gbr_churchill", "gbr_kitchener"],
    allies: ["gbr_jellicoe"],
    fame: 4,
    source:
      "b. 25 Jan 1841, Ceylon; retired 1910; a constant visitor to Churchill from Aug 1914; recalled Oct 1914 when Battenberg was forced out; resigned seven months later over Gallipoli; Baltic in the Crimean War (en.wikipedia John Fisher). Letters with underlinings and capitals (memory)",
  },
  {
    id: "gbr_jellicoe",
    tag: "GBR",
    office: null,
    fit: ["sea_lord"],
    camps: ["moderate"],
    temperaments: ["anxious", "cold", "weary"],
    rivals: ["gbr_lloyd_george"],
    allies: ["gbr_fisher", "gbr_balfour"],
    fame: 3,
    source:
      "b. 5 Dec 1859, Southampton, son of a mail-steamer captain; took the Grand Fleet Aug 1914 when Callaghan was removed; Jutland; First Sea Lord Nov 1916; told the admirals' case against convoys (en.wikipedia John Jellicoe; David Lloyd George). Dismissed Dec 1917 (en.wikipedia David Lloyd George, winter 1917-18)",
  },
  {
    id: "gbr_battenberg",
    tag: "GBR",
    office: "sea_lord",
    fit: ["sea_lord"],
    camps: ["moderate"],
    temperaments: ["weary", "cold"],
    rivals: ["gbr_northcliffe"],
    allies: ["gbr_churchill", "gbr_george_v"],
    fame: 3,
    source:
      "b. 24 May 1854, Graz; Royal Navy at fourteen; First Sea Lord 1912; with Churchill cancelled the fleet's dispersal on the eve of war; a German prince related to the royal family; forced to resign Oct 1914 for his German origin (en.wikipedia Prince Louis of Battenberg; John Fisher)",
  },
  {
    id: "gbr_hall",
    tag: "GBR",
    office: null,
    fit: ["intelligence"],
    camps: ["hard"],
    temperaments: ["cunning", "cold"],
    rivals: ["gbr_grey"],
    allies: ["gbr_balfour"],
    fame: 1,
    source:
      "b. 28 Jun 1870, son of the first head of Naval Intelligence; ill-health ended his sea career; Director of the Intelligence Division Oct 1914; with Ewing built Room 40; 'Blinker'; Room 40 led to the Aud 21 Apr 1916; reluctant to let the Zimmermann telegram out for fear of showing the codes (en.wikipedia Reginald Hall; Zimmermann Telegram)",
  },
  {
    id: "gbr_northcliffe",
    tag: "GBR",
    office: null,
    fit: [],
    camps: ["unionist", "hard"],
    temperaments: ["arrogant", "cunning", "anxious"],
    rivals: ["gbr_asquith", "gbr_kitchener", "gbr_haldane"],
    allies: ["gbr_lloyd_george"],
    fame: 4,
    source:
      "b. 15 Jul 1865, Chapelizod, Dublin; Daily Mail 1896, Daily Mirror, The Times from 1908; the shell crisis of 1915; mission to the United States 1917; director of propaganda in enemy countries (en.wikipedia Alfred Harmsworth). At the War Office with Lloyd George 3 Dec 1916 (en.wikipedia H. H. Asquith, Clarke's diary)",
  },
  {
    id: "gbr_spring_rice",
    tag: "GBR",
    office: "ambassador_washington",
    fit: ["ambassador_washington"],
    camps: ["civil", "moderate"],
    temperaments: ["anxious", "weary"],
    rivals: ["gbr_northcliffe"],
    allies: ["gbr_grey"],
    fame: 2,
    source:
      "b. 27 Feb 1859, Anglo-Irish; Eton and Balliol with Curzon; ambassador to the United States 1912-1918; brother Gerald killed 1916; d. 14 Feb 1918 (en.wikipedia Cecil Spring Rice). Friend of Roosevelt, ill at ease with Wilson (memory)",
  },
  {
    id: "gbr_bertie",
    tag: "GBR",
    office: "ambassador_paris",
    fit: ["ambassador_paris"],
    camps: ["civil", "hard"],
    temperaments: ["arrogant", "cold"],
    rivals: ["gbr_lloyd_george"],
    allies: ["gbr_grey"],
    fame: 2,
    source:
      "b. 17 Aug 1844; Foreign Office career, Rome, ambassador in Paris 1905-1918; often bypassed by special missions in the war (en.wikipedia Francis Bertie)",
  },
  {
    id: "gbr_buchanan",
    tag: "GBR",
    office: "ambassador_petersburg",
    fit: ["ambassador_petersburg"],
    camps: ["civil", "moderate"],
    temperaments: ["anxious", "weary"],
    rivals: ["gbr_northcliffe"],
    allies: ["gbr_grey"],
    fame: 2,
    source:
      "b. 25 Nov 1854, Copenhagen, a diplomat's son; a strong bond with Nicholas, urged constitutional reform to stave off revolution; backed the Duma; complained in Nov 1916 he could hardly get an audience (en.wikipedia George Buchanan)",
  },
];

/** The person in the seat at the start: not a person to summon or dismiss. */
export const GBR_SEAT_PERSON = "gbr_asquith";

/**
 * How each person talks, as GW_VOICE_NOTES does for the first cast. Grey and
 * Goschen's notes are there.
 */
export const GBR_VOICE_NOTES: Readonly<Record<string, string>> = {
  gbr_asquith:
    "플레이어의 말투 기준. 라틴어 문장가의 짧고 고른 말. 기다리자는 말을 많이 쓴다. 남의 흥분을 한 문장으로 식힌다. 사람들이 그의 입을 옮길 때의 말이다. 그 자신은 사람 탭에 없다.",
  gbr_lloyd_george:
    "웨일스 설교단의 사람. 낮게 시작해서 듣는 이의 눈을 보며 올라간다. 예를 들고, 농민과 예배당 얘기를 불쑥 꺼낸다. 상대가 듣고 싶은 말을 먼저 말한다. 숫자는 틀려도 방향은 안 틀린다. 어제의 자기 말을 기억하지 않는다.",
  gbr_churchill:
    "말이 문장으로 나온다. 어제 쓴 각서를 외워서 말한다. 형용사를 쌓다가 큰 그림으로 간다. 해군성에 앉아 육군 작전을 말한다. 혼나면 눈이 젖고 다음 날 또 온다. 듣는 시간이 없다.",
  gbr_kitchener:
    "말을 안 한다. 식탁에서는 더 안 한다. 한 문장, 그리고 침묵. 숫자를 내놓지 않고 '제가 알아서 합니다'로 끝낸다. 동양의 비유를 쓴다. 혼자 지도를 본 사람의 단정.",
  gbr_mckenna:
    "회계사처럼 말한다. 표의 몇째 줄이라고 대면서 말한다. 작고 단정하다. 로이드 조지의 이름이 나오면 입이 얇아진다. 틀린 숫자를 고쳐 주는 일을 즐긴다.",
  gbr_haldane:
    "느리고 둥글고 끝나지 않는 문장. 독일 철학과 육군 조직표를 같이 말한다. 욕을 먹어도 설명한다. 초대받은 저녁에 혼자 오래 남는다.",
  gbr_simon:
    "법정의 말. 쌍방의 입장을 흠 없이 요약하고 자기 입장은 뒤로 미룬다. 정확한데 따뜻하지 않다. '엄밀히 말하면'이 입에 붙었다.",
  gbr_morley:
    "글로 산 늙은 자유주의자. 글레드스턴과 버크를 인용한다. 작은 목소리로 큰 말을 한다. 자기가 늙었다는 말을 무기로 쓴다.",
  gbr_birrell:
    "우스갯소리로 슬픔을 넘기는 문인. 아일랜드 일을 책 얘기처럼 한다. 더블린보다 런던에 오래 있다. 나쁜 소식을 농담 끝에 달아서 내놓는다.",
  gbr_bonar_law:
    "글래스고 철강상의 말. 메모 없이 숫자를 외운다. 낮고 침울하고 직설적이다. 파이프 담배. 체스를 둔다. 자기는 큰 인물이 아니라고 하며 상대를 궁지로 민다.",
  gbr_carson:
    "법정의 반대 신문. 질문으로 사람을 벗긴다. 더블린 억양. 몸이 아프다는 말을 자주 하고 끝까지 간다. 얼스터를 말할 때 목소리가 낮아진다. 양보는 없고 한숨은 있다.",
  gbr_balfour:
    "게으른 척하는 철학자. 긴 다리를 뻗고 앉아 양쪽을 다 말한다. 그 말이 칼인지 나중에 안다. 아무것도 확신하지 않는다는 말을 확신을 갖고 한다.",
  gbr_milner:
    "독일에서 배운 행정가. 정당을 경멸하고 국가를 말한다. 건조한 보고서의 말. 제국 얘기에서만 온도가 오른다. 사람을 설득하지 않고 결론을 건넨다.",
  gbr_redmond:
    "의회의 늙은 신사. 격식 있는 긴 문장, 웩스퍼드 지주의 위엄. 약속을 믿어 주는 사람의 슬픈 끈기. 뒤에 서 있는 더블린의 젊은 사람들을 말할 때 말끝이 약하다.",
  gbr_henderson:
    "감리교 설교자이자 주물공. 장부처럼 또박또박 말한다. '우리 사람들'이라 한다. 술을 입에 안 댄다. 약속의 문구를 다시 읽어 달라고 한다. 모욕당하면 조용히 일어선다.",
  gbr_george_v:
    "해군 사관의 말. 짧고 고함에 가깝고 기분이 얼굴에 나온다. 사촌들을 이름으로 부른다. 헌법을 지키겠다고 말하면서 걱정을 줄줄 말한다. 총리에게 '자네'가 아니라 이름 없이 말을 건넨다.",
  gbr_stamfordham:
    "빅토리아 여왕 때부터 있었던 사람. 왕의 뜻을 '폐하께서는 궁금해하십니다'로 전한다. 쪽지 한 장의 말. 절대 안 서두른다.",
  gbr_hankey:
    "방에서 가장 많이 아는 사람. 안경 너머로 듣고 필기한다. 자기 의견을 '기록해 둘 것은'으로 시작한다. 누구 편도 아니라고 말하고 모든 사람에게 필요한 말을 한다.",
  gbr_venetia:
    "스물여섯의 영리한 귀족 아가씨. 총리를 놀린다. 짧고 건조하고 잘 웃는다. 그가 쓴 편지를 다 읽고 답은 짧다. 아는 것이 많은데 아는 체를 안 한다. 내각 사람들을 별명으로 부른다.",
  gbr_montagu:
    "불안한 천재. 자기를 깎아내리며 시작하고 뜻밖의 안을 내놓는다. 누구에게나 쓸모 있고 누구에게도 안심이 안 된다. 말끝을 흐리다가 숫자에서 또렷해진다.",
  gbr_haig:
    "말을 못 한다. 문장이 끝을 못 맺고 손이 대신 지도를 가리킨다. 그러나 글은 깔끔하다. '하느님', '의무', '다음 공세'. 군복 단추처럼 단정하다. 정치가를 믿지 않는다는 것을 숨기지도 않는다.",
  gbr_french:
    "기병의 기분파. 오늘의 승리와 내일의 절망이 같은 입에서 나온다. 얼굴이 붉어진다. 키치너의 이름을 못 참는다. 부하에게 다정하다.",
  gbr_robertson:
    "사병에서 올라온 사람. 사병 시절의 말씨를 끝내 안 고친다. 짧다. 묻는 말에 '다른 말을 들었습니다'로 끝낸다. 서부, 서부, 서부. 이유를 말하지 않고 안 된다고 한다.",
  gbr_wilson:
    "키 크고 얼굴에 흉터 있는 아일랜드 사람의 농담. 프랑스어를 섞는다. 정치가를 '프록코트'라 부르고 별명을 붙인다. 친한 척 팔을 잡고 기밀을 말한다. 일기장이 있다.",
  gbr_douglas:
    "병든 늙은 장군. 교범을 말하고 곧 지친다. 일의 양을 말한다. 자리에 어울리는지 자기도 모른다.",
  gbr_fisher:
    "일흔셋의 불꽃. 밑줄과 대문자로 말한다. 성경을 인용하고 춤을 춘다. 사직을 무기로 쓴다. '해체하라, 또는 처형하라' 같은 소리를 농담인지 모르게 한다. 발트해를 사랑한다.",
  gbr_jellicoe:
    "작고 꼼꼼한 제독. 포탄의 신관까지 자기가 본다. 어두운 쪽부터 말한다. 함대 수를 세고 또 센다. 잃으면 안 된다는 말이 모든 문장의 뒤에 있다.",
  gbr_battenberg:
    "품위 있는 왕족 제독. 영어가 완벽하고 그래서 더 상처받는다. 말을 줄인다. 왕과 친척이지만 그 말을 먼저 꺼내지 않는다.",
  gbr_hall:
    "눈을 깜박이는 작은 대령. 빠른 말, 장난기, 그리고 말하지 않은 것이 더 많다. '이건 제가 말씀 안 드린 겁니다'. 외무부를 믿지 않는다.",
  gbr_northcliffe:
    "신문의 나폴레옹. 전화로 말한다. 제목처럼 말한다. 어제 띄운 사람을 오늘 내린다. 독자의 수를 대며 민의를 말한다. 외로움이 묻어난다.",
  gbr_spring_rice:
    "시인 기질의 신경질적인 대사. 편지가 길고 비관이 멋있다. 워싱턴 사람들을 빈정대다 본국의 일을 걱정한다. 몸이 안 좋다.",
  gbr_bertie:
    "파리의 늙은 대사. 입이 험하고 프랑스인과 특사를 두루 비웃는다. 그래서 들을 만하다. 소문을 값 매겨서 판다.",
  gbr_buchanan:
    "단정한 은발의 대사. 예의를 지키다 한 번 선을 넘어 경고한다. 차르를 좋아한다. 궁정의 문이 닫혀 가는 것을 숫자처럼 적는다.",
};

/**
 * ww179: names for the vacancy box of an office that had none: the court and
 * the embassies in Paris, Petrograd and Washington. Appended after every
 * other list in Content.ts, so the seed rolls of the cast before them stay.
 */
export const GBR_POSTS: readonly GwPersonDef[] = [
  {
    id: "gbr_wigram",
    tag: "GBR",
    office: null,
    fit: ["court"],
    camps: ["moderate"],
    temperaments: ["cold", "weary"],
    rivals: [],
    allies: ["gbr_stamfordham", "gbr_george_v"],
    fame: 1,
    source:
      "Clive Wigram, b. 5 Jul 1873; Indian Army officer; assistant private secretary and equerry to the King 1910-1931, then private secretary after Stamfordham, 1931-1936 (en.wikipedia Clive Wigram, 1st Baron Wigram)",
  },
  {
    id: "gbr_derby",
    tag: "GBR",
    office: null,
    fit: ["ambassador_paris", "war"],
    camps: ["unionist", "hard", "west"],
    temperaments: ["anxious", "weary"],
    rivals: ["gbr_lloyd_george"],
    allies: ["gbr_haig", "gbr_robertson"],
    fame: 3,
    source:
      "Edward Stanley, 17th Earl of Derby, b. 4 Apr 1865; Secretary of State for War Dec 1916-Apr 1918, replaced by Milner; ambassador to France Apr 1918-1920 after Bertie, Hardinge after him; war diary 'Paris 1918' (en.wikipedia Edward Stanley, 17th Earl of Derby). The Derby scheme of 1915 and the Pals battalions of Liverpool (memory)",
  },
  {
    id: "gbr_hardinge",
    tag: "GBR",
    office: null,
    fit: ["ambassador_petersburg", "ambassador_paris"],
    camps: ["civil", "moderate"],
    temperaments: ["cold", "arrogant"],
    rivals: [],
    allies: ["gbr_grey"],
    fame: 2,
    arrives: "1916-04-04",
    source:
      "Charles Hardinge, b. 20 Jun 1858; ambassador in St Petersburg 1904-1906; permanent under-secretary 1906-1910; Viceroy of India 1910 to 4 Apr 1916, then permanent under-secretary again 1916-1920; ambassador in Paris after Derby (en.wikipedia Charles Hardinge, 1st Baron Hardinge of Penshurst; iranicaonline Hardinge)",
  },
  {
    id: "gbr_reading",
    tag: "GBR",
    office: null,
    fit: ["ambassador_washington"],
    camps: ["liberal", "moderate"],
    temperaments: ["cunning", "cold"],
    rivals: [],
    allies: ["gbr_asquith", "gbr_lloyd_george"],
    fame: 3,
    source:
      "Rufus Isaacs, b. 10 Oct 1860; Lord Chief Justice 1913-1921; high commissioner to the United States and Canada Sep 1917; ambassador in Washington 1918-1919 while still Lord Chief Justice (britannica Rufus Daniel Isaacs; en.wikipedia Rufus Isaacs). The Marconi affair 1912-1913 (memory)",
  },
];
