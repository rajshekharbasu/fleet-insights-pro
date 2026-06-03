import { useMemo, useState } from "react";
import { useMisReport, markCompleted, markLost, markShort } from "@/contexts/MisReportContext";
import { fmtKm } from "@/lib/mis/analytics";
import type { ScheduleReportRow } from "@/lib/mis/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReasonPicker } from "./ReasonPicker";
import { StatusPill, Td, Th, MisTableShell } from "./mis-shared";

export function AdjustmentWorkspaceTab() {
  const {
    scheduleReports,
    state,
    generateReport,
    patchTrip,
    resetSchedule,
    undoLast,
    addExtraTrip,
  } = useMisReport();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reasonTrip, setReasonTrip] = useState<string | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraForm, setExtraForm] = useState({
    fromStage: "",
    toStage: "",
    distanceInKM: "",
    reason: "",
  });

  const byRoute = useMemo(() => {
    const map = new Map<string, ScheduleReportRow[]>();
    scheduleReports.forEach((r) => {
      const list = map.get(r.route) ?? [];
      list.push(r);
      map.set(r.route, list);
    });
    return map;
  }, [scheduleReports]);

  const selected = scheduleReports.find((r) => r.key === selectedKey) ?? scheduleReports[0] ?? null;

  if (state.loadState !== "ready" || scheduleReports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 px-6 py-16 text-center text-[13px] text-muted-foreground">
        {state.loadState === "loading"
          ? "Loading trips…"
          : "Load today’s trips on the Daily trip list tab first."}
        {state.loadState === "idle" && (
          <Button className="mt-3" size="lg" onClick={generateReport}>
            Load today’s trips
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid min-h-[640px] grid-cols-[280px_1fr] gap-4 rounded-xl border border-border/50 overflow-hidden">
      <aside className="border-r border-border/50 bg-card/40 overflow-auto max-h-[80vh]">
        <div className="border-b border-border/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Schedules by route
        </div>
        {[...byRoute.entries()].map(([route, rows]) => (
          <div key={route}>
            <div className="bg-muted/30 px-3 py-1.5 text-[11px] font-semibold">{route}</div>
            {rows.map((r) => {
              const badges = [
                r.metrics.shortTrip > 0 && `${r.metrics.shortTrip} short`,
                r.metrics.tripNotCompleted > 0 && `${r.metrics.tripNotCompleted} loss`,
                r.metrics.extraTripCount > 0 && `${r.metrics.extraTripCount} extra`,
              ].filter(Boolean);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setSelectedKey(r.key)}
                  className={`flex w-full flex-col gap-0.5 border-b border-border/20 px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-muted/40 ${
                    selected?.key === r.key ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {r.hasAdjustment && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                    {r.runningBoard}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {r.shift} · {r.driverName}
                  </span>
                  {badges.length > 0 && (
                    <span className="text-[10px] text-amber-600">{badges.join(" · ")}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {selected && (
        <div className="overflow-auto p-4 space-y-4">
          <header>
            <h3 className="text-[16px] font-semibold">
              {selected.runningBoard} · {selected.route} · {selected.shift}
            </h3>
            <p className="text-[12px] text-muted-foreground">
              Driver {selected.driverName} ({selected.driverId}) · Bus {selected.busNo}
            </p>
          </header>

          <div className="grid grid-cols-5 gap-2 rounded-lg border border-border/40 bg-muted/20 p-3 text-[11px]">
            {[
              ["Scheduled", fmtKm(selected.roundTripKm)],
              ["Completed", fmtKm(selected.metrics.completedKMs)],
              ["Loss", fmtKm(selected.metrics.lossKMs)],
              ["Extra", fmtKm(selected.metrics.extraKMs)],
              ["Billing", fmtKm(selected.metrics.billingKMs)],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-muted-foreground">{l}</div>
                <div className="num text-[15px] font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <MisTableShell>
            <thead>
              <tr>
                <Th>Trip</Th>
                <Th>Leg</Th>
                <Th align="right">KM</Th>
                <Th>Time</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {selected.trips.map((trip) => (
                <tr
                  key={trip.tripKey}
                  className={
                    trip.status === "lost"
                      ? "bg-red-500/8"
                      : trip.status === "short"
                        ? "bg-amber-500/8"
                        : trip.status === "extra"
                          ? "bg-emerald-500/8"
                          : ""
                  }
                >
                  <Td>{trip.tripNumber}</Td>
                  <Td>
                    {trip.fromStage} → {trip.toStage}
                  </Td>
                  <Td align="right">{fmtKm(trip.distanceInKM)}</Td>
                  <Td>
                    {trip.startTime}–{trip.endTime}
                  </Td>
                  <Td>
                    <StatusPill status={trip.status} />
                  </Td>
                  <Td>
                    {trip.status !== "extra" && (
                      <div className="flex flex-wrap gap-1">
                        {trip.status !== "lost" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 text-[10px]"
                            onClick={() => setReasonTrip(`${trip.tripKey}:lost`)}
                          >
                            Mark Lost
                          </Button>
                        )}
                        {trip.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px]"
                            onClick={() => setReasonTrip(`${trip.tripKey}:short`)}
                          >
                            Mark Short
                          </Button>
                        )}
                        {(trip.status === "lost" || trip.status === "short") && (
                          <Button
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => patchTrip(trip.tripKey, markCompleted())}
                          >
                            Mark Completed
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px]"
                          onClick={() => setReasonTrip(`${trip.tripKey}:reason`)}
                        >
                          Change Reason
                        </Button>
                      </div>
                    )}
                    {reasonTrip?.startsWith(trip.tripKey) && (
                      <ReasonPicker
                        onConfirm={(remark, notes) => {
                          const mode = reasonTrip.split(":")[1];
                          if (mode === "lost") patchTrip(trip.tripKey, markLost({}, remark, notes));
                          else if (mode === "short") patchTrip(trip.tripKey, markShort({}, notes));
                          else patchTrip(trip.tripKey, { remark, reason: notes });
                          setReasonTrip(null);
                        }}
                        onCancel={() => setReasonTrip(null)}
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </MisTableShell>

          {!extraOpen ? (
            <Button variant="outline" size="sm" onClick={() => setExtraOpen(true)}>
              + Add Extra Trip
            </Button>
          ) : (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="From stage"
                  value={extraForm.fromStage}
                  onChange={(e) => setExtraForm((f) => ({ ...f, fromStage: e.target.value }))}
                />
                <Input
                  placeholder="To stage"
                  value={extraForm.toStage}
                  onChange={(e) => setExtraForm((f) => ({ ...f, toStage: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Distance KM"
                  value={extraForm.distanceInKM}
                  onChange={(e) => setExtraForm((f) => ({ ...f, distanceInKM: e.target.value }))}
                />
                <Input
                  placeholder="Reason / notes"
                  value={extraForm.reason}
                  onChange={(e) => setExtraForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const km = parseFloat(extraForm.distanceInKM);
                    if (!extraForm.fromStage || !extraForm.toStage || !Number.isFinite(km)) return;
                    addExtraTrip(selected.scheduleCode, selected.shift, {
                      fromStage: extraForm.fromStage,
                      toStage: extraForm.toStage,
                      distanceInKM: km,
                      reason: extraForm.reason,
                    });
                    setExtraForm({ fromStage: "", toStage: "", distanceInKM: "", reason: "" });
                    setExtraOpen(false);
                  }}
                >
                  Add Extra Trip
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setExtraOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <ScheduleSummaryPanel row={selected} onUndo={undoLast} onReset={() => resetSchedule(selected.scheduleCode, selected.shift)} />
        </div>
      )}
    </div>
  );
}

function ScheduleSummaryPanel({
  row,
  onUndo,
  onReset,
}: {
  row: ScheduleReportRow;
  onUndo: () => void;
  onReset: () => void;
}) {
  const m = row.metrics;
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-4 text-[12px] space-y-2">
      <div className="font-semibold">Schedule adjustment summary</div>
      <div className="grid grid-cols-2 gap-4 text-muted-foreground">
        <div>
          <div className="text-[10px] uppercase">After adjustments</div>
          <div>
            Scheduled: {m.scheduledTrips} · Completed: {m.tripCompleted} · Loss: {m.tripNotCompleted} ·
            Short: {m.shortTrip}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase">Billing</div>
          <div>
            Extra trips: {m.extraTripCount} ({fmtKm(m.extraKMs)} km) · Net billing:{" "}
            <strong className="text-foreground">{fmtKm(m.billingKMs)} km</strong>
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={onUndo}>
          Undo Last Change
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          Reset This Schedule
        </Button>
      </div>
    </div>
  );
}
