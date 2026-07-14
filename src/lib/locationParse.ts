export interface ParsedLocation {
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string; // "Collin County, TX" → county: "Collin", state: "TX"
}

// Accepts "75217", "Dallas, TX" (towns count as cities), or
// "Collin County, TX". Returns null if the text doesn't match any of these
// shapes. RentCast's search has no county parameter, so a county result
// means "search the state, then filter by each listing's county field".
export function parseLocationQuery(input: string): ParsedLocation | null {
  const trimmed = input.trim();
  if (/^\d{5}$/.test(trimmed)) {
    return { zipCode: trimmed };
  }

  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const place = parts[0];
    const state = parts[1].toUpperCase();
    if (/^[A-Z]{2}$/.test(state)) {
      const countyMatch = place.match(/^(.+?)\s+county$/i);
      if (countyMatch) {
        return { county: countyMatch[1], state };
      }
      return { city: place, state };
    }
  }

  return null;
}
