const COUNTY_DB: Record<string, Array<{fips:string;name:string;state:string}>> = {
  "33914": [{ fips: "12071", name: "Lee County", state: "FL" }],
  "33901": [{ fips: "12071", name: "Lee County", state: "FL" }],
  "33125": [{ fips: "12086", name: "Miami-Dade", state: "FL" }],
  "33133": [{ fips: "12086", name: "Miami-Dade", state: "FL" }],
  "32801": [{ fips: "12095", name: "Orange County", state: "FL" }],
  "33602": [{ fips: "12057", name: "Hillsborough", state: "FL" }],
  "10001": [{ fips: "36061", name: "New York", state: "NY" }],
  "77001": [{ fips: "48201", name: "Harris County", state: "TX" }],
  "90210": [{ fips: "06037", name: "Los Angeles", state: "CA" }],
};
export function lookupCounties(zip: string) {
  if (COUNTY_DB[zip]) return COUNTY_DB[zip];
  if (/^\d{5}$/.test(zip)) return [];
  return [];
}
export const getFPL = (n: number) => 15650 + (n - 1) * 5500;
export const getFPLpct = (inc: number, n: number) => Math.round((inc / getFPL(n)) * 100);
