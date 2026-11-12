// ww187: the text lint. Every Korean body that names a place that changes
// hands, a front line, a sitting house or a person a game can take away must
// carry the matching tag (engine-api/ww1914/GwAssumes): `held`, `line`,
// `sits`/`shut`, `active`; or `past` when it only remembers. Today's hits sit in
// textlint/allow/<pack>.txt, one per line: `<scene> <field> <kind>:<key>`. A
// fixed body must leave the list: an entry that no longer hits fails too.
// L1 alone wrote the lists: `TEXTLINT_WRITE=1 npx vitest TextLint --run`.
// Format: /home/eser/dev/ww187-l1-format.md.
import type { GwAssumes } from "@openfront/engine-api/ww1914/GwAssumes";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { namesIn } from "./textlint/names";

const ROOT = path.join(__dirname, "../..");
const PACKS = path.join(ROOT, "resources/ww1914/ko");
const ALLOW = path.join(__dirname, "textlint/allow");

type Body = { field: string; text: string; tags: GwAssumes[] };

const scenes = new Map<string, GwScene>(
  GW_CONTENT.scenes.map((s) => [s.id, s]),
);

const strings = (o: unknown, at: string): [string, string][] =>
  typeof o === "string"
    ? [[at, o]]
    : o !== null && typeof o === "object"
      ? Object.entries(o).flatMap(([k, v]) =>
          strings(v, at === "" ? k : `${at}.${k}`),
        )
      : [];

/** Each text of a scene's pack, with the tags that stand behind it. */
function bodiesOf(id: string, pack: Record<string, unknown>): Body[] {
  const s = scenes.get(id);
  const top = s?.assumes === undefined ? [] : [s.assumes];
  // A scene with a body for its house shut assumes it sits in the others.
  const shut = s?.variants.find((x) => x.assumes?.shut !== undefined);
  const sits: GwAssumes[] =
    shut === undefined ? [] : [{ sits: shut.assumes!.shut }];
  const variant = (v: string) => {
    const a = s?.variants.find((x) => x.id === v)?.assumes;
    return a === undefined ? [...top, ...sits] : [...top, a];
  };
  const says = (node: string, v: string) => {
    const a = s?.nodes?.[node]?.says.find((x) => x.id === v)?.assumes;
    return a === undefined ? top : [...top, a];
  };
  // ww187 merge: an option gated by its own `when` assumes what that asks.
  const opt = (o: string) => {
    const a = whenTags(s?.options?.find((x) => x.id === o)?.when);
    return a === null ? top : [...top, a];
  };
  const out: Body[] = [];
  for (const [field, text] of strings(pack, "")) {
    const p = field.split(".");
    let tags = top;
    if (p[0] === "opt" && p.length === 2) tags = opt(p[1]);
    else if (p[0] === "text" || p[0] === "optBy") tags = variant(p[1]);
    else if (p[0] === "brief" && p.length > 1) tags = variant(p[1]);
    else if (p[0] === "nodes" && p[2] === "says") tags = says(p[1], p[3]);
    else if (p[0] === "nodes" && p[2] === "saysBy") tags = says(p[1], p[4]);
    out.push({ field, text, tags });
  }
  return out;
}

/**
 * The tags an option's `when` stands for: each fact the whole of it needs
 * (the top `all`, or the one cond), read as gwAssumesCond writes them.
 */
function whenTags(when: unknown): GwAssumes | null {
  if (when === undefined || when === null) return null;
  const w = when as { kind: string; of?: unknown };
  const parts: { kind: string; [k: string]: unknown }[] =
    w.kind === "all" && Array.isArray(w.of) ? w.of : [w];
  const held: Record<string, string> = {};
  const line: Record<string, [string, string]> = {};
  const sits: string[] = [];
  const shut: string[] = [];
  const active: string[] = [];
  for (const c of parts) {
    const of = c.of as Record<string, string> | undefined;
    if (c.kind === "person_active") active.push(c.person as string);
    else if (c.kind === "world" && of?.is === "held") held[of.place] = of.by;
    else if (c.kind === "world" && of?.is === "front") {
      line[of.theatre] = [of.from, of.to];
    } else if (c.kind === "world" && of?.is === "sits") sits.push(of.id);
    else if (c.kind === "not") {
      const inner = (c.of as { of?: Record<string, string> } | undefined)?.of;
      if (inner?.is === "sits") shut.push(inner.id);
    }
  }
  const a: Record<string, unknown> = {};
  if (Object.keys(held).length > 0) a.held = held;
  if (Object.keys(line).length > 0) a.line = line;
  if (sits.length > 0) a.sits = sits;
  if (shut.length > 0) a.shut = shut;
  if (active.length > 0) a.active = active;
  return Object.keys(a).length === 0 ? null : (a as GwAssumes);
}

function covered(hit: string, tags: readonly GwAssumes[]): boolean {
  if (tags.some((a) => a.past === true)) return true;
  const [kind, key] = hit.split(":");
  return tags.some((a) => {
    if (kind === "place") return a.held?.[key as "paris"] !== undefined;
    if (kind === "line") return a.line?.[key as "west"] !== undefined;
    if (kind === "house") return (a.sits ?? a.shut) !== undefined;
    return a.active?.includes(key) === true;
  });
}

/** Today's hits, by pack (the file's prefix: DEU, GBR, ..., common). */
function lint(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of fs.readdirSync(PACKS).sort()) {
    const group = f.split(".")[0];
    const d = JSON.parse(fs.readFileSync(path.join(PACKS, f), "utf8"));
    const list = out.get(group) ?? [];
    for (const [id, pack] of Object.entries<Record<string, unknown>>(
      d.scenes ?? {},
    )) {
      const s = scenes.get(id);
      const nations = (s?.nation as string[] | undefined) ?? [group];
      for (const b of bodiesOf(id, pack)) {
        for (const hit of namesIn(b.text, nations)) {
          if (!covered(hit, b.tags)) list.push(`${id} ${b.field} ${hit}`);
        }
      }
    }
    out.set(group, list);
  }
  return out;
}

const readAllow = (group: string): string[] => {
  const p = path.join(ALLOW, `${group}.txt`);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"));
};

describe("text lint (ww187)", () => {
  test("every body naming a fact a game can change carries its tag", () => {
    const hits = lint();
    if (process.env.TEXTLINT_WRITE === "1") {
      fs.mkdirSync(ALLOW, { recursive: true });
      for (const [group, list] of hits) {
        const body = [...new Set(list)].sort().join("\n");
        fs.writeFileSync(path.join(ALLOW, `${group}.txt`), body + "\n");
      }
    }
    const fresh: string[] = [];
    const stale: string[] = [];
    const counts: string[] = [];
    for (const [group, list] of hits) {
      const allow = new Set(readAllow(group));
      const now = new Set(list);
      for (const h of now) if (!allow.has(h)) fresh.push(h);
      for (const a of allow) if (!now.has(a)) stale.push(`${group}: ${a}`);
      counts.push(`${group} ${allow.size}`);
    }
    console.log(`text lint allow-list: ${counts.join(", ")}`);
    // A new body naming a changeable fact: give it its tag (or `past`).
    expect(fresh).toEqual([]);
    // A fixed body: take its line out of textlint/allow/<pack>.txt.
    expect(stale).toEqual([]);
  }, 60000);
});
