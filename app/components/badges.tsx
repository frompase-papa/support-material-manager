import type { StudentType } from "@/app/lib/students";
import { TYPE_LABEL } from "@/app/lib/students";

/** 提供形態のバッジ（交互提供 / カリキュラム固定） */
export function TypeBadge({ type }: { type: StudentType }) {
  const styles =
    type === "curriculum"
      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

/**
 * 「要教材選定」バッジ。
 * その日の教材が「カリキュラム」のときにのみ表示する。
 */
export function MaterialSelectionBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-950 ring-1 ring-amber-500/50 dark:bg-amber-500 dark:text-amber-950">
      <span aria-hidden>⚠</span>
      要教材選定
    </span>
  );
}
