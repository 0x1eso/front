import type { GwMarkRow } from "./GwMarks";

// ww207 (W-DEU): DEU's party marks. Our own simple marks in each party's
// colours, never their real emblems or anyone's face. What they lean on:
// the SPD's red flag; the Centre's "tower" (Julius Bachem's 1906 "Wir müssen
// aus dem Turm heraus"); the Prussian crown for the Conservatives; name
// marks where a party had no sign of its own (NL, FVP, USPD, Spartakus);
// black-white-red for the Fatherland Party; the Iron Cross for the supreme
// command; Bavaria's lozenges for the southern courts. The minorities'
// group (Poles, Danes, Alsace-Lorrainers) keeps the fallback shield. The
// party colours are not checked (F).

const word = (text: string, fill: string, size = 9): string =>
  `<text x="12" y="${12 + size * 0.36}" font-size="${size}" font-weight="700" text-anchor="middle" font-family="sans-serif" fill="${fill}">${text}</text>`;

export const DEU_MARKS: readonly GwMarkRow[] = [
  {
    faction: "deu_spd",
    colours: ["#c8102e", "#3a2a1a"],
    svg: '<rect x="5" y="3" width="1.6" height="18" fill="#3a2a1a"/><path d="M6.6 4h12.4l-3 3.5 3 3.5H6.6z" fill="#c8102e"/>',
  },
  {
    faction: "deu_centre",
    colours: ["#1a1a1a", "#ffffff"],
    svg: '<path d="M7 21V9H6V4h2.4v2h2.2V4h2.8v2h2.2V4H18v5h-1v12z" fill="#1a1a1a"/><path d="M10.5 21v-4a1.5 1.5 0 0 1 3 0v4z" fill="#ffffff"/>',
  },
  {
    faction: "deu_cons",
    colours: ["#202020", "#ffffff"],
    svg: '<path d="M4 17 5.5 7.5l4 4L12 5l2.5 6.5 4-4L20 17z" fill="#202020"/><rect x="4" y="18" width="16" height="2.2" fill="#202020"/>',
  },
  {
    faction: "deu_natlib",
    colours: ["#1f4e9c", "#ffffff"],
    svg: `<rect x="2" y="5" width="20" height="14" rx="2" fill="#1f4e9c"/>${word("NL", "#ffffff")}`,
  },
  {
    faction: "deu_progress",
    colours: ["#d4a017", "#2b2b2b"],
    svg: `<rect x="2" y="5" width="20" height="14" rx="2" fill="#d4a017"/>${word("FVP", "#2b2b2b", 7.5)}`,
  },
  {
    faction: "deu_uspd",
    colours: ["#8b0000", "#ffffff"],
    svg: `<rect x="2" y="5" width="20" height="14" rx="2" fill="#8b0000"/>${word("USPD", "#ffffff", 6)}`,
  },
  {
    faction: "deu_spartacus",
    colours: ["#b00000", "#ffffff"],
    svg: `<circle cx="12" cy="12" r="9.5" fill="#b00000"/>${word("S", "#ffffff", 12)}`,
  },
  {
    faction: "deu_fatherland",
    colours: ["#000000", "#ffffff", "#dd0000"],
    svg: '<rect x="2" y="5" width="20" height="4.7" fill="#000000"/><rect x="2" y="9.7" width="20" height="4.6" fill="#ffffff"/><rect x="2" y="14.3" width="20" height="4.7" fill="#dd0000"/><rect x="2" y="5" width="20" height="14" fill="none" stroke="#000000" stroke-width="0.6"/>',
  },
  {
    faction: "deu_ohl",
    colours: ["#111111", "#ffffff"],
    svg: '<path d="M9 2h6l-1 6.5L20.5 9v6l-6.5-.5L15 22H9l1-7.5L3.5 15V9L10 8.5z" fill="#ffffff" stroke="#111111" stroke-width="1.2"/><path d="M10.4 3.4h3.2l-.9 6.2 6.4.6v3.6l-6.4.6.9 6.2h-3.2l.9-6.2-6.4-.6v-3.6l6.4-.6z" fill="#111111"/>',
  },
  {
    faction: "deu_south",
    colours: ["#1c6fd1", "#ffffff"],
    svg: '<rect x="3" y="4" width="18" height="16" fill="#ffffff" stroke="#1c6fd1" stroke-width="0.8"/><path d="M3 8l3-4 3 4-3 4zm6 0 3-4 3 4-3 4zm6 0 3-4 3 4-3 4zM6 12l3-4 3 4-3 4zm6 0 3-4 3 4-3 4zM3 16l3-4 3 4-3 4zm6 0 3-4 3 4-3 4zm6 0 3-4 3 4-3 4z" fill="#1c6fd1"/>',
  },
];
