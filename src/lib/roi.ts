import { estimateAnnualInsurance } from "./insurance";
import { estimateAnnualPropertyTax, getLocalTaxRate } from "./propertyTax";
import type { FinancingAssumptions, Property, ROIResult } from "./types";

export const DEFAULT_ASSUMPTIONS: FinancingAssumptions = {
  downPaymentPct: 0.2,
  interestRatePct: 0.0675,
  loanTermYears: 30,
  closingCostsPct: 0.03,
  vacancyPct: 0.05,
  maintenanceCapexPct: 0.1,
  propertyMgmtPct: 0.08,
  annualInsuranceEstimate: null, // null = per-listing local estimate
  rentGrowthPct: 0.03,
  sellingCostsPct: 0.06,
  requiredReturnPct: 0.08,
};

function monthlyMortgagePayment(loanAmount: number, annualRatePct: number, termYears: number): number {
  // No loan (100% down) or a cleared/zero loan-term field: without this guard
  // the amortization formula divides by zero and Infinity cascades through
  // every cash-flow number in the UI.
  if (loanAmount <= 0 || termYears <= 0) return 0;
  const monthlyRate = annualRatePct / 12;
  const numPayments = termYears * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (loanAmount * monthlyRate * factor) / (factor - 1);
}

/**
 * Computes all investor ROI metrics for a property given an estimated monthly
 * rent and a set of financing/operating assumptions (PRD section 6.2).
 */
export function computeROI(
  property: Property,
  monthlyRent: number,
  assumptions: FinancingAssumptions = DEFAULT_ASSUMPTIONS
): ROIResult {
  const annualRent = monthlyRent * 12;

  const vacancyLoss = annualRent * assumptions.vacancyPct;
  const maintenanceCapex = annualRent * assumptions.maintenanceCapexPct;
  const propertyMgmt = annualRent * assumptions.propertyMgmtPct;
  const annualPropertyTax = estimateAnnualPropertyTax(property);
  const insuranceEstimate = estimateAnnualInsurance(property);
  const annualInsurance = assumptions.annualInsuranceEstimate ?? insuranceEstimate.annual;
  const insuranceSource: ROIResult["insuranceSource"] =
    assumptions.annualInsuranceEstimate !== null ? "override" : insuranceEstimate.source;
  const annualOperatingExpenses =
    annualPropertyTax +
    annualInsurance +
    vacancyLoss +
    maintenanceCapex +
    propertyMgmt +
    property.hoaMonthly * 12;

  const noi = annualRent - annualOperatingExpenses;
  const capRatePct = property.price > 0 ? (noi / property.price) * 100 : 0;
  const grossYieldPct = property.price > 0 ? (annualRent / property.price) * 100 : 0;
  const rentToPricePct = property.price > 0 ? (monthlyRent / property.price) * 100 : 0;

  // Clamp to [0, 100%]: a down payment typed as 150% would otherwise produce
  // a negative loan amount, whose "payment" comes out negative and silently
  // inflates cash flow with phantom income.
  const downPaymentPct = Math.min(1, Math.max(0, assumptions.downPaymentPct));
  const downPaymentAmount = property.price * downPaymentPct;
  const loanAmount = property.price - downPaymentAmount;
  const closingCosts = property.price * assumptions.closingCostsPct;
  const totalCashInvested = downPaymentAmount + closingCosts;

  const monthlyMortgagePI = monthlyMortgagePayment(
    loanAmount,
    assumptions.interestRatePct,
    assumptions.loanTermYears
  );
  const annualDebtService = monthlyMortgagePI * 12;

  const annualCashFlow = noi - annualDebtService;
  const monthlyCashFlow = annualCashFlow / 12;
  const cashOnCashPct = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

  const loanToValuePct = property.price > 0 ? (loanAmount / property.price) * 100 : 0;
  // When there's no payment (100% down, or loan term cleared to 0), the
  // amortization-derived fields are meaningless — zero them rather than
  // reporting interest on a loan that's never paid.
  const hasPayment = monthlyMortgagePI > 0;
  const monthlyRate = assumptions.interestRatePct / 12;
  const firstMonthInterest = hasPayment ? loanAmount * monthlyRate : 0;
  const firstMonthPrincipal = hasPayment ? monthlyMortgagePI - firstMonthInterest : 0;
  const totalInterestOverLoanTerm = hasPayment
    ? monthlyMortgagePI * assumptions.loanTermYears * 12 - loanAmount
    : 0;

  // ---- Price to hit the required cash-on-cash return ------------------------
  // Solve CoC(P) = t for purchase price P, holding rent, the expense
  // percentages, insurance, and HOA constant. Only tax and financing scale
  // with P:
  //   K            = rent-side constants = annualRent − vacancy − maint −
  //                  mgmt − HOA − insurance
  //   tax(P)       = r·P   (r from the listing's actual bill when known —
  //                  taxes get reassessed at sale — else the local rate)
  //   debt(P)      = P·(1−d)·A   (A = annual mortgage constant per $1)
  //   invested(P)  = P·(d+c)
  //   CoC = (K − rP − P(1−d)A) / (P(d+c)) = t
  //   ⇒ P* = K / (r + (1−d)·A + t·(d+c))
  const K = annualRent - vacancyLoss - maintenanceCapex - propertyMgmt -
    property.hoaMonthly * 12 - annualInsurance;
  const taxRate =
    property.annualPropertyTax !== undefined && property.price > 0
      ? property.annualPropertyTax / property.price
      : getLocalTaxRate(property.city, property.state).rate;
  const annualMortgageConstant =
    monthlyMortgagePayment(1, assumptions.interestRatePct, assumptions.loanTermYears) * 12;
  const targetDenominator =
    taxRate +
    (1 - downPaymentPct) * annualMortgageConstant +
    assumptions.requiredReturnPct * (downPaymentPct + assumptions.closingCostsPct);
  const targetPrice =
    K > 0 && targetDenominator > 0 ? Math.round(K / targetDenominator) : null;
  const meetsRequiredReturn =
    targetPrice !== null && property.price > 0 && property.price <= targetPrice;

  return {
    monthlyRent,
    annualRent,
    annualPropertyTax,
    annualInsurance,
    insuranceSource,
    targetPrice,
    meetsRequiredReturn,
    annualOperatingExpenses,
    noi,
    capRatePct,
    grossYieldPct,
    rentToPricePct,
    loanAmount,
    downPaymentAmount,
    closingCosts,
    totalCashInvested,
    loanToValuePct,
    monthlyMortgagePI,
    firstMonthInterest,
    firstMonthPrincipal,
    totalInterestOverLoanTerm,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCashPct,
  };
}
