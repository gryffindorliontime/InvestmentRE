// Free OpenStreetMap Nominatim geocoder (no API key, ~1 req/sec fair-use).
// Server-side only — called from the RentCast search path to turn a county
// name into a centroid + radius, since RentCast has no county query param.

export interface GeocodedArea {
  lat: number;
  lng: number;
  radiusMiles: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  // [south, north, west, east] as decimal-degree strings.
  boundingbox?: [string, string, string, string];
}

const MILES_PER_DEGREE_LAT = 69;

export async function geocodeCounty(county: string, state: string): Promise<GeocodedArea | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${county} County, ${state}, USA`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    // Nominatim's usage policy requires an identifying User-Agent.
    headers: { "User-Agent": "real-estate-roi-dashboard/0.1 (demo project)" },
  });
  if (!res.ok) return null;

  const results = (await res.json()) as NominatimResult[];
  const hit = results[0];
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  // Radius = half the bounding box diagonal, so the circle covers the whole
  // county. Clamped: never absurdly small, and well under RentCast's 100 mi
  // cap (results get filtered back down to the exact county anyway).
  let radiusMiles = 15;
  if (hit.boundingbox) {
    const [south, north, west, east] = hit.boundingbox.map(Number);
    if (![south, north, west, east].some(Number.isNaN)) {
      const halfLatMiles = ((north - south) * MILES_PER_DEGREE_LAT) / 2;
      const halfLngMiles =
        ((east - west) * MILES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)) / 2;
      radiusMiles = Math.ceil(Math.hypot(halfLatMiles, halfLngMiles));
    }
  }
  radiusMiles = Math.min(60, Math.max(5, radiusMiles));

  return { lat, lng, radiusMiles };
}
