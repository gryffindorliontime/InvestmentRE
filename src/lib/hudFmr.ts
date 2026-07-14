// HUD Fair Market Rents — real government data (huduser.gov), not an
// approximation. hudFmrData.json is a one-time conversion of HUD's public
// FY2026 county-level FMR spreadsheet (no API key required; HUD's live API
// needs a registered Bearer token, so this bakes in the same underlying
// numbers as a static asset instead). Regenerate by re-running the county
// xlsx through the same pivot when HUD publishes a new fiscal year.
import hudFmrData from "./hudFmrData.json";

type FmrTuple = [number, number, number, number, number]; // studio, 1br, 2br, 3br, 4br

const BY_COUNTY = hudFmrData.byCounty as unknown as Record<string, FmrTuple>;
const BY_STATE = hudFmrData.byState as unknown as Record<string, FmrTuple>;

function normalizeCounty(name: string): string {
  return name
    .replace(/\s+(county|parish|borough|census area|municipality)$/i, "")
    .trim()
    .toLowerCase();
}

// Converts HUD's 0-4br tuple into the app's bed-keyed (1-5) rent table
// shape. HUD tops out at 4br; 5+ is a linear extrapolation from the 3→4br
// step, consistent with how the mock dataset scales its own top tier.
function tupleToTable(fmr: FmrTuple): Record<number, number> {
  const [, br1, br2, br3, br4] = fmr;
  const step = br4 - br3;
  return { 1: br1, 2: br2, 3: br3, 4: br4, 5: Math.round(br4 + Math.max(step, 0)) };
}

export function getHudCountyTable(county: string, state: string): Record<number, number> | undefined {
  const fmr = BY_COUNTY[`${normalizeCounty(county)}|${state}`];
  return fmr ? tupleToTable(fmr) : undefined;
}

export function getHudStateTable(state: string): Record<number, number> | undefined {
  const fmr = BY_STATE[state];
  return fmr ? tupleToTable(fmr) : undefined;
}
