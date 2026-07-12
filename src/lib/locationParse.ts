export interface ParsedLocation {
  city?: string;
  state?: string;
  zipCode?: string;
}

// Accepts "75217" or "Dallas, TX". Returns null if the text doesn't match
// either shape — RentCast's search requires one of these to be unambiguous.
export function parseLocationQuery(input: string): ParsedLocation | null {
  const trimmed = input.trim();
  if (/^\d{5}$/.test(trimmed)) {
    return { zipCode: trimmed };
  }

  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[0];
    const state = parts[1].toUpperCase();
    if (/^[A-Z]{2}$/.test(state)) {
      return { city, state };
    }
  }

  return null;
}
