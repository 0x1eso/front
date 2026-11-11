// Great War 1914, ww173: the words of the secret war (engine/ww1914/Spies).
// A scene reads it through `world({ is: "spy", can, tag? })` and does it
// through `doWorld({ do: "spy", act, tag? })`. Lists are APPEND ONLY.

/** What a seat's schedule or a scene can order. */
export const GW_SPY_ACTS = [
  "net", // 요원망을 심는다 (tag)
  "sabotage", // 공장과 항구를 노린다 (tag)
  "court", // 중립국을 끌어온다 (tag)
  "lenin", // 망명 혁명가를 돌려보낸다 (DEU)
  "ireland", // 아일랜드 봉기에 무기를 보낸다 (DEU)
  "arab", // 아랍 봉기를 돕는다 (GBR)
  "jihad", // 성전을 선포하게 한다 (DEU, OTT)
  "double", // 잡힌 요원을 이중간첩으로 쓴다
  "expose", // 잡힌 요원을 드러낸다
  "blame", // 간첩 탓으로 돌린다
  "hide", // 읽은 것을 모르는 척한다
] as const;
export type GwSpyAct = (typeof GW_SPY_ACTS)[number];

/**
 * What a condition asks. The acts: whether the seat can order it now (with
 * `tag` for net, sabotage, court). ok / out: how its last operation went (out:
 * found out). from: a caught agent waits whose sender is `tag`. reading: the
 * seat reads `tag`'s codes (anyone's without a tag). ship: the Irish arms ship was read and taken.
 * exposed: the seat's agents were taken and named lately, by anyone's
 * counter-intelligence (in `tag` when given), not only its last operation.
 * codebook: the Baltic codebook touched the seat's country (Germany lost it;
 * Britain or Russia got it). sealed: Germany sent the exiles home to Russia.
 * With `peace` (ww178) any of them holds only while the seat is at peace.
 */
export const GW_SPY_CANS = [
  "net",
  "sabotage",
  "court",
  "lenin",
  "ireland",
  "arab",
  "jihad",
  "blame",
  "ok",
  "out",
  "from",
  "reading",
  "ship",
  "double",
  "exposed",
  "codebook",
  "sealed",
] as const;
export type GwSpyCan = (typeof GW_SPY_CANS)[number];

/**
 * ww180: the service's four branches, in the order of `GwIntel.fund`:
 * codebreakers (crypt), counter-intelligence (counter), our own codes
 * (secure) and agents abroad (abroad).
 */
export const GW_SERVICE_BRANCHES = [
  "crypt",
  "counter",
  "secure",
  "abroad",
] as const;
export type GwServiceBranch = (typeof GW_SERVICE_BRANCHES)[number];
/**
 * ww180: a branch's share of the service's money and men, 0..3: cut, as now,
 * more, much more. The seat picks it in words (gw.intel.fund.share.<n>).
 */
export const GW_SERVICE_SHARE_MAX = 3;
