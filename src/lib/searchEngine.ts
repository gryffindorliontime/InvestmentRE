import { getCompsForProperty, getRentBaselineForProperty, MOCK_PROPERTIES } from "./mockData";
import { estimateRent } from "./rentEstimate";
import { computeROI } from "./roi";
import type {
  FinancingAssumptions,
  FloodZoneInfo,
  Property,
  PropertyTaxRecord,
  RentEstimate,
  ROIResult,
  SearchFilters,
  SortState,
} from "./types";

export interface EnrichedListing {
  property: Property;
  rentEstimate: RentEstimate;
  roi: ROIResult;
}

// Runs every mock property through the rent-estimation blend + ROI math once.
// `floodOverrides` holds on-demand FEMA flood-zone lookups keyed by property
// id (flood zone doesn't affect ROI math, it's informational).
export function buildEnrichedListings(
  assumptions: FinancingAssumptions,
  floodOverrides: Record<string, FloodZoneInfo> = {}
): EnrichedListing[] {
  return MOCK_PROPERTIES.map((property) => {
    const floodZone = floodOverrides[property.id];
    const effectiveProperty = floodZone ? { ...property, floodZone } : property;
    const comps = getCompsForProperty(effectiveProperty);
    const zipBaseline = getRentBaselineForProperty(effectiveProperty);
    const rentEstimate = estimateRent(effectiveProperty, comps, zipBaseline);
    const roi = computeROI(effectiveProperty, rentEstimate.monthlyRent, assumptions);
    return { property: effectiveProperty, rentEstimate, roi };
  });
}

// Same as buildEnrichedListings, but for live RentCast search results. Each
// property already carries a rentEstimate (zip-baseline, computed for free by
// /api/search) which can be swapped for a comps-based one via
// `rentOverrides` after the user fetches live comps for that property.
// `taxOverrides` works the same way for county tax records: fetched on
// demand, they replace the city/state tax estimate in the ROI math.
export function buildEnrichedListingsFromLive(
  entries: { property: Property; rentEstimate: RentEstimate }[],
  assumptions: FinancingAssumptions,
  rentOverrides: Record<string, RentEstimate>,
  taxOverrides: Record<string, PropertyTaxRecord> = {},
  floodOverrides: Record<string, FloodZoneInfo> = {}
): EnrichedListing[] {
  return entries.map(({ property, rentEstimate }) => {
    const taxRecord = taxOverrides[property.id];
    const floodZone = floodOverrides[property.id];
    let effectiveProperty: Property = taxRecord
      ? {
          ...property,
          // Keep any existing value when the county reported assessments but
          // no tax totals.
          annualPropertyTax: taxRecord.annualPropertyTax ?? property.annualPropertyTax,
          taxHistory: taxRecord.taxHistory,
          assessmentHistory: taxRecord.assessmentHistory,
        }
      : property;
    if (floodZone) effectiveProperty = { ...effectiveProperty, floodZone };
    const effectiveRentEstimate = rentOverrides[property.id] ?? rentEstimate;
    const roi = computeROI(effectiveProperty, effectiveRentEstimate.monthlyRent, assumptions);
    return { property: effectiveProperty, rentEstimate: effectiveRentEstimate, roi };
  });
}

function matchesRange(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

export function applyFilters(listings: EnrichedListing[], filters: SearchFilters): EnrichedListing[] {
  const locationQuery = filters.location.trim().toLowerCase();
  const keywordQuery = filters.keyword.trim().toLowerCase();

  return listings.filter(({ property, roi }) => {
    if (locationQuery) {
      const haystack = `${property.city} ${property.state} ${property.zip} ${
        property.county ? `${property.county} county` : ""
      }`.toLowerCase();
      if (!haystack.includes(locationQuery)) return false;
    }

    if (filters.states.length > 0 && !filters.states.includes(property.state)) return false;

    if (!matchesRange(property.price, filters.price.min, filters.price.max)) return false;

    if (filters.homeTypes.length > 0 && !filters.homeTypes.includes(property.homeType)) return false;

    if (filters.bedsMin !== null && property.beds < filters.bedsMin) return false;
    if (filters.bathsMin !== null && property.baths < filters.bathsMin) return false;

    if (!matchesRange(property.sqft, filters.sqft.min, filters.sqft.max)) return false;
    if (!matchesRange(property.lotSqft, filters.lotSqft.min, filters.lotSqft.max)) return false;
    if (!matchesRange(property.yearBuilt, filters.yearBuilt.min, filters.yearBuilt.max)) return false;

    if (filters.daysOnMarketMax !== null && property.daysOnMarket > filters.daysOnMarketMax) return false;

    if (filters.status.length > 0 && !filters.status.includes(property.status)) return false;

    if (filters.hoaMax !== null && property.hoaMonthly > filters.hoaMax) return false;

    if (!matchesRange(property.pricePerSqft, filters.pricePerSqft.min, filters.pricePerSqft.max))
      return false;

    if (filters.parkingMin !== null && property.parkingSpots < filters.parkingMin) return false;

    if (filters.basementOnly && !property.hasBasement) return false;

    if (keywordQuery) {
      const haystack = [property.address, ...property.keywords].join(" ").toLowerCase();
      if (!haystack.includes(keywordQuery)) return false;
    }

    if (filters.capRateMin !== null && roi.capRatePct < filters.capRateMin) return false;
    if (filters.cashOnCashMin !== null && roi.cashOnCashPct < filters.cashOnCashMin) return false;
    if (filters.monthlyCashFlowMin !== null && roi.monthlyCashFlow < filters.monthlyCashFlowMin)
      return false;
    if (filters.rentToPriceMin !== null && roi.rentToPricePct < filters.rentToPriceMin) return false;
    if (filters.unitCountMin !== null && property.unitCount < filters.unitCountMin) return false;
    if (filters.meetsTargetOnly && !roi.meetsRequiredReturn) return false;

    return true;
  });
}

export function sortListings(listings: EnrichedListing[], sort: SortState): EnrichedListing[] {
  const sorted = [...listings].sort((a, b) => {
    const getValue = (listing: EnrichedListing): number => {
      switch (sort.key) {
        case "price":
          return listing.property.price;
        case "capRatePct":
          return listing.roi.capRatePct;
        case "cashOnCashPct":
          return listing.roi.cashOnCashPct;
        case "monthlyCashFlow":
          return listing.roi.monthlyCashFlow;
        case "rentToPricePct":
          return listing.roi.rentToPricePct;
        case "monthlyRent":
          return listing.rentEstimate.monthlyRent;
        case "targetPrice":
          // Listings with no achievable target sink to the bottom either way.
          return listing.roi.targetPrice ?? (sort.direction === "asc" ? Infinity : -Infinity);
        case "daysOnMarket":
          return listing.property.daysOnMarket;
        default:
          return 0;
      }
    };
    const diff = getValue(a) - getValue(b);
    return sort.direction === "asc" ? diff : -diff;
  });
  return sorted;
}
