// 出席レコードと教材の解決ロジック。
//
// データ構造は「曜日ルール」ではなく、日付ごとの出席レコード（AttendanceRecord）で持つ。
// これにより HUG の出席データと連動し、任意の日付に出席登録・教材切り替えができる。

import type { Student } from "@/app/lib/students";

/**
 * 提供教材
 * - curriculum : カリキュラム
 * - tablet     : タブレット
 */
export type Material = "curriculum" | "tablet";

export const MATERIAL_LABEL: Record<Material, string> = {
  curriculum: "カリキュラム",
  tablet: "タブレット",
};

export const MATERIAL_OPTIONS: { value: Material; label: string }[] = [
  { value: "curriculum", label: MATERIAL_LABEL.curriculum },
  { value: "tablet", label: MATERIAL_LABEL.tablet },
];

/** 反対の教材を返す（交互提供の自動判定用） */
export function oppositeMaterial(m: Material): Material {
  return m === "curriculum" ? "tablet" : "curriculum";
}

/** 1件の出席（生徒がその日に来所したという事実） */
export interface AttendanceRecord {
  id: string; // `${studentId}_${dateKey}`
  studentId: string;
  date: string; // "YYYY-MM-DD"
}

/** レコードIDを生成（studentId と日付キーから一意に決まる） */
export function makeRecordId(studentId: string, dateKey: string): string {
  return `${studentId}_${dateKey}`;
}

/** 教材まで解決済みの出席情報 */
export interface ResolvedAttendance {
  record: AttendanceRecord;
  student: Student;
  material: Material;
  /** 手動で教材を変更（手修正）しているか */
  isManual: boolean;
  /** 交互提供による自動判定の結果か */
  isAuto: boolean;
  /** 「要教材選定」バッジを表示すべきか（＝教材がカリキュラム） */
  requiresSelection: boolean;
}

/**
 * すべての出席レコードについて、実際に提供される教材を解決する。
 *
 * ルール:
 * 1. 手動変更（overrides に値がある）→ その教材を採用（isManual）
 * 2. カリキュラム固定の生徒 → 常に「カリキュラム」
 * 3. 交互提供の生徒 → 直前の来所実績の教材の反対（初回は「カリキュラム」）（isAuto）
 *
 * 手動変更した実績も「前回実績」として次回の自動判定の基準になる
 * （時系列順に走査し、prev に確定した教材を引き継ぐため）。
 *
 * @returns recordId をキーにした解決結果の Map
 */
export function resolveAttendance(
  students: Student[],
  records: AttendanceRecord[],
  overrides: Record<string, Material>
): Map<string, ResolvedAttendance> {
  const studentById = new Map(students.map((s) => [s.id, s]));

  // 生徒ごとにレコードをまとめる
  const byStudent = new Map<string, AttendanceRecord[]>();
  for (const rec of records) {
    const list = byStudent.get(rec.studentId);
    if (list) list.push(rec);
    else byStudent.set(rec.studentId, [rec]);
  }

  const result = new Map<string, ResolvedAttendance>();

  for (const [studentId, recs] of byStudent) {
    const student = studentById.get(studentId);
    if (!student) continue;

    // 日付の昇順に走査（前回実績を引き継ぐため）
    const sorted = [...recs].sort((a, b) => a.date.localeCompare(b.date));

    let prev: Material | null = null;
    for (const rec of sorted) {
      const override = overrides[rec.id];
      let material: Material;
      let isManual = false;
      let isAuto = false;

      if (override) {
        material = override;
        isManual = true;
      } else if (student.type === "curriculum") {
        material = "curriculum";
      } else {
        // 交互提供：前回実績の反対（初回はカリキュラム）
        material = prev === null ? "curriculum" : oppositeMaterial(prev);
        isAuto = true;
      }

      result.set(rec.id, {
        record: rec,
        student,
        material,
        isManual,
        isAuto,
        requiresSelection: material === "curriculum",
      });

      prev = material; // 手動・自動を問わず、確定した教材を次回の基準にする
    }
  }

  return result;
}
