// RentCast API client (https://www.rentcast.io/api).
//
// Server-side only: reads process.env, which Next.js keeps out of the client
// bundle by default since these vars aren't NEXT_PUBLIC_-prefixed. Only call
// this from route handlers (src/app/api/**/route.ts), never from a
// "use client" component. Gated behind ENABLE_LIVE_API in .env.local.
//
// Field mappings below were confirmed against real API responses on
// 2026-07-12 (see /listings/sale, /avm/rent/long-term) — not guessed.

import type { HomeType, ListingStatus, Property, RentComp, RentEstimate } from "./types";

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
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  hoa?: { fee?: number };
  status: string;
  price: number;
  daysOnMarket?: number;
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

export function mapSaleListingToProperty(raw: RawSaleListing): Property {
  const homeType = mapPropertyType(raw.propertyType);
  const sqft = raw.squareFootage ?? 0;

  return {
    id: raw.id,
    address: raw.addressLine1,
    city: raw.city,
    state: raw.state,
    zip: raw.zipCode,
    lat: raw.latitude,
    lng: raw.longitude,
    price: raw.price,
    homeType,
    beds: raw.bedrooms ?? 0,
    baths: raw.bathrooms ?? 0,
    sqft,
    lotSqft: raw.lotSize ?? 0,
    yearBuilt: raw.yearBuilt ?? 0,
    daysOnMarket: raw.daysOnMarket ?? 0,
    status: mapStatus(raw.status),
    // RentCast's hoa.fee doesn't document billing frequency; treating as
    // monthly, which matches the typical range seen for HOA fees at this
    // magnitude. Worth confirming against RentCast docs before relying on it.
    hoaMonthly: raw.hoa?.fee ?? 0,
    pricePerSqft: sqft > 0 ? Math.round(raw.price / sqft) : 0,
    // Not returned by the sale listings endpoint.
    parkingSpots: 0,
    hasBasement: false,
    unitCount: homeType.startsWith("Multi-Family") ? 2 : 1,
    annualPropertyTax: undefined,
    keywords: [],
    source: "rentcast",
  };
}

function mapComparable(raw: RawRentComparable): RentComp {
  return {
    id: raw.id,
    address: raw.formattedAddress,
    distanceMiles: raw.distance ?? 0,
    beds: raw.bedrooms ?? 0,
    baths: raw.bathrooms ?? 0,
    sqft: raw.squareFootage ?? 0,
    monthlyRent: raw.price,
    daysOnMarket: raw.daysOnMarket ?? 0,
  };
}

export function mapAvmToRentEstimate(raw: RawAvmRentResponse, zipBaselineMonthlyRent: number): RentEstimate {
  const comps = raw.comparables.map(mapComparable);
  // RentCast's AVM is itself comp-derived, so we treat it as our "comps" tier
  // directly rather than re-blending with the zip baseline.
  return {
    monthlyRent: raw.rent,
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
  priceMin?: number;
  priceMax?: number;
  propertyType?: HomeType;
  limit?: number;
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
  const raw = await rentcastFetch<RawSaleListing[]>("/listings/sale", {
    city: params.city,
    state: params.state,
    zipCode: params.zipCode,
    status: "Active",
    propertyType: params.propertyType ? HOME_TYPE_TO_RENTCAST[params.propertyType] : undefined,
    limit: params.limit ?? 20,
  });

  let properties = raw.map(mapSaleListingToProperty);

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

  return mapAvmToRentEstimate(raw, zipBaselineMonthlyRent);
}
