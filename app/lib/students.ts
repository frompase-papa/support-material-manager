// 生徒（児童）の型定義とユーティリティ。
//
// 児童名簿は HUG の出席データ取込によって動的に構築される（固定リストは持たない）。
// 提供形態（type）は HUG には無いため、アプリ側で保持・編集する。

export type StudentType = "alternate" | "curriculum";

export interface Student {
  id: string; // 児童名をそのままキーに使う（HUGにIDが無いため）
  name: string;
  furigana?: string;
  grade?: string;
  type: StudentType;
  /** 表示用アクセントカラー（名前から決定論的に割り当て） */
  color: string;
}

/** 提供形態の日本語ラベル */
export const TYPE_LABEL: Record<StudentType, string> = {
  alternate: "交互提供",
  curriculum: "カリキュラム固定",
};

export const TYPE_OPTIONS: { value: StudentType; label: string }[] = [
  { value: "alternate", label: TYPE_LABEL.alternate },
  { value: "curriculum", label: TYPE_LABEL.curriculum },
];

/** 新規児童の初期提供形態 */
export const DEFAULT_STUDENT_TYPE: StudentType = "alternate";

// アクセントカラーのパレット（判別しやすい色を用意）
const COLOR_PALETTE = [
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#7c3aed", // violet
  "#e11d48", // rose
  "#0891b2", // cyan
  "#db2777", // pink
  "#4f46e5", // indigo
  "#16a34a", // green
  "#ea580c", // orange
  "#9333ea", // purple
  "#0d9488", // teal
];

/** 名前から決定論的に色を割り当てる（同じ名前は常に同じ色） */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}
