// Korean particles (josa) that depend on the sound before them. ko.json writes
// a particle after a placeholder as a marker, e.g. "{name}이(가)", and
// translateText calls applyJosa on the finished Korean text, when the word
// before the marker is known: 이(가), 을(를), 은(는), 과(와) (or 와(과)) and
// (으)로.

type Batchim = "none" | "rieul" | "other";

const MARKER = /(이\(가\)|을\(를\)|은\(는\)|과\(와\)|와\(과\)|\(으\)로)/g;

/** Characters that close a quote or bracket: the word's sound is the one before. */
const CLOSERS = new Set([..."\"')]}>”’」』》〉"]);

/** The final sound of a spoken digit: 영 일 이 삼 사 오 육 칠 팔 구. */
const DIGIT_BATCHIM: readonly Batchim[] = [
  "other", // 0 영 (ㅇ)
  "rieul", // 1 일
  "none", // 2 이
  "other", // 3 삼
  "none", // 4 사
  "none", // 5 오
  "other", // 6 육
  "rieul", // 7 칠
  "rieul", // 8 팔
  "none", // 9 구
];

/** The unit a run of trailing zeros ends in: 십 백 천 만 (ㄴ) ... 억 (ㄱ) ... 조 (no final) ... */
function zeroUnitBatchim(zeros: number): Batchim {
  return zeros >= 12 && zeros < 16 ? "none" : "other";
}

/** A number as read aloud: by its last spoken syllable. `digits` has no separators. */
function numberBatchim(digits: string): Batchim {
  let zeros = 0;
  for (let i = digits.length - 1; i >= 0 && digits[i] === "0"; i--) zeros++;
  if (zeros === digits.length) {
    return zeros === 1 ? "other" : zeroUnitBatchim(zeros); // 영, 십 ...
  }
  if (zeros > 0) return zeroUnitBatchim(zeros);
  return DIGIT_BATCHIM[digits.charCodeAt(digits.length - 1) - 48];
}

/** A Latin letter's reading at the end of a word, a fair guess: m n l ng and stops have one. */
function latinBatchim(word: string): Batchim {
  const c = word[word.length - 1].toLowerCase();
  if (c === "l") return "rieul";
  return "mnkptbdgcx".includes(c) ? "other" : "none";
}

/** The final sound of the word that ends `before`, or null when there is no word. */
export function batchimOf(before: string): Batchim | null {
  let end = before.length;
  while (end > 0 && CLOSERS.has(before[end - 1])) end--;
  if (end === 0) return null;
  const ch = before[end - 1];
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 ? "none" : jong === 8 ? "rieul" : "other";
  }
  if (ch >= "0" && ch <= "9") {
    let start = end - 1;
    while (start > 0 && /[0-9,]/.test(before[start - 1])) start--;
    const digits = before.slice(start, end).replace(/,/g, "");
    return numberBatchim(digits);
  }
  if (/[A-Za-z]/.test(ch)) return latinBatchim(before.slice(0, end));
  if (/\s/.test(ch)) return null;
  return "none";
}

function pick(marker: string, b: Batchim): string {
  switch (marker) {
    case "이(가)":
      return b === "none" ? "가" : "이";
    case "을(를)":
      return b === "none" ? "를" : "을";
    case "은(는)":
      return b === "none" ? "는" : "은";
    case "과(와)":
    case "와(과)":
      return b === "none" ? "와" : "과";
    default:
      return b === "other" ? "으로" : "로";
  }
}

/**
 * Replaces each particle marker with the form that fits the word before it.
 * A marker with no word before it (start of the text, after a space) is left
 * as written.
 */
export function applyJosa(text: string): string {
  if (text.indexOf("(") === -1) return text;
  return text.replace(MARKER, (marker: string, _g: string, at: number) => {
    const b = batchimOf(text.slice(0, at));
    return b === null ? marker : pick(marker, b);
  });
}
