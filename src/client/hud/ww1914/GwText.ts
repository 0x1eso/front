import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";

/** A person's name; the id when the pack has no row. */
export function personName(pack: GwPack | null, id: string): string {
  return pack?.people[id]?.name ?? id;
}

/**
 * Fills {role}, {role.title} and {date} in a pack's text. Only names, titles
 * and dates are put in (design §5.3); josa markers after them are resolved.
 */
export function fillGw(
  text: string,
  pack: GwPack | null,
  card: GwCardView,
  seat: GwSeatView,
  date: string,
): string {
  const out = text.replace(
    /\{([a-z_0-9]+)(\.title)?\}/g,
    (hole, role, title) => {
      if (role === "date") return date;
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
  const voice = pack?.scenes[card.scene]?.voice;
  if (voice === undefined) return [];
  return Object.entries(card.cast).flatMap(([role, id]) => {
    const line = voice[role]?.[id];
    return line === undefined ? [] : [line];
  });
}

/** "army:-1" as the player reads it; a word with no translation shows itself. */
export function tellText(tell: string): string {
  const [key, value] = tell.split(":");
  const k = `gw.tell.${key}`;
  const t = translateText(k);
  const name = t === k ? key.replace(/_/g, " ") : t;
  return value === undefined ? name : `${name} ${value}`;
}

/** The ending's text when the pack has one (an `ending_<id>` scene), else null. */
export function endingText(pack: GwPack | null, id: string): string | null {
  const s = pack?.scenes[`ending_${id}`];
  return s === undefined ? null : (s.text.base ?? Object.values(s.text)[0]);
}

export function endingTitle(pack: GwPack | null, id: string): string {
  return (
    pack?.scenes[`ending_${id}`]?.title ?? translateText("gw.ui.ending_default")
  );
}

/** A person's one-line lean, or "" when the pack has none. */
export function personLean(pack: GwPack | null, id: string): string {
  return pack?.people[id]?.lean ?? "";
}

export function personBio(pack: GwPack | null, id: string): string {
  return pack?.people[id]?.bio ?? "";
}
