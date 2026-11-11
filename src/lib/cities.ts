import type { City } from './types';

// Fictional cinemas are placed at real neighbourhood coordinates.
export const CITIES: City[] = [
  { id: 'kochi', name: 'Kochi', state: 'Kerala', lat: 9.9816, lng: 76.2999, areas: [
    { name: 'Edappally', lat: 10.0261, lng: 76.3084 }, { name: 'Vyttila', lat: 9.9658, lng: 76.3209 }, { name: 'Kakkanad', lat: 10.0159, lng: 76.3419 }, { name: 'Fort Kochi', lat: 9.9658, lng: 76.2421 }, { name: 'MG Road', lat: 9.9725, lng: 76.2835 } ] },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, areas: [
    { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 }, { name: 'Koramangala', lat: 12.9352, lng: 77.6245 }, { name: 'Whitefield', lat: 12.9698, lng: 77.75 }, { name: 'Malleshwaram', lat: 13.0031, lng: 77.5643 } ] },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777, areas: [
    { name: 'Andheri West', lat: 19.1364, lng: 72.8296 }, { name: 'Lower Parel', lat: 18.9953, lng: 72.8302 }, { name: 'Bandra', lat: 19.0596, lng: 72.8295 }, { name: 'Powai', lat: 19.1176, lng: 72.906 } ] },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, areas: [
    { name: 'T. Nagar', lat: 13.0418, lng: 80.2341 }, { name: 'Velachery', lat: 12.9815, lng: 80.218 }, { name: 'Anna Nagar', lat: 13.085, lng: 80.2101 } ] },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867, areas: [
    { name: 'Banjara Hills', lat: 17.4156, lng: 78.4347 }, { name: 'HITEC City', lat: 17.4435, lng: 78.3772 }, { name: 'Kukatpally', lat: 17.4849, lng: 78.4138 } ] },
  { id: 'delhi', name: 'Delhi NCR', state: 'Delhi', lat: 28.6139, lng: 77.209, areas: [
    { name: 'Saket', lat: 28.5245, lng: 77.2066 }, { name: 'Connaught Place', lat: 28.6315, lng: 77.2167 }, { name: 'Vasant Kunj', lat: 28.5293, lng: 77.1519 } ] },
];

export function nearestCity(lat: number, lng: number) {
  let best = CITIES[0], bd = Infinity;
  for (const c of CITIES) { const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}
