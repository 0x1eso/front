// World War 1936 P5: the leaders the endgame content names (content lane K5).
// The registry adds PERSONS_ENDGAME after the other person files.
import type { PersonDef } from "../types";

export const PERSONS_ENDGAME: PersonDef[] = [
  {
    // source: President of the Commonwealth of the Philippines 1935-11-15 to
    // his death on 1944-08-01 (en.wikipedia "Manuel L. Quezon"; Official
    // Gazette of the Philippines, Proclamation No. 1-W of 1944-08-01).
    id: "phl_quezon",
    nameKey: "ww1936.person.phl_quezon",
    country: "PHL",
    roles: ["leader"],
    ideology: "democratic",
    until: "1944-08-01",
    source:
      "President of the Commonwealth 1935-11-15 to 1944-08-01 (en.wikipedia; Official Gazette Proclamation 1-W)",
  },
  {
    // source: sworn in as President in Washington on 1944-08-01 (en.wikipedia
    // "1944 in the Philippines"; Official Gazette press release of the day).
    id: "phl_osmena",
    nameKey: "ww1936.person.phl_osmena",
    country: "PHL",
    roles: ["leader"],
    ideology: "democratic",
    from: "1944-08-01",
    source:
      "President of the Commonwealth from 1944-08-01 (en.wikipedia; Official Gazette)",
  },
  {
    // source: King of Romania again from 1940-09-06, led the coup of
    // 1944-08-23 (en.wikipedia "Michael I of Romania"; Hoover Institution
    // archive notes on King Michael I).
    id: "rou_michael",
    nameKey: "ww1936.person.rou_michael",
    country: "ROU",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    from: "1940-09-06",
    source:
      "King of Romania 1940-09-06 to 1947-12-30, coup of 1944-08-23 (en.wikipedia; Hoover Institution)",
  },
  {
    // source: Shah of Iran from his father's abdication on 1941-09-16, oath on
    // 1941-09-17 (en.wikipedia "Mohammad Reza Pahlavi"; Kufa Journal of Arts
    // article on his accession in the Iraqi press).
    id: "irn_mohammad_reza",
    nameKey: "ww1936.person.irn_mohammad_reza",
    country: "IRN",
    roles: ["leader"],
    ideology: "neutral",
    leaderTraits: ["monarch"],
    from: "1941-09-16",
    source: "Shah of Iran from 1941-09-16 (en.wikipedia; Kufa Journal of Arts)",
  },
];
