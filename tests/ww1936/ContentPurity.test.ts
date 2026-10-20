// World War 1936 P3 (plan Global Constraints): the content files are data
// only — no functions, classes, callbacks or eval. Only helpers.ts and
// registry.ts may hold code. Comments and string literals are not looked at
// (controller ruling R19).
import fs from "fs";
import path from "path";

const ROOT = path.join(
  __dirname,
  "../../packages/engine-lib/src/ww1936/content",
);
const CODE_FILES = new Set(["helpers.ts", "registry.ts"]);
const FORBIDDEN = [
  /=>/,
  /\bfunction\b/,
  /\bnew /,
  /\beval\b/,
  /\bMath\./,
  /\bclass\b/,
];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return files(p);
    return d.name.endsWith(".ts") ? [p] : [];
  });
}

/** The source without comments and string literals (a small scanner). */
export function codeOnly(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      i++;
      while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      i++;
      out += '""';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

describe("content purity", () => {
  it("the scanner skips comments and strings", () => {
    expect(codeOnly('const a = "=>"; // new x\n/* function */ b')).toBe(
      'const a = ""; \n b',
    );
  });

  it("no content file but helpers.ts and registry.ts holds code", () => {
    const all = files(ROOT);
    expect(all.length).toBeGreaterThan(30);
    for (const f of all) {
      if (CODE_FILES.has(path.basename(f)) && path.dirname(f) === ROOT)
        continue;
      const code = codeOnly(fs.readFileSync(f, "utf8"));
      for (const re of FORBIDDEN) {
        expect(re.test(code), `${path.relative(ROOT, f)}: ${re}`).toBe(false);
      }
    }
  });
});
