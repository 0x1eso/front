import type { GwMarkRow } from "./GwMarks";

// ww207 (W-AUH): AUH's party marks: simple marks of our own in the parties'
// colours, flags and signs (no portraits, no copied emblems). What each is
// drawn from (F: memory, not checked against the parties' own papers):
// - Social Democrats: the red flag of the labour movement.
// - Christian Socials: black, a white cross (their Catholic colour).
// - German Nationals: the cornflower blue of the German national movement.
// - Czechs: the Bohemian white over red.
// - Poles: the white eagle's red and white.
// - South Slavs: the red, white and blue the South Slav lands shared.
// - Party of Work: Hungary's tricolour; Independence: the tricolour and "48".
// - Károlyi: the tricolour crossed by a white olive branch (peace).
// - AOK and court: the black and yellow of the dynasty; a sword, a crown.
// - Ukrainians: blue over yellow; Romanians: blue, yellow, red.
const flag3 = (a: string, b: string, c: string): string =>
  `<rect x="3" y="5" width="18" height="4.67" fill="${a}"/>` +
  `<rect x="3" y="9.67" width="18" height="4.67" fill="${b}"/>` +
  `<rect x="3" y="14.33" width="18" height="4.67" fill="${c}"/>`;
const HU = flag3("#ce2939", "#ffffff", "#477050");

export const AUH_MARKS: readonly GwMarkRow[] = [
  {
    faction: "auh_sd",
    colours: ["#c8102e", "#ffffff"],
    svg: '<rect x="5" y="3" width="1.6" height="18" fill="#5a3a22"/><path d="M6.6 4h12l-3 4 3 4h-12z" fill="#c8102e"/>',
  },
  {
    faction: "auh_csoc",
    colours: ["#1a1a1a", "#ffffff"],
    svg: '<circle cx="12" cy="12" r="9" fill="#1a1a1a"/><rect x="10.8" y="6" width="2.4" height="12" fill="#ffffff"/><rect x="7.5" y="9" width="9" height="2.4" fill="#ffffff"/>',
  },
  {
    faction: "auh_germans",
    colours: ["#3b5fc0", "#1a1a1a"],
    svg: '<circle cx="12" cy="12" r="2.4" fill="#1f2f6e"/><g fill="#3b5fc0"><circle cx="12" cy="6.5" r="2.6"/><circle cx="17.2" cy="10.3" r="2.6"/><circle cx="15.2" cy="16.5" r="2.6"/><circle cx="8.8" cy="16.5" r="2.6"/><circle cx="6.8" cy="10.3" r="2.6"/></g>',
  },
  {
    faction: "auh_czech",
    colours: ["#d7141a", "#ffffff"],
    svg: '<path d="M4 4h16v8H4z" fill="#ffffff" stroke="#999" stroke-width="0.5"/><path d="M4 12h16v3a8 8 0 0 1-16 0z" fill="#d7141a"/>',
  },
  {
    faction: "auh_poles",
    colours: ["#dc143c", "#ffffff"],
    svg: '<path d="M4 4h16v9a8 8 0 0 1-16 0z" fill="#dc143c"/><path d="M12 7l2 3h3l-2 2 1 4-4-2-4 2 1-4-2-2h3z" fill="#ffffff"/>',
  },
  {
    faction: "auh_slavs",
    colours: ["#c8102e", "#ffffff", "#1c3f94"],
    svg: flag3("#c8102e", "#ffffff", "#1c3f94"),
  },
  {
    faction: "auh_work",
    colours: ["#477050", "#ce2939", "#ffffff"],
    svg: HU,
  },
  {
    faction: "auh_indep",
    colours: ["#ce2939", "#477050", "#ffffff"],
    svg:
      HU +
      '<text x="12" y="14" font-size="6" font-weight="700" text-anchor="middle" fill="#1a1a1a">48</text>',
  },
  {
    faction: "auh_karolyi",
    colours: ["#477050", "#ffffff", "#ce2939"],
    svg:
      HU +
      '<path d="M6 17c4-1 8-5 12-10" stroke="#1a1a1a" stroke-width="1.2" fill="none"/><ellipse cx="10" cy="13.5" rx="1.6" ry="0.8" fill="#1a1a1a"/><ellipse cx="14" cy="10" rx="1.6" ry="0.8" fill="#1a1a1a"/>',
  },
  {
    faction: "auh_aok",
    colours: ["#1a1a1a", "#f5c400"],
    svg: '<rect x="3" y="3" width="18" height="9" fill="#1a1a1a"/><rect x="3" y="12" width="18" height="9" fill="#f5c400"/><path d="M12 4v14M9 15h6" stroke="#ffffff" stroke-width="1.6"/>',
  },
  {
    faction: "auh_court",
    colours: ["#f5c400", "#1a1a1a"],
    svg: '<rect x="3" y="3" width="18" height="9" fill="#1a1a1a"/><rect x="3" y="12" width="18" height="9" fill="#f5c400"/><path d="M6 17l1-7 3 3 2-5 2 5 3-3 1 7z" fill="#f5c400" stroke="#1a1a1a" stroke-width="0.6"/>',
  },
  {
    faction: "auh_ukr",
    colours: ["#0057b7", "#ffd700"],
    svg: '<rect x="3" y="5" width="18" height="7" fill="#0057b7"/><rect x="3" y="12" width="18" height="7" fill="#ffd700"/>',
  },
  {
    faction: "auh_romanians",
    colours: ["#002b7f", "#fcd116", "#ce1126"],
    svg: '<rect x="3" y="5" width="6" height="14" fill="#002b7f"/><rect x="9" y="5" width="6" height="14" fill="#fcd116"/><rect x="15" y="5" width="6" height="14" fill="#ce1126"/>',
  },
];
