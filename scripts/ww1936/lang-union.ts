// Usage: npx tsx scripts/ww1936/lang-union.ts --ours <file> --theirs <file> --out <file> [--base <file>]
// The union of two language files: every key of both, sorted at every level
// (tests/EnJsonSorted). A key with two different texts fails and is printed.
// P3 plan "환경": lanes add keys to the same two files; a merge conflict in
// resources/lang/{en,ko}.json is resolved with this, never by hand. With
// --base (git's stage 1, `git show :1:resources/lang/en.json`), a key only
// one side changed since the base takes that side's text: a lane branched
// before the integration branch's own edits does not clash on them.
import fs from "fs";

export type Json = { [k: string]: Json | string };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 || i + 1 >= process.argv.length
    ? undefined
    : process.argv[i + 1];
}

function need(name: string): string {
  const v = arg(name);
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
}

/**
 * Every key of `a` and `b`, sorted at every level. Two different texts go to
 * `clashes` (a's is kept) unless `base` shows only one side changed it.
 */
export function union(
  a: Json,
  b: Json,
  path: string,
  clashes: string[],
  base?: Json | string,
): Json {
  const out: Json = {};
  const baseOf = (k: string) =>
    base === undefined || typeof base === "string" ? undefined : base[k];
  // A side the other lacks is sorted too (every level).
  const alone = (v: Json | string, k: string): Json | string =>
    typeof v === "string" ? v : union(v, {}, `${path}${k}.`, clashes);
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x: Json | string | undefined = a[k];
    const y: Json | string | undefined = b[k];
    const o = baseOf(k);
    if (x === undefined) out[k] = alone(y, k);
    else if (y === undefined) out[k] = alone(x, k);
    else if (typeof x === "string" || typeof y === "string") {
      if (x === y || y === o) out[k] = alone(x, k);
      else if (x === o) out[k] = alone(y, k);
      else {
        clashes.push(`${path}${k}`);
        out[k] = alone(x, k);
      }
    } else out[k] = union(x, y, `${path}${k}.`, clashes, o);
  }
  return out;
}

/** `j` with every level's keys sorted. */
export const sortDeep = (j: Json): Json => union(j, {}, "", []);

if (process.argv[1]?.endsWith("lang-union.ts")) {
  const read = (f: string): Json => JSON.parse(fs.readFileSync(f, "utf8"));
  const clashes: string[] = [];
  const base = arg("base");
  const merged = union(
    read(need("ours")),
    read(need("theirs")),
    "",
    clashes,
    base === undefined ? undefined : read(base),
  );
  if (clashes.length > 0) {
    console.error(`different texts for the same key:\n${clashes.join("\n")}`);
    process.exit(1);
  }
  fs.writeFileSync(need("out"), `${JSON.stringify(merged, null, 2)}\n`);
}
