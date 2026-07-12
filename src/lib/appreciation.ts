import type { HomeType, Property } from "./types";

// Annual home-price appreciation assumptions. Like the rent baselines in
// mockData.ts, these are rough demo approximations of long-run regional
// trends, not authoritative forecasts.

// State-level regional appreciation rates (annual, as fractions).
const REGIONAL_APPRECIATION: Record<string, number> = {
  WA: 0.048, OR: 0.042, CA: 0.05, NV: 0.045, AZ: 0.046, CO: 0.044, UT: 0.047,
  ID: 0.046, NM: 0.035, TX: 0.042, OK: 0.03, AR: 0.031, LA: 0.025,
  IL: 0.028, MN: 0.034, WI: 0.033, MI: 0.032, IN: 0.033, OH: 0.033,
  MO: 0.031, NE: 0.032, IA: 0.029, KS: 0.03, ND: 0.028, SD: 0.031,
  GA: 0.043, TN: 0.044, NC: 0.045, SC: 0.042, FL: 0.047, AL: 0.033,
  MS: 0.026, KY: 0.031, WV: 0.024, VA: 0.038, MD: 0.033, DC: 0.035,
  DE: 0.034, NJ: 0.038, NY: 0.036, PA: 0.031, CT: 0.033, RI: 0.038,
  MA: 0.042, NH: 0.041, VT: 0.035, ME: 0.038, MT: 0.042, WY: 0.033,
  AK: 0.026, HI: 0.04,
};

const DEFAULT_REGIONAL = 0.035;

// National appreciation tendency by home style, blended with the regional
// rate below. Manufactured homes historically appreciate much slower (the
// structure depreciates; land carries the value); land itself is volatile
// but trends above SFR in growth corridors; condos lag SFR slightly.
const HOME_TYPE_APPRECIATION: Record<HomeType, number> = {
  "Single Family": 0.04,
  "Multi-Family (2-4 unit)": 0.042,
  "Multi-Family (5+ unit)": 0.043,
  Condo: 0.033,
  Townhouse: 0.037,
  Manufactured: 0.015,
  Land: 0.045,
};

const REGIONAL_WEIGHT = 0.7;
const HOME_TYPE_WEIGHT = 0.3;

export interface AppreciationBlend {
  regionalPct: number; // the state-level rate
  homeTypePct: number; // the national rate for this home style
  blendedPct: number; // 70/30 weighted blend, used by projections
}

export function getAppreciationBlend(property: Property): AppreciationBlend {
  const regionalPct = REGIONAL_APPRECIATION[property.state] ?? DEFAULT_REGIONAL;
  const homeTypePct = HOME_TYPE_APPRECIATION[property.homeType] ?? 0.035;
  const blendedPct = REGIONAL_WEIGHT * regionalPct + HOME_TYPE_WEIGHT * homeTypePct;
  return { regionalPct, homeTypePct, blendedPct };
}
