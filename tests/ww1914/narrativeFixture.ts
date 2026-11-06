import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwNode,
  GwReply,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { useGwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { afterEach } from "vitest";

const person = (
  id: string,
  over: Partial<GwPersonDef> & Pick<GwPersonDef, "temperaments">,
): GwPersonDef => ({
  id,
  tag: "DEU",
  office: null,
  fit: [],
  camps: [],
  rivals: [],
  allies: [],
  fame: 3,
  source: "fixture",
  ...over,
});

/** One temperament each, so a seed can't change what the tests expect. */
export const CAST: readonly GwPersonDef[] = [
  person("deu_arrogant", {
    office: "chancellor",
    camps: ["civil"],
    temperaments: ["arrogant"],
    rivals: ["deu_anxious"],
    allies: ["deu_cold"],
  }),
  person("deu_anxious", {
    office: "chief_of_staff",
    camps: ["military", "hard"],
    temperaments: ["anxious"],
  }),
  person("deu_cold", {
    office: "foreign",
    camps: ["civil"],
    temperaments: ["cold"],
  }),
  person("deu_stubborn", {
    office: "war",
    camps: ["military"],
    temperaments: ["stubborn"],
    rivals: ["deu_cold"],
  }),
  person("deu_cunning", {
    camps: ["east"],
    temperaments: ["cunning"],
  }),
  person("gbr_grey", {
    tag: "GBR",
    office: "foreign",
    temperaments: ["weary"],
  }),
];

export const scene = (id: string, over: Partial<GwScene> = {}): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  cast: {},
  salience: 5,
  tags: [],
  variants: [{ id: "base" }],
  ...over,
});

export const decision = (id: string, over: Partial<GwScene> = {}): GwScene =>
  scene(id, {
    kind: "proposal",
    options: [{ id: "ok", tell: [], effects: [] }],
    ...over,
  });

export const reply = (id: string, over: Partial<GwReply> = {}): GwReply => ({
  id,
  stance: "frank",
  kind: "ask",
  tell: [],
  effects: [],
  next: null,
  ...over,
});

export const node = (...replies: GwReply[]): GwNode => ({
  says: [{ id: "base" }],
  replies,
});

/** A summonable talk with the chancellor unless `who` says otherwise. */
export const talk = (
  id: string,
  who: string,
  nodes: Record<string, GwNode>,
  over: Partial<GwScene> = {},
): GwScene =>
  scene(id, {
    kind: "talk",
    summon: true,
    cast: { x: { person: who } },
    who: "x",
    start: "open",
    nodes,
    ...over,
  });

/** Plays on these scenes and the fixture cast until the test ends. */
export function useScenes(scenes: readonly GwScene[]): void {
  useGwContent({ scenes, people: CAST });
}

afterEach(() => useGwContent(null));
