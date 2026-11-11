import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";

/**
 * France's cast (plan: /home/eser/dev/ww166-plan-fra-scenes.md). The seat is
 * Raymond Poincaré, President of the Republic, for the whole game; he is in
 * people_common.ts with Briand, Clemenceau, Joffre, Foch and Pétain, Jules
 * Cambon is in people.ts and Paléologue in people_rus.ts. Their texts stay in
 * the packs that hold them; the rest is in FRA.people.json.
 *
 * Offices are those of June 1914 (Viviani's first government, 13 Jun 1914).
 * `chancellor` is the président du Conseil, a person under the seat. Viviani
 * held Foreign Affairs himself until 3 Aug 1914, and the game gives one man one
 * office: the Quai goes to Bienvenu-Martin, the Garde des Sceaux who kept it
 * ad interim while Viviani was at sea with the President in July. Joffre holds
 * `chief_of_staff` (chief of the general staff, commander in chief on
 * mobilisation). `munitions` has no holder until Albert Thomas (May 1915).
 *
 * Camps, one per axis: party (radical = Radicals and the small
 * republican-socialist group that governed with them; socialist = SFIO and
 * the CGT; centre = the Alliance démocratique and the moderate left
 * republicans; right = the Fédération républicaine, the Catholics and Action
 * française), conduct of the war (hard, moderate), where to fight (west, east
 * = Salonika and the Orient). Soldiers are also `military`, sailors aren't
 * (the GBR rule).
 *
 * `source`: "(memory)" marks facts not checked against a page.
 * Order matters to the seed rolls: append.
 */
const VIVIANI_I = "fr.wikipedia Gouvernement René Viviani (1)";
const VIVIANI_II = "en.wikipedia Second Viviani government";
const BRIAND_V = "fr.wikipedia Gouvernement Aristide Briand (5)";
const BRIAND_VI = "fr.wikipedia Gouvernement Aristide Briand (6)";
const RIBOT_V = "fr.wikipedia Gouvernement Alexandre Ribot (5)";
const PAINLEVE_I = "fr.wikipedia Gouvernement Paul Painlevé (1)";
const CLEMENCEAU_II = "fr.wikipedia Gouvernement Georges Clemenceau (2)";

export const FRA_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "fra_viviani",
    tag: "FRA",
    office: "chancellor",
    fit: ["chancellor", "foreign"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["anxious", "weary"],
    rivals: ["fra_clemenceau", "fra_caillaux"],
    allies: ["fra_briand", "fra_malvy"],
    fame: 3,
    source: `Président du Conseil 13 Jun 1914-29 Oct 1915, and Foreign Affairs until 3 Aug 1914 (${VIVIANI_I}); second government from 26 Aug 1914, Foreign Affairs again after Delcassé left on 15 Oct 1915 (${VIVIANI_II}); vice-president of the Council and Justice under Briand (${BRIAND_V}); Justice under Ribot (${RIBOT_V}). b. 8 Nov 1863, Sidi Bel Abbès; lawyer; first Minister of Labour 1906; with the President at Petersburg Jul 1914 (memory)`,
  },
  {
    id: "fra_bienvenu_martin",
    tag: "FRA",
    office: "foreign",
    fit: ["foreign", "interior"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["weary", "cold"],
    rivals: ["fra_messimy"],
    allies: ["fra_viviani", "fra_berthelot"],
    fame: 1,
    source: `b. 22 Jul 1847, Saint-Bris-le-Vineux; senator for the Yonne from 1905; Justice in Doumergue's cabinet and in Viviani's first (Jun 1914); a press photo shows Schoen reading him Germany's note 'qui assure l'intérim des Affaires étrangères'; Labour in the second Viviani government (en.wikipedia Jean-Baptiste Bienvenu-Martin; ${VIVIANI_I}). The game seats him at the Quai from June because Viviani held both posts`,
  },
  {
    id: "fra_messimy",
    tag: "FRA",
    office: "war",
    fit: ["war"],
    camps: ["civil", "radical", "hard"],
    temperaments: ["anxious", "arrogant"],
    rivals: ["fra_bienvenu_martin", "fra_caillaux"],
    allies: ["fra_gallieni", "fra_joffre"],
    fame: 2,
    source: `War minister in Viviani's first government to 26 Aug 1914 (${VIVIANI_I}). b. 1869, Lyon; a former officer; War minister 1911-1912, wanted to drop the red trousers; named Gallieni military governor of Paris; went to the front after leaving office (memory)`,
  },
  {
    id: "fra_gauthier",
    tag: "FRA",
    office: "navy",
    fit: ["navy"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["anxious", "weary"],
    rivals: ["fra_augagneur"],
    allies: ["fra_viviani"],
    fame: 1,
    source: `Armand Gauthier de l'Aude, Marine in Viviani's first government until 3 Aug 1914, then Augagneur (${VIVIANI_I}). Senator for the Aude, a doctor (memory)`,
  },
  {
    id: "fra_malvy",
    tag: "FRA",
    office: "interior",
    fit: ["interior"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["cunning", "anxious"],
    rivals: ["fra_clemenceau", "fra_daudet"],
    allies: ["fra_caillaux", "fra_viviani"],
    fame: 2,
    source: `Interior from 13 Jun 1914 (${VIVIANI_I}) to 31 Aug 1917, replaced by Steeg; his resignation brought down Ribot's government on 7 Sep 1917 (${RIBOT_V}). b. 1875, Figeac; Caillaux's friend; left the Carnet B unused in Aug 1914; paid the Bonnet rouge; accused by Daudet and Clemenceau, tried by the Senate 1918 (memory)`,
  },
  {
    id: "fra_noulens",
    tag: "FRA",
    office: "finance",
    fit: ["finance", "war", "agriculture", "ambassador_petersburg"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["cold", "stubborn"],
    rivals: ["fra_caillaux"],
    allies: ["fra_viviani"],
    fame: 1,
    source: `Finance in Viviani's first government, Jun-Aug 1914 (${VIVIANI_I}); Agriculture and Food from Jul 1919 (${CLEMENCEAU_II}). War minister 1913-1914 under Doumergue (memory); named ambassador in Petrograd Jun 1917, left in Feb 1918 for Vologda (en.wikipedia Joseph Noulens; FRUS Paris 1919 vol. III)`,
  },
  {
    id: "fra_david",
    tag: "FRA",
    office: "agriculture",
    fit: ["agriculture"],
    camps: ["civil", "centre", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["fra_malvy"],
    allies: ["fra_ribot"],
    fame: 1,
    source: `Fernand David, Agriculture in Viviani's first and second governments (${VIVIANI_I}; ${VIVIANI_II}), again under Ribot and Painlevé in 1917 (${RIBOT_V}; ${PAINLEVE_I}). Deputy for Savoie (memory)`,
  },
  {
    id: "fra_paul_cambon",
    tag: "FRA",
    office: "ambassador_london",
    fit: ["ambassador_london", "foreign"],
    camps: ["civil", "centre", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["gbr_grey"],
    allies: ["fra_delcasse", "fra_poincare"],
    fame: 3,
    source:
      "b. 1843; ambassador in London 1898-1920; the Entente of 1904; the Grey-Cambon letters of Nov 1912; pressed Grey day after day from 30 Jul 1914; brother of Jules in Berlin; spoke French only to the British (memory)",
  },
  {
    id: "fra_dumaine",
    tag: "FRA",
    office: "ambassador_vienna",
    fit: ["ambassador_vienna"],
    camps: ["civil", "moderate"],
    temperaments: ["weary", "anxious"],
    rivals: ["auh_berchtold"],
    allies: ["fra_bienvenu_martin"],
    fame: 1,
    source:
      "Alfred Dumaine, ambassador in Vienna in Jul 1914, left after the declaration of war in Aug 1914 (memory)",
  },
  {
    id: "fra_jusserand",
    tag: "FRA",
    office: "ambassador_washington",
    fit: ["ambassador_washington"],
    camps: ["civil", "centre", "moderate"],
    temperaments: ["cunning", "cold"],
    rivals: ["usa_bryan"],
    allies: ["usa_lansing"],
    fame: 2,
    source:
      "b. 1855, Lyon; ambassador in Washington 1902-1925; a scholar of English literature; Theodore Roosevelt's friend (memory)",
  },
  {
    id: "fra_doumergue",
    tag: "FRA",
    office: null,
    fit: ["foreign", "chancellor"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["cunning", "weary"],
    rivals: ["fra_clemenceau"],
    allies: ["fra_viviani", "fra_malvy"],
    fame: 2,
    source: `Took Foreign Affairs from Viviani on 3 Aug 1914 (${VIVIANI_I}); Colonies in the second Viviani government and under Briand (${VIVIANI_II}; ${BRIAND_V}; ${BRIAND_VI}). b. 1863, Aigues-Vives, a Protestant; président du Conseil Dec 1913-Jun 1914; mission to Petrograd Feb 1917 (memory)`,
  },
  {
    id: "fra_delcasse",
    tag: "FRA",
    office: null,
    fit: ["foreign", "navy"],
    camps: ["civil", "centre", "hard"],
    temperaments: ["stubborn", "arrogant"],
    rivals: ["fra_caillaux", "fra_briand"],
    allies: ["fra_paul_cambon", "fra_paleologue"],
    fame: 3,
    source: `Foreign Affairs in the second Viviani government until 15 Oct 1915 (${VIVIANI_II}). b. 1852, Pamiers; Foreign Affairs 1898-1905, the Entente; forced out in 1905 over Morocco; Marine 1911-1913; ambassador in Petersburg 1913 (memory)`,
  },
  {
    id: "fra_millerand",
    tag: "FRA",
    office: null,
    fit: ["war"],
    camps: ["civil", "centre", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["fra_clemenceau", "fra_gallieni"],
    allies: ["fra_joffre", "fra_poincare"],
    fame: 2,
    source: `War in the second Viviani government, Aug 1914-Oct 1915 (${VIVIANI_II}). b. 1859; the first socialist in a cabinet, 1899; War minister 1912-1913; shielded Joffre from the Chamber (memory)`,
  },
  {
    id: "fra_gallieni",
    tag: "FRA",
    office: null,
    fit: ["war", "chief_of_staff"],
    camps: ["military", "east", "hard"],
    temperaments: ["cold", "stubborn"],
    rivals: ["fra_joffre"],
    allies: ["fra_messimy", "fra_painleve"],
    fame: 4,
    source: `War minister in Briand's fifth government until 16 Mar 1916, then Roques (${BRIAND_V}). b. 1849, Saint-Béat; Madagascar; retired in 1914; military governor of Paris from 26 Aug 1914; the taxis of the Marne; died May 1916 (memory)`,
  },
  {
    id: "fra_roques",
    tag: "FRA",
    office: null,
    fit: ["war"],
    camps: ["military", "west", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["fra_joffre"],
    allies: ["fra_briand"],
    fame: 1,
    source: `War minister from 16 Mar 1916 in Briand's fifth government (${BRIAND_V}). An engineer general, first head of military aviation; First Army 1915; his Verdun inspection of 1916 (memory)`,
  },
  {
    id: "fra_lyautey",
    tag: "FRA",
    office: null,
    fit: ["war"],
    camps: ["military", "right", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["fra_briand", "fra_painleve"],
    allies: ["fra_poincare"],
    fame: 3,
    source: `War in Briand's sixth government until 14 Mar 1917; Briand fell after an incident between Lyautey and the Chamber over military aviation (${BRIAND_VI}). b. 1854, Nancy; resident-general in Morocco from 1912 (memory)`,
  },
  {
    id: "fra_painleve",
    tag: "FRA",
    office: null,
    fit: ["war", "chancellor"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["anxious", "cunning"],
    rivals: ["fra_nivelle", "fra_clemenceau"],
    allies: ["fra_petain", "fra_gallieni"],
    fame: 2,
    source: `Public Instruction under Briand (${BRIAND_V}); War under Ribot, Mar-Sep 1917 (${RIBOT_V}); président du Conseil and War 12 Sep-13 Nov 1917 (${PAINLEVE_I}). b. 1863, Paris; mathematician; doubted Nivelle's plan, backed Pétain (memory)`,
  },
  {
    id: "fra_augagneur",
    tag: "FRA",
    office: null,
    fit: ["navy"],
    camps: ["civil", "radical", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["fra_delcasse"],
    allies: ["fra_viviani"],
    fame: 1,
    source: `Public Instruction in Viviani's first government, Marine from 3 Aug 1914 (${VIVIANI_I}; ${VIVIANI_II}). A doctor; mayor of Lyon; governor-general of Madagascar; the Dardanelles squadron 1915 (memory)`,
  },
  {
    id: "fra_lacaze",
    tag: "FRA",
    office: null,
    fit: ["navy", "war"],
    camps: ["moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["fra_augagneur"],
    allies: ["fra_briand"],
    fame: 1,
    source: `Admiral; Marine under Briand from Oct 1915 (${BRIAND_V}); War ad interim 15-17 Mar 1917 (${BRIAND_VI}); Marine until 10 Aug 1917, then Chaumet (${RIBOT_V})`,
  },
  {
    id: "fra_ribot",
    tag: "FRA",
    office: null,
    fit: ["finance", "foreign", "chancellor"],
    camps: ["civil", "centre", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: ["fra_caillaux", "fra_clemenceau"],
    allies: ["fra_poincare", "fra_paul_cambon"],
    fame: 2,
    source: `Finance in the second Viviani government and under Briand (${VIVIANI_II}; ${BRIAND_V}; ${BRIAND_VI}); président du Conseil and Foreign Affairs 20 Mar-7 Sep 1917 (${RIBOT_V}); Foreign Affairs under Painlevé until 23 Oct 1917 (${PAINLEVE_I}). b. 1842, Saint-Omer; made the Russian alliance as foreign minister, 1891 (memory)`,
  },
  {
    id: "fra_thomas",
    tag: "FRA",
    office: null,
    fit: ["munitions"],
    camps: ["civil", "socialist", "hard"],
    temperaments: ["cunning", "stubborn"],
    rivals: ["fra_longuet", "fra_clemenceau"],
    allies: ["fra_millerand", "fra_loucheur"],
    fame: 2,
    source: `Under-secretary of state from 18 May 1915 (${VIVIANI_II}), for artillery and munitions (${BRIAND_V}); Minister of Armament and War Manufactures Dec 1916-Sep 1917 (${BRIAND_VI}; ${RIBOT_V}). b. 1878, Champigny; SFIO; mission to Russia 1917 (memory)`,
  },
  {
    id: "fra_loucheur",
    tag: "FRA",
    office: null,
    fit: ["munitions"],
    camps: ["civil", "centre", "hard"],
    temperaments: ["cunning", "cold"],
    rivals: ["fra_thomas"],
    allies: ["fra_clemenceau"],
    fame: 1,
    source: `Under-secretary for war manufactures from Dec 1916 (${BRIAND_VI}; ${RIBOT_V}); Armament and War Manufactures under Painlevé and Clemenceau (${PAINLEVE_I}; ${CLEMENCEAU_II}). b. 1872, Roubaix; engineer and contractor (memory)`,
  },
  {
    id: "fra_nivelle",
    tag: "FRA",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["fra_petain", "fra_painleve"],
    allies: ["fra_mangin", "fra_briand"],
    fame: 3,
    source:
      "b. 1856, Tulle, an English mother; artillery; took back Douaumont Oct 1916; commander in chief Dec 1916-May 1917; the Chemin des Dames, 16 Apr 1917 (memory)",
  },
  {
    id: "fra_jaures",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "socialist", "moderate"],
    temperaments: ["stubborn", "anxious"],
    rivals: ["fra_barres", "fra_daudet"],
    allies: ["fra_longuet", "fra_renaudel"],
    fame: 4,
    source:
      "b. 1859, Castres; leader of the SFIO, founder of L'Humanité; fought the three-year law; at the International's bureau in Brussels 29 Jul 1914; shot at the Café du Croissant by Raoul Villain on 31 Jul 1914 (memory)",
  },
  {
    id: "fra_caillaux",
    tag: "FRA",
    office: null,
    fit: ["finance", "chancellor"],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["fra_clemenceau", "fra_poincare", "fra_delcasse"],
    allies: ["fra_malvy"],
    fame: 3,
    source:
      "b. 1863, Le Mans; président du Conseil 1911-1912, Agadir; the income tax; resigned Finance in Mar 1914 after his wife shot Calmette of Le Figaro; her trial 20-28 Jul 1914 and acquittal; arrested Jan 1918 (memory)",
  },
  {
    id: "fra_deschanel",
    tag: "FRA",
    office: null,
    fit: ["chancellor"],
    camps: ["civil", "centre", "moderate"],
    temperaments: ["anxious", "cold"],
    rivals: ["fra_clemenceau"],
    allies: ["fra_poincare"],
    fame: 2,
    source: `President of the Chamber of Deputies; Poincaré thought of him first in Mar 1917, then chose Ribot (${BRIAND_VI}). b. 1855; President of the Chamber 1898-1902 and from 1912 (memory)`,
  },
  {
    id: "fra_dubost",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["weary", "stubborn"],
    rivals: ["fra_clemenceau"],
    allies: ["fra_poincare"],
    fame: 1,
    source: "Antonin Dubost, President of the Senate from 1906 (memory)",
  },
  {
    id: "fra_barthou",
    tag: "FRA",
    office: null,
    fit: ["foreign", "chancellor"],
    camps: ["civil", "centre", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["fra_caillaux"],
    allies: ["fra_poincare"],
    fame: 2,
    source: `Minister of state, then Foreign Affairs from 23 Oct 1917 (${PAINLEVE_I}). b. 1862, Oloron; président du Conseil 1913, carried the three-year law (memory)`,
  },
  {
    id: "fra_sembat",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "socialist", "moderate"],
    temperaments: ["weary", "cunning"],
    rivals: ["fra_barres"],
    allies: ["fra_guesde", "fra_jaures"],
    fame: 1,
    source: `SFIO; Public Works in the second Viviani government and under Briand (${VIVIANI_II}; ${BRIAND_V}). His book 'Faites un roi, sinon faites la paix', 1913 (memory)`,
  },
  {
    id: "fra_guesde",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "socialist", "hard"],
    temperaments: ["stubborn", "cold"],
    rivals: ["fra_longuet"],
    allies: ["fra_sembat"],
    fame: 2,
    source: `SFIO; minister without portfolio in the second Viviani government, minister of state under Briand (${VIVIANI_II}; ${BRIAND_V}). b. 1845; the old Marxist of the party (memory)`,
  },
  {
    id: "fra_renaudel",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "socialist", "hard"],
    temperaments: ["stubborn", "arrogant"],
    rivals: ["fra_longuet"],
    allies: ["fra_thomas", "fra_jaures"],
    fame: 1,
    source:
      "Pierre Renaudel, Jaurès's second at L'Humanité, its director after him; led the SFIO majority for the national defence (memory)",
  },
  {
    id: "fra_longuet",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "socialist", "moderate"],
    temperaments: ["anxious", "stubborn"],
    rivals: ["fra_renaudel", "fra_guesde"],
    allies: ["fra_jaures"],
    fame: 1,
    source:
      "Jean Longuet, Marx's grandson; deputy; led the SFIO minority from 1915, Le Populaire (memory)",
  },
  {
    id: "fra_jouhaux",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "socialist", "moderate"],
    temperaments: ["cunning", "weary"],
    rivals: ["fra_malvy"],
    allies: ["fra_thomas"],
    fame: 1,
    source:
      "Léon Jouhaux, secretary-general of the CGT from 1909; spoke at Jaurès's funeral on 4 Aug 1914 for the defence of the country (memory)",
  },
  {
    id: "fra_barres",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "right", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["fra_jaures", "fra_caillaux"],
    allies: ["fra_poincare", "fra_castelnau"],
    fame: 2,
    source:
      "Maurice Barrès, b. 1862; writer, deputy for Paris; president of the Ligue des patriotes from 1914; a daily article in L'Écho de Paris through the war (memory)",
  },
  {
    id: "fra_daudet",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "right", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["fra_malvy", "fra_caillaux"],
    allies: ["fra_barres"],
    fame: 1,
    source:
      "Léon Daudet, b. 1867; Action française; denounced Malvy, Almereyda and Caillaux as traitors from 1917 (memory)",
  },
  {
    id: "fra_cochin",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "right", "hard"],
    temperaments: ["weary", "stubborn"],
    rivals: ["fra_malvy"],
    allies: ["fra_briand"],
    fame: 1,
    source: `Denys Cochin, Action libérale (Catholic); minister of state under Briand (${BRIAND_V}); under-secretary for the blockade Dec 1916-2 Aug 1917 (${BRIAND_VI}; ${RIBOT_V})`,
  },
  {
    id: "fra_castelnau",
    tag: "FRA",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["stubborn", "weary"],
    rivals: ["fra_sarrail"],
    allies: ["fra_joffre", "fra_barres"],
    fame: 2,
    source:
      "b. 1851; Second Army 1914, held Nancy at the Grand Couronné; Joffre's chief of staff Dec 1915; a Catholic, lost sons in the war (memory)",
  },
  {
    id: "fra_lanrezac",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["military", "west", "moderate"],
    temperaments: ["anxious", "arrogant"],
    rivals: ["fra_joffre", "gbr_french"],
    allies: ["fra_gallieni"],
    fame: 1,
    source:
      "b. 1852; Fifth Army 1914, warned that the Germans came through Belgium; Charleroi, Guise; relieved by Joffre in Sep 1914 (memory)",
  },
  {
    id: "fra_sarrail",
    tag: "FRA",
    office: null,
    fit: ["chief_of_staff"],
    camps: ["military", "east", "hard"],
    temperaments: ["arrogant", "cunning"],
    rivals: ["fra_joffre", "fra_castelnau"],
    allies: ["fra_caillaux", "fra_malvy"],
    fame: 2,
    source:
      "b. 1856; the left's general; Third Army 1914 at Verdun; relieved Jul 1915; Army of the Orient at Salonika from Oct 1915 to Dec 1917 (memory)",
  },
  {
    id: "fra_mangin",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["military", "west", "hard"],
    temperaments: ["arrogant", "stubborn"],
    rivals: ["fra_petain"],
    allies: ["fra_nivelle"],
    fame: 2,
    source:
      "b. 1866; colonial officer, 'La Force noire' 1910; Douaumont 1916; Sixth Army at the Chemin des Dames, relieved; Tenth Army Jul 1918 (memory)",
  },
  {
    id: "fra_berthelot",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "centre", "hard"],
    temperaments: ["cunning", "cold"],
    rivals: ["fra_paleologue"],
    allies: ["fra_bienvenu_martin", "fra_briand"],
    fame: 1,
    source:
      "Philippe Berthelot, b. 1866; at the political direction of the Quai d'Orsay in Jul 1914, ran it with Bienvenu-Martin while the President and Viviani were at sea; Briand's right hand from 1915 (memory)",
  },
  {
    id: "fra_ferry",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "centre", "moderate"],
    temperaments: ["stubborn", "anxious"],
    rivals: ["fra_joffre"],
    allies: ["fra_viviani"],
    fame: 1,
    source: `Abel Ferry, under-secretary of state at the Présidence du Conseil and Foreign Affairs from 14 Jun 1914 (${VIVIANI_I}; ${VIVIANI_II}). Jules Ferry's nephew; served at the front as a deputy; wounded in Sep 1918 and died (memory)`,
  },
  {
    id: "fra_mandel",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "centre", "hard"],
    temperaments: ["cold", "cunning"],
    rivals: ["fra_malvy"],
    allies: ["fra_clemenceau"],
    fame: 1,
    source: `Georges Mandel ran Clemenceau's civil cabinet from Nov 1917 (${CLEMENCEAU_II}). b. 1885; Clemenceau's man at L'Homme libre (memory)`,
  },
  {
    id: "fra_barrere",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "centre", "hard"],
    temperaments: ["cunning", "arrogant"],
    rivals: ["ita_giolitti"],
    allies: ["ita_salandra", "ita_sonnino"],
    fame: 1,
    source:
      "Camille Barrère, ambassador in Rome from 1897; the Franco-Italian accord of 1902; worked for Italy's entry in 1915 (memory)",
  },
  {
    id: "fra_bourgeois",
    tag: "FRA",
    office: null,
    fit: [],
    camps: ["civil", "radical", "moderate"],
    temperaments: ["weary", "stubborn"],
    rivals: ["fra_clemenceau"],
    allies: ["fra_poincare"],
    fame: 2,
    source: `Léon Bourgeois, minister of state under Briand (${BRIAND_V}); Labour under Ribot (${RIBOT_V}); minister of state in Painlevé's war committee (${PAINLEVE_I}). b. 1851; arbitration at The Hague (memory)`,
  },
];

/** The person in the seat for the whole game: never summoned or dismissed. */
export const FRA_SEAT_PERSON = "fra_poincare";

/** The sixteen with six summons talks each (plan §4). */
export const FRA_SUMMONED: readonly string[] = [
  "fra_viviani",
  "fra_messimy",
  "fra_jaures",
  "fra_caillaux",
  "fra_joffre",
  "fra_gallieni",
  "fra_foch",
  "fra_petain",
  "fra_malvy",
  "fra_briand",
  "fra_clemenceau",
  "fra_thomas",
  "fra_paul_cambon",
  "fra_delcasse",
  "fra_ribot",
  "fra_paleologue",
];

/**
 * How each person talks, as GW_VOICE_NOTES. Poincaré, Briand, Clemenceau,
 * Joffre, Foch and Pétain are in GW_VOICE_NOTES_COMMON, Jules Cambon in
 * GW_VOICE_NOTES, Paléologue in RUS_VOICE_NOTES.
 */
export const FRA_VOICE_NOTES: Readonly<Record<string, string>> = {
  fra_viviani:
    "법정과 의회에서 이긴 웅변가. 목소리가 크고 문장이 아름답다. 그런데 서류 앞에서는 손이 흔들리고 같은 질문을 두 번 한다. 외교 문서의 낱말 하나에 밤을 새운다. 화가 나면 욕을 하고 곧 사과한다.",
  fra_bienvenu_martin:
    "법무부의 늙은 상원의원. 남의 자리를 맡아 앉은 사람의 조심성. '대통령 각하와 수상께서 돌아오시면'을 붙인다. 들은 말을 그대로 적어 두고 자기 판단은 안 붙인다.",
  fra_messimy:
    "군복을 벗은 장교의 급한 말. 문장이 짧고 명령형이다. 숫자와 열차 시간을 외운다. 신이 나면 목소리가 높고 겁이 나면 더 높다. 일을 먼저 하고 허락을 나중에 묻는다.",
  fra_gauthier:
    "늙은 의사 출신 상원의원. 해군 일을 남의 병처럼 진찰하듯 말한다. 피곤하다는 말을 자주 하고 결정은 제독들에게 넘긴다.",
  fra_malvy:
    "남서부 사람의 부드럽고 친절한 말. 누구와도 '우리끼리 말인데'로 시작한다. 경찰 서류를 알면서 모르는 척한다. 노조 사람들의 이름을 다 안다. 몰리면 더 웃는다.",
  fra_noulens:
    "장부를 펴 놓고 말하는 급진당 사람. 숫자 다음에 '하원이 이걸 통과시킬까요'를 붙인다. 감정이 적고 반대도 조용하다.",
  fra_david:
    "사부아 산골 의원. 밀과 소와 날씨로 말한다. 파리 사람들의 계획을 수확 철에 맞춰 본다.",
  fra_paul_cambon:
    "스무 해 가까이 런던에 산 노대사. 영어를 안 쓰고 프랑스어로만 말한다. 정확하고 마른 문장, 가끔 신랄한 한마디. 영국 사람의 '아마도'를 몇 가지로 번역해 보인다. 말이 아니라 서류를 믿는다.",
  fra_dumaine:
    "빈의 대사. 궁정의 소문과 무도회 얘기를 섞는다. 경고는 공손하게, 그래서 묻힌다.",
  fra_jusserand:
    "학자 대사. 영문학을 인용하고 미국 대통령들의 버릇을 안다. 웃으며 말하고 웃으며 조른다. 워싱턴의 시간이 파리와 다르다고 말한다.",
  fra_doumergue:
    "남부 개신교도의 웃는 얼굴. 말이 쉽고 친근하다. 누구와도 척지지 않는다. 그 미소 뒤에서 표를 센다.",
  fra_delcasse:
    "작은 키의 고집. 협상국을 자기가 만들었다고 믿는다. 문장이 날카롭고 짧다. 반대를 들으면 대답 대신 지도를 편다. 독일 이름이 나오면 입술이 얇아진다.",
  fra_millerand:
    "굵은 목소리의 변호사. 질문을 받으면 질문으로 막는다. 장군을 감싸고 의원을 쫓는다. '군이 할 일입니다'가 입에 붙었다.",
  fra_gallieni:
    "코안경 너머로 보는 늙은 식민지 장군. 짧고 차고 정확하다. 조프르를 '그 사람'이라 부른다. 아픈 몸을 말하지 않는다. 계획을 세 줄로 적어 내민다.",
  fra_roques:
    "공병 장군. 다리와 철도와 비행기의 말. 남의 실수를 보고서로 적고 말로는 안 한다.",
  fra_lyautey:
    "모로코의 총독. 귀족의 말투, 긴 문장, 의회를 경멸한다. 사람을 매혹하고 곧 피곤하게 한다. 비밀을 하원에서 말할 수 없다고 큰 소리로 말한다.",
  fra_painleve:
    "수학자 정치가. 빨리 생각하고 빨리 말한다. 문장이 엉키고 계산은 맞다. 장군들의 계획에 확률을 묻는다. 사람을 믿고 늦게 실망한다.",
  fra_augagneur:
    "리옹의 의사이자 시장. 무뚝뚝하고 거칠고 자기 확신이 크다. 제독들에게 환자 대하듯 한다.",
  fra_lacaze:
    "말수 적은 제독. 함대의 수, 석탄의 톤, 잠수함의 수. 정치는 장관실 문 밖에 두고 들어온다.",
  fra_ribot:
    "일흔을 넘긴 공화국의 원로. 긴 수염, 느리고 고른 문장, 법과 선례를 댄다. 위험한 일은 '아직 이릅니다'로 미룬다. 영국과 미국의 돈을 누구보다 잘 안다.",
  fra_thomas:
    "턱수염의 사회주의 역사가. 공장과 노동자를 숫자와 이름으로 같이 말한다. 생산을 사회주의의 말로 설명한다. 열정적이고 끝없이 일한다. 동지들의 비판을 듣고 반박을 미리 준비해 온다.",
  fra_loucheur:
    "북부 사업가. 계약서와 톤 수의 말. 빠르고 실용적이다. 안 된다는 말 대신 얼마 드는지 말한다.",
  fra_nivelle:
    "매끄럽고 자신에 찬 포병 장군. 영어를 잘한다. '단절', '48시간'을 쓴다. 의심을 받으면 더 확신에 차서 말한다. 정치가를 설득하는 법을 안다.",
  fra_jaures:
    "남부 억양의 거대한 목소리. 연단에서는 우레, 방 안에서는 다정하다. 역사와 인용을 쌓아 올린 끝에 노동자 한 사람의 얼굴로 내려온다. 상대를 '동지', 대통령에게는 정중하되 굽히지 않는다. 평화를 말할 때 목소리가 낮아진다.",
  fra_caillaux:
    "오만한 재정가. 단안경, 빠른 말, 경멸. 숫자로 사람을 누른다. 독일과의 거래를 계산으로 말하고 그게 왜 반역이냐고 묻는다. 아내 얘기에서만 말이 끊긴다.",
  fra_deschanel:
    "아카데미 회원의 공들인 연설. 의사봉과 의전의 사람. 대통령 자리를 바라보는 사람의 정중함이 지나치다.",
  fra_dubost:
    "상원 의장. 늙고 무겁고 의례적이다. 상원의 권리를 조항으로 말한다. 짧게 동의하고 길게 조건을 단다.",
  fra_barthou:
    "피레네의 변호사, 책 수집가. 재치 있고 빠르다. 삼 년법을 자기 일로 여긴다. 웃으며 정적을 찌른다.",
  fra_sembat:
    "교양 있는 사회주의자. 반어와 인용을 쓴다. 공화국이 전쟁을 할 줄 모른다고 써 놓고 장관이 된 사람의 쓴웃음.",
  fra_guesde:
    "긴 수염의 늙은 혁명가. 마르크스의 말로 국방을 말한다. 말이 적고 엄하다. 타협을 원칙처럼 말한다.",
  fra_renaudel:
    "《뤼마니테》의 편집장. 당 대회의 결의문처럼 말한다. 다수파의 이름으로 말하고 소수파를 꾸짖는다.",
  fra_longuet:
    "마르크스의 손자. 조심스럽고 국제적이다. 영국과 독일 동지들의 소식을 전한다. '평화'라는 말 앞에서 머뭇거리고 그래도 말한다.",
  fra_jouhaux:
    "성냥 공장 노동자 출신 총연맹 서기장. 짧고 실제적이다. 임금, 시간, 징집 유예. 장관실에서도 작업복의 말을 버리지 않는다.",
  fra_barres:
    "로렌의 작가. 죽은 자와 땅을 말한다. 아름답고 긴 문장, 한 번 정한 적을 놓지 않는다. 대통령을 같은 로렌 사람으로 대한다.",
  fra_daudet:
    "왕당파 신문의 독설가. 이름을 대며 고발한다. 웃기고 잔인하다. 증거보다 확신이 먼저다.",
  fra_cochin:
    "가톨릭 귀족 의원. 공손하고 느리다. 교회와 공화국이 같은 참호에 있다고 말한다.",
  fra_castelnau:
    "구식 귀족 장군. 묵주를 지니고 다닌다. 짧고 침착하고 슬픔을 말하지 않는다. 낭시와 로렌의 지명으로 말한다.",
  fra_lanrezac:
    "참모대학의 교수였던 장군. 날카롭고 비꼰다. 지도 위의 독일군 우익을 손가락으로 짚는다. 총사령부를 믿지 않는다고 말한다.",
  fra_sarrail:
    "공화파 장군. 의원들과 잘 통하고 장군들과는 안 통한다. 자기를 쫓아내려는 음모를 말한다. 동쪽의 지도를 편다.",
  fra_mangin:
    "식민지 군인. 거칠고 대담하다. 공격, 손실, 다시 공격. 아프리카 병사들 얘기를 자기 공처럼 말한다.",
  fra_berthelot:
    "케도르세의 머리. 빠르고 차갑고 박식하다. 전보 초안을 그 자리에서 써 낸다. 장관들을 지나가는 사람처럼 대한다.",
  fra_ferry:
    "젊은 차관. 쥘 페리의 이름을 지고 산다. 수첩에 적은 것을 그대로 읽는다. 전선에서 돌아오면 장군들의 이름을 대며 따진다.",
  fra_mandel:
    "클레망소의 그림자. 말이 적고 서류철이 많다. 누가 누구에게 무엇을 빚졌는지 안다. 웃지 않는다.",
  fra_barrere:
    "로마에 오래 산 대사. 이탈리아 정치가들의 이름과 값을 안다. 자신만만하고 말이 많다.",
  fra_bourgeois:
    "중재와 연대의 원로. 법률가의 긴 설명. 전쟁 뒤의 국제 기구를 말한다. 몸이 약하다고 하면서 위원회를 맡는다.",
};

/**
 * ww179: a name for the Vienna embassy's vacancy box, which had none; Jules
 * Cambon (people.ts) and Noulens fit the other empty embassies. Appended after
 * every other list in Content.ts, so the seed rolls before it stay.
 */
export const FRA_POSTS: readonly GwPersonDef[] = [
  {
    id: "fra_crozier",
    tag: "FRA",
    office: null,
    fit: ["ambassador_vienna"],
    camps: ["civil", "moderate"],
    temperaments: ["cold", "weary"],
    rivals: [],
    allies: [],
    fame: 1,
    source:
      "Philippe Crozier, ambassador in Vienna 23 Jan 1907-18 May 1912, Dumaine after him (archivesdiplomatiques.diplomatie.gouv.fr, list of heads of post; en.wikipedia List of ambassadors of France to Austria); dealt with Aehrenthal (Mitteilungen des Österreichischen Staatsarchivs 35, 1982). Birth and later life not checked",
  },
];
