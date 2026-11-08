// World War 1936 diplomacy (ww161 Design B; ww162 L0): the screens' words —
// the country panel's rows, the deal composer, the one answer card and the
// war card's lines (lane L6 renders them). Full keys, so the translation
// check reads them; block reasons are EconomyModel.BLOCK_KEYS, the engine's
// notices DiploTypes.DIPLO_NOTICES.
import type { DealItemKind } from "@openfront/engine-api/ww1936/DiploTypes";

/** An item kind's name (the "+ 추가" list). */
export const DEAL_KIND_KEYS: Readonly<Record<DealItemKind, string>> = {
  region: "ww1936.deal.kind.region",
  equipment: "ww1936.deal.kind.equipment",
  lend_lease: "ww1936.deal.kind.lend_lease",
  licence: "ww1936.deal.kind.licence",
  access: "ww1936.deal.kind.access",
  nap: "ww1936.deal.kind.nap",
  guarantee: "ww1936.deal.kind.guarantee",
  promise: "ww1936.deal.kind.promise",
  join_war: "ww1936.deal.kind.join_war",
};

/** An item chip's text (params: region, item, count, perMonth, months, design, group, country). */
export const DEAL_ITEM_KEYS: Readonly<Record<DealItemKind, string>> = {
  region: "ww1936.deal.item.region",
  equipment: "ww1936.deal.item.equipment",
  lend_lease: "ww1936.deal.item.lend_lease",
  licence: "ww1936.deal.item.licence",
  access: "ww1936.deal.item.access",
  nap: "ww1936.deal.item.nap",
  guarantee: "ww1936.deal.item.guarantee",
  promise: "ww1936.deal.item.promise",
  join_war: "ww1936.deal.item.join_war",
};

/** The other words, by their last key part. */
export const DEAL_UI_KEYS = {
  accept: "ww1936.deal.accept",
  add: "ww1936.deal.add",
  cardTitle: "ww1936.deal.card_title",
  cardUltimatum: "ww1936.deal.card_ultimatum",
  chance: "ww1936.deal.chance",
  counter: "ww1936.deal.counter",
  default: "ww1936.deal.default",
  give: "ww1936.deal.give",
  home: "ww1936.deal.home",
  pending: "ww1936.deal.pending",
  promiseLine: "ww1936.deal.promise_line",
  refuse: "ww1936.deal.refuse",
  rowCollab: "ww1936.deal.row_collab",
  rowDeal: "ww1936.deal.row_deal",
  rowPromise: "ww1936.deal.row_promise",
  rowSeparate: "ww1936.deal.row_separate",
  rowUltimatum: "ww1936.deal.row_ultimatum",
  send: "ww1936.deal.send",
  sendConfirm: "ww1936.deal.send_confirm",
  take: "ww1936.deal.take",
  ultGive: "ww1936.deal.ult_give",
  ultRefuseHint: "ww1936.deal.ult_refuse_hint",
  ultimatumsIn: "ww1936.deal.ultimatums_in",
} as const;
