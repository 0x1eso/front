import { translateText } from "../../Utils";

/**
 * An office's title as the seat's country names it: `gw.office_by.<TAG>.<office>`
 * where a country has its own word (France: 장관, 총사령관), else the shared
 * `gw.office.<office>`.
 */
export function officeTitle(tag: string, office: string): string {
  const own = `gw.office_by.${tag}.${office}`;
  const t = translateText(own);
  return t === own ? translateText(`gw.office.${office}`) : t;
}

/**
 * ww179: a body that can say no, as the seat's country names it:
 * `gw.ui.inst_name_by.<TAG>.<inst>` (Germany's 재상의 부서), else the shared word.
 */
export function instName(tag: string, inst: string): string {
  const own = `gw.ui.inst_name_by.${tag}.${inst}`;
  const t = translateText(own);
  return t === own ? translateText(`gw.ui.inst_name.${inst}`) : t;
}
