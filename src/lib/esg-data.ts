/**
 * ESG module — stub data layer (UI-only build).
 *
 * Everything here is placeholder data behind the interface. Where the real
 * system will compute/fetch/enforce, this file returns static values with the
 * same shape so screens can be built with honest empty/loading/error states.
 * Provenance stamps mark values that will later arrive from source systems.
 */

export const ESG_TODAY = new Date("2026-07-15T09:00:00+05:30");

/* ---------------------------------- scope --------------------------------- */

export type Depot = { id: string; name: string };
export type Entity = { id: string; name: string; short: string; depots: Depot[] };

export const ESG_GROUP = {
  id: "transvolt",
  name: "Transvolt Mobility",
  entities: [
    {
      id: "mbmt",
      name: "MBMT E-Bus Operations",
      short: "MBMT",
      depots: [
        { id: "bhayandar", name: "Bhayandar Depot" },
        { id: "kashimira", name: "Kashimira Depot" },
      ],
    },
    {
      id: "silvassa",
      name: "Silvassa City SPV",
      short: "Silvassa",
      depots: [{ id: "silvassa-depot", name: "Silvassa Depot" }],
    },
    {
      id: "corp",
      name: "Corporate (HQ)",
      short: "Corporate",
      depots: [{ id: "hq", name: "Andheri HQ" }],
    },
  ] as Entity[],
};

export type ScopeSel = { entityId?: string; depotId?: string };

export function scopeLabel(sel: ScopeSel): string {
  if (!sel.entityId) return ESG_GROUP.name;
  const e = ESG_GROUP.entities.find((x) => x.id === sel.entityId);
  if (!e) return ESG_GROUP.name;
  if (!sel.depotId) return e.name;
  const d = e.depots.find((x) => x.id === sel.depotId);
  return d ? `${e.short} · ${d.name}` : e.name;
}

/* --------------------------------- people --------------------------------- */

export type Person = { id: string; name: string; role: string };

export const PEOPLE: Person[] = [
  { id: "priya", name: "Priya Nair", role: "ESG Executive" },
  { id: "kavita", name: "Kavita Rao", role: "ESG Lead" },
  { id: "arjun", name: "Arjun Mehta", role: "Project Manager · MBMT" },
  { id: "rohan", name: "Rohan Desai", role: "Depot Manager · Kashimira" },
  { id: "sunil", name: "Sunil Patil", role: "Admin & Liaison" },
];

export const personById = (id: string) => PEOPLE.find((p) => p.id === id);

/* -------------------------------- glossary -------------------------------- */

export const GLOSSARY: Record<string, { full: string; note?: string }> = {
  ESG: { full: "Environmental, Social & Governance" },
  ESMS: { full: "Environmental & Social Management System" },
  ESDD: { full: "Environmental & Social Due Diligence", note: "Study for brownfield projects." },
  ESIA: { full: "Environmental & Social Impact Assessment", note: "Study for greenfield projects." },
  ESAP: { full: "Environmental & Social Action Plan", note: "Corrective actions from ESDD / ESIA findings." },
  AMR: { full: "Annual Monitoring Report", note: "Lender-defined input fields, reported periodically." },
  GHG: { full: "Greenhouse Gas", note: "Scope 1 / 2 / 3 emission accounting." },
  BRSR: { full: "Business Responsibility & Sustainability Reporting", note: "SEBI disclosure format." },
  NOC: { full: "No Objection Certificate" },
  CTO: { full: "Consent to Operate", note: "State pollution control board consent." },
  CTE: { full: "Consent to Establish" },
  COE: { full: "Certificate of Establishment", note: "Shops & Establishment registration." },
  ROC: { full: "Registrar of Companies" },
  "MOA/AOA": { full: "Memorandum & Articles of Association" },
  SWM: { full: "Solid Waste Management" },
  STP: { full: "Sewage Treatment Plant" },
  ETP: { full: "Effluent Treatment Plant" },
  PCC: { full: "Pollution Control Committee", note: "UT-level consent authority (Silvassa)." },
  ISO: { full: "International Organization for Standardization" },
  SPV: { full: "Special Purpose Vehicle" },
  DG: { full: "Diesel Generator" },
  CEA: { full: "Central Electricity Authority", note: "Publishes the grid emission factor." },
  DEFRA: { full: "UK Dept. for Environment, Food & Rural Affairs", note: "Emission-factor dataset." },
  EV: { full: "Electric Vehicle" },
  MBMT: { full: "Mira Bhayandar Municipal Transport" },
  DMS: { full: "Document Management System" },
  tCO2e: { full: "Tonnes of CO₂ equivalent" },
  SEBI: { full: "Securities and Exchange Board of India" },
  "O&M": { full: "Operations & Maintenance" },
};

/* ------------------------------- type master ------------------------------ */

export type ComplianceCategory = "permit" | "site";

export type ComplianceType = {
  key: string;
  label: string;
  category: ComplianceCategory;
  leadDays: number; // renewal alert window before expiry
  ownerRole: string;
};

export const TYPE_MASTER: ComplianceType[] = [
  { key: "incorporation", label: "Certificate of Incorporation", category: "permit", leadDays: 0, ownerRole: "Company Secretary" },
  { key: "roc-filing", label: "ROC Annual Filing", category: "permit", leadDays: 30, ownerRole: "Company Secretary" },
  { key: "moa-aoa", label: "MOA/AOA", category: "permit", leadDays: 0, ownerRole: "Company Secretary" },
  { key: "cto", label: "CTO — Consent to Operate", category: "permit", leadDays: 90, ownerRole: "ESG Executive" },
  { key: "coe", label: "COE — Certificate of Establishment", category: "permit", leadDays: 60, ownerRole: "Admin" },
  { key: "trade-licence", label: "Trade Licence", category: "permit", leadDays: 45, ownerRole: "Admin" },
  { key: "fire-noc", label: "Fire NOC", category: "site", leadDays: 60, ownerRole: "Depot Manager" },
  { key: "swm", label: "SWM Authorisation", category: "site", leadDays: 60, ownerRole: "ESG Executive" },
  { key: "stp", label: "STP Compliance Certificate", category: "site", leadDays: 45, ownerRole: "Depot Manager" },
  { key: "etp", label: "ETP Consent", category: "site", leadDays: 45, ownerRole: "Depot Manager" },
  { key: "pcc", label: "PCC Consent", category: "site", leadDays: 60, ownerRole: "ESG Executive" },
  { key: "iso-14001", label: "ISO 14001 (Environment)", category: "site", leadDays: 90, ownerRole: "ESG Lead" },
  { key: "iso-45001", label: "ISO 45001 (Health & Safety)", category: "site", leadDays: 90, ownerRole: "ESG Lead" },
  { key: "iso-9001", label: "ISO 9001 (Quality) — certification in progress", category: "site", leadDays: 90, ownerRole: "ESG Lead" },
  { key: "battery-disposal", label: "Battery Disposal Authorisation", category: "site", leadDays: 60, ownerRole: "ESG Executive" },
];

export const typeByKey = (k: string) => TYPE_MASTER.find((t) => t.key === k);

/* ------------------------------ compliance rec ----------------------------- */

export type Provenance = { source: string; fetchedAt: string; error?: string };

export type ComplianceRecord = {
  id: string;
  typeKey: string;
  entityId: string;
  depotId?: string;
  authority: string;
  refNo: string;
  issueDate: string; // ISO date
  expiryDate?: string; // undefined = perpetual (incorporation, MOA)
  ownerId: string;
  doc: { name: string; size: string; uploadedAt: string };
  autoFields?: { label: string; value: string; prov: Provenance }[];
  withheldExternal?: boolean; // curated out of external views by default
  remarks?: string; // mandatory when non-compliant
  renewal?: "none" | "initiated";
};

export const RECORDS: ComplianceRecord[] = [
  // ---- overdue (the risk stock) ----
  {
    id: "r-fire-kash",
    typeKey: "fire-noc",
    entityId: "mbmt",
    depotId: "kashimira",
    authority: "Maharashtra Fire Services",
    refNo: "FN/KSH/2025/118",
    issueDate: "2025-06-28",
    expiryDate: "2026-06-28",
    ownerId: "rohan",
    doc: { name: "fire-noc-kashimira-2025.pdf", size: "1.2 MB", uploadedAt: "2025-07-02" },
    withheldExternal: true,
    remarks:
      "Renewal application filed 30 Jun; fire dept inspection pending — hydrant pressure test failed on first visit, pump replacement ordered (ETA 22 Jul).",
    renewal: "initiated",
  },
  {
    id: "r-stp-bhy",
    typeKey: "stp",
    entityId: "mbmt",
    depotId: "bhayandar",
    authority: "MPCB",
    refNo: "STP/BHY/2025/44",
    issueDate: "2025-07-04",
    expiryDate: "2026-07-04",
    ownerId: "rohan",
    doc: { name: "stp-cert-bhayandar.pdf", size: "840 KB", uploadedAt: "2025-07-06" },
    withheldExternal: true,
    remarks: "Lab re-test of treated water sample scheduled 18 Jul; certificate renewal blocked until report.",
    renewal: "none",
  },
  {
    id: "r-roc-corp",
    typeKey: "roc-filing",
    entityId: "corp",
    depotId: "hq",
    authority: "MCA / ROC Mumbai",
    refNo: "AOC-4/2025-26",
    issueDate: "2025-07-31",
    expiryDate: "2026-06-30",
    ownerId: "sunil",
    doc: { name: "roc-aoc4-fy25.pdf", size: "2.1 MB", uploadedAt: "2025-08-02" },
    withheldExternal: true,
    remarks: "FY25-26 filing pending auditor sign-off; CS engaged, target 25 Jul.",
    renewal: "initiated",
  },
  {
    id: "r-ewaste-silv",
    typeKey: "battery-disposal",
    entityId: "silvassa",
    depotId: "silvassa-depot",
    authority: "DNH & DD PCC",
    refNo: "BD/SLV/2025/09",
    issueDate: "2025-05-30",
    expiryDate: "2026-06-30",
    ownerId: "priya",
    doc: { name: "battery-auth-silvassa.pdf", size: "660 KB", uploadedAt: "2025-06-01" },
    withheldExternal: true,
    remarks: "Authorised recycler contract lapsed with the permit; renewal filed together on 08 Jul.",
    renewal: "initiated",
  },
  // ---- expiring soon (inside lead window) ----
  {
    id: "r-fire-bhy",
    typeKey: "fire-noc",
    entityId: "mbmt",
    depotId: "bhayandar",
    authority: "Maharashtra Fire Services",
    refNo: "FN/BHY/2025/204",
    issueDate: "2025-08-05",
    expiryDate: "2026-08-05",
    ownerId: "rohan",
    doc: { name: "fire-noc-bhayandar-2025.pdf", size: "1.1 MB", uploadedAt: "2025-08-08" },
    renewal: "none",
  },
  {
    id: "r-cto-mbmt",
    typeKey: "cto",
    entityId: "mbmt",
    authority: "MPCB",
    refNo: "CTO/TH/2024/7761",
    issueDate: "2024-08-20",
    expiryDate: "2026-08-20",
    ownerId: "priya",
    doc: { name: "cto-mbmt-2024.pdf", size: "3.4 MB", uploadedAt: "2024-08-25" },
    autoFields: [
      {
        label: "Consented capacity (buses)",
        value: "220",
        prov: { source: "Asset register", fetchedAt: "2026-07-14T22:10:00Z" },
      },
    ],
    renewal: "initiated",
  },
  {
    id: "r-iso14001",
    typeKey: "iso-14001",
    entityId: "corp",
    authority: "TÜV SÜD",
    refNo: "ISO14K/IN/22-885",
    issueDate: "2023-09-10",
    expiryDate: "2026-09-10",
    ownerId: "kavita",
    doc: { name: "iso14001-cert.pdf", size: "540 KB", uploadedAt: "2023-09-15" },
    renewal: "none",
  },
  {
    id: "r-swm-silv",
    typeKey: "swm",
    entityId: "silvassa",
    depotId: "silvassa-depot",
    authority: "DNH & DD PCC",
    refNo: "SWM/SLV/2025/21",
    issueDate: "2025-08-30",
    expiryDate: "2026-08-30",
    ownerId: "priya",
    doc: { name: "swm-auth-silvassa.pdf", size: "720 KB", uploadedAt: "2025-09-01" },
    renewal: "none",
  },
  {
    id: "r-pcc-silv",
    typeKey: "pcc",
    entityId: "silvassa",
    authority: "DNH & DD PCC",
    refNo: "PCC/SLV/2024/133",
    issueDate: "2024-09-01",
    expiryDate: "2026-09-01",
    ownerId: "priya",
    doc: { name: "pcc-consent-silvassa.pdf", size: "1.6 MB", uploadedAt: "2024-09-04" },
    renewal: "none",
  },
  {
    id: "r-trade-bhy",
    typeKey: "trade-licence",
    entityId: "mbmt",
    depotId: "bhayandar",
    authority: "MBMC",
    refNo: "TL/2025/5521",
    issueDate: "2025-08-25",
    expiryDate: "2026-08-25",
    ownerId: "sunil",
    doc: { name: "trade-licence-bhy.pdf", size: "380 KB", uploadedAt: "2025-08-28" },
    renewal: "none",
  },
  // ---- valid ----
  {
    id: "r-fire-slv",
    typeKey: "fire-noc",
    entityId: "silvassa",
    depotId: "silvassa-depot",
    authority: "DNH Fire & Emergency",
    refNo: "FN/SLV/2026/031",
    issueDate: "2026-02-14",
    expiryDate: "2027-02-14",
    ownerId: "priya",
    doc: { name: "fire-noc-silvassa-2026.pdf", size: "980 KB", uploadedAt: "2026-02-16" },
  },
  {
    id: "r-cto-silv",
    typeKey: "cto",
    entityId: "silvassa",
    authority: "DNH & DD PCC",
    refNo: "CTO/SLV/2025/402",
    issueDate: "2025-11-12",
    expiryDate: "2027-11-12",
    ownerId: "priya",
    doc: { name: "cto-silvassa.pdf", size: "2.8 MB", uploadedAt: "2025-11-15" },
  },
  {
    id: "r-coe-hq",
    typeKey: "coe",
    entityId: "corp",
    depotId: "hq",
    authority: "BMC (Shops & Estab.)",
    refNo: "COE/MUM/2025/8812",
    issueDate: "2025-12-01",
    expiryDate: "2026-11-30",
    ownerId: "sunil",
    doc: { name: "coe-hq.pdf", size: "410 KB", uploadedAt: "2025-12-03" },
  },
  {
    id: "r-coe-bhy",
    typeKey: "coe",
    entityId: "mbmt",
    depotId: "bhayandar",
    authority: "MBMC (Shops & Estab.)",
    refNo: "COE/MBM/2026/112",
    issueDate: "2026-01-15",
    expiryDate: "2027-01-14",
    ownerId: "sunil",
    doc: { name: "coe-bhayandar.pdf", size: "395 KB", uploadedAt: "2026-01-17" },
  },
  {
    id: "r-etp-kash",
    typeKey: "etp",
    entityId: "mbmt",
    depotId: "kashimira",
    authority: "MPCB",
    refNo: "ETP/KSH/2026/07",
    issueDate: "2026-03-20",
    expiryDate: "2027-03-20",
    ownerId: "rohan",
    doc: { name: "etp-consent-kashimira.pdf", size: "1.0 MB", uploadedAt: "2026-03-22" },
    autoFields: [
      {
        label: "Effluent flow (KLD, monthly avg)",
        value: "8.4",
        prov: { source: "Depot water meter", fetchedAt: "2026-07-14T21:40:00Z" },
      },
    ],
  },
  {
    id: "r-swm-bhy",
    typeKey: "swm",
    entityId: "mbmt",
    depotId: "bhayandar",
    authority: "MPCB",
    refNo: "SWM/BHY/2026/18",
    issueDate: "2026-04-02",
    expiryDate: "2027-04-02",
    ownerId: "priya",
    doc: { name: "swm-auth-bhayandar.pdf", size: "700 KB", uploadedAt: "2026-04-05" },
  },
  {
    id: "r-iso45001",
    typeKey: "iso-45001",
    entityId: "corp",
    authority: "TÜV SÜD",
    refNo: "ISO45K/IN/24-102",
    issueDate: "2024-11-20",
    expiryDate: "2027-11-20",
    ownerId: "kavita",
    doc: { name: "iso45001-cert.pdf", size: "530 KB", uploadedAt: "2024-11-22" },
  },
  {
    id: "r-inc-corp",
    typeKey: "incorporation",
    entityId: "corp",
    authority: "MCA",
    refNo: "CIN U34300MH2021PTC366702",
    issueDate: "2021-09-14",
    ownerId: "sunil",
    doc: { name: "certificate-of-incorporation.pdf", size: "290 KB", uploadedAt: "2021-09-20" },
  },
  {
    id: "r-moa-corp",
    typeKey: "moa-aoa",
    entityId: "corp",
    authority: "MCA",
    refNo: "MOA/AOA v3 (2024 amendment)",
    issueDate: "2024-02-08",
    ownerId: "sunil",
    doc: { name: "moa-aoa-2024.pdf", size: "4.8 MB", uploadedAt: "2024-02-12" },
  },
  {
    id: "r-trade-kash",
    typeKey: "trade-licence",
    entityId: "mbmt",
    depotId: "kashimira",
    authority: "MBMC",
    refNo: "TL/2026/1108",
    issueDate: "2026-03-01",
    expiryDate: "2027-02-28",
    ownerId: "sunil",
    doc: { name: "trade-licence-kash.pdf", size: "365 KB", uploadedAt: "2026-03-03" },
  },
  {
    id: "r-etp-slv",
    typeKey: "etp",
    entityId: "silvassa",
    depotId: "silvassa-depot",
    authority: "DNH & DD PCC",
    refNo: "ETP/SLV/2026/03",
    issueDate: "2026-05-10",
    expiryDate: "2027-05-10",
    ownerId: "priya",
    doc: { name: "etp-consent-silvassa.pdf", size: "930 KB", uploadedAt: "2026-05-12" },
  },
  {
    id: "r-stp-kash",
    typeKey: "stp",
    entityId: "mbmt",
    depotId: "kashimira",
    authority: "MPCB",
    refNo: "STP/KSH/2026/12",
    issueDate: "2026-06-05",
    expiryDate: "2027-06-05",
    ownerId: "rohan",
    doc: { name: "stp-cert-kashimira.pdf", size: "810 KB", uploadedAt: "2026-06-06" },
  },
];

/* ------------------------------ state machine ----------------------------- */

export type EsgState = "valid" | "expiring" | "overdue";

export const STATE_META: Record<
  EsgState,
  { label: string; color: string; text: string }
> = {
  valid: { label: "Valid", color: "var(--color-success)", text: "text-success" },
  expiring: { label: "Expiring", color: "var(--color-warning)", text: "text-warning" },
  overdue: { label: "Overdue", color: "var(--color-destructive)", text: "text-destructive" },
};

export function daysUntil(iso: string, today = ESG_TODAY): number {
  const d = new Date(`${iso}T00:00:00+05:30`);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

export function recordState(r: ComplianceRecord, today = ESG_TODAY): EsgState {
  if (!r.expiryDate) return "valid"; // perpetual instruments
  const d = daysUntil(r.expiryDate, today);
  if (d < 0) return "overdue";
  const lead = typeByKey(r.typeKey)?.leadDays ?? 60;
  return d <= lead ? "expiring" : "valid";
}

export function fmtDate(iso?: string): string {
  if (!iso) return "Perpetual";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function countdownLabel(r: ComplianceRecord): string {
  if (!r.expiryDate) return "No expiry";
  const d = daysUntil(r.expiryDate);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Expires today";
  return `${d}d left`;
}

export function inScope(r: { entityId: string; depotId?: string }, sel: ScopeSel): boolean {
  if (sel.entityId && r.entityId !== sel.entityId) return false;
  if (sel.depotId && r.depotId !== sel.depotId) return false;
  return true;
}

export const entityById = (id: string) => ESG_GROUP.entities.find((e) => e.id === id);

export function recordPlace(r: ComplianceRecord): string {
  const e = entityById(r.entityId);
  if (!e) return r.entityId;
  if (!r.depotId) return e.short;
  const d = e.depots.find((x) => x.id === r.depotId);
  if (!d) return e.short;
  const depotShort = d.name.replace(" Depot", "");
  return depotShort === e.short ? e.short : `${e.short} · ${depotShort}`;
}

/* ------------------------------- ESMS content ------------------------------ */

export type Policy = {
  id: string;
  name: string;
  entityId: string;
  version: string;
  status: "approved" | "under-review" | "draft";
  updated: string;
  ownerId: string;
};

export const POLICIES: Policy[] = [
  { id: "p-esg", name: "ESG Policy", entityId: "corp", version: "v3.0", status: "approved", updated: "2026-01-20", ownerId: "kavita" },
  { id: "p-ehs", name: "Environment, Health & Safety Policy", entityId: "corp", version: "v2.4", status: "approved", updated: "2025-11-05", ownerId: "kavita" },
  { id: "p-hr", name: "Human Rights & Labour Policy", entityId: "corp", version: "v1.2", status: "under-review", updated: "2026-06-28", ownerId: "kavita" },
  { id: "p-grv", name: "Community Grievance Policy", entityId: "mbmt", version: "v1.0", status: "approved", updated: "2025-09-14", ownerId: "priya" },
  { id: "p-sup", name: "Supplier Code of Conduct", entityId: "corp", version: "v1.1", status: "draft", updated: "2026-07-08", ownerId: "priya" },
];

export type Sop = {
  id: string;
  name: string;
  entityId: string;
  activity: string;
  version: string;
  status: "approved" | "under-review" | "draft";
  updated: string;
};

export const SOPS: Sop[] = [
  { id: "s-bat", name: "HV Battery Handling & Storage", entityId: "mbmt", activity: "Workshop", version: "v2.1", status: "approved", updated: "2026-03-11" },
  { id: "s-chg", name: "Overnight Charging Bay Operations", entityId: "mbmt", activity: "Charging", version: "v1.4", status: "approved", updated: "2026-02-02" },
  { id: "s-spill", name: "Coolant & Oil Spill Response", entityId: "mbmt", activity: "Depot Ops", version: "v1.0", status: "under-review", updated: "2026-06-20" },
  { id: "s-fire", name: "Fire Drill & Evacuation", entityId: "silvassa", activity: "Depot Ops", version: "v1.2", status: "approved", updated: "2026-04-18" },
  { id: "s-waste", name: "Segregated Waste Handling", entityId: "silvassa", activity: "Depot Ops", version: "v1.0", status: "draft", updated: "2026-07-01" },
];

export type Assessment = {
  id: string;
  kind: "ESDD" | "ESIA";
  project: string;
  entityId: string;
  projectType: "brownfield" | "greenfield";
  status: "complete" | "in-progress";
  completedOn?: string;
  params: { name: string; result: "ok" | "gap" | "pending" }[];
  reportDoc?: string;
};

export const ASSESSMENTS: Assessment[] = [
  {
    id: "a-esdd-mbmt",
    kind: "ESDD",
    project: "MBMT depot electrification (brownfield)",
    entityId: "mbmt",
    projectType: "brownfield",
    status: "complete",
    completedOn: "2025-10-30",
    params: [
      { name: "Land title & lease review", result: "ok" },
      { name: "Fire safety adequacy", result: "gap" },
      { name: "Stormwater & drainage", result: "gap" },
      { name: "Labour accommodation audit", result: "ok" },
      { name: "Battery storage risk", result: "ok" },
    ],
    reportDoc: "esdd-mbmt-2025.pdf",
  },
  {
    id: "a-esia-silv",
    kind: "ESIA",
    project: "Silvassa greenfield depot",
    entityId: "silvassa",
    projectType: "greenfield",
    status: "complete",
    completedOn: "2025-06-15",
    params: [
      { name: "Baseline air & noise survey", result: "ok" },
      { name: "Tree cover & green belt plan", result: "gap" },
      { name: "Community consultation", result: "ok" },
      { name: "Traffic impact study", result: "ok" },
    ],
    reportDoc: "esia-silvassa-2025.pdf",
  },
  {
    id: "a-esdd-noida",
    kind: "ESDD",
    project: "Depot acquisition — due diligence (pipeline)",
    entityId: "corp",
    projectType: "brownfield",
    status: "in-progress",
    params: [
      { name: "Land title & lease review", result: "pending" },
      { name: "Fire safety adequacy", result: "pending" },
      { name: "Soil contamination screen", result: "pending" },
    ],
  },
];

export type EsapAction = {
  id: string;
  assessmentId: string;
  finding: string;
  action: string;
  ownerId: string;
  due: string;
  status: "open" | "in-progress" | "closed";
  closedOn?: string;
};

export const ESAP_ACTIONS: EsapAction[] = [
  {
    id: "e-1",
    assessmentId: "a-esdd-mbmt",
    finding: "Fire safety adequacy — hydrant coverage short at Kashimira",
    action: "Install 2 additional hydrant points; re-run pressure test",
    ownerId: "rohan",
    due: "2026-07-10",
    status: "in-progress",
  },
  {
    id: "e-2",
    assessmentId: "a-esdd-mbmt",
    finding: "Stormwater & drainage — wash-bay runoff uncontained",
    action: "Construct interceptor channel + oil-water separator",
    ownerId: "arjun",
    due: "2026-08-15",
    status: "open",
  },
  {
    id: "e-3",
    assessmentId: "a-esia-silv",
    finding: "Green belt plan — 120 saplings pending vs. commitment",
    action: "Complete monsoon plantation drive, geo-tag saplings",
    ownerId: "priya",
    due: "2026-07-31",
    status: "in-progress",
  },
  {
    id: "e-4",
    assessmentId: "a-esdd-mbmt",
    finding: "Battery storage — quarantine bay signage & SOP display",
    action: "Install signage; laminate SOP at bay entrance",
    ownerId: "rohan",
    due: "2026-05-30",
    status: "closed",
    closedOn: "2026-05-21",
  },
  {
    id: "e-5",
    assessmentId: "a-esia-silv",
    finding: "Community consultation — grievance register digitisation",
    action: "Move paper register to shared tracker; monthly review",
    ownerId: "priya",
    due: "2026-06-30",
    status: "open",
  },
  {
    id: "e-6",
    assessmentId: "a-esdd-mbmt",
    finding: "Labour — contractor PF/ESIC evidence collection",
    action: "Collect quarterly challans from all 4 contractors",
    ownerId: "sunil",
    due: "2026-09-30",
    status: "open",
  },
];

export function esapState(a: EsapAction): "closed" | "overdue" | "open" {
  if (a.status === "closed") return "closed";
  return daysUntil(a.due) < 0 ? "overdue" : "open";
}

/* --------------------------------- periods -------------------------------- */

export const PERIODS = [
  { id: "2026-07", label: "Jul 2026" },
  { id: "2026-06", label: "Jun 2026" },
  { id: "2026-05", label: "May 2026" },
];

/* ----------------------------------- AMR ----------------------------------- */

export type AmrField = {
  id: string;
  label: string;
  unit: string;
  mode: "manual" | "auto";
  source?: string;
};

export const AMR_FIELDS: AmrField[] = [
  { id: "km", label: "Fleet km operated", unit: "km", mode: "auto", source: "Telematics" },
  { id: "energy", label: "Charging energy drawn", unit: "kWh", mode: "auto", source: "Energy meters" },
  { id: "water", label: "Water consumption", unit: "KL", mode: "auto", source: "Depot water meter" },
  { id: "diesel", label: "DG diesel consumed", unit: "L", mode: "manual" },
  { id: "haz", label: "Hazardous waste dispatched", unit: "kg", mode: "manual" },
  { id: "lti", label: "Lost-time injuries", unit: "count", mode: "manual" },
  { id: "grv", label: "Community grievances received", unit: "count", mode: "manual" },
  { id: "train", label: "EHS training hours", unit: "hrs", mode: "manual" },
];

/** Stub AMR values keyed period → field. `null` = not yet captured. */
export const AMR_VALUES: Record<string, Record<string, { value: number | null; prov?: Provenance }>> = {
  "2026-07": {
    km: { value: 412_380, prov: { source: "Telematics", fetchedAt: "2026-07-15T02:00:00Z" } },
    energy: { value: 486_120, prov: { source: "Energy meters", fetchedAt: "2026-07-15T02:00:00Z" } },
    water: { value: null, prov: { source: "Depot water meter", fetchedAt: "2026-07-15T02:00:00Z", error: "Source unreachable since 12 Jul — meter gateway offline" } },
    diesel: { value: null },
    haz: { value: null },
    lti: { value: 0 },
    grv: { value: null },
    train: { value: null },
  },
  "2026-06": {
    km: { value: 798_440, prov: { source: "Telematics", fetchedAt: "2026-07-01T02:00:00Z" } },
    energy: { value: 941_270, prov: { source: "Energy meters", fetchedAt: "2026-07-01T02:00:00Z" } },
    water: { value: 1_240, prov: { source: "Depot water meter", fetchedAt: "2026-07-01T02:00:00Z" } },
    diesel: { value: 310 },
    haz: { value: 84 },
    lti: { value: 0 },
    grv: { value: 2 },
    train: { value: 126 },
  },
  "2026-05": {
    km: { value: 771_020, prov: { source: "Telematics", fetchedAt: "2026-06-01T02:00:00Z" } },
    energy: { value: 910_580, prov: { source: "Energy meters", fetchedAt: "2026-06-01T02:00:00Z" } },
    water: { value: 1_310, prov: { source: "Depot water meter", fetchedAt: "2026-06-01T02:00:00Z" } },
    diesel: { value: 285 },
    haz: { value: 61 },
    lti: { value: 1 },
    grv: { value: 1 },
    train: { value: 98 },
  },
};

/* ----------------------------------- GHG ----------------------------------- */

export type GhgParam = {
  id: string;
  scope: 1 | 2 | 3;
  label: string;
  unit: string;
  factor: number; // kgCO2e per unit
  factorSource: string;
  mode: "manual" | "auto";
  source?: string;
};

export const GHG_PARAMS: GhgParam[] = [
  { id: "diesel-dg", scope: 1, label: "DG diesel", unit: "L", factor: 2.68, factorSource: "DEFRA 2025", mode: "manual" },
  { id: "refrigerant", scope: 1, label: "Refrigerant top-up (R134a)", unit: "kg", factor: 1430, factorSource: "IPCC AR6 GWP", mode: "manual" },
  { id: "grid", scope: 2, label: "Grid electricity (charging + depot)", unit: "kWh", factor: 0.716, factorSource: "CEA Baseline v19", mode: "auto", source: "Energy meters" },
  { id: "commute", scope: 3, label: "Employee commute", unit: "km", factor: 0.11, factorSource: "DEFRA 2025", mode: "manual" },
  { id: "upstream-fuel", scope: 3, label: "Well-to-tank — grid electricity", unit: "kWh", factor: 0.078, factorSource: "DEFRA 2025", mode: "auto", source: "Energy meters" },
  { id: "waste", scope: 3, label: "Waste to landfill", unit: "kg", factor: 0.45, factorSource: "DEFRA 2025", mode: "manual" },
];

/** Stub GHG activity quantities keyed period → param. */
export const GHG_QTY: Record<string, Record<string, number | null>> = {
  "2026-07": { "diesel-dg": 180, refrigerant: null, grid: 486_120, commute: 61_200, "upstream-fuel": 486_120, waste: 2_100 },
  "2026-06": { "diesel-dg": 310, refrigerant: 4, grid: 941_270, commute: 118_400, "upstream-fuel": 941_270, waste: 4_450 },
  "2026-05": { "diesel-dg": 285, refrigerant: 0, grid: 910_580, commute: 120_100, "upstream-fuel": 910_580, waste: 4_120 },
};

/* ------------------------------ carbon savings ----------------------------- */

export const CARBON = {
  /** Public-website methodology (v2.1): baseline diesel bus 1.08 kgCO2e/km vs actual grid-charged EV. */
  methodology: "Reconciled to public-website methodology v2.1 — baseline diesel bus 1.08 kgCO₂e/km vs metered EV charging × CEA grid factor.",
  baselinePerKm: 1.08, // kgCO2e/km diesel baseline
  cumulativeSavedT: 12_480, // as displayed on website
  websiteFigureT: 12_480,
  monthly: [
    { period: "2026-05", fleetKm: 771_020, savedT: 405 },
    { period: "2026-06", fleetKm: 798_440, savedT: 419 },
    { period: "2026-07", fleetKm: 412_380, savedT: 216 }, // month-to-date
  ],
};

/* --------------------------------- vendors --------------------------------- */

export type VendorCategory = "battery-recycler" | "civil-contractor" | "o-and-m" | "scrap-dealer";

export const VENDOR_CATEGORY_META: Record<
  VendorCategory,
  { label: string; conditional: string[] } // conditional doc sections
> = {
  "battery-recycler": { label: "Battery recycler", conditional: ["Battery disposal", "E-waste"] },
  "civil-contractor": { label: "Civil contractor", conditional: ["SWM", "Labour compliance"] },
  "o-and-m": { label: "O&M vendor", conditional: ["E-waste", "ETP"] },
  "scrap-dealer": { label: "Scrap dealer", conditional: ["E-waste", "SWM"] },
};

export type VendorDoc = {
  name: string;
  section: string; // "Identity" | "Registration" | conditional section
  status: "pending" | "submitted" | "verified" | "rejected";
  note?: string;
};

export type Vendor = {
  id: string;
  name: string;
  category: VendorCategory;
  contractEnd: string;
  docs: VendorDoc[];
};

export const VENDORS: Vendor[] = [
  {
    id: "v-eco",
    name: "EcoVolt Recyclers Pvt Ltd",
    category: "battery-recycler",
    contractEnd: "2027-03-31",
    docs: [
      { name: "GST registration", section: "Registration", status: "verified" },
      { name: "PAN", section: "Identity", status: "verified" },
      { name: "CPCB recycler authorisation", section: "Battery disposal", status: "submitted" },
      { name: "E-waste licence", section: "E-waste", status: "submitted" },
    ],
  },
  {
    id: "v-shree",
    name: "Shree Infra Works",
    category: "civil-contractor",
    contractEnd: "2026-12-31",
    docs: [
      { name: "GST registration", section: "Registration", status: "verified" },
      { name: "PAN", section: "Identity", status: "verified" },
      { name: "Debris disposal plan (SWM)", section: "SWM", status: "rejected", note: "Plan names a dump site outside approved list — resubmit." },
      { name: "PF/ESIC challans (Q1)", section: "Labour compliance", status: "submitted" },
    ],
  },
  {
    id: "v-omx",
    name: "OmniMax O&M Services",
    category: "o-and-m",
    contractEnd: "2027-06-30",
    docs: [
      { name: "GST registration", section: "Registration", status: "verified" },
      { name: "PAN", section: "Identity", status: "verified" },
      { name: "E-waste handling declaration", section: "E-waste", status: "pending" },
      { name: "ETP operator certification", section: "ETP", status: "pending" },
    ],
  },
];

/* --------------------------------- reports --------------------------------- */

export type ReportDef = {
  id: string;
  name: string;
  acronyms: string[];
  blurb: string;
  kind: "rollup" | "external-format" | "narrative" | "calculation";
};

export const REPORT_DEFS: ReportDef[] = [
  { id: "noncompliance", name: "Non-compliance report", acronyms: [], blurb: "Roll-up of every item outside validity, with root cause and remediation state.", kind: "rollup" },
  { id: "amr", name: "AMR", acronyms: ["AMR"], blurb: "Lender-format monitoring report from configured input fields.", kind: "external-format" },
  { id: "ghg", name: "GHG inventory", acronyms: ["GHG"], blurb: "Scope 1 / 2 / 3 emissions from configured parameters and factors.", kind: "external-format" },
  { id: "brsr", name: "BRSR", acronyms: ["BRSR", "SEBI"], blurb: "SEBI disclosure format; project-level, rolls up to group.", kind: "external-format" },
  { id: "impact", name: "Impact report", acronyms: ["ESIA", "ESDD"], blurb: "Narrative output of the assessment process.", kind: "narrative" },
  { id: "carbon", name: "Carbon savings", acronyms: ["EV"], blurb: "Baseline-vs-actual emissions avoided by EV fleet operation.", kind: "calculation" },
];

/* ------------------------------ notifications ------------------------------ */

export type EsgNotification = {
  id: string;
  kind: "expiry" | "digest" | "escalation";
  title: string;
  detail: string;
  when: string;
  recordId?: string;
  unread?: boolean;
};

export const NOTIFICATIONS: EsgNotification[] = [
  {
    id: "n-1",
    kind: "escalation",
    title: "Fire NOC · Kashimira — 17d overdue, escalated",
    detail: "Unactioned past owner SLA; escalated to ESG Lead. Remediation note on record.",
    when: "2026-07-14T08:00:00+05:30",
    recordId: "r-fire-kash",
    unread: true,
  },
  {
    id: "n-2",
    kind: "expiry",
    title: "Fire NOC · Bhayandar — enters 60-day window",
    detail: "Expires 05 Aug 2026. Renewal not yet initiated. Owner: Rohan Desai.",
    when: "2026-07-13T07:30:00+05:30",
    recordId: "r-fire-bhy",
    unread: true,
  },
  {
    id: "n-3",
    kind: "expiry",
    title: "CTO · MBMT — 36 days to expiry",
    detail: "Renewal initiated 02 Jul; awaiting MPCB inspection slot.",
    when: "2026-07-12T07:30:00+05:30",
    recordId: "r-cto-mbmt",
  },
  {
    id: "n-4",
    kind: "digest",
    title: "Monthly compliance digest — 7 Jul 2026",
    detail: "4 overdue · 6 expiring · 14 valid across group. Full list in Reports → Non-compliance.",
    when: "2026-07-07T09:00:00+05:30",
  },
];

/* ------------------------------- aggregations ------------------------------ */

export type DomainKey = "permits" | "site" | "esms" | "vendor" | "reporting";

export const DOMAINS: { key: DomainKey; label: string; acronyms?: string[] }[] = [
  { key: "permits", label: "Permits & Licences" },
  { key: "site", label: "Site Compliance" },
  { key: "esms", label: "ESMS", acronyms: ["ESMS"] },
  { key: "vendor", label: "Vendors" },
  { key: "reporting", label: "AMR / GHG", acronyms: ["AMR", "GHG"] },
];

export type CellStat = { valid: number; expiring: number; overdue: number };

export function worstOf(c: CellStat): EsgState {
  if (c.overdue > 0) return "overdue";
  if (c.expiring > 0) return "expiring";
  return "valid";
}

/** Matrix cell roll-up per entity × domain (stub aggregation over local data). */
export function cellStat(entityId: string, domain: DomainKey): CellStat {
  const zero: CellStat = { valid: 0, expiring: 0, overdue: 0 };
  if (domain === "permits" || domain === "site") {
    const cat: ComplianceCategory = domain === "permits" ? "permit" : "site";
    return RECORDS.filter((r) => r.entityId === entityId && typeByKey(r.typeKey)?.category === cat).reduce(
      (acc, r) => {
        acc[recordState(r) === "overdue" ? "overdue" : recordState(r) === "expiring" ? "expiring" : "valid"]++;
        return acc;
      },
      { ...zero },
    );
  }
  if (domain === "esms") {
    return ESAP_ACTIONS.filter((a) => {
      const asmt = ASSESSMENTS.find((x) => x.id === a.assessmentId);
      return asmt?.entityId === entityId;
    }).reduce(
      (acc, a) => {
        const s = esapState(a);
        if (s === "overdue") acc.overdue++;
        else if (s === "open") acc.expiring++;
        else acc.valid++;
        return acc;
      },
      { ...zero },
    );
  }
  if (domain === "vendor") {
    // Vendors attach at group level in the stub; attribute to MBMT + Silvassa evenly for the matrix.
    if (entityId === "corp") return { ...zero };
    return VENDORS.reduce(
      (acc, v) => {
        for (const d of v.docs) {
          if (d.status === "rejected") acc.overdue++;
          else if (d.status === "pending" || d.status === "submitted") acc.expiring++;
          else acc.valid++;
        }
        return acc;
      },
      { ...zero },
    );
  }
  // reporting: July capture status per entity (stub — water meter outage + pending manual fields)
  const julyPending = entityId === "mbmt" ? 3 : entityId === "silvassa" ? 2 : 0;
  return { valid: AMR_FIELDS.length - julyPending, expiring: julyPending, overdue: 0 };
}

export function headline(sel: ScopeSel) {
  const rec = RECORDS.filter((r) => inScope(r, sel));
  const overdue = rec.filter((r) => recordState(r) === "overdue");
  const expiring = rec.filter((r) => recordState(r) === "expiring");
  const openActions = ESAP_ACTIONS.filter((a) => a.status !== "closed").filter((a) => {
    const asmt = ASSESSMENTS.find((x) => x.id === a.assessmentId);
    return asmt ? inScope({ entityId: asmt.entityId }, { entityId: sel.entityId }) : true;
  });
  const compliantPct = rec.length === 0 ? 100 : Math.round(((rec.length - overdue.length) / rec.length) * 100);
  return { records: rec, overdue, expiring, openActions, compliantPct };
}
