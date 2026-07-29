"use client";

import {
  MATERIAL_OPTIONS,
  type Material,
} from "@/app/lib/attendance";

/**
 * その日の教材（カリキュラム / タブレット）をワンタップで切り替えるトグル。
 * - isManual: 手動変更済み（override あり）
 * - isAuto  : 交互提供の自動判定による値
 */
export function MaterialToggle({
  material,
  isManual,
  isAuto,
  onSelect,
  onClearToAuto,
}: {
  material: Material;
  isManual: boolean;
  isAuto: boolean;
  onSelect: (m: Material) => void;
  onClearToAuto: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
        {MATERIAL_OPTIONS.map((opt, i) => {
          const active = material === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={active}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                i > 0 ? "border-l border-zinc-300 dark:border-zinc-700" : ""
              } ${
                active
                  ? opt.value === "curriculum"
                    ? "bg-amber-400 text-amber-950"
                    : "bg-emerald-500 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 状態表示 */}
      {isManual ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
          <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            手動
          </span>
          <button
            type="button"
            onClick={onClearToAuto}
            className="text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            自動に戻す
          </button>
        </span>
      ) : isAuto ? (
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          自動
        </span>
      ) : null}
    </div>
  );
}
