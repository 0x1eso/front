// Great War 1914, ww180: the words of the secret war at sea (engine/ww1914/
// NavalIntel). A scene reads it through `world({ is: "naval", can })` and does
// it through `doWorld({ do: "naval", act })`. Lists are APPEND ONLY.

/** What a seat's schedule or a scene can order. */
export const GW_NAVAL_ACTS = [
  "build", // 해안에 방향탐지소를 세운다
  "listen", // 듣기만 한다
  "fleet", // 함대에만 알린다
  "all", // 상선도 피하게 한다
] as const;
export type GwNavalAct = (typeof GW_NAVAL_ACTS)[number];

/**
 * What a condition asks. build: the seat's country fights at sea and has no
 * chain yet. use: it has one. listen / fleet / all: the use in force. warned:
 * our chain caught an enemy fleet putting out and the fleet was told, lately.
 * met: our own fleet put out and found the enemy already at sea, lately.
 */
export const GW_NAVAL_CANS = [
  "build",
  "use",
  "listen",
  "fleet",
  "all",
  "warned",
  "met",
] as const;
export type GwNavalCan = (typeof GW_NAVAL_CANS)[number];

/** The uses, in order: `GwNaval.use` is the index. */
export const GW_NAVAL_USES: readonly GwNavalAct[] = ["listen", "fleet", "all"];
