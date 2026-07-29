"use client";

import { useEffect, useState } from "react";
import { parseHugMonth } from "@/app/lib/hugImport";
import type { AttendanceStore, ImportResult } from "@/app/hooks/useAttendanceStore";

/**
 * HUG の出席カレンダーを貼り付けて取り込むパネル。
 * 毎月分を年月を指定して取り込み、マージ・上書きできる。
 */
export function HugImportPanel({
  store,
  defaultYear,
  defaultMonth,
  onClose,
}: {
  store: AttendanceStore;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
}) {
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleImport = () => {
    setError(null);
    setResult(null);
    if (!text.trim()) {
      setError("HUGの出席カレンダーを貼り付けてください。");
      return;
    }
    try {
      const parsed = parseHugMonth(text, year, month);
      if (Object.keys(parsed.presentByDate).length === 0) {
        setError(
          "出席データを読み取れませんでした。表全体（日付・出席人数・児童名）を貼り付けているか確認してください。"
        );
        return;
      }
      const r = store.importMonth(parsed);
      setResult(r);
      setText("");
    } catch {
      setError("取込中にエラーが発生しました。貼り付け内容をご確認ください。");
    }
  };

  const years = [defaultYear - 1, defaultYear, defaultYear + 1];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="HUGデータ取込"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">HUGデータ取込</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <ol className="mb-4 list-decimal space-y-1 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
          <li>HUGの出席カレンダー画面を開き、表全体を選択してコピー</li>
          <li>下の欄に貼り付け、対象の「年・月」を選んで「取込」</li>
          <li>毎月、同じ手順で追加できます（同じ月は上書き）</li>
        </ol>

        {/* 年月 */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium">対象月：</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </div>

        {/* 貼り付け欄 */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="ここにHUGの出席カレンダーを貼り付け…"
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800"
        />

        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}
        {result && (
          <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            取込完了：{year}年{month}月 ／ {result.days}日分 ／ のべ出席{" "}
            {result.present}件 ／ 児童 {result.students}名
          </p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleImport}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            取込
          </button>
        </div>

        {/* 取込済みの月 */}
        <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-semibold">取込済みの月</h3>
          {store.importedMonths.length === 0 ? (
            <p className="text-xs text-zinc-400">まだ取り込まれていません。</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {store.importedMonths.map((mk) => {
                const [y, m] = mk.split("-").map(Number);
                return (
                  <li
                    key={mk}
                    className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pl-3 pr-1 text-sm dark:border-zinc-700"
                  >
                    <span>
                      {y}年{m}月
                    </span>
                    <button
                      type="button"
                      onClick={() => store.clearMonth(y, m)}
                      aria-label={`${y}年${m}月を削除`}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {store.hasData && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "取り込んだ出席データと教材の変更をすべて削除します。よろしいですか？"
                  )
                ) {
                  store.clearAll();
                }
              }}
              className="mt-3 text-xs text-red-500 underline underline-offset-2 hover:text-red-600"
            >
              すべての取込データを削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
