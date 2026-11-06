import type { GwReason } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwCardView,
  GwPromiseView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";

/** A person's name; the id when the pack has no row. */
export function personName(pack: GwPack | null, id: string): string {
  return pack?.people[id]?.name ?? id;
}

/** "1914-07-05" as prose: "7월 5일". */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
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
      if (role === "date") return date;
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
  return scene?.opt?.[id] ?? id;
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
  const line = pack?.reasons?.[r.key];
  if (line !== undefined) return withWho(line, pack, r.who);
  return translateText(`gw.reason.${r.key}`);
}

/** A promise as the people screen lists it. */
export function promiseText(pack: GwPack | null, p: GwPromiseView): string {
  return withWho(pack?.promises?.[p.key] ?? p.key, pack, p.who);
}

/** "army:-1" as the player reads it. */
export function tellText(tell: string): string {
  const [key, value] = tell.split(":");
  const name = translateText(`gw.tell.${key}`);
  return value === undefined ? name : `${name} ${value}`;
}
