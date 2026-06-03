import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  buildScheduleReports,
  distinctRoutes,
  filterTrips,
} from "@/lib/mis/analytics";
import { fetchMisTripsRange } from "@/lib/mis/api";
import { extraTripNumber, scheduleKey, tripKey } from "@/lib/mis/keys";
import type { OverlayMap } from "@/lib/mis/merge";
import type { MisTripRow, RemarkCode, TripOverride } from "@/lib/mis/types";

type LoadState = "idle" | "loading" | "ready" | "error";

type MisState = {
  loadState: LoadState;
  sourceRows: MisTripRow[];
  overlay: OverlayMap;
  history: string[];
  dateFrom: string;
  dateTo: string;
  routeFilters: string[];
  siteId: string | null;
  shiftFilter: "All" | "Morning" | "Evening";
  reportGenerated: boolean;
  errorMessage: string | null;
};

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_OK"; rows: MisTripRow[] }
  | { type: "LOAD_ERR"; message: string }
  | {
      type: "SET_FILTERS";
      dateFrom?: string;
      dateTo?: string;
      routes?: string[];
      siteId?: string | null;
      shift?: MisState["shiftFilter"];
    }
  | { type: "REPORT_GENERATED" }
  | { type: "SET_OVERLAY"; overlay: OverlayMap; historyKey?: string }
  | { type: "PATCH_TRIP"; key: string; patch: TripOverride; recordHistory?: boolean }
  | { type: "RESET_OVERLAY" }
  | { type: "UNDO" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const initial: MisState = {
  loadState: "idle",
  sourceRows: [],
  overlay: new Map(),
  history: [],
  dateFrom: todayIso(),
  dateTo: todayIso(),
  routeFilters: [],
  siteId: null,
  shiftFilter: "All",
  reportGenerated: false,
  errorMessage: null,
};

function reducer(state: MisState, action: Action): MisState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loadState: "loading", errorMessage: null };
    case "LOAD_OK":
      return { ...state, loadState: "ready", sourceRows: action.rows };
    case "LOAD_ERR":
      return { ...state, loadState: "error", errorMessage: action.message };
    case "SET_FILTERS":
      return {
        ...state,
        dateFrom: action.dateFrom ?? state.dateFrom,
        dateTo: action.dateTo ?? state.dateTo,
        routeFilters: action.routes ?? state.routeFilters,
        siteId: action.siteId !== undefined ? action.siteId : state.siteId,
        shiftFilter: action.shift ?? state.shiftFilter,
        reportGenerated: false,
      };
    case "REPORT_GENERATED":
      return { ...state, reportGenerated: true };
    case "SET_OVERLAY": {
      const history = action.historyKey
        ? [...state.history, action.historyKey]
        : state.history;
      return { ...state, overlay: action.overlay, history };
    }
    case "PATCH_TRIP": {
      const next = new Map(state.overlay);
      const prev = next.get(action.key) ?? {};
      next.set(action.key, { ...prev, ...action.patch });
      const history =
        action.recordHistory !== false
          ? [...state.history, action.key]
          : state.history;
      return { ...state, overlay: next, history };
    }
    case "RESET_OVERLAY":
      return { ...state, overlay: new Map(), history: [] };
    case "UNDO": {
      if (state.history.length === 0) return state;
      const next = new Map(state.overlay);
      const last = state.history[state.history.length - 1]!;
      next.delete(last);
      return {
        ...state,
        overlay: next,
        history: state.history.slice(0, -1),
      };
    }
    default:
      return state;
  }
}

type MisContextValue = {
  state: MisState;
  filteredRows: MisTripRow[];
  scheduleReports: ReturnType<typeof buildScheduleReports>;
  availableRoutes: string[];
  generateReport: () => Promise<void>;
  resetAllAdjustments: () => void;
  setFilters: (
    p: Partial<Pick<MisState, "dateFrom" | "dateTo" | "routeFilters" | "siteId" | "shiftFilter">>,
  ) => void;
  patchTrip: (key: string, patch: TripOverride, recordHistory?: boolean) => void;
  resetSchedule: (scheduleCode: string, shift: string) => void;
  undoLast: () => void;
  addExtraTrip: (
    scheduleCode: string,
    shift: string,
    trip: Pick<TripOverride, "fromStage" | "toStage" | "distanceInKM" | "reason">,
  ) => void;
  getOverlay: () => OverlayMap;
};

const MisReportContext = createContext<MisContextValue | null>(null);

export function MisReportProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const filteredRows = useMemo(
    () =>
      filterTrips(state.sourceRows, {
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        routes: state.routeFilters,
        siteId: state.siteId,
        shift: state.shiftFilter,
      }),
    [
      state.sourceRows,
      state.dateFrom,
      state.dateTo,
      state.routeFilters,
      state.siteId,
      state.shiftFilter,
    ],
  );

  const scheduleReports = useMemo(
    () => buildScheduleReports(filteredRows, state.overlay),
    [filteredRows, state.overlay],
  );

  const availableRoutes = useMemo(() => distinctRoutes(state.sourceRows), [state.sourceRows]);

  const generateReport = useCallback(async () => {
    dispatch({ type: "LOAD_START" });
    try {
      const rows = await fetchMisTripsRange(state.dateFrom, state.dateTo);
      dispatch({ type: "LOAD_OK", rows });
      dispatch({ type: "REPORT_GENERATED" });
    } catch {
      dispatch({ type: "LOAD_ERR", message: "Failed to load data." });
    }
  }, [state.dateFrom, state.dateTo]);

  const patchTrip = useCallback(
    (key: string, patch: TripOverride, recordHistory = true) => {
      dispatch({ type: "PATCH_TRIP", key, patch, recordHistory });
    },
    [],
  );

  const resetAllAdjustments = useCallback(() => dispatch({ type: "RESET_OVERLAY" }), []);

  const setFilters = useCallback(
    (
      p: Partial<
        Pick<MisState, "dateFrom" | "dateTo" | "routeFilters" | "siteId" | "shiftFilter">
      >,
    ) => {
      dispatch({
        type: "SET_FILTERS",
        dateFrom: p.dateFrom,
        dateTo: p.dateTo,
        routes: p.routeFilters,
        siteId: p.siteId,
        shift: p.shiftFilter,
      });
    },
    [],
  );

  const resetSchedule = useCallback(
    (scheduleCode: string, shift: string) => {
      const prefix = `${scheduleCode}::`;
      const next = new Map(state.overlay);
      [...next.keys()].forEach((k) => {
        if (k.startsWith(prefix)) next.delete(k);
      });
      dispatch({ type: "SET_OVERLAY", overlay: next });
    },
    [state.overlay],
  );

  const undoLast = useCallback(() => dispatch({ type: "UNDO" }), []);

  const addExtraTrip = useCallback(
    (
      scheduleCode: string,
      _shift: string,
      trip: Pick<TripOverride, "fromStage" | "toStage" | "distanceInKM" | "reason">,
    ) => {
      const existing = [...state.overlay.keys()].filter(
        (k) => k.startsWith(`${scheduleCode}::`) && state.overlay.get(k)?.isExtra,
      ).length;
      const tn = extraTripNumber(existing + 1);
      const key = tripKey(scheduleCode, tn);
      const next = new Map(state.overlay);
      next.set(key, {
        isExtra: true,
        isLost: 0,
        isShort: 0,
        fromStage: trip.fromStage,
        toStage: trip.toStage,
        distanceInKM: trip.distanceInKM,
        reason: trip.reason,
      });
      dispatch({ type: "SET_OVERLAY", overlay: next, historyKey: key });
    },
    [state.overlay],
  );

  const value: MisContextValue = {
    state,
    filteredRows,
    scheduleReports,
    availableRoutes,
    generateReport,
    resetAllAdjustments,
    setFilters,
    patchTrip,
    resetSchedule,
    undoLast,
    addExtraTrip,
    getOverlay: () => state.overlay,
  };

  return <MisReportContext.Provider value={value}>{children}</MisReportContext.Provider>;
}

export function useMisReport() {
  const ctx = useContext(MisReportContext);
  if (!ctx) throw new Error("useMisReport must be used within MisReportProvider");
  return ctx;
}

export function markLost(patch: TripOverride, remark: RemarkCode, reason: string): TripOverride {
  return { isLost: 1, isShort: 0, remark, reason, isExtra: false };
}

export function markShort(patch: TripOverride, reason: string): TripOverride {
  return { isLost: 0, isShort: 1, remark: 0, reason, isExtra: false };
}

export function markCompleted(): TripOverride {
  return { isLost: 0, isShort: 0, remark: 0, reason: "", isExtra: false };
}

export { scheduleKey, tripKey };
