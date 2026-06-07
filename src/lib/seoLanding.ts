// Slug helpers for SEO landing pages (state + discipline).
import { COURSE_CATALOG } from "@/lib/courseCatalog";

export const US_STATES: Array<{ code: string; name: string; slug: string }> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "District of Columbia"],
].map(([code, name]) => ({ code, name, slug: name.toLowerCase().replace(/\s+/g, "-") }));

export const stateBySlug = (slug: string) =>
  US_STATES.find((s) => s.slug === slug.toLowerCase());

export const stateMatches = (courseState: string | undefined, target: { code: string; name: string }) => {
  if (!courseState) return false;
  const s = courseState.trim();
  return s.toLowerCase() === target.name.toLowerCase() || s.toUpperCase() === target.code;
};

export const disciplineSlug = (key: string) =>
  key.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const disciplineBySlug = (slug: string) =>
  COURSE_CATALOG.find((c) => disciplineSlug(c.key) === slug.toLowerCase());
