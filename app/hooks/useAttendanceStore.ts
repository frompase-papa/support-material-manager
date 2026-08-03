"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db, WORKSPACE_ID } from "@/app/lib/firebase";
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
import {
  DEFAULT_TEACHING_MATERIALS,
  MAX_MATERIALS_PER_DAY,
  newMaterialId,
  type TeachingMaterial,
} from "@/app/lib/teachingMaterials";
import { toDateKey } from "@/app/lib/date";
import type { ParsedMonth } from "@/app/lib/hugImport";

/** 旧ローカル保存キー（端末→クラウド移行の読み出し元） */
const LOCAL_BACKUP_KEY = "sm_attendance_v2";
/** 移行済みフラグ（一度移行したら案内を出さない） */
const MIGRATED_FLAG_KEY = "sm_migrated_to_cloud";

function makeClientId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** localStorage に保存する状態 */
interface PersistedState {
  typeById: Record<string, StudentType>;
  overrides: Record<string, Material>;
  presentByDate: Record<string, string[]>;
  absentByDate: Record<string, string[]>;
  materials: TeachingMaterial[];
  assignments: Record<string, string[]>; // recordId -> 教材id[]
  notes: Record<string, string>; // studentId -> 支援メモ
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
  importedMonths: string[];

  /** この端末にローカル保存された旧データがあるか（クラウド移行の案内用） */
  localBackupAvailable: boolean;
  /** 端末のローカルデータをクラウドへ移行する */
  migrateFromLocalStorage: () => boolean;

  getForDate: (date: Date) => ResolvedAttendance[];
  getAbsentNamesOnDate: (date: Date) => string[];
  countPendingOnDate: (date: Date) => number;
  getUnattendedStudents: (date: Date) => Student[];

  setStudentType: (studentId: string, type: StudentType) => void;
  setMaterial: (studentId: string, date: Date, material: Material) => void;
  clearMaterial: (studentId: string, date: Date) => void;
  addAttendance: (studentId: string, date: Date) => void;
  removeAttendance: (studentId: string, date: Date) => void;

  importMonth: (parsed: ParsedMonth) => ImportResult;
  clearMonth: (year: number, month: number) => void;
  clearAll: () => void;

  // 教材マスタ
  materials: TeachingMaterial[];
  getMaterialById: (id: string) => TeachingMaterial | undefined;
  addMaterial: (input: Omit<TeachingMaterial, "id">) => void;
  updateMaterial: (id: string, patch: Partial<Omit<TeachingMaterial, "id">>) => void;
  deleteMaterial: (id: string) => void;

  // 教材の割り当て（本日の提供教材、最大3）
  getAssignedMaterialIds: (studentId: string, date: Date) => string[];
  addAssignment: (studentId: string, date: Date, materialId: string) => void;
  removeAssignment: (studentId: string, date: Date, materialId: string) => void;

  // 支援情報メモ
  getNote: (studentId: string) => string;
  setNote: (studentId: string, text: string) => void;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function useAttendanceStore(): AttendanceStore {
  const [hydrated, setHydrated] = useState(false);
  const [typeById, setTypeById] = useState<Record<string, StudentType>>({});
  const [overrides, setOverrides] = useState<Record<string, Material>>({});
  const [presentByDate, setPresentByDate] = useState<Record<string, string[]>>({});
  const [absentByDate, setAbsentByDate] = useState<Record<string, string[]>>({});
  const [materials, setMaterials] = useState<TeachingMaterial[]>(
    DEFAULT_TEACHING_MATERIALS
  );
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const clientIdRef = useRef<string>("");
  if (!clientIdRef.current) clientIdRef.current = makeClientId();
  const lastSyncedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localBackupAvailable, setLocalBackupAvailable] = useState(false);

  const applyData = useCallback((d: Partial<PersistedState>) => {
    setTypeById(d.typeById ?? {});
    setOverrides(d.overrides ?? {});
    setPresentByDate(d.presentByDate ?? {});
    setAbsentByDate(d.absentByDate ?? {});
    if (d.materials) setMaterials(d.materials);
    setAssignments(d.assignments ?? {});
    setNotes(d.notes ?? {});
  }, []);

  // Firestore からリアルタイム購読（他PCの変更も自動反映）
  useEffect(() => {
    const ref = doc(db, "workspace", WORKSPACE_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const json = snap.exists()
          ? (snap.data().json as string | undefined)
          : undefined;
        if (json && json !== lastSyncedRef.current) {
          lastSyncedRef.current = json;
          try {
            applyData(JSON.parse(json) as Partial<PersistedState>);
          } catch {
            /* 壊れたデータは無視 */
          }
        }
        setHydrated(true);
      },
      () => setHydrated(true)
    );
    return () => unsub();
  }, [applyData]);

  // 端末に旧ローカルデータがあるか（クラウド移行の案内用）
  useEffect(() => {
    try {
      if (window.localStorage.getItem(MIGRATED_FLAG_KEY)) return;
      const raw = window.localStorage.getItem(LOCAL_BACKUP_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<PersistedState>;
        const hasSomething =
          (d.presentByDate && Object.keys(d.presentByDate).length > 0) ||
          (d.materials && d.materials.length > 0) ||
          (d.notes && Object.keys(d.notes).length > 0);
        setLocalBackupAvailable(Boolean(hasSomething));
      }
    } catch {
      /* 無視 */
    }
  }, []);

  const currentData = useMemo<PersistedState>(
    () => ({
      typeById,
      overrides,
      presentByDate,
      absentByDate,
      materials,
      assignments,
      notes,
    }),
    [
      typeById,
      overrides,
      presentByDate,
      absentByDate,
      materials,
      assignments,
      notes,
    ]
  );

  // 変更を Firestore に保存（デバウンス。自分の書き込みは再取込しない）
  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(currentData);
    if (serialized === lastSyncedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSyncedRef.current = serialized;
      setDoc(
        doc(db, "workspace", WORKSPACE_ID),
        {
          json: serialized,
          updatedAt: serverTimestamp(),
          updatedBy: clientIdRef.current,
        },
        { merge: true }
      ).catch(() => {
        /* 保存失敗（オフライン等）は次の変更時に再送される */
      });
    }, 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, currentData]);

  const migrateFromLocalStorage = useCallback((): boolean => {
    try {
      const raw = window.localStorage.getItem(LOCAL_BACKUP_KEY);
      if (!raw) return false;
      applyData(JSON.parse(raw) as Partial<PersistedState>);
      window.localStorage.setItem(MIGRATED_FLAG_KEY, "1");
      setLocalBackupAvailable(false);
      return true;
    } catch {
      return false;
    }
  }, [applyData]);

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
    setAbsentByDate((prev) => {
      const list = prev[key];
      if (!list || !list.includes(studentId)) return prev;
      const nextList = list.filter((id) => id !== studentId);
      const next = { ...prev };
      if (nextList.length > 0) next[key] = nextList;
      else delete next[key];
      return next;
    });
  }, []);

  const removeAttendance = useCallback((studentId: string, date: Date) => {
    const key = toDateKey(date);
    const recId = makeRecordId(studentId, key);
    setPresentByDate((prev) => {
      const list = prev[key];
      if (!list || !list.includes(studentId)) return prev;
      const nextList = list.filter((id) => id !== studentId);
      const next = { ...prev };
      if (nextList.length > 0) next[key] = nextList;
      else delete next[key];
      return next;
    });
    setAbsentByDate((prev) => {
      const list = prev[key] ?? [];
      if (list.includes(studentId)) return prev;
      return { ...prev, [key]: [...list, studentId] };
    });
    setOverrides((prev) => {
      if (!(recId in prev)) return prev;
      const next = { ...prev };
      delete next[recId];
      return next;
    });
    // 割り当て教材も掃除
    setAssignments((prev) => {
      if (!(recId in prev)) return prev;
      const next = { ...prev };
      delete next[recId];
      return next;
    });
  }, []);

  const importMonth = useCallback((parsed: ParsedMonth): ImportResult => {
    const prefix = monthKey(parsed.year, parsed.month);
    setPresentByDate((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) if (!k.startsWith(prefix)) next[k] = v;
      for (const [k, v] of Object.entries(parsed.presentByDate)) next[k] = v;
      return next;
    });
    setAbsentByDate((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) if (!k.startsWith(prefix)) next[k] = v;
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
      Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith(prefix)));
    setPresentByDate((prev) => strip(prev));
    setAbsentByDate((prev) => strip(prev));
  }, []);

  const clearAll = useCallback(() => {
    setPresentByDate({});
    setAbsentByDate({});
    setOverrides({});
    setAssignments({});
  }, []);

  // ---- 教材マスタ ----
  const materialMap = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials]
  );
  const getMaterialById = useCallback(
    (id: string) => materialMap.get(id),
    [materialMap]
  );
  const addMaterial = useCallback((input: Omit<TeachingMaterial, "id">) => {
    setMaterials((prev) => [...prev, { ...input, id: newMaterialId() }]);
  }, []);
  const updateMaterial = useCallback(
    (id: string, patch: Partial<Omit<TeachingMaterial, "id">>) => {
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );
  const deleteMaterial = useCallback((id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    // 割り当てからも取り除く
    setAssignments((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, ids] of Object.entries(prev)) {
        const filtered = ids.filter((mid) => mid !== id);
        if (filtered.length > 0) next[k] = filtered;
      }
      return next;
    });
  }, []);

  // ---- 割り当て ----
  const getAssignedMaterialIds = useCallback(
    (studentId: string, date: Date): string[] =>
      assignments[makeRecordId(studentId, toDateKey(date))] ?? [],
    [assignments]
  );
  const addAssignment = useCallback(
    (studentId: string, date: Date, materialId: string) => {
      const recId = makeRecordId(studentId, toDateKey(date));
      setAssignments((prev) => {
        const list = prev[recId] ?? [];
        if (list.includes(materialId) || list.length >= MAX_MATERIALS_PER_DAY)
          return prev;
        return { ...prev, [recId]: [...list, materialId] };
      });
    },
    []
  );
  const removeAssignment = useCallback(
    (studentId: string, date: Date, materialId: string) => {
      const recId = makeRecordId(studentId, toDateKey(date));
      setAssignments((prev) => {
        const list = prev[recId];
        if (!list) return prev;
        const filtered = list.filter((mid) => mid !== materialId);
        const next = { ...prev };
        if (filtered.length > 0) next[recId] = filtered;
        else delete next[recId];
        return next;
      });
    },
    []
  );

  // ---- 支援メモ ----
  const getNote = useCallback(
    (studentId: string): string => notes[studentId] ?? "",
    [notes]
  );
  const setNote = useCallback((studentId: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[studentId] = text;
      else delete next[studentId];
      return next;
    });
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
    localBackupAvailable,
    migrateFromLocalStorage,
    getForDate,
    getAbsentNamesOnDate,
    countPendingOnDate,
    getUnattendedStudents,
    setStudentType,
    setMaterial,
    clearMaterial,
    addAttendance,
    removeAttendance,
    importMonth,
    clearMonth,
    clearAll,
    materials,
    getMaterialById,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    getAssignedMaterialIds,
    addAssignment,
    removeAssignment,
    getNote,
    setNote,
  };
}
