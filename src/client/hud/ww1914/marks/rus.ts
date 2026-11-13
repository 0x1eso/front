import type { GwMarkRow } from "./GwMarks";

// ww207 (W-RUS): RUS's party marks: our own simple name marks in the
// parties' colours, never a portrait. The Russian initials are the parties'
// own short names: К-Д the Constitutional Democrats ("Kadets"), 17 the Union
// of 17 October, С-Р the Socialist Revolutionaries, СРН the Union of the
// Russian People, С-Д the Social Democrats, ТГ the Trudovik Group, ОД the
// United Nobility. Not checked (F): the colours are ours (red for the
// socialists, the imperial black and gold for the Right, white and red for
// the Poles); the parties had no fixed emblems we could find to copy. The
// Empress's circle and the Stavka have no mark: the fallback shield.
const name = (text: string, fill: string, ink: string, size = 9): string =>
  `<rect x="1" y="3" width="22" height="18" rx="3" fill="${fill}"/>` +
  `<text x="12" y="${12 + size / 3}" font-size="${size}" font-weight="700" ` +
  `text-anchor="middle" fill="${ink}" font-family="sans-serif">${text}</text>`;

/** A red flag on its staff, with letters on the cloth. */
const flag = (text: string, fill: string, size = 6): string =>
  `<rect x="3" y="2" width="1.6" height="20" fill="#3b2a1a"/>` +
  `<path d="M4.6 3h16l-3 4.5 3 4.5h-16z" fill="${fill}"/>` +
  `<text x="11.5" y="${7.5 + size / 3}" font-size="${size}" font-weight="700" ` +
  `text-anchor="middle" fill="#ffffff" font-family="sans-serif">${text}</text>`;

/** The eight-pointed Orthodox cross on the imperial gold. */
const cross =
  `<rect x="1" y="1" width="22" height="22" rx="3" fill="#f2c200"/>` +
  `<rect x="11" y="3" width="2" height="18" fill="#111111"/>` +
  `<rect x="9" y="5" width="6" height="1.6" fill="#111111"/>` +
  `<rect x="6" y="8.5" width="12" height="2" fill="#111111"/>` +
  `<path d="M8.5 16.5l7 -2v1.6l-7 2z" fill="#111111"/>`;

export const RUS_MARKS: readonly GwMarkRow[] = [
  { faction: "rus_rights", colours: ["#f2c200", "#111111"], svg: cross },
  {
    faction: "rus_octob",
    colours: ["#2e6b3a", "#ffffff"],
    svg: name("17", "#2e6b3a", "#ffffff", 12),
  },
  {
    faction: "rus_kadets",
    colours: ["#1f4e9c", "#ffffff"],
    svg: name("К-Д", "#1f4e9c", "#ffffff", 9),
  },
  {
    faction: "rus_trud",
    colours: ["#d0601a", "#ffffff"],
    svg: name("ТГ", "#d0601a", "#ffffff", 11),
  },
  {
    faction: "rus_sd",
    colours: ["#c00000", "#ffffff"],
    svg: flag("С-Д", "#c00000", 5),
  },
  {
    faction: "rus_bolsh",
    colours: ["#8f0000", "#ffffff"],
    svg: flag("Б", "#8f0000", 8),
  },
  {
    faction: "rus_sr",
    colours: ["#b01010", "#111111"],
    svg: name("С-Р", "#111111", "#e03030", 9),
  },
  {
    faction: "rus_urp",
    colours: ["#111111", "#f2c200", "#ffffff"],
    svg: name("СРН", "#111111", "#f2c200", 8),
  },
  {
    faction: "rus_nobles",
    colours: ["#5a3e8a", "#f2c200"],
    svg: name("ОД", "#5a3e8a", "#f2c200", 11),
  },
  {
    faction: "rus_poles",
    colours: ["#dc143c", "#ffffff"],
    svg:
      `<rect x="1" y="3" width="22" height="9" fill="#ffffff" stroke="#999999" stroke-width="0.5"/>` +
      `<rect x="1" y="12" width="22" height="9" fill="#dc143c"/>` +
      `<text x="12" y="19.5" font-size="7" font-weight="700" text-anchor="middle" ` +
      `fill="#ffffff" font-family="sans-serif">ND</text>`,
  },
];
