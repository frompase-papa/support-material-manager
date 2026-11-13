"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { DayPrintSheet } from "@/app/components/DayPrintSheet";
import { PrepPrintSheet, type PrepKind } from "@/app/components/PrepPrintSheet";
import { addDays, formatFullDate, startOfDay, toDateKey } from "@/app/lib/date";

/**
 * 翌日準備。ホワイトボードに貼る3枚（A3横）を、日付を決めてまとめて出す入口。
 *   1. おやつ確認表
 *   2. カリキュラム・タブレット確認表（既存の当日シート）
 *   3. 17じ／18じ表（送迎アプリの送り出発時刻）
 */
export function PrepDialog({
  store,
  today,
  onClose,
}: {
  store: AttendanceStore;
  today: Date;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => addDays(today, 1));
  const [open, setOpen] = useState<PrepKind | "curriculum" | null>(null);

  if (typeof document === "undefined") return null;

  // 印刷シートを開いている間は、シートだけを出す（印刷時に他の要素が混ざらないように）
  if (open === "curriculum") {
    return <DayPrintSheet store={store} date={date} onClose={() => setOpen(null)} />;
  }
  if (open) {
    return <PrepPrintSheet kind={open} store={store} date={date} onClose={() => setOpen(null)} />;
  }

  const count = store.getForDate(date).length;
  const cards: { key: PrepKind | "curriculum"; title: string; desc: string }[] = [
    { key: "snack", title: "① おやつ確認表", desc: "来る全員の名前。「済」「OT」は印刷後に貼ります" },
    { key: "curriculum", title: "② カリキュラム・タブレット確認表", desc: "カリキュラムの子（教材つき）とタブレットの子" },
    { key: "leave", title: "③ 17じ／18じ表", desc: "帰りの送り出発時刻ごと。名前はひらがな（送迎アプリから取得）" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">翌日準備（ホワイトボード用）</h2>
          <button type="button" onClick={onClose} className="text-sm text-zinc-500 hover:underline">
            閉じる
          </button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            value={toDateKey(date)}
            onChange={(e) => {
              if (e.target.value) setDate(startOfDay(new Date(`${e.target.value}T00:00:00`)));
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="準備する日"
          />
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatFullDate(date)} ／ 出席 {count} 名
          </span>
        </div>
        {count === 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            この日の出席予定がまだありません。月の予定の取り込みや送迎アプリの反映を確認してください。
          </p>
        )}
        <ul className="space-y-2">
          {cards.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setOpen(c.key)}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{c.desc}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
