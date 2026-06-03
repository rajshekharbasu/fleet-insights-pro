/** Plain-language labels for depot staff (avoid Excel / MIS jargon). */

export const OPS = {
  pageTitle: "Daily running report",
  pageSubtitle: "Pick your depot, load the day’s trips, check kilometres, fix trips if needed, then download.",

  step1: "1. Choose depot & report style",
  step2: "2. Load & review trips",
  step3: "3. Fix trips (if needed) & download",

  yourDepot: "Your depot",
  reportStyle: "Report style for this depot",
  customizeLayout: "Set up columns & routes",

  loadReport: "Load today’s trips",
  loadReportHint: "Press this after choosing dates. Wait a few seconds.",
  downloadExcel: "Download Excel file",
  downloadPdf: "Print / save PDF",
  undoChanges: "Undo all trip fixes",

  tabDaily: "Daily trip list",
  tabFix: "Fix individual trips",
  tabSummary: "Summary by route / driver",

  previewDaily: "How the daily list will look",
  previewSummary: "How the summary table will look",

  tripDone: "Trip completed",
  tripLost: "Trip not done (loss)",
  tripShort: "Short trip",
  tripExtra: "Extra trip added",
  rowAdjusted: "You changed this row",

  showColumn: "Show on report",
  columnTitle: "Column title on report",
  routesForDepot: "Routes at this depot",
  routesHint: "Tap a route to add it. These filter which trips appear.",

  saveAndUse: "Save & use this style",
  sampleDataNote: "Preview shows example trips. Load the report to see real data.",

  emptyColumns: "Turn on at least one section below to see the preview.",

  pivotRows: "Group summary by",
  pivotNumbers: "Numbers to show",

  routesAutoFilter: "Trips are filtered to the routes you set in your report style.",
  expandTripsHint: "Tap ▶ on a row to see each trip leg.",
  markNotDone: "Mark as not done",
  markShortTrip: "Mark as short trip",
  markDone: "Mark as completed",
  editTrip: "Change trip",
  loadFirst: "Load today’s trips on the Daily trip list tab first.",
  buildSummary: "Build summary table",
} as const;

export const GROUP_PLAIN: Record<string, string> = {
  identity: "Bus & driver info",
  scheduleBus: "Bus details",
  route: "Route & distance",
  tripStatus: "Trip counts",
  loss: "Why trips were lost",
  km: "Kilometres (billing)",
};
