// regions.bin (spec §4.7): "RGN1", u32 width, u32 height, u32 run count,
// then runs of (LEB128 length >= 1, LEB128 id 0..65535) in map.bin tile
// order. Integer arithmetic only: the engine decodes it.
const MAGIC = [0x52, 0x47, 0x4e, 0x31];
const MAX_VARINT_MUL = 34_359_738_368; // 2^35: five 7-bit groups

function pushVarint(out: number[], value: number): void {
  let v = value;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

export function encodeRegions(
  ids: Uint16Array,
  width: number,
  height: number,
): Uint8Array {
  if (ids.length !== width * height) {
    throw new Error(`regions: ${ids.length} ids for a ${width}x${height} map`);
  }
  const body: number[] = [];
  let runs = 0;
  for (let i = 0; i < ids.length; ) {
    let j = i + 1;
    while (j < ids.length && ids[j] === ids[i]) j++;
    pushVarint(body, j - i);
    pushVarint(body, ids[i]);
    runs++;
    i = j;
  }
  const out = new Uint8Array(16 + body.length);
  out.set(MAGIC, 0);
  const view = new DataView(out.buffer);
  view.setUint32(4, width, true);
  view.setUint32(8, height, true);
  view.setUint32(12, runs, true);
  out.set(body, 16);
  return out;
}

export function decodeRegions(
  bytes: Uint8Array,
  width: number,
  height: number,
): Uint16Array {
  if (bytes.length < 16 || MAGIC.some((b, i) => bytes[i] !== b)) {
    throw new Error("regions.bin: bad magic");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const w = view.getUint32(4, true);
  const h = view.getUint32(8, true);
  const runs = view.getUint32(12, true);
  if (w !== width || h !== height) {
    throw new Error(`regions.bin is ${w}x${h}, the map is ${width}x${height}`);
  }
  const out = new Uint16Array(w * h);
  let pos = 16;
  const read = (): number => {
    let v = 0;
    let mul = 1;
    for (;;) {
      if (pos >= bytes.length) throw new Error("regions.bin: truncated");
      const b = bytes[pos++];
      v += (b & 0x7f) * mul;
      if ((b & 0x80) === 0) return v;
      mul *= 0x80;
      if (mul > MAX_VARINT_MUL) throw new Error("regions.bin: varint too long");
    }
  };
  let at = 0;
  for (let r = 0; r < runs; r++) {
    const len = read();
    const id = read();
    if (len < 1 || id > 0xffff || at + len > out.length) {
      throw new Error(`regions.bin: bad run ${r}`);
    }
    out.fill(id, at, at + len);
    at += len;
  }
  if (at !== out.length || pos !== bytes.length) {
    throw new Error("regions.bin: the runs do not cover the map exactly");
  }
  return out;
}
