import { getAppreciationBlend, type AppreciationBlend } from "./appreciation";
import type { FinancingAssumptions, Property, ROIResult } from "./types";

export interface ProjectionYear {
  year: number;
  propertyValue: number;
  loanBalance: number;
  equity: number; // value - balance
  annualCashFlow: number; // NOI (grown) - debt service for this year
  cumulativeCashFlow: number;
  netSaleProceeds: number; // if sold at end of this year: value*(1-sellingCosts) - balance
  totalProfitIfSold: number; // cumulative CF + sale proceeds - cash invested
  irrIfSoldPct: number | null; // annualized IRR if sold at end of this year
}

export interface Projection {
  appreciation: AppreciationBlend;
  years: ProjectionYear[];
}

// Remaining balance after `monthsPaid` months of a fully-amortizing loan.
function remainingBalance(
  loanAmount: number,
  annualRatePct: number,
  termYears: number,
  monthsPaid: number
): number {
  if (loanAmount <= 0) return 0;
  // Term of 0 is treated as "no payments" throughout the app (see roi.ts) —
  // the balance just sits there until sale pays it off.
  if (termYears <= 0) return loanAmount;
  const n = termYears * 12;
  const m = Math.min(monthsPaid, n);
  const r = annualRatePct / 12;
  if (r === 0) return loanAmount * (1 - m / n);
  const factorN = Math.pow(1 + r, n);
  const factorM = Math.pow(1 + r, m);
  const payment = (loanAmount * r * factorN) / (factorN - 1);
  return loanAmount * factorM - (payment * (factorM - 1)) / r;
}

// IRR via bisection on the NPV of yearly cash flows (flows[0] is the initial
// outlay, negative). Returns null when no sign change exists in the bracket
// (e.g. every flow negative — the deal never returns money).
function irr(flows: number[]): number | null {
  const npv = (rate: number) =>
    flows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  let lo = -0.95;
  let hi = 5;
  let npvLo = npv(lo);
  const npvHi = npv(hi);
  if (npvLo * npvHi > 0) return null;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-7) return mid;
    if (npvLo * npvMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      npvLo = npvMid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Projects the investment over `horizonYears`, growing NOI at the rent-growth
 * assumption and property value at the property's blended regional/home-style
 * appreciation rate. Simplifications (documented for transparency): all
 * operating expenses are grown together with rent inside NOI rather than
 * itemized per year, and the loan payment is fixed-rate for the full term.
 */
export function buildProjection(
  property: Property,
  roi: ROIResult,
  assumptions: FinancingAssumptions,
  horizonYears = 10
): Projection {
  const appreciation = getAppreciationBlend(property);
  const annualDebtServiceFull = roi.monthlyMortgagePI * 12;
  const years: ProjectionYear[] = [];

  let cumulativeCashFlow = 0;
  const cashFlows: number[] = [-roi.totalCashInvested];

  for (let year = 1; year <= horizonYears; year++) {
    const noi = roi.noi * Math.pow(1 + assumptions.rentGrowthPct, year - 1);
    // After the loan is paid off, debt service stops.
    const loanActive = assumptions.loanTermYears > 0 && year <= assumptions.loanTermYears;
    const annualCashFlow = noi - (loanActive ? annualDebtServiceFull : 0);
    cumulativeCashFlow += annualCashFlow;

    const propertyValue = property.price * Math.pow(1 + appreciation.blendedPct, year);
    const loanBalance = remainingBalance(
      roi.loanAmount,
      assumptions.interestRatePct,
      assumptions.loanTermYears,
      year * 12
    );
    const equity = propertyValue - loanBalance;
    const netSaleProceeds = propertyValue * (1 - assumptions.sellingCostsPct) - loanBalance;
    const totalProfitIfSold = cumulativeCashFlow + netSaleProceeds - roi.totalCashInvested;

    cashFlows.push(annualCashFlow);
    const flowsIfSold = [...cashFlows];
    flowsIfSold[year] += netSaleProceeds;
    const irrIfSold = irr(flowsIfSold);

    years.push({
      year,
      propertyValue,
      loanBalance,
      equity,
      annualCashFlow,
      cumulativeCashFlow,
      netSaleProceeds,
      totalProfitIfSold,
      irrIfSoldPct: irrIfSold === null ? null : irrIfSold * 100,
    });
  }

  return { appreciation, years };
}
