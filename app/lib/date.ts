// 日付関連のユーティリティ関数。
// 週は「日曜はじまり」で扱う（日本の一般的なカレンダー表記に合わせる）。

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 時刻を 0:00:00 に落とした新しい Date を返す */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** n 日進めた（マイナスなら戻した）新しい Date を返す */
export function addDays(date: Date, n: number): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Date → "YYYY-MM-DD"（ローカルタイム基準。タイムゾーンずれを避ける） */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 同じ日付（年月日）かどうか */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 週のはじまり（日曜）の 0:00 を返す */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  return addDays(d, -d.getDay());
}

/** 指定日を含む1週間（日〜土）の7日分を返す */
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * 指定日を含む月のカレンダー行列を返す。
 * 前月・翌月にはみ出す日も含めた「週（7日）× 必要な行数」の2次元配列。
 */
export function getMonthMatrix(date: Date): Date[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 月初の曜日ぶんだけ前月から埋める
  const leadingDays = firstOfMonth.getDay();
  const totalCells = leadingDays + daysInMonth;
  const weekCount = Math.ceil(totalCells / 7);

  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d))
  );
}

/** 例: 2026年7月28日（火） */
export function formatFullDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${
    WEEKDAY_LABELS[date.getDay()]
  }）`;
}

/** 例: 2026年7月 */
export function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}
