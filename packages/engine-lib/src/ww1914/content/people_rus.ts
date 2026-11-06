import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * Russia's cast for the first release. The seat is the Tsar, `rus_nicholas`
 * in people.ts: he stays there for the other countries' wires and is never
 * summoned from this seat (RUS_SEAT_PERSON).
 *
 * RUS_SUMMONED are the sixteen with summons talks, six each. The others come
 * through visits, voices and the vacancy box. Text is in RUS.people.json.
 * Buchanan, whom the visits also cast, is in Britain's file.
 *
 * Offices are those of June 1914. Nobody held `supreme_commander` then, so
 * it stays empty until a scene fills it: the Tsar leading the army himself is
 * that office empty. Revolution's people have `fit: []`: only a scene or a
 * regime puts them in office, never the vacancy box.
 *
 * Camps, one per axis: military/civil, court/duma, hard/moderate. Soldiers of
 * the German and Austrian front also hold `east` and Caucasus men `west`,
 * which is what `armyCommander` and `proposalsFor` read.
 *
 * `source`: "(memory)" marks facts not checked against a page. Order matters
 * to the seed rolls: append.
 */
export const RUS_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "rus_alexandra",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "court", "hard"],
    temperaments: ["stubborn", "anxious"],
    rivals: ["rus_nikolasha", "rus_rodzianko", "rus_polivanov", "rus_guchkov"],
    allies: ["rus_rasputin", "rus_goremykin", "rus_protopopov"],
    fame: 5,
    source:
      "b. 6 Jun 1872, Darmstadt, mother Alice d. 14 Dec 1878; asked to be named regent in 1900 and the ministers refused; had Polivanov removed Mar 1916 (en.wikipedia Alexandra Feodorovna, Alexei Polivanov). Trained as a Red Cross nurse, letters to Nicholas at Mogilev, ran the ministers' list from Sep 1915 (memory; letters at alexanderpalace.org)",
  },
  {
    id: "rus_rasputin",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "court", "moderate"],
    temperaments: ["cunning", "weary"],
    rivals: ["rus_nikolasha", "rus_rodzianko", "rus_khvostov", "rus_samarin"],
    allies: ["rus_alexandra", "rus_protopopov", "rus_sturmer"],
    fame: 5,
    source:
      "b. 21 Jan 1869, Pokrovskoye, Tobolsk; lamplighter at court; Stolypin's inquiry, Kokovtsov asked for his exile 1912; stabbed by Khioniya Guseva at Pokrovskoye 12 Jul 1914 NS, surgery at Tyumen, against the war; killed 30 Dec 1916 by Yusupov, Dmitri Pavlovich, Purishkevich (en.wikipedia Grigori Rasputin, Vladimir Kokovtsov). Called the couple Papa and Mama (memory)",
  },
  {
    id: "rus_goremykin",
    tag: "RUS",
    office: "chancellor",
    fit: ["chancellor"],
    camps: ["civil", "court", "hard"],
    temperaments: ["weary", "stubborn"],
    rivals: ["rus_krivoshein", "rus_rodzianko", "rus_sazonov"],
    allies: ["rus_alexandra", "rus_maklakov"],
    fame: 3,
    source:
      "b. 8 Nov 1839; prime minister 1906 and 1914-2 Feb 1916, replaced Kokovtsov at seventy-four; could not work with the First Duma; candles round his coffin remark; killed in a robbery at Sochi 24 Dec 1917 (en.wikipedia Ivan Goremykin)",
  },
  {
    id: "rus_sazonov",
    tag: "RUS",
    office: "foreign",
    fit: ["foreign"],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["anxious", "stubborn"],
    rivals: ["rus_sturmer", "rus_goremykin", "rus_rasputin"],
    allies: ["rus_krivoshein", "fra_paleologue"],
    fame: 4,
    source:
      "b. 10 Aug 1860; foreign minister 11 Oct 1910-20 Jul 1916; Stolypin's brother-in-law; Tsarskoye Selo Lyceum, London embassy; Straits two-fifths of trade; written guarantee to Romania 1 Oct 1914; Allied assent on Constantinople Mar 1915; dismissed after proposing Polish autonomy; signed the ministers' protest 1915 (en.wikipedia Sergey Sazonov; Paléologue's memoirs, 1915). His protest at partial mobilisation (en.wikipedia July Crisis)",
  },
  {
    id: "rus_krivoshein",
    tag: "RUS",
    office: "agriculture",
    fit: ["agriculture", "chancellor"],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["cunning", "cold"],
    rivals: ["rus_goremykin", "rus_maklakov"],
    allies: ["rus_sazonov", "rus_polivanov", "rus_bark"],
    fame: 3,
    source:
      "b. 31 Jul 1857, Warsaw; head of agriculture 1908-1915; Stolypin's land reform; respected by the Tsar and the public; urged Maklakov to mind the Duma; at the 24-25 Jul 1914 council argued against weakness though Russia was not ready; moderate reform 1915; dismissed after opposing the Tsar's command (en.wikipedia Alexander Krivoshein, July Crisis)",
  },
  {
    id: "rus_bark",
    tag: "RUS",
    office: "finance",
    fit: ["finance"],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["cold", "cunning"],
    rivals: ["rus_kokovtsov", "rus_sturmer"],
    allies: ["rus_krivoshein", "rus_sazonov"],
    fame: 2,
    source:
      "Credit Chancellery 1891; studied banking in Berlin 1903; Volga-Kama Bank; finance minister 1914 to the abdication, replacing Kokovtsov (en.wikipedia Pyotr Bark). Appointed to wean the treasury off vodka; ban cost about a third of revenue, Goremykin's figure 800 million rubles; suspended gold conversion summer 1914 (time.com; prlib.ru). London loans and gold shipments (memory)",
  },
  {
    id: "rus_sukhomlinov",
    tag: "RUS",
    office: "war",
    fit: ["war"],
    camps: ["military", "court", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["rus_nikolasha", "rus_polivanov", "rus_guchkov"],
    allies: ["rus_yanushkevich", "rus_rasputin"],
    fame: 4,
    source:
      "b. 16 Aug 1848; war minister 24 Mar 1909-24 Jun 1915; insisted partial mobilisation was impossible; Paléologue's verdict; wife thirty years younger, who went to Rasputin for his release; Myasoedov hanged Mar 1915; arrested, freed to house arrest by Alexandra and Protopopov (en.wikipedia Vladimir Sukhomlinov, July Crisis)",
  },
  {
    id: "rus_polivanov",
    tag: "RUS",
    office: null,
    fit: ["war"],
    camps: ["military", "duma", "moderate"],
    temperaments: ["cold", "cunning"],
    rivals: ["rus_sukhomlinov", "rus_alexandra", "rus_rasputin"],
    allies: ["rus_guchkov", "rus_krivoshein"],
    fame: 3,
    source:
      "b. 16 Mar 1855; engineer, 1877-78 war; assistant war minister until 1912, dismissed for working with Duma liberals; State Council 1912; war minister Jun 1915-Mar 1916, argued against the Tsar's command, removed by the Tsarina (en.wikipedia Alexei Polivanov)",
  },
  {
    id: "rus_nikolasha",
    tag: "RUS",
    office: null,
    fit: ["supreme_commander"],
    camps: ["military", "east", "duma", "hard"],
    temperaments: ["stubborn", "arrogant", "weary"],
    rivals: ["rus_sukhomlinov", "rus_rasputin", "rus_alexandra"],
    allies: ["rus_yanushkevich", "rus_danilov"],
    fame: 5,
    source:
      "b. 6 Nov 1856; refused dictatorship in 1905 with a pistol to his head; m. Anastasia of Montenegro 29 Apr 1907, her sister Milica at his brother's side; hunter; Supreme Commander 31 Jul 1914-23 Aug 1915, then Caucasus viceroy; named again Mar 1917 (en.wikipedia Grand Duke Nicholas Nikolaevich of Russia). Tall, the threat to hang Rasputin (memory, the threat may be legend)",
  },
  {
    id: "rus_alekseev",
    tag: "RUS",
    office: null,
    fit: ["chief_of_staff", "supreme_commander"],
    camps: ["military", "east", "duma", "moderate"],
    temperaments: ["cold", "weary", "stubborn"],
    rivals: ["rus_rasputin", "rus_ivanov"],
    allies: ["rus_guchkov", "rus_evert"],
    fame: 3,
    source:
      "b. 15 Nov 1857; captain's son of modest background, volunteer 1873; professor at the Academy; chief of staff Kiev district 1908; chief of staff of the Southwestern Front 1914; Stavka chief 1915-1917; commander-in-chief Mar-May 1917; Volunteer Army, d. 8 Oct 1918 (en.wikipedia Mikhail Alekseyev). Northwestern Front Mar 1915, ill in winter 1916-17, polled the commanders (en.wikipedia Aleksei Evert; memory)",
  },
  {
    id: "rus_brusilov",
    tag: "RUS",
    office: null,
    fit: ["supreme_commander", "chief_of_staff"],
    camps: ["military", "east", "duma", "hard"],
    temperaments: ["arrogant", "stubborn", "cold"],
    rivals: ["rus_evert", "rus_ivanov", "rus_kornilov"],
    allies: ["rus_alekseev"],
    fame: 3,
    source:
      "b. 31 Aug 1853; cavalry officer who saw cavalry was finished; Eighth Army Jul 1914, Southwest Front; the 1916 offensive; helped the Red Army to 1924 (en.wikipedia Aleksei Brusilov). Replaced Ivanov Mar 1916, Supreme Commander May-Jul 1917 (memory)",
  },
  {
    id: "rus_rodzianko",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["stubborn", "arrogant", "anxious"],
    rivals: [
      "rus_rasputin",
      "rus_goremykin",
      "rus_protopopov",
      "rus_alexandra",
    ],
    allies: ["rus_lvov", "rus_krivoshein"],
    fame: 3,
    source:
      "b. 21 Feb 1859; chamberlain, Octobrist founder; Duma chairman from 22 Mar 1911; colourful language; thought Rasputin's coming the start of the fall; headed the Provisional Committee 1917 (en.wikipedia Mikhail Rodzianko). His telegrams of Feb-Mar 1917, his great size and voice (memory)",
  },
  {
    id: "rus_milyukov",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "hard"],
    temperaments: ["stubborn", "cold", "arrogant"],
    rivals: ["rus_kerensky", "rus_sturmer", "rus_protopopov"],
    allies: ["rus_sazonov"],
    fame: 3,
    source:
      "b. 27 Jan 1859, Moscow; historian dismissed 1894, jailed, taught at Sofia, Kresty prison 1902; Kadet leader; younger son died in the war; for Constantinople; formed the Progressive Bloc Aug 1915; 'stupidity or treason' speech; foreign minister 1917, working to keep Russia in the war (en.wikipedia Pavel Milyukov, Progressive Bloc)",
  },
  {
    id: "rus_guchkov",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["rus_sukhomlinov", "rus_alexandra", "rus_rasputin"],
    allies: ["rus_polivanov", "rus_alekseev"],
    fame: 3,
    source:
      "b. 14 Oct 1862, Moscow merchant family; fought for the Boers, wounded and taken; duels; Red Cross in Manchuria, stayed with the wounded at Mukden; Duma speaker 1910, hated at court; pressed the charges on Sukhomlinov; chair of the Central War Industry Committee Jul 1915; took the abdication with Shulgin; war minister 1917 (en.wikipedia Alexander Guchkov)",
  },
  {
    id: "rus_kerensky",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["anxious", "arrogant"],
    rivals: ["rus_milyukov", "rus_protopopov", "rus_kornilov", "rus_lenin"],
    allies: ["rus_chkheidze"],
    fame: 3,
    source:
      "b. 4 May 1881, Simbirsk, raised in Tashkent; lawyer in political trials; went to the Lena goldfields 1912; Fourth Duma as a Trudovik; justice, then war minister, then head of the Provisional Government; vice-chairman of the Soviet (en.wikipedia Alexander Kerensky)",
  },
  {
    id: "rus_protopopov",
    tag: "RUS",
    office: null,
    fit: ["interior"],
    camps: ["civil", "court", "moderate"],
    temperaments: ["anxious", "cunning"],
    rivals: ["rus_rodzianko", "rus_guchkov", "rus_milyukov"],
    allies: ["rus_rasputin", "rus_alexandra"],
    fame: 2,
    source:
      "b. 30 Dec 1866; landowner, textile mill; cavalry school; Octobrist, Duma vice-president under Rodzianko 1914-16; Stockholm talk with Warburg 1916; interior minister Sep 1916-Feb 1917 by Alexandra's favour; failing mind; freed Sukhomlinov; shot by the Bolsheviks 1918 (en.wikipedia Alexander Protopopov, Vladimir Sukhomlinov)",
  },
  // Below: no summons talks. Visits, voices, the vacancy box.
  {
    id: "rus_fredericks",
    tag: "RUS",
    office: "court",
    fit: ["court"],
    camps: ["civil", "court", "moderate"],
    temperaments: ["weary", "stubborn"],
    rivals: ["rus_rasputin"],
    allies: ["rus_goremykin"],
    fame: 2,
    source:
      "b. 28 Nov 1838, Finland-Swedish baron, Lutheran family; minister of the imperial household 1897-1917; in the carriage at the abdication (en.wikipedia Woldemar Freedericksz, Abdication of Nicholas II). Failing memory by 1916 (memory)",
  },
  {
    id: "rus_yanushkevich",
    tag: "RUS",
    office: "chief_of_staff",
    fit: ["chief_of_staff"],
    camps: ["military", "east", "court", "hard"],
    temperaments: ["anxious", "weary"],
    rivals: ["rus_polivanov"],
    allies: ["rus_sukhomlinov", "rus_nikolasha", "rus_danilov"],
    fame: 2,
    source:
      "b. 13 May 1868; head of the Academy 1913-14; Chief of the General Staff Mar 1914; chief of staff to the Grand Duke Aug 1914-Sep 1915 (en.wikipedia Nikolai Yanushkevich). No field command behind him, expulsions from the front zone 1915 (memory, record text only)",
  },
  {
    id: "rus_danilov",
    tag: "RUS",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "east", "duma", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["rus_ivanov", "rus_alekseev"],
    allies: ["rus_yanushkevich", "rus_nikolasha"],
    fame: 2,
    source:
      "b. 13 Aug 1866; Quartermaster-General on the General Staff, a major hand in the 1914 war plan; ran operations at Stavka 1914-15 (en.wikipedia Yuri Danilov). Northern Front staff later (memory)",
  },
  {
    id: "rus_grigorovich",
    tag: "RUS",
    office: "navy",
    fit: ["navy"],
    camps: ["military", "duma", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["rus_sukhomlinov"],
    allies: ["rus_krivoshein"],
    fame: 2,
    source:
      "b. 26 Jan 1853; navy minister 1 Apr 1911-13 Mar 1917 (en.wikipedia Ivan Grigorovich). Said with Sukhomlinov at the Jul 1914 council that Russia was not ready (en.wikipedia July Crisis). Good terms with the Duma (memory); his rivalry with Sukhomlinov is inferred from the budget",
  },
  {
    id: "rus_kolchak",
    tag: "RUS",
    office: null,
    fit: ["navy"],
    camps: ["military", "west", "hard"],
    temperaments: ["arrogant", "anxious"],
    rivals: ["rus_kerensky"],
    allies: ["rus_grigorovich"],
    fame: 2,
    source:
      "b. 16 Nov 1874; hydrographer; lobbied the Duma for submarines and aircraft; Baltic Fleet operations 1914; Black Sea Fleet commander (en.wikipedia Alexander Kolchak). Mine war, the Bosporus scheme, sword thrown overboard 1917 (memory)",
  },
  {
    id: "rus_maklakov",
    tag: "RUS",
    office: "interior",
    fit: ["interior"],
    camps: ["civil", "court", "hard"],
    temperaments: ["cunning", "anxious"],
    rivals: ["rus_krivoshein", "rus_rodzianko"],
    allies: ["rus_goremykin"],
    fame: 2,
    source:
      "b. 21 Sep 1871; governor of Chernigov; interior minister 16 Dec 1912-5 Jun 1915; brother Vasily a liberal Duma deputy (en.wikipedia Nikolay Maklakov). Krivoshein pressed him to mind the Duma (en.wikipedia Alexander Krivoshein). Mimicry at court (memory)",
  },
  {
    id: "rus_shcherbatov",
    tag: "RUS",
    office: null,
    fit: ["interior"],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["rus_khvostov"],
    allies: ["rus_krivoshein"],
    fame: 1,
    source:
      "Prince of the Rurik line; interior minister 5 Jun-26 Sep 1915 (en.wikipedia Nikolai Shcherbatov). Signed the ministers' protest (Paléologue's memoirs, 1915). Horse breeding (memory)",
  },
  {
    id: "rus_khvostov",
    tag: "RUS",
    office: null,
    fit: ["interior"],
    camps: ["civil", "court", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["rus_rasputin", "rus_shcherbatov"],
    allies: ["rus_goremykin"],
    fame: 2,
    source:
      "Chamberlain, Black Hundreds, Union of the Russian People; interior minister five months; opposed reform; accused Rasputin of spying for Germany (en.wikipedia Alexei Khvostov). Kokovtsov opposed his appointment (en.wikipedia Vladimir Kokovtsov)",
  },
  {
    id: "rus_sturmer",
    tag: "RUS",
    office: null,
    fit: ["chancellor", "foreign"],
    camps: ["civil", "court", "hard"],
    temperaments: ["cunning", "weary"],
    rivals: ["rus_sazonov", "rus_milyukov"],
    allies: ["rus_rasputin", "rus_alexandra"],
    fame: 2,
    source:
      "Prime minister 2 Feb-23 Nov 1916, foreign minister 7 Jul-10 Nov 1916 (en.wikipedia Boris Shturmer). His German name, the speech of Nov 1916 naming him (en.wikipedia Pavel Milyukov; memory)",
  },
  {
    id: "rus_trepov",
    tag: "RUS",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "court", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["rus_protopopov", "rus_rasputin"],
    allies: ["rus_krivoshein"],
    fame: 1,
    source:
      "b. 30 Sep 1862; prime minister 23 Nov 1916-9 Jan 1917; monarchist for moderate reform, against Rasputin (en.wikipedia Alexander Trepov). Transport minister, the Murmansk line (en.wikipedia Kirov Railway; memory)",
  },
  {
    id: "rus_golitsyn",
    tag: "RUS",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "court", "moderate"],
    temperaments: ["weary", "anxious"],
    rivals: ["rus_rodzianko"],
    allies: ["rus_alexandra"],
    fame: 1,
    source:
      "b. 12 Apr 1850; governor of Arkhangelsk, Kaluga, Tver; Red Cross famine relief 1907-08; State Council 1912; last prime minister from 9 Jan 1917 (en.wikipedia Nikolai Golitsyn). Asked not to be appointed, worked with the Tsarina's prisoner relief (memory)",
  },
  {
    id: "rus_kokovtsov",
    tag: "RUS",
    office: null,
    fit: ["chancellor", "finance"],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["rus_rasputin", "rus_goremykin", "rus_bark"],
    allies: ["rus_krivoshein"],
    fame: 2,
    source:
      "b. 18 Apr 1853; finance minister, prime minister 1911-1914; asked for Rasputin's exile 1912; opposed Khvostov (en.wikipedia Vladimir Kokovtsov). Fell over the vodka revenue and in the Tsar's disfavour Feb 1914 (time.com; memory)",
  },
  {
    id: "rus_durnovo",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "court", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["rus_sazonov", "rus_witte"],
    allies: ["rus_goremykin"],
    fame: 2,
    source:
      "b. 1845, d. 24 Sep 1915; interior minister 1905-06, State Council; letter to Nicholas Feb 1914 against the British tie and on what a war with Germany would bring (en.wikipedia Pyotr Nikolayevich Durnovo). That war would end in social revolution; its fate in the Tsar's papers (memory)",
  },
  {
    id: "rus_witte",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["arrogant", "weary"],
    rivals: ["rus_durnovo", "rus_goremykin"],
    allies: ["rus_kokovtsov"],
    fame: 3,
    source:
      "b. 29 Jun 1849, d. 13 Mar 1915; railways, finance, first prime minister, October Manifesto; strategy to avoid wars; spoke against the war to Paléologue Jul 1914 (en.wikipedia Sergei Witte, Russian entry into World War I)",
  },
  {
    id: "rus_shuvaev",
    tag: "RUS",
    office: null,
    fit: ["war"],
    camps: ["military", "court", "moderate"],
    temperaments: ["stubborn", "weary"],
    rivals: ["rus_guchkov"],
    allies: ["rus_alexandra"],
    fame: 1,
    source:
      "b. 24 Oct 1854; chief quartermaster from 1909; war minister 1916 (en.wikipedia Dmitry Shuvayev; Alexei Polivanov). A soldier of supply, honest and out of his depth (memory)",
  },
  {
    id: "rus_belyaev",
    tag: "RUS",
    office: null,
    fit: ["war"],
    camps: ["military", "court", "moderate"],
    temperaments: ["anxious", "cold"],
    rivals: ["rus_polivanov"],
    allies: ["rus_alexandra"],
    fame: 1,
    source:
      "b. 23 Dec 1863; acting chief of the General Staff 1914-16; war minister 1917 (en.wikipedia Mikhail Belyayev). Rumania liaison 1916, 'the dead head' (memory)",
  },
  {
    id: "rus_ivanov",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["military", "east", "court", "hard"],
    temperaments: ["stubborn", "weary"],
    rivals: ["rus_danilov", "rus_brusilov"],
    allies: ["rus_alexandra"],
    fame: 2,
    source:
      "b. 3 Aug 1851; commander of the Southwestern Front 1914 with Alekseyev as chief of staff; sent against Petrograd in 1917 (en.wikipedia Nikolai Ivanov, Mikhail Alekseyev, February Revolution). The beard, the Tsar's liking (memory)",
  },
  {
    id: "rus_ruzsky",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["military", "east", "duma", "moderate"],
    temperaments: ["anxious", "arrogant"],
    rivals: ["rus_ivanov"],
    allies: ["rus_guchkov"],
    fame: 2,
    source:
      "b. 18 Mar 1854; 'Conqueror of Galicia', St George 2nd class Oct 1914; commander of the Northern Front at Pskov, in the carriage at the abdication (en.wikipedia Nikolai Ruzsky, Abdication of Nicholas II). Pressed the Tsar that night (memory)",
  },
  {
    id: "rus_evert",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["military", "east", "court", "moderate"],
    temperaments: ["anxious", "stubborn"],
    rivals: ["rus_brusilov"],
    allies: ["rus_alekseev"],
    fame: 1,
    source:
      "Commander of the Western Front from Aug 1915; Lake Naroch Mar 1916 with Kuropatkin, no scouting and no guns (en.wikipedia Aleksei Evert). Held back in June 1916 (memory)",
  },
  {
    id: "rus_yudenich",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["military", "west", "duma", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["rus_nikolasha"],
    allies: ["rus_alekseev"],
    fame: 2,
    source:
      "b. 30 Jul 1862; Caucasus district staff 1913, chief of staff of the Caucasus Army 1914 (en.wikipedia Nikolai Yudenich); Sarikamish won 22 Dec 1914-17 Jan 1915 (en.wikipedia Battle of Sarikamish). Erzurum Feb 1916; friction with the Grand Duke as viceroy (memory)",
  },
  {
    id: "rus_kornilov",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["military", "east", "duma", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["rus_kerensky", "rus_brusilov"],
    allies: ["rus_alekseev"],
    fame: 2,
    source:
      "b. 30 Aug 1870; intelligence officer and explorer in Qing China; 48th Division; escaped Austrian captivity 1915-16; Supreme Commander 1917; the affair of Sep 1917 with V. Lvov's false errand (en.wikipedia Lavr Kornilov, Kornilov affair). Brusilov's opinion of him (memory)",
  },
  {
    id: "rus_lvov",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["weary", "cold"],
    rivals: ["rus_protopopov"],
    allies: ["rus_rodzianko"],
    fame: 2,
    source:
      "b. 2 Nov 1861; First Duma Kadet; head of the Provisional Government 15 Mar-20 Jul 1917 (en.wikipedia Georgy Lvov). Union of Zemstvos and Zemgor in the war (en.wikipedia Zemgor; memory)",
  },
  {
    id: "rus_chkheidze",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["stubborn", "weary"],
    rivals: ["rus_milyukov"],
    allies: ["rus_kerensky"],
    fame: 2,
    source:
      "b. 21 Mar 1864, Georgian; Social Democrat, Menshevik president of the Petrograd Soviet's Executive Committee 1917 (en.wikipedia Nikolay Chkheidze). Duma deputy, order No. 1's date of 14 Mar (en.wikipedia Petrograd Soviet Order No. 1; memory)",
  },
  {
    id: "rus_lenin",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["rus_kerensky", "rus_chkheidze"],
    allies: [],
    fame: 3,
    source:
      "Zurich from Feb 1916; sealed train through Germany Apr 1917; July Days (en.wikipedia Vladimir Lenin). Simbirsk, the same town as Kerensky (en.wikipedia Alexander Kerensky; memory)",
  },
  {
    id: "rus_maria",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "moderate"],
    temperaments: ["stubborn", "anxious"],
    rivals: ["rus_rasputin", "rus_alexandra"],
    allies: ["rus_kokovtsov"],
    fame: 3,
    source:
      "b. 26 Nov 1847, Dagmar of Denmark; patroness of the Russian Red Cross (en.wikipedia Maria Feodorovna). Moved to Kiev 1916, begged her son about Rasputin (memory)",
  },
  {
    id: "rus_michael",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["military", "east", "duma", "moderate"],
    temperaments: ["weary", "anxious"],
    rivals: ["rus_alexandra"],
    allies: ["rus_rodzianko"],
    fame: 3,
    source:
      "b. 4 Dec 1878; the Tsar's youngest brother; married the twice-divorced Natalia Wulfert 1912 and went abroad; back in 1914 to a cavalry division; named in the abdication, declined without a constituent assembly (en.wikipedia Grand Duke Michael Alexandrovich, Abdication of Nicholas II). The Caucasian native division (memory)",
  },
  {
    id: "rus_samarin",
    tag: "RUS",
    office: null,
    fit: [],
    camps: ["civil", "duma", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["rus_rasputin"],
    allies: ["rus_krivoshein"],
    fame: 1,
    source:
      "Procurator of the Holy Synod 1915, signed the protest on the command (Paléologue's memoirs; firstworldwar.com preface). Moscow marshal of nobility, fell over Rasputin's bishop (memory)",
  },
  {
    id: "rus_rittikh",
    tag: "RUS",
    office: null,
    fit: ["agriculture"],
    camps: ["civil", "court", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["rus_protopopov"],
    allies: ["rus_krivoshein"],
    fame: 1,
    source:
      "Krivoshein's assistant in the land reform, agriculture minister Nov 1916-Feb 1917, the grain levy of Dec 1916 (memory, no page checked)",
  },
  {
    id: "rus_izvolsky",
    tag: "RUS",
    office: "ambassador_paris",
    fit: ["ambassador_paris", "foreign"],
    camps: ["civil", "duma", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["rus_sazonov"],
    allies: ["fra_paleologue"],
    fame: 3,
    source:
      "b. 18 Mar 1856; foreign minister before Sazonov, architect of the British tie; ambassador in Paris 1910 on (en.wikipedia Alexander Izvolsky). Buchlau, 'my war' (memory)",
  },
  {
    id: "fra_paleologue",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["rus_rasputin"],
    allies: ["rus_sazonov", "rus_izvolsky"],
    fame: 3,
    source:
      "b. 13 Jan 1859; French ambassador to Russia 1914-1917; writer, hated Germany, backed mobilisation in July 1914; Buchanan on him as a source of information (en.wikipedia Maurice Paléologue). Diary published as memoirs (byu.edu edition)",
  },
];

/** The sixteen with six summons talks each (plan §2). */
export const RUS_SUMMONED: readonly string[] = RUS_PEOPLE.slice(0, 16).map(
  (p) => p.id,
);

/** The seat's own person: the head of state is never on his own people tab. */
export const RUS_SEAT_PERSON = "rus_nicholas";

/** How each person talks. The seed's temperament changes the day, not this. */
export const RUS_VOICE_NOTES: Readonly<Record<string, string>> = {
  rus_alexandra:
    "남편에게 쓰는 사람. 영어식 애칭 '니키', 밑줄 긋듯 같은 말을 두 번 한다. 사람을 선과 악으로 나눈다. 아들 얘기가 나오면 문장이 짧아진다. 대신들 앞에서는 입을 닫고 편지에서 말한다. '당신은 황제예요'가 마지막 말이다.",
  rus_rasputin:
    "글을 겨우 쓰는 시베리아 농부. 황제를 '아버지', 황후를 '어머니'라 부른다. 성경 말과 밭일의 말이 섞이고, 문장이 뚝뚝 끊겨 무슨 뜻인지 뒤에 안다. 눈을 보고 말한다. 전쟁 얘기만은 또렷하다.",
  rus_goremykin:
    "일흔다섯의 구식 관료. 의견을 묻는 것이 실례라는 듯 말한다. '폐하께서 정하시면'으로 시작하고 끝낸다. 말 사이가 길다. 관 옆에 촛불을 세웠다는 농담을 자기에게 한다. 두마를 사람으로 치지 않는다.",
  rus_sazonov:
    "말이 앞서고 얼굴이 먼저 붉어지는 외교관. 프랑스어를 섞는다. 슬라브와 정교를 진심으로 말한다. 흥분했다가 곧 후회하고, 후회한 말을 고쳐서 다시 한다. 해협 얘기에 목소리가 달라진다.",
  rus_krivoshein:
    "내각에서 가장 영리한 사람. 먼저 칭찬하고 그다음 숫자를 대고 마지막에 남의 입으로 결론을 낸다. 수상 자리를 원한다는 말은 끝내 안 한다. 땅과 화차의 말을 쓴다. 두마와 궁정 양쪽에 다리를 놓는다.",
  rus_bark:
    "베를린에서 은행을 배운 사람. 말이 얇고 정확하다. 금과 환율과 런던을 말한다. 폐하의 뜻을 일단 받고 그 값을 조용히 적어 놓는다. 술 얘기만 나오면 입가가 굳는다.",
  rus_sukhomlinov:
    "기병의 쾌활함을 잃지 않은 예순여섯. 뭐든 된다고 말하고 재치로 넘긴다. 황제를 웃게 할 줄 안다. 숫자를 물으면 일화로 답한다. 젊은 아내 얘기가 나오면 처음으로 조심한다.",
  rus_polivanov:
    "공병 출신. 서류를 읽어 내려가듯 말하고 수사가 없다. 군인을 대놓고 평가한다. 러시아의 땅이 시간을 벌어 줄 거라는 식의 차가운 말을 한다. 두마 사람과 어울린 일을 숨기지 않는다.",
  rus_nikolasha:
    "두 미터 가까운 대공. 조카인 황제를 폐하라 부르며 내려다본다. 명령처럼 말하고 쉽게 운다. 사냥개와 말 이야기. 라스푸틴의 이름을 입에 안 올린다. 패전 보고에는 성상 앞에서 할 말을 먼저 한다.",
  rus_alekseev:
    "대위의 아들. 안경, 낮은 목소리, 밤새운 얼굴. 지도 위의 수를 말하고 자기 의견은 '소직의 판단으로는' 뒤에 작게 둔다. 궁정을 모른다. 일을 혼자 다 하느라 말이 짧다. 황후 앞에서 입을 다문다.",
  rus_brusilov:
    "늙은 기병의 몸가짐에 새 전쟁의 머리. 남의 실패를 조목조목 말한다. '한 곳이 아니라 여러 곳에서'를 되풀이한다. 자기 공을 안다. 윗사람을 믿지 않고 그것을 정중하게 표현한다.",
  rus_rodzianko:
    "목소리가 방보다 큰 사람. 시종관이면서 두마 의장이다. 사랑하니까 말씀드린다고 먼저 말한다. 과장하고 호소하고 곧 울먹인다. 전보를 칠 때는 대문자로 친다. 황제가 그의 말을 끝까지 듣는 일이 드물다.",
  rus_milyukov:
    "교수. 강의를 멈추지 못한다. 역사의 예를 들고, 첫째 둘째 셋째로 말한다. 군주를 사람으로 보지 않고 제도로 본다. 해협은 러시아의 권리라 믿는다. 아들 일을 말하지 않는다.",
  rus_guchkov:
    "모스크바 상인의 손자, 결투를 즐기는 사람. 낮고 부드럽게 위험한 말을 한다. 보어 전쟁과 만주의 일을 흘린다. 황후를 적으로 안다. 앞에서는 '폐하', 뒤에서는 벌써 다음 정부를 센다.",
  rus_kerensky:
    "법정 변호사의 웅변. 몸짓이 크고 쓰러질 듯 말한다. 혁명 앞에서도 무대를 본다. 레나 금광의 일을 근거로 삼는다. 처음 황제 앞에 불려 오면 말을 잃었다가 곧 연설이 된다.",
  rus_protopopov:
    "상냥하고 산만한 사람. 이야기 도중 주제가 바뀐다. 황후와 신비한 힘을 말하고 자기 임무를 예언처럼 말한다. 두마에 다시 사랑받고 싶어 한다. 숫자가 비어 있다.",
  rus_fredericks:
    "일흔여섯의 궁정 대신. 프랑스어 섞인 격식. 잊어버린 일을 예법으로 메운다. 황제를 아이 때부터 안다. 문간의 명단을 쥐고 있다.",
  rus_yanushkevich:
    "궁정이 만든 참모총장. 듣기 좋게 말하고 숫자는 뒤에 있는 다닐로프를 본다. 질문을 받으면 수호믈리노프나 대공의 말을 옮긴다.",
  rus_danilov:
    "일하는 참모. 철도표와 병력표로 말한다. 어두운 얼굴 때문에 '검은 다닐로프'라 불린다는 소문이 있다. 서북쪽을 우선한다.",
  rus_grigorovich:
    "두마에 친구가 있는 드문 대신. 쓰시마 뒤의 해군을 다시 지은 사람답게 건조하다. 조선소 일정을 말한다.",
  rus_kolchak:
    "기뢰와 극지의 사람. 말이 빠르고 신경이 날카롭다. 바다 지도 위에서만 편안하다. 보스포루스를 말할 때 얼굴이 밝아진다.",
  rus_maklakov:
    "흉내를 잘 내는 내무대신. 재치로 황제를 웃기고, 두마는 해산이 답이라고 가볍게 말한다. 형이 두마 자유주의자인 것을 농담으로 넘긴다.",
  rus_shcherbatov:
    "말을 치는 공작. 내무를 맡았지만 경찰을 모른다고 솔직히 말한다. 예의 바르고 오래 못 버틴다.",
  rus_khvostov:
    "뚱뚱한 사냥꾼 같은 웃음. 극우의 애국을 크게 외친다. 누구에게나 비밀을 건네는 척한다.",
  rus_sturmer:
    "의전관 출신. 수염과 공손함. 하는 말에 내용이 없게 하는 재주가 있다. 독일 이름을 스스로 입에 올리지 않는다.",
  rus_trepov:
    "철도를 아는 강직한 사람. 라스푸틴을 쫓자고 말하고, 안 되면 사표를 쓴다고 말한다. 말수가 적다.",
  rus_golitsyn:
    "수상 자리를 맡지 말게 해 달라는 노인. 자선사업의 말. 겸손이 진심이라 더 난처하다.",
  rus_kokovtsov:
    "회계사의 말투로 황제에게 사실을 말한 사람. 물러나서도 예산을 외운다. 라스푸틴을 만난 일을 정확한 날짜로 말한다.",
  rus_durnovo:
    "경찰을 다스린 차가운 노인. 혁명을 사건으로 보지 않고 절차로 본다. 예측을 예언처럼 말하지 않고 보고서처럼 말한다.",
  rus_witte:
    "철도 역장에서 수상까지 온 거인. 혀가 굵고 남을 깎는다. '내가 말했소'를 다른 꼴로 되풀이한다. 전쟁을 미친 짓이라 부른다.",
  rus_shuvaev:
    "보급의 노병. 정직하고 순하다. 대신 자리에서도 창고 얘기를 한다.",
  rus_belyaev: "책상의 장군. 작은 목소리, 꼼꼼한 메모. 책임을 위로 돌린다.",
  rus_ivanov:
    "큰 수염의 노장. 폐하를 사랑한다는 말을 하고 말이 느리다. 낡은 교범을 믿는다.",
  rus_ruzsky:
    "병든 몸의 날카로운 장군. 안경 너머로 말하고 황제에게 드물게 맞선다.",
  rus_evert:
    "조심성을 원칙으로 삼은 사람. '포탄이 부족합니다'로 공세를 미룬다.",
  rus_yudenich:
    "캅카스의 고집쟁이. 눈과 고개의 말. 불가능하다는 말을 들으면 그리로 간다.",
  rus_kornilov:
    "시베리아 코사크 집안의 사막 장교. 포로수용소를 빠져나온 영웅. 말이 짧고 정치를 모른다. '조국을 구하자'를 그대로 쓴다.",
  rus_lvov:
    "톨스토이를 읽는 공작. 온화하고 일을 잘하며 결정을 못 한다. 러시아 인민의 지혜를 믿는다.",
  rus_chkheidze:
    "그루지야 억양의 사회민주당 의원. 혁명의 규칙을 따진다. 권력을 받을 생각이 없다고 말한다.",
  rus_lenin:
    "취리히의 망명자. 목소리가 없다가 편지와 전보로 나타난다. 논쟁만 한다. 강화와 땅, 두 단어를 쓴다.",
  rus_maria:
    "덴마크 왕녀 출신 모후. 아들을 '니키'라 부른다. 작은 키에 말이 곧다. 며느리 얘기는 편지의 두 번째 쪽에 쓴다.",
  rus_michael:
    "황제의 막냇동생. 키 크고 순하다. 황위를 원한 적이 없다고 진심으로 말한다. 아내를 궁정이 받아 주기를 조용히 바란다.",
  rus_samarin:
    "모스크바 귀족의 정직. 교회의 일을 교회의 말로 말한다. 궁정이 듣기 싫어할 말을 알고 한다.",
  rus_rittikh:
    "서류와 곡물표의 관리. 두마 앞에서 말을 잘한다. 공출 수치를 끝까지 믿는다.",
  rus_izvolsky:
    "외알 안경의 전 외무대신. 파리에서 자기가 만든 동맹을 자랑한다. 사조노프를 후배로 부른다.",
  fra_paleologue:
    "소설 쓰는 대사. 프랑스의 숨 가쁜 호소를 문학처럼 한다. 들은 말을 바로 일기에 옮긴다. 먼저 본국의 뜻을 밝히고 다음에 자기 뜻을 끼운다.",
};
