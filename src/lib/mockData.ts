// Mock listings + rent baselines so the dashboard is fully interactive without
// ever calling the RentCast API. Swap this out for src/lib/rentcastClient.ts
// once live calls are turned on (see ENABLE_LIVE_API in .env.local).

import type { HomeType, ListingStatus, Property, RentComp } from "./types";

// Deterministic PRNG (mulberry32) so the generated dataset is stable across
// reloads within a build, rather than reshuffling every time the module
// loads. Seed is arbitrary — just needs to be fixed.
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CityDef {
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  pricePerSqft: number; // rough median $/sqft for a single-family home
  rentByBeds: Record<number, number>; // per-unit monthly rent baseline
  taxRatePct: number; // rough effective annual property tax rate
  // Real county name, no "County"/"Parish" suffix (e.g. "Morris", not
  // "Morris County") — matches Property.county's convention. Empty for
  // independent cities (Baltimore, St. Louis, Richmond, Virginia Beach) and
  // Washington DC, which genuinely aren't part of any county.
  county: string;
}

function city(
  name: string,
  state: string,
  zip: string,
  lat: number,
  lng: number,
  pricePerSqft: number,
  rent2br: number,
  taxRatePct: number,
  county: string
): CityDef {
  return {
    city: name,
    state,
    zip,
    lat,
    lng,
    pricePerSqft,
    rentByBeds: {
      1: Math.round(rent2br * 0.75),
      2: rent2br,
      3: Math.round(rent2br * 1.25),
      4: Math.round(rent2br * 1.5),
      5: Math.round(rent2br * 1.75),
    },
    taxRatePct,
    county,
  };
}

// Spread across every US region so the map view actually looks national.
// Price/rent levels are rough approximations for demo purposes. Tax rates
// approximate published metro effective property-tax rates (tax paid /
// market value), so each listing's tax bill is realistic for its city.
const CITIES: CityDef[] = [
  city("Seattle", "WA", "98118", 47.548, -122.269, 420, 2400, 0.0088, "King"),
  city("Portland", "OR", "97202", 45.484, -122.628, 340, 2000, 0.0105, "Multnomah"),
  city("San Francisco", "CA", "94112", 37.72, -122.442, 750, 3400, 0.0074, "San Francisco"),
  city("Oakland", "CA", "94601", 37.774, -122.218, 520, 2600, 0.0082, "Alameda"),
  city("Los Angeles", "CA", "90011", 34.007, -118.258, 520, 2500, 0.0072, "Los Angeles"),
  city("San Diego", "CA", "92113", 32.699, -117.096, 480, 2400, 0.0073, "San Diego"),
  city("Sacramento", "CA", "95823", 38.482, -121.446, 270, 1800, 0.0081, "Sacramento"),
  city("Fresno", "CA", "93706", 36.706, -119.793, 210, 1400, 0.0082, "Fresno"),
  city("Las Vegas", "NV", "89101", 36.175, -115.137, 250, 1600, 0.0055, "Clark"),
  city("Phoenix", "AZ", "85008", 33.449, -112.03, 260, 1650, 0.0051, "Maricopa"),
  city("Tucson", "AZ", "85713", 32.191, -110.926, 190, 1350, 0.0085, "Pima"),
  city("Denver", "CO", "80219", 39.699, -105.019, 340, 2100, 0.0051, "Denver"),
  city("Colorado Springs", "CO", "80910", 38.816, -104.76, 260, 1650, 0.0044, "El Paso"),
  city("Salt Lake City", "UT", "84115", 40.723, -111.888, 300, 1750, 0.0055, "Salt Lake"),
  city("Boise", "ID", "83705", 43.583, -116.243, 270, 1600, 0.0053, "Ada"),
  city("Albuquerque", "NM", "87105", 35.038, -106.647, 190, 1300, 0.0098, "Bernalillo"),
  city("Chicago", "IL", "60629", 41.776, -87.706, 220, 1900, 0.0184, "Cook"),
  city("Minneapolis", "MN", "55407", 44.925, -93.262, 270, 1800, 0.0122, "Hennepin"),
  city("Milwaukee", "WI", "53215", 43.007, -87.94, 160, 1350, 0.0217, "Milwaukee"),
  city("Detroit", "MI", "48210", 42.339, -83.108, 90, 1100, 0.0283, "Wayne"),
  city("Grand Rapids", "MI", "49507", 42.938, -85.66, 190, 1350, 0.014, "Kent"),
  city("Indianapolis", "IN", "46201", 39.774, -86.135, 155, 1300, 0.0099, "Marion"),
  city("Columbus", "OH", "43206", 39.938, -82.987, 175, 1400, 0.0162, "Franklin"),
  city("Cleveland", "OH", "44109", 41.459, -81.699, 110, 1150, 0.021, "Cuyahoga"),
  city("Cincinnati", "OH", "45204", 39.108, -84.567, 145, 1250, 0.016, "Hamilton"),
  city("Kansas City", "MO", "64127", 39.089, -94.534, 160, 1300, 0.0118, "Jackson"),
  city("St. Louis", "MO", "63111", 38.56, -90.264, 130, 1200, 0.0105, ""),
  city("Omaha", "NE", "68107", 41.222, -95.958, 175, 1350, 0.0185, "Douglas"),
  city("Des Moines", "IA", "50315", 41.564, -93.622, 165, 1300, 0.0185, "Polk"),
  city("Dallas", "TX", "75217", 32.716, -96.686, 210, 1600, 0.0177, "Dallas"),
  city("Fort Worth", "TX", "76104", 32.736, -97.321, 185, 1500, 0.0186, "Tarrant"),
  city("Houston", "TX", "77033", 29.688, -95.348, 165, 1500, 0.0177, "Harris"),
  city("Austin", "TX", "78741", 30.23, -97.712, 320, 1900, 0.0162, "Travis"),
  city("San Antonio", "TX", "78211", 29.383, -98.549, 170, 1400, 0.0185, "Bexar"),
  city("Oklahoma City", "OK", "73129", 35.408, -97.516, 140, 1200, 0.0095, "Oklahoma"),
  city("Tulsa", "OK", "74107", 36.121, -95.998, 130, 1150, 0.0102, "Tulsa"),
  city("Little Rock", "AR", "72204", 34.719, -92.348, 140, 1150, 0.0066, "Pulaski"),
  city("Atlanta", "GA", "30310", 33.734, -84.417, 250, 1700, 0.0094, "Fulton"),
  city("Nashville", "TN", "37115", 36.238, -86.706, 270, 1750, 0.0063, "Davidson"),
  city("Memphis", "TN", "38116", 35.037, -90.007, 130, 1150, 0.0124, "Shelby"),
  city("Charlotte", "NC", "28208", 35.222, -80.883, 230, 1650, 0.0086, "Mecklenburg"),
  city("Raleigh", "NC", "27610", 35.759, -78.591, 250, 1700, 0.0083, "Wake"),
  city("Columbia", "SC", "29203", 34.07, -80.977, 165, 1300, 0.0066, "Richland"),
  city("Jacksonville", "FL", "32209", 30.373, -81.687, 210, 1600, 0.0085, "Duval"),
  city("Tampa", "FL", "33605", 27.964, -82.43, 270, 1750, 0.0086, "Hillsborough"),
  city("Orlando", "FL", "32805", 28.531, -81.421, 260, 1700, 0.0089, "Orange"),
  city("Miami", "FL", "33142", 25.813, -80.238, 380, 2300, 0.009, "Miami-Dade"),
  city("Birmingham", "AL", "35211", 33.484, -86.879, 130, 1100, 0.0042, "Jefferson"),
  city("New Orleans", "LA", "70126", 30.011, -89.986, 210, 1500, 0.0078, "Orleans"),
  city("New York", "NY", "11226", 40.646, -73.956, 520, 2600, 0.0086, "Kings"),
  city("Philadelphia", "PA", "19143", 39.947, -75.229, 165, 1550, 0.0096, "Philadelphia"),
  city("Pittsburgh", "PA", "15210", 40.415, -79.986, 155, 1250, 0.0179, "Allegheny"),
  city("Baltimore", "MD", "21215", 39.336, -76.673, 160, 1500, 0.015, ""),
  city("Washington", "DC", "20019", 38.889, -76.941, 380, 2300, 0.0056, ""),
  city("Boston", "MA", "02125", 42.313, -71.057, 480, 2600, 0.0072, "Suffolk"),
  city("Providence", "RI", "02905", 41.789, -71.404, 270, 1750, 0.0135, "Providence"),
  city("Hartford", "CT", "06106", 41.752, -72.694, 190, 1450, 0.024, "Hartford"),
  city("Buffalo", "NY", "14211", 42.9, -78.826, 140, 1200, 0.019, "Erie"),
  // Additional states/metros so every state has at least one listing and
  // the map view covers the whole country, not just the largest metros.
  city("Newark", "NJ", "07104", 40.759, -74.175, 220, 1900, 0.025, "Essex"),
  city("Denville", "NJ", "07834", 40.887, -74.48, 280, 2300, 0.021, "Morris"),
  city("Richmond", "VA", "23224", 37.53, -77.46, 230, 1650, 0.0092, ""),
  city("Virginia Beach", "VA", "23462", 36.849, -76.13, 250, 1750, 0.0082, ""),
  city("Louisville", "KY", "40212", 38.267, -85.812, 150, 1150, 0.0086, "Jefferson"),
  city("Wichita", "KS", "67211", 37.665, -97.313, 140, 1100, 0.0141, "Sedgwick"),
  city("Jackson", "MS", "39204", 32.284, -90.207, 110, 1050, 0.0081, "Hinds"),
  city("Charleston", "WV", "25304", 38.35, -81.63, 120, 1050, 0.0059, "Kanawha"),
  city("Manchester", "NH", "03103", 42.99, -71.463, 290, 1800, 0.0186, "Hillsborough"),
  city("Burlington", "VT", "05401", 44.476, -73.212, 330, 1900, 0.0186, "Chittenden"),
  city("Portland", "ME", "04101", 43.657, -70.259, 340, 1800, 0.0109, "Cumberland"),
  city("Billings", "MT", "59101", 45.783, -108.5, 240, 1350, 0.0084, "Yellowstone"),
  city("Cheyenne", "WY", "82001", 41.14, -104.82, 220, 1350, 0.0061, "Laramie"),
  city("Fargo", "ND", "58103", 46.877, -96.79, 200, 1250, 0.0142, "Cass"),
  city("Sioux Falls", "SD", "57104", 43.55, -96.7, 195, 1200, 0.0122, "Minnehaha"),
  city("Anchorage", "AK", "99508", 61.194, -149.816, 310, 1750, 0.0119, "Anchorage"),
  city("Honolulu", "HI", "96817", 21.316, -157.858, 780, 2600, 0.0027, "Honolulu"),
  city("Wilmington", "DE", "19802", 39.745, -75.539, 175, 1650, 0.0055, "New Castle"),
];

// Stand-in for HUD Fair Market Rent / Census ACS median rent by zip (PRD 6.1, tier 3).
// Keyed by zip, valued per-bedroom-count monthly rent baseline.
export const ZIP_BASELINE_RENTS: Record<string, Record<number, number>> = Object.fromEntries(
  CITIES.map((c) => [c.zip, c.rentByBeds])
);

// City-level effective property tax rates, keyed "City|ST". Consumed by
// lib/propertyTax.ts, which falls back to state averages for cities not in
// this metro table.
export const CITY_TAX_RATES: Record<string, number> = Object.fromEntries(
  CITIES.map((c) => [`${c.city}|${c.state}`, c.taxRatePct])
);

// Per-bedroom rent baselines keyed "City|ST". Live RentCast searches return
// listings across many zips in a city, but ZIP_BASELINE_RENTS only covers one
// zip per metro — this table catches the rest of the metro's zips.
const CITY_BASELINE_RENTS: Record<string, Record<number, number>> = Object.fromEntries(
  CITIES.map((c) => [`${c.city}|${c.state}`, c.rentByBeds])
);

// Approximate statewide median 2-bedroom asking rents (demo-grade, in the
// spirit of Census ACS / HUD FMR levels). The free fallback for live
// listings outside the metro tables — beats a flat national default without
// costing API calls. Bedroom scaling matches the city tables.
const STATE_2BR_RENTS: Record<string, number> = {
  AL: 1150, AK: 1350, AZ: 1550, AR: 1000, CA: 2400, CO: 1800, CT: 1800,
  DE: 1500, DC: 2300, FL: 1900, GA: 1500, HI: 2400, ID: 1400, IL: 1500,
  IN: 1200, IA: 1050, KS: 1100, KY: 1100, LA: 1150, ME: 1500, MD: 1800,
  MA: 2500, MI: 1250, MN: 1400, MS: 1050, MO: 1150, MT: 1400, NE: 1100,
  NV: 1500, NH: 1800, NJ: 2100, NM: 1250, NY: 2200, NC: 1450, ND: 1000,
  OH: 1150, OK: 1050, OR: 1600, PA: 1400, RI: 1900, SC: 1400, SD: 1050,
  TN: 1400, TX: 1450, UT: 1600, VT: 1600, VA: 1650, WA: 1900, WV: 950,
  WI: 1250, WY: 1100,
};

function stateBaselineTable(state: string): Record<number, number> | undefined {
  const rent2br = STATE_2BR_RENTS[state];
  if (rent2br === undefined) return undefined;
  return {
    1: Math.round(rent2br * 0.75),
    2: rent2br,
    3: Math.round(rent2br * 1.25),
    4: Math.round(rent2br * 1.5),
    5: Math.round(rent2br * 1.75),
  };
}

function zipBaselineFor(zip: string, beds: number): number {
  const table = ZIP_BASELINE_RENTS[zip];
  if (!table) return 1200;
  const clampedBeds = Math.max(1, Math.min(5, beds || 1));
  return table[clampedBeds] ?? 1200;
}

export function getZipBaselineRent(zip: string, beds: number, city?: string, state?: string): number {
  const table =
    ZIP_BASELINE_RENTS[zip] ??
    (city && state ? CITY_BASELINE_RENTS[`${city}|${state}`] : undefined) ??
    (state ? stateBaselineTable(state) : undefined);
  if (!table) return 1200;
  const clampedBeds = Math.max(1, Math.min(5, beds || 1));
  return table[clampedBeds] ?? 1200;
}

// Property.beds is TOTAL beds across every unit for multi-family properties
// (matches how listings data typically reports it), but a per-bedroom rent
// baseline needs the beds in a *single* unit — otherwise an 18-unit building
// with 18 total beds gets priced off the "5-bedroom" baseline (the highest
// tier) for every one of its 1-bedroom units. Divide by unit count first.
export function perUnitBeds(property: { beds: number; unitCount: number }): number {
  return property.unitCount > 1 ? Math.max(1, Math.round(property.beds / property.unitCount)) : property.beds;
}

// Roughly matches the actual mix of active US for-sale listings: single
// family dominates, whole-building multifamily and manufactured homes are a
// small slice, and vacant land is a bigger share of listings than people
// expect.
const HOME_TYPE_WEIGHTS: [HomeType, number][] = [
  ["Single Family", 0.55],
  ["Condo", 0.15],
  ["Townhouse", 0.1],
  ["Multi-Family (2-4 unit)", 0.07],
  ["Multi-Family (5+ unit)", 0.02],
  ["Manufactured", 0.04],
  ["Land", 0.07],
];

// Rent discount/premium by home style relative to a site-built single-family
// home with the same bedroom count in the same zip. Manufactured homes rent
// well below site-built equivalents; multifamily units rent slightly below
// (smaller, shared walls); condos roughly at par net of the amenity/size
// tradeoff.
const HOME_TYPE_RENT_FACTOR: Record<HomeType, number> = {
  "Single Family": 1.0,
  "Multi-Family (2-4 unit)": 0.92,
  "Multi-Family (5+ unit)": 0.9,
  Condo: 0.97,
  Townhouse: 1.0,
  Manufactured: 0.72,
  Land: 0,
};

// Per-unit monthly rent baseline for a property: zip/bedroom table adjusted
// for home style, falling back zip → city → state → flat default. Use this
// instead of getZipBaselineRent when a full property is in hand.
export function getRentBaselineForProperty(property: Property): number {
  const factor = HOME_TYPE_RENT_FACTOR[property.homeType] ?? 1;
  const beds = perUnitBeds(property);
  const table =
    ZIP_BASELINE_RENTS[property.zip] ??
    CITY_BASELINE_RENTS[`${property.city}|${property.state}`] ??
    stateBaselineTable(property.state);
  const clampedBeds = Math.max(1, Math.min(5, beds || 1));
  const baseline = table?.[clampedBeds] ?? 1200;
  return Math.round(baseline * factor);
}

function weightedPick<T>(rand: () => number, weights: [T, number][]): T {
  const r = rand();
  let acc = 0;
  for (const [item, w] of weights) {
    acc += w;
    if (r <= acc) return item;
  }
  return weights[weights.length - 1][0];
}

const STREET_NAMES = [
  "Maple", "Oak", "Elm", "Cedar", "Pine", "Birch", "Willow", "Sunset", "Ridge",
  "Prairie", "River", "Lake", "Highland", "Meadow", "Forest", "Spring", "Valley",
  "Hill", "Park", "Garden", "Union", "Franklin", "Washington", "Lincoln",
  "Jefferson", "Madison", "Monroe", "Adams", "Jackson", "Chestnut",
];
const STREET_SUFFIXES = ["St", "Ave", "Dr", "Blvd", "Ln", "Ct", "Rd", "Way", "Pl"];
const KEYWORD_POOL = [
  "updated kitchen", "fenced yard", "fixer-upper", "corner lot", "new roof",
  "near transit", "pool", "gated community", "new construction", "ADU potential",
  "basement", "near campus", "both units rented", "long-term tenants",
  "owned land", "move-in ready", "buildable lot", "utilities at street",
  "renovated bathroom", "walkable", "in-unit laundry", "hardwood floors",
  "open floor plan", "large backyard", "solar panels", "smart home",
  "recently painted", "new HVAC", "granite countertops", "stainless appliances",
];

function pickKeywords(rand: () => number): string[] {
  const count = Math.floor(rand() * 3);
  const picked = new Set<string>();
  while (picked.size < count) {
    picked.add(KEYWORD_POOL[Math.floor(rand() * KEYWORD_POOL.length)]);
  }
  return Array.from(picked);
}

function generateMockProperties(count: number): Property[] {
  const rand = mulberry32(42);
  const properties: Property[] = [];

  for (let i = 0; i < count; i++) {
    const cityDef = CITIES[Math.floor(rand() * CITIES.length)];
    const homeType = weightedPick(rand, HOME_TYPE_WEIGHTS);

    const streetNum = 100 + Math.floor(rand() * 9899);
    const streetName = STREET_NAMES[Math.floor(rand() * STREET_NAMES.length)];
    const streetSuffix = STREET_SUFFIXES[Math.floor(rand() * STREET_SUFFIXES.length)];
    const address = `${streetNum} ${streetName} ${streetSuffix}`;
    const lat = cityDef.lat + (rand() - 0.5) * 0.12;
    const lng = cityDef.lng + (rand() - 0.5) * 0.12;
    const yearBuilt = 1930 + Math.floor(rand() * 94);
    const daysOnMarket = rand() < 0.08 ? 200 + Math.floor(rand() * 400) : 1 + Math.floor(rand() * 120);
    const statusRoll = rand();
    const status: ListingStatus =
      statusRoll < 0.82 ? "For Sale" : statusRoll < 0.92 ? "Pending" : statusRoll < 0.97 ? "Coming Soon" : "Recently Sold";
    // Price varies independently of rent (which comes from the city's zip
    // baseline at query time) — this is what produces a real spread of cap
    // rates rather than every listing clustering around the same yield.
    const dealFactor = 0.65 + rand() * 0.9;

    let beds = 0;
    let baths = 0;
    let sqft = 0;
    let lotSqft = 0;
    let price = 0;
    let unitCount = 1;
    let hoaMonthly = 0;
    let parkingSpots = 0;
    let hasBasement = false;
    let buildingRentRoll: Property["buildingRentRoll"];

    if (homeType === "Land") {
      lotSqft = 3000 + Math.floor(rand() * 40000);
      price = Math.max(8000, Math.round(lotSqft * cityDef.pricePerSqft * 0.08 * dealFactor));
      unitCount = 0;
    } else if (homeType === "Multi-Family (2-4 unit)" || homeType === "Multi-Family (5+ unit)") {
      unitCount = homeType === "Multi-Family (2-4 unit)" ? 2 + Math.floor(rand() * 3) : 5 + Math.floor(rand() * 20);
      const bedsPerUnit = 1 + Math.floor(rand() * 2);
      beds = unitCount * bedsPerUnit;
      baths = unitCount;
      const sqftPerUnit = 550 + bedsPerUnit * 250 + Math.floor(rand() * 200);
      sqft = unitCount * sqftPerUnit;
      lotSqft = unitCount * (1500 + Math.floor(rand() * 2000));
      const pricePerSqft = cityDef.pricePerSqft * 0.85 * (0.85 + rand() * 0.3);
      price = Math.max(120000, Math.round(sqft * pricePerSqft * dealFactor));
      parkingSpots = unitCount;
      hasBasement = rand() < 0.25;

      if (rand() < 0.35) {
        const perUnitBaseline =
          zipBaselineFor(cityDef.zip, bedsPerUnit) * HOME_TYPE_RENT_FACTOR[homeType];
        buildingRentRoll = {
          buildingName: `${streetName} ${homeType === "Multi-Family (2-4 unit)" ? "Fourplex" : "Apartments"}`,
          unitRents: Array.from({ length: unitCount }, () =>
            Math.round(perUnitBaseline * (0.85 + rand() * 0.3))
          ),
        };
      }
    } else {
      // Single Family, Condo, Townhouse, Manufactured
      beds = homeType === "Condo" ? 1 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 4);
      baths = Math.max(1, beds - 1 - Math.floor(rand() * 2));
      if (rand() < 0.35) baths += 0.5;
      baths = Math.min(baths, beds);

      const sqftPerBed =
        homeType === "Condo" ? 450 + rand() * 200 :
        homeType === "Manufactured" ? 350 + rand() * 150 :
        homeType === "Townhouse" ? 500 + rand() * 200 :
        500 + rand() * 250;
      sqft = Math.round(beds * sqftPerBed);

      lotSqft =
        homeType === "Condo" ? 0 :
        homeType === "Townhouse" ? 800 + Math.floor(rand() * 2500) :
        homeType === "Manufactured" ? 3000 + Math.floor(rand() * 8000) :
        3000 + Math.floor(rand() * 10000);

      const typeMultiplier =
        homeType === "Manufactured" ? 0.5 : homeType === "Condo" ? 0.9 : homeType === "Townhouse" ? 0.95 : 1.0;
      const pricePerSqft = cityDef.pricePerSqft * typeMultiplier * (0.85 + rand() * 0.3);
      price = Math.max(homeType === "Manufactured" ? 25000 : 60000, Math.round(sqft * pricePerSqft * dealFactor));

      hoaMonthly =
        homeType === "Condo" || homeType === "Townhouse"
          ? Math.round(100 + rand() * 400)
          : rand() < 0.1
            ? Math.round(20 + rand() * 80)
            : 0;
      parkingSpots = homeType === "Condo" ? Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2);
      hasBasement = (homeType === "Single Family" || homeType === "Townhouse") && rand() < 0.35;
    }

    properties.push({
      id: `mock-${i}`,
      address,
      city: cityDef.city,
      state: cityDef.state,
      zip: cityDef.zip,
      county: cityDef.county || undefined,
      lat,
      lng,
      price,
      homeType,
      beds,
      baths,
      sqft,
      lotSqft,
      yearBuilt: homeType === "Land" ? 0 : yearBuilt,
      daysOnMarket,
      status,
      hoaMonthly,
      pricePerSqft: sqft > 0 ? Math.round(price / sqft) : 0,
      parkingSpots,
      hasBasement,
      unitCount,
      annualPropertyTax: Math.round(price * cityDef.taxRatePct),
      keywords: pickKeywords(rand),
      buildingRentRoll,
    });
  }

  return properties;
}

export const MOCK_PROPERTIES: Property[] = generateMockProperties(3000);

// Deterministic pseudo-random comps generator keyed off the property id, so
// the same property always shows the same comp set during a session.
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return (h % 1000) / 1000;
  };
}

export function getCompsForProperty(property: Property): RentComp[] {
  if (property.homeType === "Land") return [];

  const rand = seededRandom(property.id);
  const baseline = getRentBaselineForProperty(property);
  // Vary comp count so filters/confidence badges show a realistic mix: some
  // properties land in the "sparse comps -> zip baseline fallback" tier.
  const compCount = Math.floor(rand() * 10); // 0-9

  return Array.from({ length: compCount }, (_, i) => {
    const jitter = (rand() - 0.5) * 0.25; // +/-12.5%
    const rent = Math.round(baseline * (1 + jitter));
    return {
      id: `${property.id}-comp-${i}`,
      address: `${100 + i} Nearby St`,
      distanceMiles: Math.round((0.2 + rand() * 1.8) * 10) / 10,
      beds: property.beds,
      baths: property.baths,
      sqft: Math.round(property.sqft * (0.9 + rand() * 0.2)),
      monthlyRent: rent,
      daysOnMarket: Math.floor(rand() * 45),
    };
  });
}
