// Mock listings + rent baselines so the dashboard is fully interactive without
// ever calling the RentCast API. Swap this out for src/lib/rentcastClient.ts
// once live calls are turned on (see ENABLE_LIVE_API in .env.local).

import type { Property, RentComp } from "./types";

// Stand-in for HUD Fair Market Rent / Census ACS median rent by zip (PRD 6.1, tier 3).
// Keyed by zip, valued per-bedroom-count monthly rent baseline.
export const ZIP_BASELINE_RENTS: Record<string, Record<number, number>> = {
  "75217": { 1: 950, 2: 1150, 3: 1450, 4: 1750, 5: 2050 }, // Dallas, TX
  "76104": { 1: 900, 2: 1100, 3: 1350, 4: 1600, 5: 1900 }, // Fort Worth, TX
  "76010": { 1: 980, 2: 1200, 3: 1500, 4: 1800, 5: 2100 }, // Arlington, TX
  "85008": { 1: 1050, 2: 1300, 3: 1650, 4: 1950, 5: 2250 }, // Phoenix, AZ
  "43206": { 1: 850, 2: 1050, 3: 1300, 4: 1550, 5: 1850 }, // Columbus, OH
  "46201": { 1: 800, 2: 1000, 3: 1250, 4: 1500, 5: 1800 }, // Indianapolis, IN
};

function zipBaselineFor(zip: string, beds: number): number {
  const table = ZIP_BASELINE_RENTS[zip];
  if (!table) return 1200;
  const clampedBeds = Math.max(1, Math.min(5, beds || 1));
  return table[clampedBeds] ?? 1200;
}

export function getZipBaselineRent(zip: string, beds: number): number {
  return zipBaselineFor(zip, beds);
}

export const MOCK_PROPERTIES: Property[] = [
  {
    id: "p1",
    address: "4821 Maple Ridge Dr",
    city: "Dallas",
    state: "TX",
    zip: "75217",
    lat: 32.7157,
    lng: -96.6858,
    price: 285000,
    homeType: "Single Family",
    beds: 3,
    baths: 2,
    sqft: 1650,
    lotSqft: 6500,
    yearBuilt: 1998,
    daysOnMarket: 14,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 173,
    parkingSpots: 2,
    hasBasement: false,
    unitCount: 1,
    annualPropertyTax: 5400,
    keywords: ["updated kitchen", "fenced yard"],
  },
  {
    id: "p2",
    address: "112 Vickery Blvd",
    city: "Fort Worth",
    state: "TX",
    zip: "76104",
    lat: 32.7357,
    lng: -97.3208,
    price: 189000,
    homeType: "Single Family",
    beds: 2,
    baths: 1,
    sqft: 1080,
    lotSqft: 5200,
    yearBuilt: 1955,
    daysOnMarket: 42,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 175,
    parkingSpots: 1,
    hasBasement: false,
    unitCount: 1,
    annualPropertyTax: 3600,
    keywords: ["fixer-upper", "corner lot"],
  },
  {
    id: "p3",
    address: "2200 Handley Dr — 4-Plex",
    city: "Fort Worth",
    state: "TX",
    zip: "76104",
    lat: 32.741,
    lng: -97.279,
    price: 520000,
    homeType: "Multi-Family (2-4 unit)",
    beds: 8,
    baths: 4,
    sqft: 3600,
    lotSqft: 9800,
    yearBuilt: 1985,
    daysOnMarket: 21,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 144,
    parkingSpots: 4,
    hasBasement: false,
    unitCount: 4,
    annualPropertyTax: 9800,
    keywords: ["all units occupied", "separate meters"],
    buildingRentRoll: {
      buildingName: "Handley Fourplex",
      unitRents: [1150, 1175, 1200, 1160],
    },
  },
  {
    id: "p4",
    address: "980 Cooper St, Unit 3B",
    city: "Arlington",
    state: "TX",
    zip: "76010",
    lat: 32.7357,
    lng: -97.1081,
    price: 165000,
    homeType: "Condo",
    beds: 2,
    baths: 2,
    sqft: 1020,
    lotSqft: 0,
    yearBuilt: 2005,
    daysOnMarket: 9,
    status: "For Sale",
    hoaMonthly: 275,
    pricePerSqft: 162,
    parkingSpots: 1,
    hasBasement: false,
    unitCount: 1,
    annualPropertyTax: 3100,
    keywords: ["pool", "gated community"],
  },
  {
    id: "p5",
    address: "7710 Broadway Blvd",
    city: "Dallas",
    state: "TX",
    zip: "75217",
    lat: 32.705,
    lng: -96.67,
    price: 349000,
    homeType: "Townhouse",
    beds: 3,
    baths: 2.5,
    sqft: 1780,
    lotSqft: 2200,
    yearBuilt: 2016,
    daysOnMarket: 5,
    status: "For Sale",
    hoaMonthly: 180,
    pricePerSqft: 196,
    parkingSpots: 2,
    hasBasement: false,
    unitCount: 1,
    annualPropertyTax: 6800,
    keywords: ["new construction", "ADU potential"],
  },
  {
    id: "p6",
    address: "3390 E Van Buren St — 12-Unit",
    city: "Phoenix",
    state: "AZ",
    zip: "85008",
    lat: 33.449,
    lng: -111.98,
    price: 1450000,
    homeType: "Multi-Family (5+ unit)",
    beds: 24,
    baths: 12,
    sqft: 10800,
    lotSqft: 18000,
    yearBuilt: 1978,
    daysOnMarket: 60,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 134,
    parkingSpots: 12,
    hasBasement: false,
    unitCount: 12,
    annualPropertyTax: 24500,
    keywords: ["value-add", "below-market rents"],
    buildingRentRoll: {
      buildingName: "Van Buren Apartments",
      unitRents: [1050, 1075, 1100, 1050, 1125, 1080, 1060, 1090, 1110, 1070, 1095, 1085],
    },
  },
  {
    id: "p7",
    address: "1502 Sunset Ave",
    city: "Columbus",
    state: "OH",
    zip: "43206",
    lat: 39.938,
    lng: -82.987,
    price: 142000,
    homeType: "Single Family",
    beds: 3,
    baths: 1,
    sqft: 1250,
    lotSqft: 4800,
    yearBuilt: 1962,
    daysOnMarket: 30,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 114,
    parkingSpots: 1,
    hasBasement: true,
    unitCount: 1,
    annualPropertyTax: 2600,
    keywords: ["basement", "near campus"],
  },
  {
    id: "p8",
    address: "610 English Ave — Duplex",
    city: "Indianapolis",
    state: "IN",
    zip: "46201",
    lat: 39.774,
    lng: -86.135,
    price: 210000,
    homeType: "Multi-Family (2-4 unit)",
    beds: 4,
    baths: 2,
    sqft: 2100,
    lotSqft: 6000,
    yearBuilt: 1948,
    daysOnMarket: 18,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 100,
    parkingSpots: 2,
    hasBasement: true,
    unitCount: 2,
    annualPropertyTax: 3400,
    keywords: ["both units rented", "long-term tenants"],
  },
  {
    id: "p9",
    address: "88 Legacy Way",
    city: "Fort Worth",
    state: "TX",
    zip: "76104",
    lat: 32.73,
    lng: -97.31,
    price: 95000,
    homeType: "Manufactured",
    beds: 3,
    baths: 2,
    sqft: 1400,
    lotSqft: 7200,
    yearBuilt: 2001,
    daysOnMarket: 55,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 68,
    parkingSpots: 2,
    hasBasement: false,
    unitCount: 1,
    annualPropertyTax: 1400,
    keywords: ["owned land", "move-in ready"],
  },
  {
    id: "p10",
    address: "Lot 14, Prairie View Rd",
    city: "Arlington",
    state: "TX",
    zip: "76010",
    lat: 32.72,
    lng: -97.1,
    price: 65000,
    homeType: "Land",
    beds: 0,
    baths: 0,
    sqft: 0,
    lotSqft: 21000,
    yearBuilt: 0,
    daysOnMarket: 90,
    status: "For Sale",
    hoaMonthly: 0,
    pricePerSqft: 0,
    parkingSpots: 0,
    hasBasement: false,
    unitCount: 0,
    annualPropertyTax: 900,
    keywords: ["buildable lot", "utilities at street"],
  },
  {
    id: "p11",
    address: "233 Marsalis Ave",
    city: "Dallas",
    state: "TX",
    zip: "75217",
    lat: 32.71,
    lng: -96.77,
    price: 235000,
    homeType: "Single Family",
    beds: 3,
    baths: 2,
    sqft: 1420,
    lotSqft: 5800,
    yearBuilt: 1975,
    daysOnMarket: 11,
    status: "Pending",
    hoaMonthly: 0,
    pricePerSqft: 165,
    parkingSpots: 2,
    hasBasement: false,
    unitCount: 1,
    annualPropertyTax: 4700,
    keywords: ["renovated bathroom"],
  },
  {
    id: "p12",
    address: "77 Riverside Ct, Unit 5",
    city: "Columbus",
    state: "OH",
    zip: "43206",
    lat: 39.94,
    lng: -83.0,
    price: 118000,
    homeType: "Condo",
    beds: 1,
    baths: 1,
    sqft: 720,
    lotSqft: 0,
    yearBuilt: 2010,
    daysOnMarket: 25,
    status: "For Sale",
    hoaMonthly: 210,
    pricePerSqft: 164,
    parkingSpots: 1,
    hasBasement: false,
    unitCount: 1,
    annualPropertyTax: 2100,
    keywords: ["walkable", "in-unit laundry"],
  },
];

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
  const baseline = zipBaselineFor(property.zip, property.beds);
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
