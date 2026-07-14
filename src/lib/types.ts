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
  // County name without the "County" suffix (e.g. "Collin"). Only known for
  // live RentCast listings.
  county?: string;
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
  // Known for mock data at generation time; for live listings it's filled in
  // when the user fetches the county tax record (RentCast /properties).
  // Absent → estimated from city/state rates in roi.ts.
  annualPropertyTax?: number;
  // County record history (RentCast /properties), newest year first. Present
  // only after an on-demand tax-record fetch.
  taxHistory?: TaxYearRecord[];
  assessmentHistory?: AssessmentYearRecord[];
  // FEMA flood zone for the property's coordinates. Present only after an
  // on-demand flood-zone lookup (free FEMA API, works for any listing).
  floodZone?: FloodZoneInfo;
  // MLS contact info (live listings only).
  listingAgent?: ListingContact;
  listingOffice?: ListingContact;
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

// One tax year from the county assessor, via RentCast property records
// (propertyTaxes[YYYY] in their schema).
export interface TaxYearRecord {
  year: number;
  total: number; // total annual tax bill for that year
}

// One assessment year (taxAssessments[YYYY]): assessed value split into land
// and improvements (building structures).
export interface AssessmentYearRecord {
  year: number;
  value: number;
  land?: number;
  improvements?: number;
}

// Parsed result of a RentCast /properties tax lookup for one address.
export interface PropertyTaxRecord {
  // Most recent year's total tax bill — undefined when the county reported
  // assessments but no tax amounts.
  annualPropertyTax?: number;
  taxHistory: TaxYearRecord[]; // newest first
  assessmentHistory: AssessmentYearRecord[]; // newest first
}

// Listing agent / brokerage contact details, as reported by the MLS via
// RentCast. Only present on live listings.
export interface ListingContact {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export type FloodRiskLevel = "High" | "Moderate" | "Minimal" | "Undetermined";

// FEMA National Flood Hazard Layer result for a property's coordinates.
export interface FloodZoneInfo {
  zone: string; // FIRM zone code, e.g. "AE", "VE", "X"
  subtype?: string; // e.g. "0.2 PCT ANNUAL CHANCE FLOOD HAZARD", "FLOODWAY"
  riskLevel: FloodRiskLevel;
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
  // Total monthly rent for the whole property (all units combined) — this is
  // what ROI math (roi.ts) uses. For a single-unit property it equals
  // perUnitMonthlyRent.
  monthlyRent: number;
  perUnitMonthlyRent: number;
  method: RentEstimateMethod;
  compsUsed: RentComp[];
  compsWeight: number; // 0-1, share of the blended estimate coming from comps
  buildingWeight: number;
  zipBaselineWeight: number;
  zipBaselineMonthlyRent: number;
  confidence: "high" | "medium" | "low";
  // RentCast's AVM error bar around monthlyRent — present only on live
  // comps-based estimates (the local blend has no modeled range).
  rentRangeLow?: number;
  rentRangeHigh?: number;
}

export interface FinancingAssumptions {
  downPaymentPct: number; // e.g. 0.20
  interestRatePct: number; // e.g. 0.0675
  loanTermYears: number; // e.g. 30
  closingCostsPct: number; // e.g. 0.03, applied to price
  vacancyPct: number; // e.g. 0.05, applied to gross rent
  maintenanceCapexPct: number; // e.g. 0.10, applied to gross rent
  propertyMgmtPct: number; // e.g. 0.08, applied to gross rent (0 to disable)
  // Flat $/yr override; null = estimate per listing from state averages and
  // home type/value (lib/insurance.ts).
  annualInsuranceEstimate: number | null;
  // (Property tax is not an assumption: it comes from the listing when
  // reported, otherwise it's estimated per city/state in lib/propertyTax.ts.)
  rentGrowthPct: number; // e.g. 0.03, annual rent/NOI growth used in multi-year projections
  sellingCostsPct: number; // e.g. 0.06, agent commission + closing costs on the eventual sale
  // Target cash-on-cash return used to reverse-solve each listing's
  // "price to hit target" and the meets-target shortlist filter.
  requiredReturnPct: number; // e.g. 0.08
}

export interface ROIResult {
  monthlyRent: number;
  annualRent: number;
  annualPropertyTax: number; // actual from listing, or city/state estimate
  annualInsurance: number; // user override, or local estimate (lib/insurance.ts)
  insuranceSource: "override" | "state" | "default";
  // Purchase price at which this listing would hit the required
  // cash-on-cash return under the same assumptions and rent. Null when no
  // price achieves it (rent can't cover the price-independent costs).
  targetPrice: number | null;
  // True when the asking price already meets the required return.
  meetsRequiredReturn: boolean;
  annualOperatingExpenses: number;
  noi: number; // net operating income (annual)
  capRatePct: number;
  grossYieldPct: number;
  rentToPricePct: number;
  loanAmount: number;
  downPaymentAmount: number;
  closingCosts: number;
  totalCashInvested: number;
  loanToValuePct: number;
  monthlyMortgagePI: number;
  // First payment's split — the interest/principal mix shifts every month,
  // this is just the starting point (most front-loaded toward interest).
  firstMonthInterest: number;
  firstMonthPrincipal: number;
  totalInterestOverLoanTerm: number;
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
  states: string[]; // 2-letter state codes, e.g. "TX" — empty means all states
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
  // Shortlist: only listings whose asking price already meets the required
  // return (assumptions.requiredReturnPct).
  meetsTargetOnly: boolean;
}

export type SortKey =
  | "price"
  | "capRatePct"
  | "cashOnCashPct"
  | "monthlyCashFlow"
  | "rentToPricePct"
  | "monthlyRent"
  | "targetPrice"
  | "daysOnMarket";

export interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}
