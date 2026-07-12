// Domain types shared across filters, mock data, ROI math, and the RentCast client.

export type HomeType =
  | "Single Family"
  | "Multi-Family (2-4 unit)"
  | "Multi-Family (5+ unit)"
  | "Condo"
  | "Townhouse"
  | "Manufactured"
  | "Land";

export type ListingStatus = "For Sale" | "Pending" | "Coming Soon" | "Recently Sold";

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  price: number;
  homeType: HomeType;
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number;
  yearBuilt: number;
  daysOnMarket: number;
  status: ListingStatus;
  hoaMonthly: number;
  pricePerSqft: number;
  parkingSpots: number;
  hasBasement: boolean;
  unitCount: number; // 1 for SFR/condo, 2-4 or 5+ for multifamily
  // Not returned by RentCast's sale listings endpoint, so it's only known for
  // mock data. Live listings fall back to assumptions.propertyTaxPct in roi.ts.
  annualPropertyTax?: number;
  keywords: string[];
  photoUrl?: string;
  // Present only for known multi-family buildings with actual rent-roll data.
  buildingRentRoll?: {
    buildingName: string;
    unitRents: number[]; // monthly rent for each comparable unit in the building
  };
  // Defaults to "mock" when omitted (all MOCK_PROPERTIES entries).
  source?: "mock" | "rentcast";
}

// A nearby active rental listing used to build a comps-based rent estimate.
export interface RentComp {
  id: string;
  address: string;
  distanceMiles: number;
  beds: number;
  baths: number;
  sqft: number;
  monthlyRent: number;
  daysOnMarket: number;
}

export type RentEstimateMethod = "comps" | "building" | "zip-baseline" | "blended";

export interface RentEstimate {
  monthlyRent: number;
  method: RentEstimateMethod;
  compsUsed: RentComp[];
  compsWeight: number; // 0-1, share of the blended estimate coming from comps
  buildingWeight: number;
  zipBaselineWeight: number;
  zipBaselineMonthlyRent: number;
  confidence: "high" | "medium" | "low";
}

export interface FinancingAssumptions {
  downPaymentPct: number; // e.g. 0.20
  interestRatePct: number; // e.g. 0.0675
  loanTermYears: number; // e.g. 30
  closingCostsPct: number; // e.g. 0.03, applied to price
  vacancyPct: number; // e.g. 0.05, applied to gross rent
  maintenanceCapexPct: number; // e.g. 0.10, applied to gross rent
  propertyMgmtPct: number; // e.g. 0.08, applied to gross rent (0 to disable)
  annualInsuranceEstimate: number; // flat $/yr, editable
  propertyTaxPct: number; // e.g. 0.012, used as a fallback when property.annualPropertyTax is unknown (live listings)
}

export interface ROIResult {
  monthlyRent: number;
  annualRent: number;
  annualOperatingExpenses: number;
  noi: number; // net operating income (annual)
  capRatePct: number;
  grossYieldPct: number;
  rentToPricePct: number;
  loanAmount: number;
  downPaymentAmount: number;
  closingCosts: number;
  totalCashInvested: number;
  monthlyMortgagePI: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashPct: number;
}

export interface PriceRange {
  min: number | null;
  max: number | null;
}

export interface RangeFilter {
  min: number | null;
  max: number | null;
}

export interface SearchFilters {
  location: string; // free text: city, zip, or metro
  price: PriceRange;
  homeTypes: HomeType[];
  bedsMin: number | null;
  bathsMin: number | null;
  sqft: RangeFilter;
  lotSqft: RangeFilter;
  yearBuilt: RangeFilter;
  daysOnMarketMax: number | null;
  status: ListingStatus[];
  hoaMax: number | null;
  pricePerSqft: RangeFilter;
  parkingMin: number | null;
  basementOnly: boolean;
  keyword: string;
  // Investor-specific filters, computed from ROIResult per listing.
  capRateMin: number | null;
  cashOnCashMin: number | null;
  monthlyCashFlowMin: number | null;
  rentToPriceMin: number | null;
  unitCountMin: number | null;
}

export type SortKey =
  | "price"
  | "capRatePct"
  | "cashOnCashPct"
  | "monthlyCashFlow"
  | "rentToPricePct"
  | "monthlyRent"
  | "daysOnMarket";

export interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}
