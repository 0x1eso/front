// ww207 lane C: the seven tree templates are whole, and every word the
// society and the utopias name has its text in en.json and ko.json.
import {
  axesOf,
  GW_ELECTION_CAUSES,
  GW_FRANCHISES,
  GW_NODE_KINDS,
  GW_NODE_TIERS,
  GW_TREE_NODES,
  GW_TREE_TEMPLATES,
  GW_TRUST_WORDS,
} from "@openfront/engine-api/ww1914/GwSociety";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const lang = (l: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../resources/lang/${l}.json`),
      "utf-8",
    ),
  ) as Record<string, unknown>;
const LANGS = { en: lang("en"), ko: lang("ko") };

const at = (o: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (v, k) =>
        v !== null && typeof v === "object"
          ? (v as Record<string, unknown>)[k]
          : undefined,
      o,
    );

function missing(keys: readonly string[]): string[] {
  return Object.entries(LANGS).flatMap(([l, d]) =>
    keys.filter((k) => typeof at(d, k) !== "string").map((k) => `${l} ${k}`),
  );
}

const SEATS = ["DEU", "GBR", "FRA", "RUS", "AUH"] as const;

describe("ww207 society words and tree templates", () => {
  test("seven templates, nine nodes in tier order, one ability node each", () => {
    const rows = gwContent().utopia?.templates ?? [];
    expect(rows.map((r) => r.id)).toEqual([...GW_TREE_TEMPLATES]);
    for (const r of rows) {
      expect(r.nodes.length).toBe(GW_TREE_NODES);
      expect(r.nodes.map((n) => n.id)).toEqual(
        ["m", "b", "x"].flatMap((t) => [1, 2, 3].map((i) => `${t}${i}`)),
      );
      expect(r.nodes.map((n) => n.tier)).toEqual(
        GW_NODE_TIERS.flatMap((t) => [t, t, t]),
      );
      expect(r.nodes.filter((n) => n.kind === "ability").length).toBe(1);
      for (const n of r.nodes) {
        expect(n.kind === "institution").toBe(n.institution !== undefined);
      }
    }
  });

  test("every template, node, institution and seat axis has its words", () => {
    const rows = gwContent().utopia?.templates ?? [];
    const keys = [
      ...rows.flatMap((r) => [
        ...["name", "utopia", "note"].map(
          (f) => `gw.utopia.template.${r.id}.${f}`,
        ),
        ...r.nodes.flatMap((n) => [
          `gw.utopia.node.${r.id}.${n.id}.name`,
          `gw.utopia.node.${r.id}.${n.id}.note`,
          ...(n.institution === undefined
            ? []
            : [`gw.utopia.institution.${n.institution}`]),
        ]),
      ]),
      ...GW_NODE_TIERS.map((t) => `gw.utopia.tier.${t}`),
      ...GW_NODE_KINDS.map((k) => `gw.utopia.kind.${k}`),
      ...SEATS.flatMap((tag) =>
        axesOf(tag).flatMap((axis) => [
          ...["name", "minus", "plus"].map(
            (f) => `gw.society.axis.${axis}.${tag}.${f}`,
          ),
          ...[0, 1, 2, 3, 4, 5, 6].map(
            (i) => `gw.society.lean.${axis}.${tag}.${i}`,
          ),
        ]),
      ),
      ...GW_TRUST_WORDS.map((w) => `gw.society.trust.${w}`),
      ...[1, 2, 3, 4, 5].map((n) => `gw.society.size.${n}`),
      ...GW_FRANCHISES.map((f) => `gw.society.franchise.${f}`),
      ...GW_ELECTION_CAUSES.map((c) => `gw.society.election.cause.${c}`),
    ];
    expect(missing(keys)).toEqual([]);
  });
});
