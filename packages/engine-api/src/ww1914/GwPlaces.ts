import { z } from "zod";
import { GW_PLACES } from "./GwPlaces.gen";

export { GW_PLACES };

/** A place of the 1914 map, by name: what content and tables say. */
export type GwPlace = keyof typeof GW_PLACES;

export const GW_PLACE_KEYS = Object.keys(GW_PLACES) as [GwPlace, ...GwPlace[]];

export const GwPlaceSchema = z.enum(GW_PLACE_KEYS);
