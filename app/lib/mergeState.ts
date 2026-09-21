// クラウド保存時のマージ処理。
//
// 複数のPCが同じ workspace を共有しているため、保存のたびに
// 「今のクラウドの内容」と「この端末の内容」を突き合わせる必要がある。
// ロジックだけを切り出して、単体で検証できるようにしてある。

import type { Material } from "@/app/lib/attendance";
import type { StudentType } from "@/app/lib/students";
import {
  DEFAULT_TEACHING_MATERIALS,
  type TeachingMaterial,
} from "@/app/lib/teachingMaterials";
import type { SupportProgram } from "@/app/lib/supportPrograms";

/** クラウド／localStorage に保存する状態 */
export interface PersistedState {
  typeById: Record<string, StudentType>;
  overrides: Record<string, Material>;
  presentByDate: Record<string, string[]>;
  absentByDate: Record<string, string[]>;
  materials: TeachingMaterial[];
  assignments: Record<string, string[]>; // recordId -> 教材id[]
  notes: Record<string, string>; // studentId -> 支援メモ
  /** カリキュラムアセスメントシート（Googleスプレッドシート等）のURL */
  assessmentUrl: string;
  /** 専門支援マスタ */
  supportPrograms: SupportProgram[];
  /** 専門支援の割り当て recordId -> 専門支援id[] */
  supportAssignments: Record<string, string[]>;
}

/** null/空配列/空オブジェクト/空文字 を「空」とみなす */
export function isEmptyVal(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

/**
 * 保存時の安全マージ。
 *
 * @param trustLocal
 *   クラウドの内容を実際に受け取れているか。
 *   - true  … この端末はクラウドの最新を読んだうえで編集している。
 *             **「全部消した」も利用者の意思**なので、ローカルをそのまま正とする。
 *   - false … まだ読めていない（オフライン・読み取りエラー等）。
 *             空のローカルでクラウドを消してしまわないよう、クラウド側を残す。
 *
 * trustLocal を入れる前は、0件になった時点で必ずクラウドが復活していたため、
 * 「教材マスタの最後の1件が削除できない」状態になっていた。
 */
export function mergePreferNonEmpty(
  cloud: Partial<PersistedState>,
  local: PersistedState,
  trustLocal: boolean
): PersistedState {
  const pick = <T>(l: T, c: T | undefined): T =>
    trustLocal || !isEmptyVal(l) || isEmptyVal(c) ? l : (c as T);

  // 教材マスタは初期値がダミー（非空）なので通常のガードでは守れない。
  // クラウド未読の端末が「未変更の初期ダミー」でカスタム教材を上書きするのを防ぐ。
  const localMatUntouched =
    local.materials === DEFAULT_TEACHING_MATERIALS ||
    isEmptyVal(local.materials);
  const materials =
    !trustLocal && localMatUntouched && !isEmptyVal(cloud.materials)
      ? (cloud.materials as TeachingMaterial[])
      : local.materials;

  return {
    typeById: pick(local.typeById, cloud.typeById),
    overrides: pick(local.overrides, cloud.overrides),
    presentByDate: pick(local.presentByDate, cloud.presentByDate),
    absentByDate: pick(local.absentByDate, cloud.absentByDate),
    materials,
    assignments: pick(local.assignments, cloud.assignments),
    notes: pick(local.notes, cloud.notes),
    assessmentUrl: pick(local.assessmentUrl, cloud.assessmentUrl),
    supportPrograms: pick(local.supportPrograms, cloud.supportPrograms),
    supportAssignments: pick(local.supportAssignments, cloud.supportAssignments),
  };
}
