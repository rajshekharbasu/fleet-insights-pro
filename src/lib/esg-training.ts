/**
 * Training workflow — UI-only stub (Phase 5).
 *
 * Session state for the training calendar: scheduling sessions, marking
 * attendance, and completing them. Layered over the TRAININGS seed data.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { TRAININGS, type Attendee, type Training } from "./esg-data";

export interface TrainingDraft {
  topic: string;
  entityId: string;
  depotId?: string;
  scheduledAt: string; // ISO datetime
  durationMins: number;
  trainerId: string;
  attendeeIds: string[]; // person ids
}

export interface TrainingWorkflow {
  trainings: () => Training[];
  trainingById: (id: string) => Training | undefined;
  scheduleTraining: (d: TrainingDraft) => string;
  setAttendance: (trainingId: string, attendeeId: string, present: boolean) => void;
  completeTraining: (trainingId: string) => void;
}

export function useTrainingWorkflow(personLabel: (id: string) => { name: string; role: string }): TrainingWorkflow {
  const [sessionTrainings, setSessionTrainings] = useState<Training[]>([]);
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Training["status"]>>({});
  const counter = useRef(0);

  const applyOverrides = useCallback(
    (t: Training): Training => {
      const att = attendanceOverrides[t.id];
      const attendees = att ? t.attendees.map((a) => ({ ...a, present: att[a.id] ?? a.present })) : t.attendees;
      return { ...t, attendees, status: statusOverrides[t.id] ?? t.status };
    },
    [attendanceOverrides, statusOverrides],
  );

  const trainings = useCallback(
    () => [...TRAININGS, ...sessionTrainings].map(applyOverrides),
    [sessionTrainings, applyOverrides],
  );

  const trainingById = useCallback(
    (id: string) => {
      const t = [...TRAININGS, ...sessionTrainings].find((x) => x.id === id);
      return t ? applyOverrides(t) : undefined;
    },
    [sessionTrainings, applyOverrides],
  );

  const scheduleTraining = useCallback(
    (d: TrainingDraft) => {
      const id = `tr-s-${++counter.current}`;
      const attendees: Attendee[] = d.attendeeIds.map((pid) => {
        const p = personLabel(pid);
        return { id: pid, name: p.name, role: p.role, present: false };
      });
      setSessionTrainings((s) => [
        ...s,
        {
          id,
          topic: d.topic,
          entityId: d.entityId,
          depotId: d.depotId,
          scheduledAt: d.scheduledAt,
          durationMins: d.durationMins,
          trainerId: d.trainerId,
          status: "scheduled",
          attendees,
        },
      ]);
      return id;
    },
    [personLabel],
  );

  const setAttendance = useCallback((trainingId: string, attendeeId: string, present: boolean) => {
    setAttendanceOverrides((o) => ({ ...o, [trainingId]: { ...(o[trainingId] ?? {}), [attendeeId]: present } }));
  }, []);

  const completeTraining = useCallback((trainingId: string) => {
    setStatusOverrides((o) => ({ ...o, [trainingId]: "completed" }));
  }, []);

  return useMemo(
    () => ({ trainings, trainingById, scheduleTraining, setAttendance, completeTraining }),
    [trainings, trainingById, scheduleTraining, setAttendance, completeTraining],
  );
}

/* ------------------------------- date helpers ------------------------------ */

export const attendanceRate = (t: Training): number =>
  t.attendees.length ? Math.round((t.attendees.filter((a) => a.present).length / t.attendees.length) * 100) : 0;

export const presentCount = (t: Training): number => t.attendees.filter((a) => a.present).length;

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** Build the 6-week day matrix (Mon-first) covering the given month. */
export function monthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const start = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks;
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isoDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
