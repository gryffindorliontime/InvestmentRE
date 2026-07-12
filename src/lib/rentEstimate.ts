import type { Property, RentComp, RentEstimate } from "./types";

const MIN_COMPS_FOR_FULL_WEIGHT = 5;
const COMPS_BLEND_WEIGHT = 0.7;
const ZIP_BLEND_WEIGHT = 0.3;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Tiered/blended rent model per PRD section 6.1:
 *   1. Building/complex rent-roll data, when available, is preferred over generic comps.
 *   2. Otherwise, comps-based estimate blends with the zip baseline: 70/30 when
 *      the comp sample size is >= 5, falling back to 100% zip baseline below that.
 * Every result reports which method(s) contributed and a confidence tier so the UI
 * never presents a thin-sample guess with the same visual weight as a strong comp set.
 */
export function estimateRent(
  property: Property,
  comps: RentComp[],
  zipBaselineMonthlyRent: number
): RentEstimate {
  if (property.homeType === "Land") {
    return {
      monthlyRent: 0,
      method: "zip-baseline",
      compsUsed: [],
      compsWeight: 0,
      buildingWeight: 0,
      zipBaselineWeight: 0,
      zipBaselineMonthlyRent: 0,
      confidence: "low",
    };
  }

  if (property.buildingRentRoll && property.buildingRentRoll.unitRents.length > 0) {
    const buildingAvg =
      property.buildingRentRoll.unitRents.reduce((sum, r) => sum + r, 0) /
      property.buildingRentRoll.unitRents.length;

    return {
      monthlyRent: Math.round(buildingAvg),
      method: "building",
      compsUsed: comps,
      compsWeight: 0,
      buildingWeight: 1,
      zipBaselineWeight: 0,
      zipBaselineMonthlyRent,
      confidence: property.buildingRentRoll.unitRents.length >= 3 ? "high" : "medium",
    };
  }

  if (comps.length >= MIN_COMPS_FOR_FULL_WEIGHT) {
    const compsMedianRent = median(comps.map((c) => c.monthlyRent));
    const blended =
      compsMedianRent * COMPS_BLEND_WEIGHT + zipBaselineMonthlyRent * ZIP_BLEND_WEIGHT;

    return {
      monthlyRent: Math.round(blended),
      method: "blended",
      compsUsed: comps,
      compsWeight: COMPS_BLEND_WEIGHT,
      buildingWeight: 0,
      zipBaselineWeight: ZIP_BLEND_WEIGHT,
      zipBaselineMonthlyRent,
      confidence: comps.length >= 8 ? "high" : "medium",
    };
  }

  // Sparse or no comps: fall back entirely to the zip/metro baseline.
  return {
    monthlyRent: Math.round(zipBaselineMonthlyRent),
    method: "zip-baseline",
    compsUsed: comps,
    compsWeight: 0,
    buildingWeight: 0,
    zipBaselineWeight: 1,
    zipBaselineMonthlyRent,
    confidence: "low",
  };
}
