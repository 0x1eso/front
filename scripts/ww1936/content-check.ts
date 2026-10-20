// Usage: npx tsx scripts/ww1936/content-check.ts
// World War 1936 P3: the summary a content lane pastes into its report
// (plan Task 1 Step 17): focuses per tree, history path lengths, events,
// decisions, spirits and persons, the ids that miss a translation key, and
// the Korean characters of the content keys. A table for people, not a test
// (the content tests in tests/ww1936 are the checks).
import { FOCUS_TREES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import fs from "fs";
import path from "path";

type Json = { [k: string]: Json | string };
const lang = (name: string): Json =>
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "resources/lang", name), "utf8"),
  );
const en = lang("en.json");
const ko = lang("ko.json");

function textOf(json: Json, key: string): string | undefined {
  let o: Json | string | undefined = json;
  for (const part of key.split(".")) {
    if (o === undefined || typeof o === "string") return undefined;
    o = o[part];
  }
  return typeof o === "string" ? o : undefined;
}

const keys: string[] = [];
const missing: string[] = [];
const need = (key: string) => {
  keys.push(key);
  if (!textOf(en, key) || !textOf(ko, key)) missing.push(key);
};
for (const f of CONTENT.focuses) {
  need(`ww1936.focus.${f.id}`);
  need(`ww1936.focus_desc.${f.id}`);
}
for (const e of CONTENT.events) {
  need(`ww1936.event_title.${e.id}`);
  need(`ww1936.event_desc.${e.id}`);
  if (e.kind === "news") need(`ww1936.news.${e.id}`);
  else for (const o of e.options) need(`ww1936.event_opt.${e.id}.${o.id}`);
}
for (const d of CONTENT.decisions) {
  need(`ww1936.decision.${d.id}`);
  need(`ww1936.decision_desc.${d.id}`);
}
for (const s of CONTENT.spirits) {
  if (s.hidden === true) continue;
  need(`ww1936.spirit.${s.id}`);
  need(`ww1936.spirit_desc.${s.id}`);
}
for (const p of CONTENT.persons) need(p.nameKey);

let koChars = 0;
for (const k of keys) koChars += [...(textOf(ko, k) ?? "")].length;

const rows: [string, string | number][] = [];
for (const t of FOCUS_TREES) {
  const path = (CONTENT.paths[t] ?? []).length;
  rows.push([`focuses ${t}`, CONTENT.treeFocuses[t].length]);
  rows.push([`history path ${t}`, path]);
}
rows.push(["events", CONTENT.events.length]);
rows.push(["decisions", CONTENT.decisions.length]);
rows.push(["spirits", CONTENT.spirits.length]);
rows.push(["persons", CONTENT.persons.length]);
rows.push(["history beats", CONTENT.beats.length]);
rows.push(["region groups", CONTENT.groups.length]);
rows.push(["country rows", CONTENT.countries.length]);
rows.push(["content keys", keys.length]);
rows.push(["Korean characters", koChars]);
rows.push(["keys missing (en or ko)", missing.length]);
const w = Math.max(...rows.map(([k]) => k.length));
for (const [k, v] of rows) console.log(`${k.padEnd(w)}  ${v}`);
if (missing.length > 0) {
  console.log("\nmissing:");
  for (const k of missing) console.log(`  ${k}`);
}
