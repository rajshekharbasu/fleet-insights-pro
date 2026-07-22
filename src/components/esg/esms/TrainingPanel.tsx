import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  History as HistoryIcon,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ESG_GROUP, ESG_TODAY, entityById, inScope, PEOPLE, personById, type Training } from "@/lib/esg-data";
import {
  attendanceRate,
  fmtDateTime,
  fmtTime,
  isoDayKey,
  monthMatrix,
  presentCount,
  sameDay,
  type TrainingDraft,
} from "@/lib/esg-training";
import { exportToXlsx } from "@/lib/export-xlsx";
import { EmptyState, PanelCard, useEsg } from "../primitives";
import { Segmented } from "../Segmented";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function statusTint(status: Training["status"]) {
  return status === "completed"
    ? "bg-success/12 text-success"
    : status === "cancelled"
      ? "bg-muted text-muted-foreground"
      : "bg-warning/14 text-warning";
}

/* --------------------------------- schedule -------------------------------- */

function ScheduleTrainingDialog({ onSchedule }: { onSchedule: (d: TrainingDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [entityId, setEntityId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMins, setDurationMins] = useState("60");
  const [trainerId, setTrainerId] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);

  const depots = entityId ? entityById(entityId)?.depots ?? [] : [];
  const valid = topic.trim() && entityId && scheduledAt && trainerId && attendeeIds.length > 0;

  const reset = () => {
    setTopic("");
    setEntityId("");
    setDepotId("");
    setScheduledAt("");
    setDurationMins("60");
    setTrainerId("");
    setAttendeeIds([]);
  };
  const toggle = (id: string) =>
    setAttendeeIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const submit = () => {
    if (!valid) return;
    onSchedule({
      topic: topic.trim(),
      entityId,
      depotId: depotId || undefined,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMins: Number(durationMins) || 60,
      trainerId,
      attendeeIds,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-[12px]">
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Schedule training
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Schedule training</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Fire drill & evacuation refresher"
              className="h-9 text-[12.5px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Date &amp; time</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9 text-[12.5px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Duration (mins)</Label>
              <Input
                type="number"
                min={15}
                step={15}
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
                className="h-9 text-[12.5px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Entity</Label>
              <Select
                value={entityId}
                onValueChange={(v) => {
                  setEntityId(v);
                  setDepotId("");
                }}
              >
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {ESG_GROUP.entities.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-[12.5px]">
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Trainer</Label>
              <Select value={trainerId} onValueChange={setTrainerId}>
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue placeholder="Select trainer" />
                </SelectTrigger>
                <SelectContent>
                  {PEOPLE.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[12.5px]">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {depots.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Depot (optional)</Label>
              <Select value={depotId} onValueChange={setDepotId}>
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue placeholder="Select depot" />
                </SelectTrigger>
                <SelectContent>
                  {depots.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-[12.5px]">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[12px]">Attendees ({attendeeIds.length} selected)</Label>
            <div className="max-h-[140px] space-y-1.5 overflow-y-auto rounded-lg border border-border/60 p-2">
              {PEOPLE.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                  <Checkbox checked={attendeeIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span>{p.name}</span>
                  <span className="text-[11px] text-muted-foreground">· {p.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={!valid} className="text-[12px]">
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ session detail ----------------------------- */

function reportRows(t: Training) {
  return t.attendees.map((a) => ({
    Topic: t.topic,
    "Date & time": fmtDateTime(t.scheduledAt),
    Trainer: personById(t.trainerId)?.name ?? t.trainerId,
    Attendee: a.name,
    Role: a.role,
    Present: a.present ? "Yes" : "No",
  }));
}

function downloadSessionReport(t: Training) {
  exportToXlsx(
    `training-${t.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    [
      { key: "Topic", header: "Topic" },
      { key: "Date & time", header: "Date & time" },
      { key: "Trainer", header: "Trainer" },
      { key: "Attendee", header: "Attendee" },
      { key: "Role", header: "Role" },
      { key: "Present", header: "Present" },
    ],
    reportRows(t),
    "Attendance",
  );
}

function SessionDetailDialog({
  training,
  onClose,
}: {
  training: Training | null;
  onClose: () => void;
}) {
  const { training: wf } = useEsg();
  if (!training) return null;
  const live = wf.trainingById(training.id) ?? training;
  const present = presentCount(live);
  const rate = attendanceRate(live);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{live.topic}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {fmtDateTime(live.scheduledAt)} · {live.durationMins}m
            </span>
            <span>Trainer {personById(live.trainerId)?.name}</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                statusTint(live.status),
              )}
            >
              {live.status}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
              <Users className="h-3.5 w-3.5 text-primary" aria-hidden /> Attendance
            </span>
            <span className="num text-[12.5px] font-semibold">
              {present}/{live.attendees.length} · {rate}%
            </span>
          </div>

          <div className="space-y-1.5">
            {live.attendees.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40"
              >
                <Checkbox
                  checked={a.present}
                  onCheckedChange={(v) => wf.setAttendance(live.id, a.id, Boolean(v))}
                />
                <span className="text-[12.5px] font-medium">{a.name}</span>
                <span className="text-[11px] text-muted-foreground">· {a.role}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-[12px]"
            onClick={() => downloadSessionReport(live)}
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Download report
          </Button>
          {live.status !== "completed" && (
            <Button
              size="sm"
              className="text-[12px]"
              onClick={() => {
                wf.completeTraining(live.id);
                toast.success("Training completed", { description: `${live.topic} — attendance recorded.` });
              }}
            >
              Mark completed
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ calendar view ------------------------------ */

function CalendarView({ sessions, onOpen }: { sessions: Training[]; onOpen: (t: Training) => void }) {
  const [cursor, setCursor] = useState({ y: ESG_TODAY.getFullYear(), m: ESG_TODAY.getMonth() });
  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const byDay = useMemo(() => {
    const map: Record<string, Training[]> = {};
    for (const t of sessions) {
      const key = isoDayKey(new Date(t.scheduledAt));
      (map[key] ||= []).push(t);
    }
    return map;
  }, [sessions]);

  const shift = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <PanelCard>
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="text-[14px] font-semibold tracking-tight">
          {MONTHS[cursor.m]} {cursor.y}
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-border/40 text-center text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((day, i) => {
          const inMonth = day.getMonth() === cursor.m;
          const key = isoDayKey(day);
          const daySessions = byDay[key] ?? [];
          const isToday = sameDay(day, ESG_TODAY);
          return (
            <div
              key={i}
              className={cn(
                "min-h-[76px] border-b border-r border-border/30 p-1.5 last:border-r-0",
                !inMonth && "bg-muted/20",
                i % 7 === 6 && "border-r-0",
              )}
            >
              <div
                className={cn(
                  "mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-semibold",
                  isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50",
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {daySessions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t)}
                    className={cn(
                      "block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80",
                      statusTint(t.status),
                    )}
                    title={`${t.topic} · ${fmtTime(t.scheduledAt)}`}
                  >
                    {fmtTime(t.scheduledAt)} {t.topic}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

/* ------------------------------- history view ------------------------------ */

function HistoryView({ sessions, onOpen }: { sessions: Training[]; onOpen: (t: Training) => void }) {
  const past = useMemo(
    () => sessions.slice().sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    [sessions],
  );

  const exportHistory = () => {
    exportToXlsx(
      "training-history",
      [
        { key: "Topic", header: "Topic" },
        { key: "When", header: "Date & time" },
        { key: "Entity", header: "Entity" },
        { key: "Attendees", header: "Attendees" },
        { key: "Present", header: "Present" },
        { key: "Rate", header: "Attendance %" },
        { key: "Status", header: "Status" },
      ],
      past.map((t) => ({
        Topic: t.topic,
        When: fmtDateTime(t.scheduledAt),
        Entity: entityById(t.entityId)?.short ?? t.entityId,
        Attendees: t.attendees.length,
        Present: presentCount(t),
        Rate: attendanceRate(t),
        Status: t.status,
      })),
      "History",
    );
    toast.success("Training history exported", { description: `${past.length} sessions written to .xlsx.` });
  };

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Training history</h3>
          <p className="text-[12px] text-muted-foreground">Every session with attendance and completion state.</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={exportHistory}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export history
        </Button>
      </div>
      {past.length === 0 ? (
        <EmptyState title="No training sessions in this scope" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Topic</th>
                <th className="px-3 py-2.5 text-left font-medium">When</th>
                <th className="px-3 py-2.5 text-right font-medium">Attendance</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Report</th>
              </tr>
            </thead>
            <tbody>
              {past.map((t) => (
                <tr key={t.id} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-2.5 font-medium">
                    <button
                      type="button"
                      onClick={() => onOpen(t)}
                      className="text-left underline-offset-2 hover:text-primary hover:underline"
                    >
                      {t.topic}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDateTime(t.scheduledAt)}</td>
                  <td className="num px-3 py-2.5 text-right">
                    {presentCount(t)}/{t.attendees.length} · {attendanceRate(t)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        statusTint(t.status),
                      )}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => downloadSessionReport(t)}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
                    >
                      <Download className="h-3 w-3" aria-hidden /> .xlsx
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

/* -------------------------------- training --------------------------------- */

export function TrainingPanel() {
  const { scope, training: wf } = useEsg();
  const [view, setView] = useState<"calendar" | "history">("calendar");
  const [openId, setOpenId] = useState<string | null>(null);

  const sessions = useMemo(
    () => wf.trainings().filter((t) => inScope({ entityId: t.entityId, depotId: t.depotId }, scope)),
    [wf, scope],
  );
  const openTraining = openId ? sessions.find((t) => t.id === openId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Training view"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { key: "calendar", label: "Calendar", Icon: CalendarDays },
            { key: "history", label: "History", Icon: HistoryIcon },
          ]}
        />
        <ScheduleTrainingDialog
          onSchedule={(d) => {
            wf.scheduleTraining(d);
            toast.success("Training scheduled", { description: `${d.topic} — ${fmtDateTime(d.scheduledAt)}.` });
          }}
        />
      </div>

      {view === "calendar" ? (
        <CalendarView sessions={sessions} onOpen={(t) => setOpenId(t.id)} />
      ) : (
        <HistoryView sessions={sessions} onOpen={(t) => setOpenId(t.id)} />
      )}

      <SessionDetailDialog training={openTraining} onClose={() => setOpenId(null)} />
    </div>
  );
}
