// World War 1936 P6 (spec §27.7-2, -4): where the dates of the depth data
// come from, for the tables whose rows have no source field. Keys:
// "agency:<TAG>", "beat:<beat id>", "event:<event id>", "scientist:<TAG>",
// "nuke:<attacker>-<target>". Field marshals carry their own source
// (content/depth/command.ts). Checked 2026-10-21.
export const DEPTH_SOURCES: Readonly<Record<string, string>> = {
  "agency:DEU":
    "the military intelligence service existed before 1936; AI window start 1936-03-01 (spec §19.5)",
  "agency:GBR":
    "the secret intelligence and code-breaking services existed before 1936; AI window start 1936-03-01 (spec §19.5)",
  "agency:SUN":
    "the military intelligence directorate existed before 1936; AI window start 1936-03-01 (spec §19.5)",
  "agency:JPN":
    "the army and navy intelligence sections existed before 1936; AI window start 1936-03-01 (spec §19.5)",
  "agency:ITA":
    "the military intelligence service existed before 1936; AI window start 1936-03-01 (spec §19.5)",
  "agency:FRA":
    "the army intelligence bureau existed before 1936; AI window start 1936-03-01 (spec §19.5)",
  "agency:USA":
    "Office of the Coordinator of Information created by White House order 1941-07-11; en.wikipedia Office of the Coordinator of Information; cia.gov Historical Intelligence Documents from COI to CIG",
  "beat:b19390101_deu_rocket_site":
    "spec §19.6 (year only); the army rocket centre on the Baltic coast was already working from 1937",
  "beat:b19390901_deu_atomic":
    "the army ordnance office took over the uranium research 1939-09-01 (first meeting 1939-09-16); en.wikipedia German nuclear weapons program; liquisearch German Nuclear Energy Project (second Uranverein)",
  "beat:b19400101_deu_jet": "spec §19.6 (year only)",
  "beat:b19400221_gbr_magnetron":
    "first cavity magnetron run at Birmingham 1940-02-21; IET Archives GEC Wembley Laboratories and the cavity magnetron; ETHW Cavity Magnetron",
  "beat:b19400601_gbr_shared_intel": "spec §14.1 (month only)",
  "beat:b19400901_gbr_night_bombing":
    "spec §15.3; Bomber Command's main force flew by night from 1940; en.wikipedia RAF Bomber Command",
  "beat:b19410101_deu_flying_bomb": "spec §19.6 (year only)",
  "beat:b19410401_jpn_atomic":
    "the army's request for the uranium study approved April 1941 (month only); en.wikipedia Japanese nuclear weapons program; Atomic Heritage Foundation Japanese atomic bomb project",
  "beat:b19410818_sun_dnipro_dam":
    "the dam was blown up by the retreating Soviet side on the evening of 1941-08-18; RFE/RL Waters Of War, Echoes Of History (2023); jmhum.org This day – August 18, 1941",
  "beat:b19420101_deu_ballistic":
    "spec §19.6 (year only); the first successful launch of the army rocket was 1942-10-03",
  "beat:b19420101_usa_proximity_fuze": "spec §19.6 (year only)",
  "beat:b19420601_usa_atomic_sites": "spec §19.6 (month only)",
  "beat:b19420813_usa_atomic_start":
    "the Manhattan Engineer District established 1942-08-13; en.wikipedia Manhattan Project; AIP History Manhattan Project",
  "beat:b19430211_sun_atomic":
    "State Defence Committee decree on the uranium work 1943-02-11; ufn.ru Physics-Uspekhi 2022 no. 5 (decree 2872ss); globalsecurity.org Russian nuclear weapons program",
  "beat:b19430517_gbr_dam_raid":
    "the raid on the Möhne and Eder dams, night of 16-17 May 1943; en.wikipedia Operation Chastise; Imperial War Museums",
  "beat:b19440609_gbr_floating_harbor":
    "the Normandy harbour breakwaters sunk into place from 1944-06-09; Australian War Memorial collection C1131030; Imperial War Museums How the Mulberry Harbours kept D-Day afloat",
  "event:treaty_escalation":
    "protocol of 1938-06-30 raising the battleship limit to 45,000 tons (escalation invoked 1938-03-31); en.wikipedia Second London Naval Treaty; navygeneralboard.com The escalator clause",
  "event:usa_uranium_committee":
    "Advisory Committee on Uranium first met 1939-10-21; atomicarchive.com Smyth Report ch. III; AIP History Manhattan Project",
  "event:quebec_agreement":
    "articles of agreement approved at Quebec 1943-08-19; history.state.gov FRUS 1946 vol. I doc. 609; en.wikipedia Quebec Agreement",
  "scientist:GBR":
    "the extra nuclear scientist from 1940-06-21: French physicists reached Falmouth with the heavy water stock (sources give 19 or 21 June; the later date kept); en.wikipedia SS Broompark; The National Archives blog The battle for heavy water",
  "nuke:USA-JPN":
    "spec §19.6; Hiroshima is region 757; the 1936 map has no Nagasaki region, Nagasaki's tiles lie in region 800 (Kumamoto, western Kyushu)",
};
