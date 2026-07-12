import { getCompsForProperty, getZipBaselineRent, MOCK_PROPERTIES, perUnitBeds } from "./mockData";
import { estimateRent } from "./rentEstimate";
import { computeROI } from "./roi";
import type {
  FinancingAssumptions,
  Property,
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
export function buildEnrichedListings(assumptions: FinancingAssumptions): EnrichedListing[] {
  return MOCK_PROPERTIES.map((property) => {
    const comps = getCompsForProperty(property);
    const zipBaseline = getZipBaselineRent(property.zip, perUnitBeds(property));
    const rentEstimate = estimateRent(property, comps, zipBaseline);
    const roi = computeROI(property, rentEstimate.monthlyRent, assumptions);
    return { property, rentEstimate, roi };
  });
}

// Same as buildEnrichedListings, but for live RentCast search results. Each
// property already carries a rentEstimate (zip-baseline, computed for free by
// /api/search) which can be swapped for a comps-based one via
// `rentOverrides` after the user fetches live comps for that property.
export function buildEnrichedListingsFromLive(
  entries: { property: Property; rentEstimate: RentEstimate }[],
  assumptions: FinancingAssumptions,
  rentOverrides: Record<string, RentEstimate>
): EnrichedListing[] {
  return entries.map(({ property, rentEstimate }) => {
    const effectiveRentEstimate = rentOverrides[property.id] ?? rentEstimate;
    const roi = computeROI(property, effectiveRentEstimate.monthlyRent, assumptions);
    return { property, rentEstimate: effectiveRentEstimate, roi };
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
      const haystack = `${property.city} ${property.state} ${property.zip}`.toLowerCase();
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
