import { CITY_TAX_RATES } from "./mockData";
import type { Property } from "./types";

// Effective annual property tax rates (tax paid / market value). Resolution
// order: actual tax from the listing → city rate (metro table below) → state
// average → 1% default. Demo-grade data — real rates vary by county, school
// district, and exemptions.
const STATE_PROPERTY_TAX_RATES: Record<string, number> = {
  NJ: 0.0223, IL: 0.0208, NH: 0.0193, VT: 0.0183, CT: 0.0179, TX: 0.0168,
  NE: 0.0163, WI: 0.0161, OH: 0.0159, IA: 0.0152, PA: 0.0149, NY: 0.014,
  RI: 0.014, MI: 0.0138, KS: 0.0134, ME: 0.0124, SD: 0.0117, MA: 0.0114,
  MN: 0.0111, AK: 0.0107, MD: 0.0105, ND: 0.0098, OR: 0.0093, MO: 0.0091,
  WA: 0.0087, VA: 0.0087, OK: 0.0085, IN: 0.0083, KY: 0.0083, GA: 0.0081,
  FL: 0.008, MS: 0.0075, CA: 0.0075, MT: 0.0074, NC: 0.0073, NM: 0.0067,
  AR: 0.0061, TN: 0.0058, DC: 0.0057, AZ: 0.0056, ID: 0.0056, UT: 0.0055,
  WV: 0.0055, NV: 0.0055, WY: 0.0055, SC: 0.0053, DE: 0.0053, LA: 0.0051,
  CO: 0.0045, AL: 0.0038, HI: 0.0027,
};

const DEFAULT_TAX_RATE = 0.01;

export interface TaxRateSource {
  rate: number;
  source: "city" | "state" | "default";
}

export function getLocalTaxRate(city: string, state: string): TaxRateSource {
  const cityRate = CITY_TAX_RATES[`${city}|${state}`];
  if (cityRate !== undefined) return { rate: cityRate, source: "city" };
  const stateRate = STATE_PROPERTY_TAX_RATES[state];
  if (stateRate !== undefined) return { rate: stateRate, source: "state" };
  return { rate: DEFAULT_TAX_RATE, source: "default" };
}

// Actual tax bill when the listing reports one, otherwise estimated from the
// property's city (or state) rate.
export function estimateAnnualPropertyTax(property: Property): number {
  if (property.annualPropertyTax !== undefined) return property.annualPropertyTax;
  return Math.round(property.price * getLocalTaxRate(property.city, property.state).rate);
}
