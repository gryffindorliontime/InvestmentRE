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

export function buildRealtorSearchUrl(property: Property): string {
  const slug = [
    slugify(property.address),
    slugify(property.city),
    property.state,
    property.zip,
  ].join("_");
  return `https://www.realtor.com/realestateandhomes-search/${slug}`;
}
