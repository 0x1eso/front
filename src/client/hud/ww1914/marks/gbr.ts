import type { GwMarkRow } from "./GwMarks";

// ww207 (W-GBR): GBR's party marks, our own simple drawings in each party's
// colours (no portraits). From memory (F): Liberal yellow, the Unionists' blue
// and the Primrose League's flower, Labour's and the ILP's red, the Irish
// Party's green flag with the gold harp, the green, white and orange
// tricolour taken up after 1916, the Red Hand of Ulster, the Lords' red
// benches and a peer's coronet. The Liberal rebels have none: the fallback
// shield shows their short name.
const text = (t: string, fill: string, size = 9): string =>
  `<text x="12" y="15.5" font-size="${size}" font-weight="700" font-family="sans-serif" text-anchor="middle" fill="${fill}">${t}</text>`;

export const GBR_MARKS: readonly GwMarkRow[] = [
  // A Liberal rosette.
  {
    faction: "gbr_liberals",
    colours: ["#f2b705", "#7a5200"],
    svg:
      `<path d="M8 15 L5 23 L9 21 L10 16 Z M16 15 L19 23 L15 21 L14 16 Z" fill="#7a5200"/>` +
      `<circle cx="12" cy="10" r="8" fill="#f2b705"/>` +
      `<circle cx="12" cy="10" r="4" fill="none" stroke="#7a5200" stroke-width="1.5"/>`,
  },
  // Lloyd George's Liberals: his initials on Liberal yellow.
  {
    faction: "gbr_lg",
    colours: ["#e08a00", "#ffffff"],
    svg:
      `<rect x="2" y="2" width="20" height="20" rx="4" fill="#e08a00"/>` +
      text("LG", "#ffffff"),
  },
  // The Primrose League's flower on Unionist blue.
  {
    faction: "gbr_unionists",
    colours: ["#1f3f8f", "#f5e27a"],
    svg:
      `<circle cx="12" cy="12" r="11" fill="#1f3f8f"/>` +
      `<g fill="#f5e27a"><circle cx="12" cy="6.5" r="3.2"/><circle cx="17.2" cy="10.3" r="3.2"/>` +
      `<circle cx="15.2" cy="16.4" r="3.2"/><circle cx="8.8" cy="16.4" r="3.2"/><circle cx="6.8" cy="10.3" r="3.2"/></g>` +
      `<circle cx="12" cy="12" r="2" fill="#d98c00"/>`,
  },
  // The Red Hand of Ulster, for Carson's committee.
  {
    faction: "gbr_uwc",
    colours: ["#c8102e", "#ffffff"],
    svg:
      `<rect x="2" y="2" width="20" height="20" rx="3" fill="#ffffff" stroke="#c8102e" stroke-width="1.5"/>` +
      `<path d="M8 21 L8 12 L7 8 Q7 7 8 7 L9 11 L9 5 Q9.5 4 10.5 5 L10.5 10.5 L11 4 Q12 3 12.5 4 L12.5 10.5 L13.5 5 Q14.5 4 15 5 L14.5 11.5 L16.5 9 Q17.5 9 17 10.5 L15.5 15 L15.5 21 Z" fill="#c8102e"/>`,
  },
  // Labour's red, with its name.
  {
    faction: "gbr_labour",
    colours: ["#d50000", "#ffffff"],
    svg:
      `<rect x="2" y="2" width="20" height="20" rx="4" fill="#d50000"/>` +
      text("LAB", "#ffffff", 7.5),
  },
  {
    faction: "gbr_ilp",
    colours: ["#8b0000", "#ffffff"],
    svg:
      `<circle cx="12" cy="12" r="11" fill="#8b0000"/>` +
      text("ILP", "#ffffff", 8),
  },
  // The Irish Party's green flag and gold harp.
  {
    faction: "gbr_irish",
    colours: ["#169b62", "#f2c230"],
    svg:
      `<rect x="1" y="3" width="22" height="18" rx="2" fill="#169b62"/>` +
      `<path d="M8 6 Q15 4 17 8 L10 19 L8 19 Z" fill="none" stroke="#f2c230" stroke-width="1.6"/>` +
      `<g stroke="#f2c230" stroke-width="0.8"><path d="M10 7 L10 18"/><path d="M12 6.5 L12 15.5"/><path d="M14 6.6 L14 12.5"/></g>`,
  },
  // The green, white and orange.
  {
    faction: "gbr_sinn_fein",
    colours: ["#169b62", "#ff883e"],
    svg:
      `<rect x="1" y="4" width="7.4" height="16" fill="#169b62"/>` +
      `<rect x="8.3" y="4" width="7.4" height="16" fill="#ffffff"/>` +
      `<rect x="15.6" y="4" width="7.4" height="16" fill="#ff883e"/>` +
      `<rect x="1" y="4" width="22" height="16" fill="none" stroke="#555555" stroke-width="0.6"/>`,
  },
  // A peer's coronet on the Lords' red.
  {
    faction: "gbr_peers",
    colours: ["#b0102c", "#e8c35a"],
    svg:
      `<rect x="2" y="2" width="20" height="20" rx="4" fill="#b0102c"/>` +
      `<path d="M5 17 L6 9 L9 13 L12 7 L15 13 L18 9 L19 17 Z" fill="#e8c35a"/>` +
      `<rect x="5" y="17" width="14" height="2.5" fill="#e8c35a"/>`,
  },
  // Crossed swords on khaki: the generals.
  {
    faction: "gbr_generals",
    colours: ["#7a6a3a", "#e6e0cc"],
    svg:
      `<circle cx="12" cy="12" r="11" fill="#7a6a3a"/>` +
      `<g stroke="#e6e0cc" stroke-width="1.8" stroke-linecap="round"><path d="M6 18 L18 6"/><path d="M18 18 L6 6"/></g>` +
      `<g stroke="#e6e0cc" stroke-width="1.4"><path d="M6.5 14.5 L9.5 17.5"/><path d="M17.5 14.5 L14.5 17.5"/></g>`,
  },
];
