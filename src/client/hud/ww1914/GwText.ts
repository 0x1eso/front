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
import { gwBrief, type GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwCardView,
  GwChoiceView,
  GwPromiseView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwReportView } from "@openfront/engine-api/ww1914/GwWorldView";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";

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
        : translateText(`gw.office.${office}`);
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

export function optionText(
  pack: GwPack | null,
  card: GwCardView,
  id: string,
): string {
  const scene = pack?.scenes[card.scene];
  if (card.node !== null) return scene?.nodes?.[card.node]?.replies[id] ?? id;
  // Some shares wrote the lead of an option in **; the button shows plain text.
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

/** A why-log line: the pack's, else the language file's. */
export function reasonText(pack: GwPack | null, r: GwReason): string {
  const line = pack?.reasons?.[r.key] ?? translateText(`gw.reason.${r.key}`);
  const country =
    r.tag === undefined ? "" : translateText(`gw.country.${r.tag}`);
  return withWho(line.replace(/\{country\}/g, country), pack, r.who);
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
  return withWho(pack?.promises?.[p.key] ?? p.key, pack, p.who);
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
export function tellText(tell: string): string {
  const [key, value] = tell.split(":");
  const k = `gw.tell.${key}`;
  const t = translateText(k);
  const name = t === k ? key.replace(/_/g, " ") : t;
  return value === undefined ? name : `${name} ${value}`;
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

export function endingTitle(id: string): string {
  return textOrNull(`gw.ending.${id}`) ?? translateText("gw.ui.ending_default");
}

const country = (tag: string) => translateText(`gw.country.${tag}`);

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
export function reportText(r: GwReportView): string {
  return translateText("gw.ui.report_line", {
    country: country(r.tag),
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
