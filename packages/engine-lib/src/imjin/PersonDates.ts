// ww177 merge 3: the Imjin War's people's real dates (Gregorian), read on
// the game's own calendar (Calendar.dayOfDateIn). `until` is a death that
// the game does not play: illness, old age, or events outside the war
// (Sekigahara, Liaodong). A death in a battle or a purge the game plays
// (Sin Rip, Kim Si-min, Yi Sun-sin, Hidetsugu, Shen Weijing...) has no date:
// the state decides it. A year known only to the year is written as its
// 1 January. ww177 P7a checked them on the web (en/ko/ja/zh Wikipedia and
// Wikidata, 2026-11-12); a date known only in the lunar calendar is
// converted with Lunar.ts (it may be a day off). Still open:
// /home/eser/dev/ww166-facts-open.md, ww177 Imjin.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

type Dates = { from?: string; until?: string };

export const IMJIN_PERSON_DATES: Readonly<Record<string, Dates>> = {
  // Joseon.
  imjin_ryu_seong_ryong: { until: "1607-05-31" },
  imjin_yi_san_hae: { until: "1609-09-20" },
  imjin_jeong_cheol: { until: "1594-02-07" },
  imjin_yun_du_su: { until: "1601-01-01" },
  imjin_kim_seong_il: { until: "1593-05-29" },
  imjin_heo_seong: { until: "1612-01-01" },
  imjin_yi_hang_bok: { until: "1618-07-04" },
  imjin_yi_deok_hyeong: { until: "1613-11-20" },
  imjin_yi_il: { until: "1601-01-01" },
  imjin_gwon_yul: { until: "1599-08-26" },
  imjin_kim_myeong_won: { until: "1602-12-13" },
  // Ming.
  imjin_song_yingchang: { until: "1606-01-01" },
  imjin_li_rusong: { until: "1598-05-08" },
  imjin_chen_lin: { until: "1607-01-01" },
  imjin_liu_ting: { until: "1619-04-18" },
  imjin_yang_hao: { until: "1629-01-01" },
  // Japan.
  imjin_ishida_mitsunari: { until: "1600-11-06" },
  imjin_otani_yoshitsugu: { until: "1600-10-21" },
  imjin_mashita_nagamori: { until: "1615-06-23" },
  imjin_natsuka_masaie: { until: "1600-11-05" },
  imjin_asano_nagamasa: { until: "1611-05-29" },
  imjin_maeda_geni: { until: "1602-06-26" },
  imjin_tokugawa_ieyasu: { until: "1616-06-01" },
  imjin_maeda_toshiie: { until: "1599-04-27" },
  imjin_uesugi_kagekatsu: { until: "1623-04-19" },
  imjin_konishi_yukinaga: { until: "1600-11-06" },
  imjin_so_yoshitoshi: { until: "1615-01-31" },
  imjin_genso: { until: "1611-11-26" },
  imjin_saisho_jotai: { until: "1608-01-01" },
  imjin_kato_kiyomasa: { until: "1611-08-02" },
  imjin_kuroda_nagamasa: { until: "1623-08-29" },
  imjin_shimazu_yoshihiro: { until: "1619-08-30" },
  imjin_kobayakawa_takakage: { until: "1597-07-26" },
  imjin_fukushima_masanori: { until: "1624-08-26" },
  imjin_mori_terumoto: { until: "1625-06-02" },
  // Adopted into the Kobayakawa house in 1594, a boy of 8 in 1590.
  imjin_kobayakawa_hideaki: { from: "1594-01-01", until: "1602-12-01" },
  imjin_nabeshima_naoshige: { until: "1618-07-24" },
  imjin_chosokabe_motochika: { until: "1599-07-11" },
  imjin_matsura_shigenobu: { until: "1614-07-03" },
  imjin_arima_harunobu: { until: "1612-06-05" },
  imjin_kuki_yoshitaka: { until: "1600-11-17" },
  imjin_todo_takatora: { until: "1630-11-09" },
  imjin_wakisaka_yasuharu: { until: "1626-09-26" },
  imjin_kato_yoshiaki: { until: "1631-10-07" },
  imjin_naito_joan: { until: "1626-01-01" },
};

/** The rows with their dates from IMJIN_PERSON_DATES. */
export function withImjinDates(rows: readonly PersonDef[]): PersonDef[] {
  return rows.map((p) => {
    const d = IMJIN_PERSON_DATES[p.id];
    return d === undefined ? p : { ...p, ...d };
  });
}
