// World War 1936 P3 (spec §6.5, §15.2, §19.10): the politics of the
// countries on 1936-01-01, the claims and the faction names.
// The foundation's empty tables; lane K6 (Task 15) fills them. A country
// without a row starts neutral with the spec §19.10 defaults.
import type {
  ClaimDef,
  CountryPoliticsDef,
  FactionNameDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const COUNTRY_POLITICS: readonly CountryPoliticsDef[] = [];

export const CLAIMS: readonly ClaimDef[] = [];

export const FACTION_NAMES: readonly FactionNameDef[] = [];
