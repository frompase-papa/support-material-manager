"use client";

import { createPortal } from "react-dom";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { DayPrintPage } from "@/app/components/DayPrintSheet";
import { PrepPrintPage, type PrepKind } from "@/app/components/PrepPrintSheet";
import { toDateKey } from "@/app/lib/date";

export type PrepSheetKind = PrepKind | "curriculum";

export const PREP_KIND_LABEL: Record<PrepSheetKind, string> = {
  snack: "おやつ確認表",
  curriculum: "カリキュラム・タブレット",
  leave: "17じ／18じ表",
};

/** 表示・印刷の順番（日付ごとに、この順で並べる） */
export const PREP_KIND_ORDER: PrepSheetKind[] = ["snack", "curriculum", "leave"];

/**
 * 選んだ日付 × 選んだ種類を、A3横1枚ずつ続けて並べる（まとめて印刷）。
 * 日付ごとに おやつ → カリキュラム・タブレット → 17じ/18じ の順。
 * 印刷の仕組み（body直下・用紙サイズ・改ページ）は1日ぶんと同じ。
 */
export function PrepBatchSheet({
  store,
  dates,
  kinds,
  onClose,
}: {
  store: AttendanceStore;
  dates: Date[];
  kinds: PrepSheetKind[];
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  const ordered = PREP_KIND_ORDER.filter((k) => kinds.includes(k));
  const items = dates.flatMap((date) => ordered.map((kind) => ({ date, kind })));

  return createPortal(
    <div id="day-print-portal" className="fixed inset-0 z-50 overflow-auto bg-zinc-700/90 p-4">
      <div className="mx-auto mb-4 flex max-w-[400mm] flex-wrap items-center gap-3 print:hidden">
        <h2 className="text-lg font-bold text-white">まとめて印刷（A3横 {items.length}枚）</h2>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
          >
            🖨 {items.length}枚を印刷する
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/60 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            閉じる
          </button>
        </div>
      </div>
      <p className="mx-auto mb-3 max-w-[400mm] text-xs text-white/80 print:hidden">
        印刷の設定で用紙サイズを「A3」、倍率を「100%（既定）」にしてください。「PDFに保存」してから印刷してもかまいません。
      </p>
      {items.map(({ date, kind }) => (
        <div key={`${toDateKey(date)}-${kind}`} className="day-print-batch-item mb-6 print:mb-0">
          <p className="mx-auto mb-1 max-w-[400mm] text-xs text-white/70 print:hidden">
            {PREP_KIND_LABEL[kind]}
          </p>
          {kind === "curriculum" ? (
            <DayPrintPage store={store} date={date} />
          ) : (
            <PrepPrintPage kind={kind} store={store} date={date} />
          )}
        </div>
      ))}
    </div>,
    document.body
  );
}
