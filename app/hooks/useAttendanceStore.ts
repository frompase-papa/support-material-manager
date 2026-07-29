"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_STUDENT_TYPE,
  colorForName,
  type Student,
  type StudentType,
} from "@/app/lib/students";
import {
  makeRecordId,
  resolveAttendance,
  type AttendanceRecord,
  type Material,
  type ResolvedAttendance,
} from "@/app/lib/attendance";
import { startOfDay, toDateKey } from "@/app/lib/date";
import type { ParsedMonth } from "@/app/lib/hugImport";

const STORAGE_KEY = "sm_attendance_v2";

/** localStorage に保存する状態 */
interface PersistedState {
  typeById: Record<string, StudentType>;
  overrides: Record<string, Material>;
  presentByDate: Record<string, string[]>; // dateKey -> 出席児童名[]
  absentByDate: Record<string, string[]>; // dateKey -> 欠席児童名[]
}

export interface ImportResult {
  days: number;
  present: number;
  students: number;
}

export interface AttendanceStore {
  hydrated: boolean;
  hasData: boolean;
  students: Student[];
  importedMonths: string[]; // "YYYY-MM" 昇順

  getForDate: (date: Date) => ResolvedAttendance[];
  getAbsentNamesOnDate: (date: Date) => string[];
  countPendingOnDate: (date: Date) => number;
  getUnattendedStudents: (date: Date) => Student[];

  setStudentType: (studentId: string, type: StudentType) => void;
  setMaterial: (studentId: string, date: Date, material: Material) => void;
  clearMaterial: (studentId: string, date: Date) => void;
  addAttendance: (studentId: string, date: Date) => void;

  importMonth: (parsed: ParsedMonth) => ImportResult;
  clearMonth: (year: number, month: number) => void;
  clearAll: () => void;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function useAttendanceStore(): AttendanceStore {
  const [hydrated, setHydrated] = useState(false);
  const [typeById, setTypeById] = useState<Record<string, StudentType>>({});
  const [overrides, setOverrides] = useState<Record<string, Material>>({});
  const [presentByDate, setPresentByDate] = useState<Record<string, string[]>>(
    {}
  );
  const [absentByDate, setAbsentByDate] = useState<Record<string, string[]>>({});

  // 復元
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<PersistedState>;
        if (p.typeById) setTypeById(p.typeById);
        if (p.overrides) setOverrides(p.overrides);
        if (p.presentByDate) setPresentByDate(p.presentByDate);
        if (p.absentByDate) setAbsentByDate(p.absentByDate);
      }
    } catch {
      /* 壊れたデータは無視 */
    }
    setHydrated(true);
  }, []);

  // 保存
  useEffect(() => {
    if (!hydrated) return;
    const data: PersistedState = {
      typeById,
      overrides,
      presentByDate,
      absentByDate,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* 保存失敗は無視 */
    }
  }, [hydrated, typeById, overrides, presentByDate, absentByDate]);

  // 名簿（出席・欠席・設定済みの全児童名から構築）
  const students = useMemo<Student[]>(() => {
    const names = new Set<string>();
    for (const list of Object.values(presentByDate)) list.forEach((n) => names.add(n));
    for (const list of Object.values(absentByDate)) list.forEach((n) => names.add(n));
    Object.keys(typeById).forEach((n) => names.add(n));

    return [...names]
      .sort((a, b) => a.localeCompare(b, "ja"))
      .map((name) => ({
        id: name,
        name,
        type: typeById[name] ?? DEFAULT_STUDENT_TYPE,
        color: colorForName(name),
      }));
  }, [presentByDate, absentByDate, typeById]);

  // 出席レコード
  const records = useMemo<AttendanceRecord[]>(() => {
    const recs: AttendanceRecord[] = [];
    for (const [dateKey, ids] of Object.entries(presentByDate)) {
      for (const id of ids) {
        recs.push({ id: makeRecordId(id, dateKey), studentId: id, date: dateKey });
      }
    }
    return recs;
  }, [presentByDate]);

  const resolved = useMemo(
    () => resolveAttendance(students, records, overrides),
    [students, records, overrides]
  );

  const studentOrder = useMemo(
    () => new Map(students.map((s, i) => [s.id, i])),
    [students]
  );

  const getForDate = useCallback(
    (date: Date): ResolvedAttendance[] => {
      const key = toDateKey(date);
      const list: ResolvedAttendance[] = [];
      for (const item of resolved.values()) {
        if (item.record.date === key) list.push(item);
      }
      list.sort(
        (a, b) =>
          (studentOrder.get(a.student.id) ?? 0) -
          (studentOrder.get(b.student.id) ?? 0)
      );
      return list;
    },
    [resolved, studentOrder]
  );

  const getAbsentNamesOnDate = useCallback(
    (date: Date): string[] => absentByDate[toDateKey(date)] ?? [],
    [absentByDate]
  );

  const countPendingOnDate = useCallback(
    (date: Date): number =>
      getForDate(date).filter((r) => r.requiresSelection).length,
    [getForDate]
  );

  const getUnattendedStudents = useCallback(
    (date: Date): Student[] => {
      const present = new Set(presentByDate[toDateKey(date)] ?? []);
      return students.filter((s) => !present.has(s.id));
    },
    [presentByDate, students]
  );

  const setStudentType = useCallback((studentId: string, type: StudentType) => {
    setTypeById((prev) => ({ ...prev, [studentId]: type }));
  }, []);

  const setMaterial = useCallback(
    (studentId: string, date: Date, material: Material) => {
      const id = makeRecordId(studentId, toDateKey(date));
      setOverrides((prev) => ({ ...prev, [id]: material }));
    },
    []
  );

  const clearMaterial = useCallback((studentId: string, date: Date) => {
    const id = makeRecordId(studentId, toDateKey(date));
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const addAttendance = useCallback((studentId: string, date: Date) => {
    const key = toDateKey(date);
    setPresentByDate((prev) => {
      const list = prev[key] ?? [];
      if (list.includes(studentId)) return prev;
      return { ...prev, [key]: [...list, studentId] };
    });
  }, []);

  const importMonth = useCallback((parsed: ParsedMonth): ImportResult => {
    const prefix = monthKey(parsed.year, parsed.month);

    setPresentByDate((prev) => {
      const next: Record<string, string[]> = {};
      // 同じ月の既存データは一旦除去（再取込で上書き）
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(prefix)) next[k] = v;
      }
      for (const [k, v] of Object.entries(parsed.presentByDate)) next[k] = v;
      return next;
    });
    setAbsentByDate((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(prefix)) next[k] = v;
      }
      for (const [k, v] of Object.entries(parsed.absentByDate)) next[k] = v;
      return next;
    });

    const present = Object.values(parsed.presentByDate).reduce(
      (sum, list) => sum + list.length,
      0
    );
    return {
      days: Object.keys(parsed.presentByDate).length,
      present,
      students: parsed.studentNames.length,
    };
  }, []);

  const clearMonth = useCallback((year: number, month: number) => {
    const prefix = monthKey(year, month);
    const strip = (obj: Record<string, string[]>) =>
      Object.fromEntries(
        Object.entries(obj).filter(([k]) => !k.startsWith(prefix))
      );
    setPresentByDate((prev) => strip(prev));
    setAbsentByDate((prev) => strip(prev));
  }, []);

  const clearAll = useCallback(() => {
    setPresentByDate({});
    setAbsentByDate({});
    setOverrides({});
  }, []);

  const importedMonths = useMemo(() => {
    const set = new Set<string>();
    Object.keys(presentByDate).forEach((k) => set.add(k.slice(0, 7)));
    return [...set].sort();
  }, [presentByDate]);

  return {
    hydrated,
    hasData: Object.keys(presentByDate).length > 0,
    students,
    importedMonths,
    getForDate,
    getAbsentNamesOnDate,
    countPendingOnDate,
    getUnattendedStudents,
    setStudentType,
    setMaterial,
    clearMaterial,
    addAttendance,
    importMonth,
    clearMonth,
    clearAll,
  };
}
