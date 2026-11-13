import type { GwMarkRow } from "./GwMarks";

// ww207 (W-FRA): FRA's party marks. Our own simple marks in each party's
// colours, never a real emblem drawn exactly or anyone's face. What they lean
// on: Marianne's Phrygian cap for the Radicals; the red flag for the SFIO
// (its three arrows came only in the 1930s); the tricolour for the centre's
// republicans; a cross for the Catholic deputies; the fleur-de-lis for Action
// française's king; three claw marks for the Tiger (the nickname); crossed
// swords for the GQG. Caillaux's men, the Republican-Socialists, the
// minority and the Federation keep the fallback shield. Colours not checked
// (F).
export const FRA_MARKS: readonly GwMarkRow[] = [
  {
    faction: "fra_radicals",
    colours: ["#d7262e", "#ffffff"],
    svg: '<path d="M4 19c0-6 3-11 9-12 4-1 7 1 7 4-2-1-4-1-5 1 2 2 3 4 3 7z" fill="#d7262e"/><path d="M4 19h14v2H4z" fill="#ffffff"/><circle cx="11" cy="14" r="1.6" fill="#ffffff"/>',
  },
  {
    faction: "fra_sfio",
    colours: ["#c8102e", "#3a2a1a"],
    svg: '<rect x="5" y="3" width="1.6" height="18" fill="#3a2a1a"/><path d="M6.6 4h12.4l-2 3.5 2 3.5H6.6z" fill="#c8102e"/>',
  },
  {
    faction: "fra_left_rep",
    colours: ["#1f4e9c", "#ffffff", "#d7262e"],
    svg: '<rect x="3" y="5" width="6" height="14" fill="#1f4e9c"/><rect x="9" y="5" width="6" height="14" fill="#ffffff"/><rect x="15" y="5" width="6" height="14" fill="#d7262e"/>',
  },
  {
    faction: "fra_catholics",
    colours: ["#1f3a93", "#ffffff"],
    svg: '<rect x="10" y="3" width="4" height="18" fill="#1f3a93"/><rect x="5" y="8" width="14" height="4" fill="#1f3a93"/>',
  },
  {
    faction: "fra_af",
    colours: ["#1d3f8c", "#e8c547"],
    svg: '<path d="M12 3c-2 3-2 6 0 9 2-3 2-6 0-9zM11 12c-2-3-6-4-8-2 2 0 4 1 5 4zM13 12c2-3 6-4 8-2-2 0-4 1-5 4z" fill="#e8c547"/><rect x="7" y="13" width="10" height="2" fill="#e8c547"/><path d="M11 15h2l1 5h-4z" fill="#e8c547"/>',
  },
  {
    faction: "fra_tiger",
    colours: ["#e07b00", "#2b2b2b"],
    svg: '<path d="M5 4l4 16h2L7 4zM10 3l4 17h2L12 3zM15 4l4 16h2L17 4z" fill="#e07b00"/>',
  },
  {
    faction: "fra_gqg",
    colours: ["#4a5d23", "#c9b037"],
    svg: '<path d="M4 4l1.5-1.5L20 17l-1.5 1.5zM20 4l-1.5-1.5L4 17l1.5 1.5z" fill="#4a5d23"/><circle cx="5" cy="19" r="1.6" fill="#c9b037"/><circle cx="19" cy="19" r="1.6" fill="#c9b037"/>',
  },
];
