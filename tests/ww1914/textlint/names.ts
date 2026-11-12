// ww187: the text lint's small dictionary (TextLint.test.ts). A body that
// names one of these needs the matching tag (engine-api/ww1914/GwAssumes), or
// `past` when it only remembers. Keep it small: words that a game can make
// false. A new word adds hits; write them to the allow-list only with the
// owner's lane (see /home/eser/dev/ww187-l1-format.md).
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";

/** Before a name: not inside a longer Korean word. */
const NH = "(?<![가-힣])";

/** Places that change hands in a game and that texts march on or mourn (as a claim, below). */
export const LINT_PLACES: readonly GwPlace[] = [
  "paris",
  "verdun",
  "ypres",
  "liege",
  "antwerp",
  "brussels",
  "reims",
  "amiens",
  "calais",
  "lemberg",
  "przemysl",
  "warsaw",
  "riga",
  "kovno",
  "vilna",
  "brest_litovsk",
  "belgrade",
  "bucharest",
  "trieste",
  "gorizia",
  "venice",
  "udine",
  "constantinople",
  "baghdad",
  "jerusalem",
  "kut",
  "erzurum",
  "salonika",
];

/** Front lines by their Korean words: needs `line` on that theatre. */
export const LINT_LINES: readonly { word: string; theatre: GwTheatre }[] = [
  { word: "마른 ?강", theatre: "west" },
  { word: "마른 전투", theatre: "west" },
  { word: "마른에서", theatre: "west" },
  { word: "마른의", theatre: "west" },
  { word: "엔 ?강", theatre: "west" },
  { word: "솜 ?강", theatre: "west" },
  { word: "솜 전투", theatre: "west" },
  { word: "솜에서", theatre: "west" },
  { word: "힌덴부르크 ?선", theatre: "west" },
  { word: "비스와", theatre: "east" },
  { word: "드비나", theatre: "east" },
  { word: "이손초", theatre: "italy" },
  { word: "피아베", theatre: "italy" },
  { word: "갈리폴리", theatre: "straits" },
  { word: "다르다넬스", theatre: "straits" },
];

/** Each seat's house, and what it does only while it sits. Needs `sits` or `shut`. */
export const LINT_HOUSES: Readonly<Record<string, string>> = {
  DEU: "제국의회|라이히스타크|의사당|의회",
  GBR: "하원|상원|의사당|의회",
  FRA: "하원|상원|의사당|의회|부르봉궁",
  RUS: "두마|국가평의회|의사당",
  AUH: "제국의회|라이히스라트|의사당",
};
const SITTING =
  "표결|신임|불신임|의사일정|수정안|질의|가결|부결|등원|개회|다수당|연설대|본회의|회기 중|투표";
/** A match with these words tells of the house closed: no claim it sits. */
const CLOSED =
  /닫|휴회|정회|해산|열지 않|열리지 않|정지|소집하지|문을 걸|폐지|선거|없어|없다/;

/** People a game can take away: needs `active` with the id. */
export const LINT_PEOPLE: Readonly<Record<string, string>> = {
  gbr_kitchener: "키치너",
  auh_franz_joseph: "프란츠 요제프",
  auh_ff: "프란츠 페르디난트",
  rus_rasputin: "라스푸틴",
  fra_jaures: "조레스",
  auh_sturgkh: "슈튀르크",
};

/**
 * A place is a claim when the words after it march on it, stand before it,
 * or say it fell: "파리까지", "파리를 친다", "렘베르크가 떨어졌다". A bare
 * mention (the government in Paris, Belgrade's answer) is not linted.
 */
const APPROACH =
  "까지|로 가|으로 가|로 간|으로 간|로 들어가|으로 들어가|를 향|을 향|앞에|앞이|앞까지|외곽|근처|가 보인|이 보인|로 진격|으로 진격|를 뺏|을 뺏|를 친다|을 친다|를 치|을 치|입성|를 노|을 노|를 포위|을 포위|가 멀지|이 멀지";
const TAKEN =
  "가 떨어졌|이 떨어졌|를 잃었|을 잃었|를 잃은|을 잃은|가 우리 손|이 우리 손|를 점령|을 점령|가 함락|이 함락|를 내주|을 내주|를 되찾|을 되찾|를 지켰|을 지켰|가 버티|이 버티";
const placeRe = LINT_PLACES.map((p) => ({
  p,
  re: new RegExp(`${NH}${GW_PLACES[p].nameKo}\\s?(?:${APPROACH}|${TAKEN})`),
}));
const lineRe = LINT_LINES.map((l) => ({ ...l, re: new RegExp(NH + l.word) }));
const houseRe = Object.fromEntries(
  Object.entries(LINT_HOUSES).map(([tag, h]) => [
    tag,
    new RegExp(
      `(?:${h})[^.。"]{0,40}(?:${SITTING})|(?:${SITTING})[^.。"]{0,25}(?:${h})`,
      "g",
    ),
  ]),
);
const personRe = Object.entries(LINT_PEOPLE).map(([id, name]) => ({
  id,
  re: new RegExp(NH + name),
}));

/** What a text names: `place:<id>`, `line:<theatre>`, `house:<tag>`, `person:<id>`. */
export function namesIn(text: string, nations: readonly string[]): string[] {
  const out = new Set<string>();
  for (const { p, re } of placeRe) if (re.test(text)) out.add(`place:${p}`);
  for (const l of lineRe) if (l.re.test(text)) out.add(`line:${l.theatre}`);
  for (const tag of nations) {
    const re = houseRe[tag];
    if (re === undefined) continue;
    const sits = [...text.matchAll(re)].some((m) => !CLOSED.test(m[0]));
    if (sits) out.add(`house:${tag}`);
  }
  for (const { id, re } of personRe) if (re.test(text)) out.add(`person:${id}`);
  return [...out].sort();
}
