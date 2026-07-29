"use client";

import { useEffect } from "react";
import {
  TYPE_OPTIONS,
  type Student,
  type StudentType,
} from "@/app/lib/students";

/**
 * 生徒の提供形態（交互提供 / カリキュラム固定）を変更する設定モーダル。
 */
export function StudentSettingsPanel({
  students,
  onChangeType,
  onClose,
}: {
  students: Student[];
  onChangeType: (studentId: string, type: StudentType) => void;
  onClose: () => void;
}) {
  // Esc キーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="生徒設定"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">生徒設定 ／ 提供形態</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          各生徒の提供形態を変更できます。「交互提供」は前回実績の反対を自動でセットし、
          「カリキュラム固定」は原則カリキュラムを提供します。
        </p>

        <ul className="flex flex-col gap-3">
          {students.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium">{s.name}</span>
                {s.grade && (
                  <span className="text-xs text-zinc-400">{s.grade}</span>
                )}
              </div>

              <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
                {TYPE_OPTIONS.map((opt, i) => {
                  const active = s.type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChangeType(s.id, opt.value)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        i > 0
                          ? "border-l border-zinc-300 dark:border-zinc-700"
                          : ""
                      } ${
                        active
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                          : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
