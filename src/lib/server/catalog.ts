import { listTheatres, moviesInCityOf } from '../catalog';
import { db } from './db';
export type { ShowSlot, TheatreListing } from '../catalog';

export const theatreListings = (q: Parameters<typeof listTheatres>[1]) => listTheatres(db(), q);
export const moviesInCity = (cityId: string) => moviesInCityOf(db(), cityId);
