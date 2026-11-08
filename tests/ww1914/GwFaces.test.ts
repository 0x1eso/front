import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

/**
 * The cast's photographs (plan /home/eser/dev/ww160-plan-portraits.md): one
 * file per row of faces/sources.json and back, each a period photograph in the
 * public domain in the US and at home, small enough to load as it is shown.
 */
const DIR = path.join(__dirname, "../../resources/ww1914/faces");
const index = JSON.parse(
  fs.readFileSync(path.join(DIR, "sources.json"), "utf8"),
) as {
  faces: {
    id: string;
    url: string;
    author: string;
    date: string;
    licence: string[];
    crop: [number, number, number, number];
  }[];
};
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".webp"));

/** The two peace-table envoys who are not in the cast. */
const ENVOYS = ["jpn_saionji", "deu_brockdorff"];

/**
 * The Commons licence tags a face may carry, copied from its file page. A file
 * with only its home country's tag rests on its date for the US: anything
 * published by 1928 is free there. "Public domain" with no reason is not here.
 */
const LICENCES = new RegExp(
  "^(" +
    [
      // Free at home and in the US in one tag.
      "PD-old-(70|80|100|auto)-(1923|expired)",
      "PD-old-expired",
      "PD-anon-(expired|1923)",
      // The US: published before 1931, or an American work.
      "PD-US(-expired|-no notice|-1996)?",
      "PD-1923",
      "PD-1996",
      "PD-Russia-1996",
      "PD-Bain",
      "PD-Harris-Ewing",
      "PD-National Photo Company",
      "PD-Gutenberg",
      // At home.
      "PD-old(-70|-80|-100)?",
      "PD-anon-70-EU",
      "PD-RusEmpire",
      "PD-Russia(-expired)?",
      "PD-UK(-unknown)?",
      "PD-France",
      "PD-Italy",
      "PD-Hungary",
      "PD-TR",
      "PD-Japan-oldphoto",
      "PD-Jordan",
      "PD-Syria",
      "PD-Saudi Arabia",
      "Cc-zero",
    ].join("|") +
    ")$",
);

/** A WebP's canvas size, from its first chunk (lossy, lossless or extended). */
function webpSize(b: Buffer): [number, number] {
  const kind = b.subarray(12, 16).toString("ascii");
  if (kind === "VP8 ") {
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  if (kind === "VP8L") {
    const v = b.readUInt32LE(21);
    return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
  }
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
}

describe("faces", () => {
  test("every file has its row and every row its file", () => {
    const rows = index.faces.map((r) => r.id).sort();
    expect(new Set(rows).size).toBe(rows.length);
    expect(files.map((f) => f.replace(/\.webp$/, "")).sort()).toEqual(rows);
  });

  test("every face is someone at the table: cast or envoy", () => {
    const known = new Set([...GW_CONTENT.people.map((p) => p.id), ...ENVOYS]);
    for (const r of index.faces) expect(known.has(r.id), r.id).toBe(true);
  });

  test("each says where it came from, by whom, when, under what licence", () => {
    for (const r of index.faces) {
      expect(r.url, r.id).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      );
      expect(r.author.length, r.id).toBeGreaterThan(0);
      const years = (r.date.match(/1[89]\d\d/g) ?? []).map(Number);
      expect(years.length, r.id).toBeGreaterThan(0);
      expect(Math.max(...years), r.id).toBeLessThanOrEqual(1928);
      expect(r.licence.length, r.id).toBeGreaterThan(0);
      for (const l of r.licence) expect(l, r.id).toMatch(LICENCES);
      expect(r.crop, r.id).toHaveLength(4);
    }
  });

  test("small square WebP: 20 KB a face, 4 MB in all", () => {
    let total = 0;
    for (const f of files) {
      const b = fs.readFileSync(path.join(DIR, f));
      expect(b.subarray(0, 4).toString("ascii"), f).toBe("RIFF");
      expect(b.subarray(8, 12).toString("ascii"), f).toBe("WEBP");
      expect(webpSize(b), f).toEqual([192, 192]);
      expect(b.length, f).toBeLessThanOrEqual(20 * 1024);
      total += b.length;
    }
    expect(total).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
});
