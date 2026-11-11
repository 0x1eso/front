import {
  GW_LINES,
  GwFactKind,
  GwMemoir,
  GwNews,
  GwReason,
  GwTheatre,
  GwUnknown,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwAskView,
  GwFileView,
} from "@openfront/engine-api/ww1914/GwHouse";
import { gwBrief, type GwPack } from "@openfront/engine-api/ww1914/GwPack";
import { GW_PLACES, type GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwCardView,
  GwChoiceView,
  GwPromiseView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwReportView } from "@openfront/engine-api/ww1914/GwWorldView";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";
import { officeTitle } from "./GwOffice";

/** A key's text, or null when it has none. */
export function textOrNull(
  key: string,
  params: Record<string, string | number> = {},
): string | null {
  const t = translateText(key, params);
  return t === key ? null : t;
}

/** A person's name; the id when the pack has no row. */
export function personName(pack: GwPack | null, id: string): string {
  return pack?.people[id]?.name ?? id;
}

/** "1914-07-05" as prose: "7월 5일". */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
}

/** "1914-07-05" as the screen's headings write it. */
export function fullDate(iso: string): string {
  return `${iso.split("-")[0]}년 ${shortDate(iso)}`;
}

/** Thousands as a Korean count: 520 is 52만, 1234 is 123만 4천. */
export function countInMan(thousands: number): string {
  const man = Math.floor(thousands / 10);
  const rest = thousands % 10;
  if (man === 0) return `${rest}천`;
  return rest === 0 ? `${man}만` : `${man}만 ${rest}천`;
}

/** The date of the latest memory or decision a callback hole names. */
function callbackDate(seat: GwSeatView, head: string, id: string): string {
  const rows =
    head === "mem"
      ? (seat.memory ?? []).filter((m) => m.key === id)
      : (seat.choices ?? []).filter((c) => c.scene === id);
  const last = rows[rows.length - 1];
  return last === undefined ? "" : shortDate(last.date);
}

/**
 * Fills {role}, {role.title}, {date} and the callbacks {mem.<key>} and
 * {chose.<scene>} in a pack's text. Only names, titles and dates are put in
 * (design §5.3); josa markers after them are resolved.
 */
export function fillGw(
  text: string,
  pack: GwPack | null,
  card: GwCardView,
  seat: GwSeatView,
  date: string,
): string {
  const out = text.replace(
    /\{([a-z_0-9]+)(?:\.([a-z_0-9]+))?\}/g,
    (hole, role, title) => {
      if (role === "date") return shortDate(date);
      if ((role === "mem" || role === "chose") && title !== undefined) {
        return callbackDate(seat, role, title);
      }
      const id = card.cast[role];
      if (id === undefined) return hole;
      if (title === undefined) return personName(pack, id);
      const office = seat.people.find((p) => p.id === id)?.office;
      return office === null || office === undefined
        ? ""
        : officeTitle(seat.tag, office);
    },
  );
  return applyJosa(out);
}

/** The card's text; its id when the pack has none (design §12). */
export function cardBody(pack: GwPack | null, card: GwCardView): string {
  return pack?.scenes[card.scene]?.text[card.variant] ?? card.scene;
}

/** The secretary's note for the card, its holes filled; null when it has none. */
export function briefText(
  pack: GwPack | null,
  card: GwCardView,
  seat: GwSeatView,
  date: string,
): string | null {
  const raw = gwBrief(pack?.scenes[card.scene]?.brief, card.variant);
  return raw === null || raw.trim() === ""
    ? null
    : fillGw(raw, pack, card, seat, date);
}

/** A body in paragraphs; one that starts "> " is a paper quoted in the scene. */
export function bodyParts(text: string): { quote: boolean; text: string }[] {
  return text.split(/\n{2,}/).map((p) => {
    const quote = p.startsWith("> ");
    return { quote, text: quote ? p.slice(2) : p };
  });
}

/** The same body as running text: a card's first lines, a talk's room. */
export function bodyPlain(text: string): string {
  return bodyParts(text)
    .map((p) => p.text)
    .join("\n\n");
}

export function cardTitle(pack: GwPack | null, card: GwCardView): string {
  return pack?.scenes[card.scene]?.title ?? card.scene;
}

/** What the person says at the card's node. */
export function saysText(pack: GwPack | null, card: GwCardView): string {
  if (card.node === null || card.says === null) return "";
  const node = pack?.scenes[card.scene]?.nodes?.[card.node];
  const by = card.who === null ? undefined : node?.saysBy?.[card.who];
  return by?.[card.says] ?? node?.says[card.says] ?? card.says;
}

/** A big scene's node: the hour, and the line of narration before the words. */
export function beatOf(
  pack: GwPack | null,
  card: GwCardView,
): { at: string | null; room: string | null } {
  const node =
    card.node === null
      ? undefined
      : pack?.scenes[card.scene]?.nodes?.[card.node];
  return { at: node?.at ?? null, room: node?.room ?? null };
}

/** A prologue scene's date, and who `who` was then. */
export function pastOf(
  pack: GwPack | null,
  card: GwCardView,
  who: string,
): { dated: string | null; as: string | null } {
  const t = pack?.scenes[card.scene];
  return { dated: t?.dated ?? null, as: t?.as?.[who] ?? null };
}

/**
 * The memoir's line on the rival: his own by how it went (an end, else what
 * the seat did, else how far he got), else a plain one that names him.
 */
export function rivalLine(
  pack: GwPack | null,
  r: NonNullable<GwMemoir["rival"]>,
): string {
  const name = personName(pack, r.who);
  const keys = [r.end, r.act, `stage${r.stage}`].filter((k) => k !== null);
  const own = pack?.rivals?.[r.who];
  for (const k of keys) {
    const line = own?.[k];
    if (line !== undefined) return applyJosa(line.replace(/\{who\}/g, name));
  }
  return translateText(`gw.ui.rival.${keys[0]}`, { name });
}

export function optionText(
  pack: GwPack | null,
  card: GwCardView,
  id: string,
): string {
  const scene = pack?.scenes[card.scene];
  // Some shares wrote the lead of an option or a reply in **; the button shows
  // plain text.
  if (card.node !== null) {
    return (scene?.nodes?.[card.node]?.replies[id] ?? id).replace(/\*\*/g, "");
  }
  const line = scene?.optBy?.[card.variant]?.[id] ?? scene?.opt?.[id];
  return (line ?? id).replace(/\*\*/g, "");
}

/** The option as written, its bold marks kept for `boldParts`. */
export function optionMarked(
  pack: GwPack | null,
  card: GwCardView,
  id: string,
): string {
  const scene = pack?.scenes[card.scene];
  return scene?.optBy?.[card.variant]?.[id] ?? scene?.opt?.[id] ?? id;
}

/** An option's text, its **verb phrase** marked: the style guide's bold line. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((p) => p.text !== "");
}

/**
 * An option split into what the player picks and what follows from it: the
 * bold lead, or the first sentence when the share wrote no bold. Only the lead
 * shows before the choice; the rest is the result note after it.
 */
export function optionSplit(text: string): { lead: string; rest: string } {
  const bold = /^\s*\*\*([^*]+)\*\*\s*([\s\S]*)$/.exec(text);
  if (bold !== null) return { lead: bold[1].trim(), rest: bold[2].trim() };
  const plain = text.replace(/\*\*/g, "").trim();
  const cut = plain.search(/(?<=[.!?\u2026])\s/);
  return cut < 0
    ? { lead: plain, rest: "" }
    : { lead: plain.slice(0, cut), rest: plain.slice(cut + 1).trim() };
}

/** Each cast member's own paragraph on this card, in cast order. */
export function voices(pack: GwPack | null, card: GwCardView): string[] {
  const scene = pack?.scenes[card.scene];
  if (scene === undefined) return [];
  return Object.entries(card.cast).flatMap(([role, id]) => {
    const variant = card.voice?.[role];
    const by = variant === undefined ? undefined : scene.voiceBy?.[role];
    const line = by?.[id]?.[variant!] ?? scene.voice?.[role]?.[id];
    return line === undefined ? [] : [line];
  });
}

/** The titles of the small scenes a quiet card folded, one line each. */
export function foldedLines(pack: GwPack | null, card: GwCardView): string[] {
  return (card.folded ?? []).map((id) => pack?.scenes[id]?.title ?? id);
}

function withWho(text: string, pack: GwPack | null, who?: string | null) {
  const name = who === null || who === undefined ? "" : personName(pack, who);
  return applyJosa(text.replace(/\{who\}/g, name));
}

/** What a schedule act's line moved (ww169 `what`), named by its key's family. */
function whatText(pack: GwPack | null, key: string, what: string): string {
  // Occupation and the tables (ww172): a place.
  if (key.startsWith("land_") && what in GW_PLACES) {
    return GW_PLACES[what as GwPlace].nameKo;
  }
  if (key.startsWith("fx_inst_"))
    return translateText(`gw.ui.inst_name.${what}`);
  if (key.startsWith("fx_opinion_"))
    return pack?.press?.blocs[what]?.name ?? what;
  if (key === "fx_inspect" || key === "fx_report") {
    return translateText(`gw.ui.fact.${what}`);
  }
  if (key.startsWith("fx_faction_"))
    return pack?.factions?.[what]?.name ?? what;
  return personName(pack, what);
}

/** A why-log line: the pack's, else the language file's. */
export function reasonText(pack: GwPack | null, r: GwReason): string {
  const line = pack?.reasons?.[r.key] ?? translateText(`gw.reason.${r.key}`);
  const country =
    r.tag === undefined ? "" : translateText(`gw.country.${r.tag}`);
  const what =
    r.what === undefined || r.what === null
      ? ""
      : whatText(pack, r.key, r.what);
  const text = withWho(
    line.replace(/\{country\}/g, country).replace(/\{what\}/g, what),
    pack,
    r.who,
  );
  // An answer to a power names it, so it reads as caused (ww169).
  if (r.power === undefined) return text;
  return translateText("gw.power.because", {
    power: pack?.powers?.[r.power]?.name ?? r.power,
    line: text,
  });
}

/** Dug-in lines to take turns; the rule's own, for papers with none. */
const DUG_LINES = 3;

/** How a paper sent back comes again; null for one that wasn't. */
export function backText(
  pack: GwPack | null,
  card: GwCardView,
  seat: GwSeatView,
  date: string,
): string | null {
  const b = card.back;
  if (b === null || b === undefined) return null;
  const own = pack?.scenes[card.scene]?.back?.[b.changed ? b.direction : "dug"];
  const line =
    own ??
    translateText(
      b.changed
        ? `gw.back.changed.${b.direction}`
        : `gw.back.dug.n${card.uid % DUG_LINES}`,
    );
  return withWho(fillGw(line, pack, card, seat, date), pack, card.backWho);
}

/** A promise as the people screen lists it. */
export function promiseText(pack: GwPack | null, p: GwPromiseView): string {
  // A yes to an ally's ask is filed by the ask's name (ww158).
  const ask = p.key.startsWith("ask_")
    ? pack?.asks?.[p.key.slice(4)]?.name
    : undefined;
  const own = pack?.promises?.[p.key] ?? ask ?? houseDeal(pack, p.key);
  return withWho(own ?? p.key, pack, p.who);
}

/**
 * A deal struck in the house (ww158), key `house_<faction>_<law>`, with no
 * text of its own: the common line, naming the bill by its title.
 */
function houseDeal(pack: GwPack | null, key: string): string | null {
  if (pack === null || !key.startsWith("house_")) return null;
  const law = Object.keys(pack.scenes)
    .filter((id) => id.startsWith("gw_law_"))
    .map((id) => id.slice("gw_law_".length))
    .filter((l) => key.endsWith(`_${l}`))
    .sort((a, b) => b.length - a.length)[0];
  const bill = law === undefined ? undefined : pack.scenes[`gw_law_${law}`];
  const line =
    bill === undefined
      ? pack.promises?.house_deal_plain
      : pack.promises?.house_deal;
  if (line === undefined) return null;
  return line.replace(/\{bill\}/g, bill?.title ?? "");
}

/** A file's line in the 서류철: the pack's words for it, else the kind's. */
export function fileLine(pack: GwPack | null, f: GwFileView): string {
  return (
    pack?.weak?.[f.who]?.[f.weak] ?? translateText(`gw.dossier.weak.${f.weak}`)
  );
}

/** Where a file stands: held, used, burnt (it was false), out (a scandal). */
export function fileState(f: GwFileView): string {
  if (f.end !== null) return translateText(`gw.dossier.end.${f.end}`);
  return f.used > 0
    ? translateText("gw.dossier.used", { n: f.used })
    : translateText("gw.dossier.held");
}

/** An ally's ask by its pack name. */
export function askName(pack: GwPack | null, a: GwAskView): string {
  return pack?.asks?.[a.id]?.name ?? a.id;
}

/**
 * A decision as the notebook lists it: the paper's title and the bold line of
 * what was chosen, with the names of who was in the scene.
 */
export function decisionLine(
  pack: GwPack | null,
  d: GwChoiceView,
): { title: string; pick: string } {
  const scene = pack?.scenes[d.scene];
  const text = scene?.opt?.[d.pick] ?? d.pick;
  const { lead } = optionSplit(text);
  const pick = lead.replace(/\{([a-z_0-9]+)\}/g, (hole, role) => {
    const id = d.cast?.[role];
    return id === undefined ? hole : personName(pack, id);
  });
  return { title: scene?.title ?? d.scene, pick: applyJosa(pick) };
}

/** "army:-1" as the player reads it; a word with no translation shows itself. */
export function tellText(tell: string, tag?: string): string {
  const [key, value] = tell.split(":");
  const k = `gw.tell.${key}`;
  const t = translateText(k);
  // An office reads as the seat's country names it (Germany's 재상).
  const own =
    tag === undefined ? null : textOrNull(`gw.office_by.${tag}.${key}`);
  const name = own ?? (t === k ? key.replace(/_/g, " ") : t);
  if (value === undefined) return name;
  const word = tellWord(value);
  return word === null ? `${name} ${value}` : `${name} ${value} (${word})`;
}

/** ww179: a signed number on a chip, said in words: "+1" is "조금 오름". */
export function tellWord(value: string): string | null {
  const m = /^([+-])(\d+)$/.exec(value);
  if (m === null || m[2] === "0") return null;
  const n = Number(m[2]);
  const size = n <= 1 ? "small" : n === 2 ? "mid" : "big";
  return translateText(
    `gw.ui.tell_move.${m[1] === "+" ? "up" : "down"}.${size}`,
  );
}

/** The ending's paragraph, its holes filled; null when the pack has none. */
export function endingText(
  pack: GwPack | null,
  memoir: GwMemoir,
  date: string,
): string | null {
  const own = pack?.endings?.[memoir.ending];
  if (own === undefined) return null;
  const coda = memoir.coda === null ? undefined : pack?.endings?.[memoir.coda];
  const text = coda === undefined ? own : `${own}\n\n${coda}`;
  return applyJosa(
    text
      .replace(/\{date\}/g, fullDate(date))
      .replace(/\{casualties\}/g, countInMan(memoir.casualties)),
  );
}

/** Why the world's ending came (ww172); null when the memoir has none. */
export function endingWhy(memoir: GwMemoir): string | null {
  const why = memoir.why ?? null;
  if (why === null) return null;
  const line = textOrNull(`gw.ending_why.${why.key}`, {
    country: why.tag === null ? "" : country(why.tag),
  });
  return line === null ? null : applyJosa(line);
}

export function endingTitle(id: string): string {
  return textOrNull(`gw.ending.${id}`) ?? translateText("gw.ui.ending_default");
}

export const country = (tag: string) => translateText(`gw.country.${tag}`);

const theatreName = (t: GwTheatre) => translateText(`gw.theatre.${t}`);

/** A front's named line: the index is the engine's, the name is the reader's. */
export function frontLine(t: GwTheatre, line: string | number): string {
  const name = typeof line === "number" ? GW_LINES[t][line] : line;
  return textOrNull(`gw.front.${t}.${name}`) ?? name.replace(/_/g, " ");
}

/** What a fact's value reads as ("총동원"). */
export function factText(fact: GwFactKind, value: number): string {
  return textOrNull(`gw.fact.${fact}.${value}`) ?? String(value);
}

/** A line of the world's news; null for a key with no text. */
export function newsText(n: GwNews): string | null {
  const line = textOrNull(`gw.news.${n.key}`, {
    a: n.a === null ? "" : country(n.a),
    b: n.b === null ? "" : country(n.b),
    theatre: n.theatre === null ? "" : theatreName(n.theatre),
    place: n.place === undefined ? "" : GW_PLACES[n.place].nameKo,
  });
  return line === null ? null : applyJosa(line);
}

/** A turning point in the memoir. */
export function turnText(t: { key: string; tag: GwTag | null }): string {
  return applyJosa(
    translateText(`gw.turn.${t.key}`, {
      country: t.tag === null ? "" : country(t.tag),
    }),
  );
}

/** One line of "이 판에서 당신이 몰랐던 것". */
export function unknownText(pack: GwPack | null, u: GwUnknown): string {
  if (u.kind === "secret") return translateText(`gw.secret.${u.id}`);
  const word =
    u.kind === "ai" && u.word !== null ? translateText(`gw.ai.${u.word}`) : "";
  return applyJosa(
    translateText(`gw.unknown.${u.kind}`, {
      country: u.kind === "source" || u.kind === "person" ? "" : country(u.id),
      theatre: u.theatre === null ? "" : theatreName(u.theatre),
      person: u.kind === "person" ? personName(pack, u.id) : "",
      source: u.kind === "source" ? translateText(`gw.source.${u.id}`) : "",
      fact: u.kind === "lean" ? factText("lean", u.value) : "",
      value: u.value,
      word,
    }),
  );
}

/** A report as the seat got it: who it's about and what it says. */
export function reportText(r: GwReportView, pack?: GwPack | null): string {
  // A plot's or an ask's report names what it is about (ww158).
  const about =
    r.about === null || r.about === undefined
      ? undefined
      : r.fact === "plot"
        ? pack?.plots?.[r.about]?.name
        : r.fact === "ally"
          ? pack?.asks?.[r.about]?.name
          : r.fact === "count"
            ? pack?.scenes[`gw_law_${r.about}`]?.title
            : undefined;
  // ww173: a front's preparation or strain names the front too.
  const where =
    (r.fact === "prep" || r.fact === "strain") && r.theatre !== null
      ? translateText("gw.ui.report_where", {
          country: country(r.tag),
          theatre: theatreName(r.theatre),
        })
      : undefined;
  return translateText("gw.ui.report_line", {
    country: about ?? where ?? country(r.tag),
    fact: translateText(`gw.ui.fact.${r.fact}`),
    claim: factText(r.fact, r.claim),
  });
}

/** A person's one-line lean, or "" when the pack has none. */
export function personLean(pack: GwPack | null, id: string): string {
  return pack?.people[id]?.lean ?? "";
}

export function personBio(pack: GwPack | null, id: string): string {
  return pack?.people[id]?.bio ?? "";
}
