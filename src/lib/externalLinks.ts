import type { Property } from "./types";

// We don't have real Zillow/Realtor.com listing IDs for mock (or RentCast) data,
// so these build the standard public address-search URLs both sites support —
// they resolve to the matching listing when one exists, or a search results
// page otherwise. Safe to link to directly; no scraping involved.

function slugify(part: string): string {
  return part
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function buildZillowSearchUrl(property: Property): string {
  const slug = [
    slugify(property.address),
    slugify(property.city),
    property.state,
    property.zip,
  ].join("-");
  return `https://www.zillow.com/homes/${slug}_rb/`;
}

// Realtor.com property pages require their internal listing id (the
// "_M12345-67890" suffix on realestateandhomes-detail URLs), which RentCast
// doesn't provide, and their search path only accepts city/zip locations —
// an address slug lands on a dead search. A site-scoped Google search on the
// exact address is the reliable way to reach the listing's profile page.
export function buildRealtorSearchUrl(property: Property): string {
  // Exact-phrase match on the street address only — unit designators after
  // the comma ("Apt 303", "# Ab") are written inconsistently across sites
  // and would over-constrain the phrase.
  const streetPart = property.address.split(",")[0].trim();
  const query = `site:realtor.com "${streetPart}" ${property.city} ${property.state}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
