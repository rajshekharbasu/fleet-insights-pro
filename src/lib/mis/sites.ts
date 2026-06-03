/** Operational sites / depots — each can have its own MIS templates and routes */

export interface MisSite {
  id: string;
  name: string;
  zone: string;
}

export const MIS_SITES: MisSite[] = [
  { id: "khapri", name: "Khapri", zone: "North" },
  { id: "wadi", name: "Wadi", zone: "Central" },
  { id: "mihan", name: "MIHAN", zone: "East" },
  { id: "bkc", name: "BKC Mumbai", zone: "West" },
  { id: "mbm", name: "MBM", zone: "South" },
  { id: "kandla", name: "Kandla", zone: "West" },
];

export function misSiteById(id: string): MisSite | undefined {
  return MIS_SITES.find((s) => s.id === id);
}

/** Default route prefixes seeded per site (editable in template) */
export const DEFAULT_SITE_ROUTES: Record<string, string[]> = {
  khapri: ["RT-101", "RT-205"],
  wadi: ["RT-318"],
  mihan: ["RT-422"],
  bkc: ["RT-101", "RT-318"],
  mbm: ["RT-205", "RT-422"],
  kandla: ["RT-422"],
};
