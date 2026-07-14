// RentCast API client (https://www.rentcast.io/api).
//
// Server-side only: reads process.env, which Next.js keeps out of the client
// bundle by default since these vars aren't NEXT_PUBLIC_-prefixed. Only call
// this from route handlers (src/app/api/**/route.ts), never from a
// "use client" component. Gated behind ENABLE_LIVE_API in .env.local.
//
// Field mappings below were confirmed against real API responses on
// 2026-07-12 (see /listings/sale, /avm/rent/long-term) — not guessed.

import { geocodeCounty, type GeocodedArea } from "./geocode";
import type {
  AssessmentYearRecord,
  HomeType,
  ListingContact,
  ListingStatus,
  Property,
  PropertyTaxRecord,
  RentComp,
  RentEstimate,
  TaxYearRecord,
} from "./types";

const BASE_URL = process.env.RENTCAST_BASE_URL ?? "https://api.rentcast.io/v1";

class LiveApiDisabledError extends Error {
  constructor() {
    super(
      "RentCast live API calls are disabled (ENABLE_LIVE_API is not 'true' in .env.local)."
    );
    this.name = "LiveApiDisabledError";
  }
}

function assertLiveApiEnabled(): void {
  if (process.env.ENABLE_LIVE_API !== "true") {
    throw new LiveApiDisabledError();
  }
}

function getApiKey(): string {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) {
    throw new Error("RENTCAST_API_KEY is not set in .env.local");
  }
  return key;
}

async function rentcastFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>
): Promise<T> {
  assertLiveApiEnabled();

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "X-Api-Key": getApiKey(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`RentCast API error ${response.status} for ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

// ---- Raw response shapes (subset of fields we actually use) ----------------

interface RawSaleListing {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  addressLine2?: string; // unit/apt designator, present for condos etc.
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number; // sqft
  yearBuilt?: number;
  hoa?: { fee?: number };
  status: string;
  price: number;
  listingType?: string; // "Standard" | "New Construction" | "Foreclosure" | "Short Sale"
  listedDate?: string; // ISO timestamp
  daysOnMarket?: number;
  listingAgent?: { name?: string; phone?: string; email?: string; website?: string };
  listingOffice?: { name?: string; phone?: string; email?: string; website?: string };
}

// MLS feeds pad these fields with stray whitespace/tabs; drop empty shells.
function mapContact(raw: RawSaleListing["listingAgent"]): ListingContact | undefined {
  if (!raw) return undefined;
  const contact: ListingContact = {
    name: raw.name?.trim() || undefined,
    phone: raw.phone?.trim() || undefined,
    email: raw.email?.trim() || undefined,
    website: raw.website?.trim() || undefined,
  };
  return Object.values(contact).some(Boolean) ? contact : undefined;
}

interface RawRentComparable {
  id: string;
  formattedAddress: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  price: number; // monthly rent for rent comparables
  distance?: number;
  daysOnMarket?: number;
}

interface RawAvmRentResponse {
  rent: number;
  rentRangeLow: number;
  rentRangeHigh: number;
  comparables: RawRentComparable[];
}

// Property record (/properties) — county assessor data. Taxes and
// assessments are objects keyed by tax year ("2023": {...}), per
// https://developers.rentcast.io/reference/property-data-schema.
interface RawPropertyRecord {
  id: string;
  formattedAddress: string;
  propertyTaxes?: Record<string, { year: number; total: number }>;
  taxAssessments?: Record<
    string,
    { year: number; value: number; land?: number; improvements?: number }
  >;
}

// ---- Field mapping -----------------------------------------------------

function mapPropertyType(raw: string): HomeType {
  const normalized = raw.toLowerCase();
  if (normalized.includes("single family")) return "Single Family";
  if (normalized.includes("condo")) return "Condo";
  if (normalized.includes("townhouse")) return "Townhouse";
  if (normalized.includes("manufactured")) return "Manufactured";
  if (normalized.includes("land")) return "Land";
  if (normalized.includes("apartment")) return "Multi-Family (5+ unit)";
  if (normalized.includes("multi")) return "Multi-Family (2-4 unit)";
  return "Single Family";
}

function mapStatus(raw: string): ListingStatus {
  const normalized = raw.toLowerCase();
  if (normalized === "active") return "For Sale";
  if (normalized === "pending" || normalized === "contingent") return "Pending";
  if (normalized === "coming soon") return "Coming Soon";
  return "Recently Sold";
}

// RentCast omits daysOnMarket on some listings but almost always returns
// listedDate — derive the age from that before giving up.
function resolveDaysOnMarket(raw: RawSaleListing): number {
  if (raw.daysOnMarket !== undefined) return raw.daysOnMarket;
  if (raw.listedDate) {
    const listed = Date.parse(raw.listedDate);
    if (!Number.isNaN(listed)) {
      return Math.max(0, Math.round((Date.now() - listed) / 86_400_000));
    }
  }
  return 0;
}

export function mapSaleListingToProperty(raw: RawSaleListing): Property {
  const homeType = mapPropertyType(raw.propertyType);
  const sqft = raw.squareFootage ?? 0;

  // RentCast doesn't report unit counts, so use the lower bound implied by
  // the property type — rent totals for multifamily stay conservative.
  const unitCount =
    homeType === "Land" ? 0 :
    homeType === "Multi-Family (5+ unit)" ? 5 :
    homeType === "Multi-Family (2-4 unit)" ? 2 : 1;

  // Searchable listing attributes RentCast exposes outside the mock schema
  // (listing type, county) live in keywords so the keyword filter finds them.
  const keywords: string[] = [];
  if (raw.listingType && raw.listingType.toLowerCase() !== "standard") {
    keywords.push(raw.listingType.toLowerCase());
  }
  if (raw.county) keywords.push(`${raw.county} county`.toLowerCase());

  return {
    id: raw.id,
    address: [raw.addressLine1, raw.addressLine2].filter(Boolean).join(", "),
    city: raw.city,
    state: raw.state,
    zip: raw.zipCode,
    county: raw.county,
    lat: raw.latitude,
    lng: raw.longitude,
    price: raw.price,
    homeType,
    beds: raw.bedrooms ?? 0,
    baths: raw.bathrooms ?? 0,
    sqft,
    lotSqft: raw.lotSize ?? 0,
    yearBuilt: raw.yearBuilt ?? 0,
    daysOnMarket: resolveDaysOnMarket(raw),
    status: mapStatus(raw.status),
    // RentCast's hoa.fee doesn't document billing frequency; treating as
    // monthly, which matches the typical range seen for HOA fees at this
    // magnitude. Worth confirming against RentCast docs before relying on it.
    hoaMonthly: raw.hoa?.fee ?? 0,
    pricePerSqft: sqft > 0 ? Math.round(raw.price / sqft) : 0,
    // Not returned by the sale listings endpoint.
    parkingSpots: 0,
    hasBasement: false,
    unitCount,
    // Not returned either — roi.ts estimates it from city/state tax rates.
    annualPropertyTax: undefined,
    keywords,
    listingAgent: mapContact(raw.listingAgent),
    listingOffice: mapContact(raw.listingOffice),
    source: "rentcast",
  };
}

function mapComparable(raw: RawRentComparable): RentComp {
  return {
    id: raw.id,
    address: raw.formattedAddress,
    // Live distances come back with 4+ decimals — round for display.
    distanceMiles: Math.round((raw.distance ?? 0) * 100) / 100,
    beds: raw.bedrooms ?? 0,
    baths: raw.bathrooms ?? 0,
    sqft: raw.squareFootage ?? 0,
    monthlyRent: raw.price,
    daysOnMarket: raw.daysOnMarket ?? 0,
  };
}

export function mapAvmToRentEstimate(
  raw: RawAvmRentResponse,
  zipBaselineMonthlyRent: number,
  unitCount: number
): RentEstimate {
  const comps = raw.comparables.map(mapComparable);
  // RentCast's AVM estimates rent for the address as queried. Sale listings
  // report the whole property at that address, so we treat raw.rent as the
  // total for the property (consistent with how price/other fields work)
  // and derive a per-unit figure by dividing — this is an approximation for
  // multi-family addresses since RentCast doesn't expose a per-unit AVM.
  const safeUnitCount = Math.max(1, unitCount);
  return {
    monthlyRent: raw.rent,
    perUnitMonthlyRent: Math.round(raw.rent / safeUnitCount),
    rentRangeLow: raw.rentRangeLow,
    rentRangeHigh: raw.rentRangeHigh,
    method: "comps",
    compsUsed: comps,
    compsWeight: 1,
    buildingWeight: 0,
    zipBaselineWeight: 0,
    zipBaselineMonthlyRent,
    confidence: comps.length >= 5 ? "high" : comps.length >= 2 ? "medium" : "low",
  };
}

// ---- Public API ----------------------------------------------------------

export interface SaleListingSearchParams {
  city?: string;
  state?: string;
  zipCode?: string;
  // County name, with or without the "County" suffix. RentCast has no county
  // query parameter (verified 2026-07-14: ?county= is silently ignored), so
  // county searches geocode the county to a centroid + radius, run a radius
  // search, and filter the response by each listing's county field.
  county?: string;
  priceMin?: number;
  priceMax?: number;
  propertyType?: HomeType;
  limit?: number;
}

function normalizeCounty(name: string): string {
  return name.replace(/\s+county$/i, "").trim().toLowerCase();
}

const HOME_TYPE_TO_RENTCAST: Record<HomeType, string> = {
  "Single Family": "Single Family",
  "Multi-Family (2-4 unit)": "Multi-Family",
  "Multi-Family (5+ unit)": "Apartment",
  Condo: "Condo",
  Townhouse: "Townhouse",
  Manufactured: "Manufactured",
  Land: "Land",
};

export async function searchSaleListings(params: SaleListingSearchParams): Promise<Property[]> {
  // County searches: geocode (free, Nominatim) → RentCast radius search
  // (still exactly 1 RentCast API call) → exact county filter, since the
  // radius circle overlaps neighboring counties.
  const isCountySearch = params.county !== undefined;
  let area: GeocodedArea | null = null;
  if (isCountySearch) {
    area = await geocodeCounty(normalizeCounty(params.county!), params.state ?? "");
    if (!area) {
      throw new Error(`Couldn't locate ${params.county}, ${params.state ?? "US"} on the map.`);
    }
  }

  const raw = await rentcastFetch<RawSaleListing[]>("/listings/sale", {
    city: isCountySearch ? undefined : params.city,
    state: isCountySearch ? undefined : params.state,
    zipCode: params.zipCode,
    latitude: area?.lat,
    longitude: area?.lng,
    radius: area?.radiusMiles,
    status: "Active",
    propertyType: params.propertyType ? HOME_TYPE_TO_RENTCAST[params.propertyType] : undefined,
    limit: isCountySearch ? 500 : params.limit ?? 20,
  });

  let properties = raw.map(mapSaleListingToProperty);

  if (isCountySearch) {
    const wanted = normalizeCounty(params.county!);
    properties = properties.filter((p) => p.county !== undefined && normalizeCounty(p.county) === wanted);
  }
  if (params.priceMin !== undefined) {
    properties = properties.filter((p) => p.price >= params.priceMin!);
  }
  if (params.priceMax !== undefined) {
    properties = properties.filter((p) => p.price <= params.priceMax!);
  }

  return properties;
}

export interface RentEstimateParams {
  address: string;
  propertyType?: HomeType;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  unitCount?: number;
}

// Fetches the county tax record for one address (1 API call). Returns null
// when RentCast has no record — or a record with no tax/assessment data —
// for the address.
export async function getPropertyTaxRecord(address: string): Promise<PropertyTaxRecord | null> {
  const raw = await rentcastFetch<RawPropertyRecord[] | RawPropertyRecord>("/properties", {
    address,
  });
  const record = Array.isArray(raw) ? raw[0] : raw;
  if (!record) return null;

  const taxHistory: TaxYearRecord[] = Object.values(record.propertyTaxes ?? {})
    .map((t) => ({ year: t.year, total: t.total }))
    .sort((a, b) => b.year - a.year);
  const assessmentHistory: AssessmentYearRecord[] = Object.values(record.taxAssessments ?? {})
    .map((a) => ({ year: a.year, value: a.value, land: a.land, improvements: a.improvements }))
    .sort((a, b) => b.year - a.year);

  if (taxHistory.length === 0 && assessmentHistory.length === 0) return null;

  return {
    annualPropertyTax: taxHistory[0]?.total,
    taxHistory,
    assessmentHistory,
  };
}

export async function getRentEstimate(
  params: RentEstimateParams,
  zipBaselineMonthlyRent: number
): Promise<RentEstimate> {
  const raw = await rentcastFetch<RawAvmRentResponse>("/avm/rent/long-term", {
    address: params.address,
    propertyType: params.propertyType ? HOME_TYPE_TO_RENTCAST[params.propertyType] : undefined,
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
    squareFootage: params.squareFootage,
  });

  return mapAvmToRentEstimate(raw, zipBaselineMonthlyRent, params.unitCount ?? 1);
}
