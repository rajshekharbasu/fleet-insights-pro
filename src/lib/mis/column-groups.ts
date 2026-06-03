export const COLUMN_GROUPS = {
  identity: { label: "Identity", band: "bg-slate-700 text-white" },
  scheduleBus: { label: "Schedule Bus", band: "bg-slate-600 text-white" },
  route: { label: "Route", band: "bg-blue-700 text-white" },
  tripStatus: { label: "Trip Status", band: "bg-slate-600 text-white" },
  loss: { label: "Loss Detail", band: "bg-red-700 text-white" },
  km: { label: "KM Summary", band: "bg-emerald-700 text-white" },
} as const;

export type ColumnGroupKey = keyof typeof COLUMN_GROUPS;
