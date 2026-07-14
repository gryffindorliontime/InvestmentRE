import type { HomeType, Property } from "./types";

// Approximate average annual homeowners-insurance premium by state for a
// ~$300K dwelling (demo-grade, directionally matching published 2024-25
// surveys: hail/wind states like OK/KS/NE/TX and hurricane states like FL/LA
// run far above coastal-west and northeast averages). Same spirit as the
// property-tax tables: realistic per-state levels, not quotes.
const STATE_AVG_PREMIUM: Record<string, number> = {
  AL: 2900, AK: 1300, AZ: 2000, AR: 3300, CA: 1600, CO: 3600, CT: 1800,
  DE: 1200, DC: 1300, FL: 5500, GA: 2400, HI: 1300, ID: 1700, IL: 2400,
  IN: 2300, IA: 2400, KS: 3900, KY: 3000, LA: 4300, ME: 1500, MD: 1800,
  MA: 1900, MI: 2400, MN: 2800, MS: 3600, MO: 3000, MT: 2600, NE: 4700,
  NV: 1300, NH: 1400, NJ: 1300, NM: 2300, NY: 1900, NC: 2400, ND: 2800,
  OH: 1800, OK: 5000, OR: 1500, PA: 1800, RI: 2000, SC: 2500, SD: 3100,
  TN: 2800, TX: 4400, UT: 1500, VA: 2000, VT: 1400, WA: 1600, WV: 2000,
  WI: 1700, WY: 1900,
};

const DEFAULT_PREMIUM = 2000;
const BASELINE_HOME_VALUE = 300_000;

// Premiums track replacement cost, which loosely tracks price. Condos carry
// HO-6 policies (the HOA master policy covers the structure); multifamily
// needs landlord/commercial coverage; land is liability-only.
const HOME_TYPE_INSURANCE_FACTOR: Record<HomeType, number> = {
  "Single Family": 1.0,
  "Multi-Family (2-4 unit)": 1.3,
  "Multi-Family (5+ unit)": 1.6,
  Condo: 0.35,
  Townhouse: 0.9,
  Manufactured: 0.85,
  Land: 0.1,
};

export interface InsuranceEstimate {
  annual: number;
  source: "state" | "default";
}

export function estimateAnnualInsurance(property: Property): InsuranceEstimate {
  const statePremium = STATE_AVG_PREMIUM[property.state];
  const base = statePremium ?? DEFAULT_PREMIUM;
  const typeFactor = HOME_TYPE_INSURANCE_FACTOR[property.homeType] ?? 1;
  // Scale with price as a replacement-cost proxy, clamped so extreme listing
  // prices don't produce absurd premiums.
  const valueScale = Math.min(3, Math.max(0.5, property.price / BASELINE_HOME_VALUE));
  return {
    annual: Math.round(base * typeFactor * valueScale),
    source: statePremium !== undefined ? "state" : "default",
  };
}
