import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";

let loading: Promise<ReadonlySet<CountryTag>> | null = null;

/**
 * ww234: the minors that play their own national tree (the live nations of
 * engine-lib's content), for the lobby's mark. Loaded on demand, once: the
 * nations' content is large and the lobby chunk stays small without it.
 */
export function nationalTreeTags(): Promise<ReadonlySet<CountryTag>> {
  loading ??= import("@openfront/engine-lib/ww1936/content/nations/live").then(
    (m) =>
      new Set(m.liveNationTags().filter((t) => COUNTRIES[t]?.major === false)),
  );
  return loading;
}
