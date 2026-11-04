// Usage: npx tsx scripts/ww1936/merge-hist-text.ts [--dir /home/eser/dev/ww62-text]
// Merges the catalogue's entry names (one JSON file per country, each
// { "<entry id>": { "en": "...", "ko": "..." } }) into resources/lang/en.json
// and ko.json under ww1936.hist.<id>. The whole ww1936.hist subtree is
// rewritten from the files (so an id the audit renamed or dropped goes away),
// sorted by key (tests/EnJsonSorted); nothing else in either file moves.
// Reports ids with no text and texts with no catalogue entry; run it again
// whenever the text files change.
import fs from "fs";
import path from "path";
import { HIST_ALL } from "../../packages/engine-lib/src/ww1936/hist/index";

type Json = { [k: string]: Json | string };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 || i + 1 >= process.argv.length ? fallback : process.argv[i + 1];
}

const dir = arg("dir", "/home/eser/dev/ww62-text");
const root = path.resolve(import.meta.dirname, "..", "..");
const langs = ["en", "ko"] as const;

const texts: Record<(typeof langs)[number], Record<string, string>> = {
  en: {},
  ko: {},
};
const problems: string[] = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Record<
    string,
    { en?: string; ko?: string }
  >;
  for (const [id, t] of Object.entries(j)) {
    for (const l of langs) {
      const v = t[l];
      if (typeof v !== "string" || v.trim() === "") {
        problems.push(`${f}: ${id} has no ${l} text`);
        continue;
      }
      if (texts[l][id] !== undefined && texts[l][id] !== v) {
        problems.push(`${f}: ${id} (${l}) differs from an earlier file`);
      }
      texts[l][id] = v;
    }
  }
}

const known = new Set(HIST_ALL.map((e) => e.id));
for (const id of known) {
  if (texts.en[id] === undefined || texts.ko[id] === undefined) {
    problems.push(`catalogue entry ${id} has no text`);
  }
}
for (const id of Object.keys(texts.en)) {
  if (!known.has(id)) problems.push(`text ${id} has no catalogue entry`);
}

for (const l of langs) {
  const file = path.join(root, "resources", "lang", `${l}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as Json;
  const ww = data.ww1936 as Json;
  const hist: Json = {};
  for (const id of Object.keys(texts[l]).sort()) hist[id] = texts[l][id];
  // Replace in place if it is there, else insert before the first key that
  // sorts after "hist" (ko.json is not fully sorted: its order stays as is).
  const next: Json = {};
  let placed = false;
  for (const [k, v] of Object.entries(ww)) {
    if (k === "hist") {
      next.hist = hist;
      placed = true;
      continue;
    }
    if (!placed && k > "hist") {
      next.hist = hist;
      placed = true;
    }
    next[k] = v;
  }
  if (!placed) next.hist = hist;
  data.ww1936 = next;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`${l}.json: ${Object.keys(hist).length} names`);
}
if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
}
