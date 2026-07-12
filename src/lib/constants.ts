import type { HomeType, ListingStatus, SearchFilters } from "./types";

export const HOME_TYPES: HomeType[] = [
  "Single Family",
  "Multi-Family (2-4 unit)",
  "Multi-Family (5+ unit)",
  "Condo",
  "Townhouse",
  "Manufactured",
  "Land",
];

export const LISTING_STATUSES: ListingStatus[] = [
  "For Sale",
  "Pending",
  "Coming Soon",
  "Recently Sold",
];

export const DEFAULT_FILTERS: SearchFilters = {
  location: "",
  states: [],
  price: { min: null, max: null },
  homeTypes: [],
  bedsMin: null,
  bathsMin: null,
  sqft: { min: null, max: null },
  lotSqft: { min: null, max: null },
  yearBuilt: { min: null, max: null },
  daysOnMarketMax: null,
  status: [],
  hoaMax: null,
  pricePerSqft: { min: null, max: null },
  parkingMin: null,
  basementOnly: false,
  keyword: "",
  capRateMin: null,
  cashOnCashMin: null,
  monthlyCashFlowMin: null,
  rentToPriceMin: null,
  unitCountMin: null,
};
