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
