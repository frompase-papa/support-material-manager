"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { DayPrintSheet } from "@/app/components/DayPrintSheet";
import { PrepPrintSheet, type PrepKind } from "@/app/components/PrepPrintSheet";
import {
  PrepBatchSheet,
  PREP_KIND_LABEL,
  PREP_KIND_ORDER,
  type PrepSheetKind,
} from "@/app/components/PrepBatchSheet";
import { WEEKDAY_LABELS, addDays, formatFullDate, startOfDay, toDateKey } from "@/app/lib/date";

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

  // 1週間まとめて印刷
  const [mode, setMode] = useState<"day" | "week">("day");
  const [weekStart, setWeekStart] = useState(() => {
    // 明日を含む週の月曜
    const t = addDays(today, 1);
    return addDays(t, -((t.getDay() + 6) % 7));
  });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // 日付ごとのチェック。未操作の日は「出席のある日」を初期値にする
  const [dayChecks, setDayChecks] = useState<Record<string, boolean>>({});
  const [kindChecks, setKindChecks] = useState<Record<PrepSheetKind, boolean>>({
    snack: true,
    curriculum: true,
    leave: true,
  });
  const [batchOpen, setBatchOpen] = useState(false);
  // 選んだ1日ぶんの3枚をまとめて印刷
  const [dayBatchOpen, setDayBatchOpen] = useState(false);
  const dayChecked = (d: Date) => dayChecks[toDateKey(d)] ?? store.getForDate(d).length > 0;

  if (typeof document === "undefined") return null;

  // 印刷シートを開いている間は、シートだけを出す（印刷時に他の要素が混ざらないように）
  if (open === "curriculum") {
    return <DayPrintSheet store={store} date={date} onClose={() => setOpen(null)} />;
  }
  if (dayBatchOpen) {
    return (
      <PrepBatchSheet
        store={store}
        dates={[date]}
        kinds={PREP_KIND_ORDER}
        onClose={() => setDayBatchOpen(false)}
      />
    );
  }
  if (batchOpen) {
    return (
      <PrepBatchSheet
        store={store}
        dates={weekDays.filter(dayChecked)}
        kinds={PREP_KIND_ORDER.filter((k) => kindChecks[k])}
        onClose={() => setBatchOpen(false)}
      />
    );
  }
  if (open) {
    return <PrepPrintSheet kind={open} store={store} date={date} onClose={() => setOpen(null)} />;
  }

  const count = store.getForDate(date).length;
  const cards: { key: PrepKind | "curriculum"; title: string; desc: string }[] = [
    { key: "snack", title: "① おやつ確認表", desc: "来る全員の名前。「済」「OT」は印刷後に貼ります" },
    { key: "curriculum", title: "② カリキュラム・タブレット確認表", desc: "カリキュラムの子（教材つき）とタブレットの子" },
    { key: "leave", title: "③ 17じ／18じ表", desc: "帰りの送り出発時刻ごと。苗字は漢字・名前はひらがな（送迎アプリから取得）" },
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
        <div className="mb-3 flex gap-1 text-sm">
          {(["day", "week"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 ${
                mode === m
                  ? "bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900"
                  : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {m === "day" ? "1日" : "1週間まとめて"}
            </button>
          ))}
        </div>
        {mode === "day" ? (
          <>
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
        <button
          type="button"
          disabled={count === 0}
          onClick={() => setDayBatchOpen(true)}
          className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-bold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          🖨 ①②③をまとめて印刷（この日の3枚）
        </button>
          </>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className="rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                aria-label="前の週"
              >
                ‹
              </button>
              <span className="font-medium">
                {weekDays[0].getMonth() + 1}/{weekDays[0].getDate()} 〜 {weekDays[6].getMonth() + 1}/
                {weekDays[6].getDate()}
              </span>
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                aria-label="次の週"
              >
                ›
              </button>
            </div>
            <p className="mb-1 text-xs font-semibold text-zinc-500">印刷する日</p>
            <ul className="mb-3 grid grid-cols-2 gap-1 text-sm">
              {weekDays.map((d) => {
                const n = store.getForDate(d).length;
                return (
                  <li key={toDateKey(d)}>
                    <label className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
                      <input
                        type="checkbox"
                        checked={dayChecked(d)}
                        onChange={(e) => setDayChecks({ ...dayChecks, [toDateKey(d)]: e.target.checked })}
                      />
                      <span>
                        {d.getMonth() + 1}/{d.getDate()}（{WEEKDAY_LABELS[d.getDay()]}）
                      </span>
                      <span className={`ml-auto text-xs ${n === 0 ? "text-zinc-400" : "text-zinc-500"}`}>
                        {n === 0 ? "予定なし" : `${n}名`}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mb-1 text-xs font-semibold text-zinc-500">印刷する表（1つだけ選ぶと個別、全部選ぶとまとめて）</p>
            <ul className="mb-3 space-y-1 text-sm">
              {PREP_KIND_ORDER.map((k) => (
                <li key={k}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={kindChecks[k]}
                      onChange={(e) => setKindChecks({ ...kindChecks, [k]: e.target.checked })}
                    />
                    {PREP_KIND_LABEL[k]}
                  </label>
                </li>
              ))}
            </ul>
            {(() => {
              const sheets = weekDays.filter(dayChecked).length * PREP_KIND_ORDER.filter((k) => kindChecks[k]).length;
              return (
                <button
                  type="button"
                  disabled={sheets === 0}
                  onClick={() => setBatchOpen(true)}
                  className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                >
                  📋 {sheets}枚のプレビュー・印刷へ
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
