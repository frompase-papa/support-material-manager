"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { formatFullDate } from "@/app/lib/date";
import {
  TM_TYPE_LABEL,
  type TeachingMaterial,
} from "@/app/lib/teachingMaterials";

/**
 * A3横（420×297mm）から余白10mmを引いた印刷可能領域。
 * 高さは端数で2枚目に送られないよう1mmだけ余裕を持たせている。
 */
const SHEET_W_MM = 400;
const SHEET_H_MM = 276;

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.2;
/** これ以下に縮むとホワイトボードから読みづらいので画面上で警告する */
const WARN_SCALE = 0.6;
const MAX_TRIES = 12;

/**
 * 当日のカリキュラム・タブレットの生徒をA3横1枚に印刷するシート。
 * ホワイトボードに貼り、遠目でも誰が何をするか分かるよう文字を大きくする。
 *
 * - 左：カリキュラムの生徒と選定教材 ／ 右：タブレットの生徒
 * - 内容の量に合わせて自動で拡大・縮小し、1枚を使い切る
 * - 印刷時に白紙ページが出ないよう、body 直下（ポータル）に描画する
 */
export function DayPrintSheet({
  store,
  date,
  onClose,
}: {
  store: AttendanceStore;
  date: Date;
  onClose: () => void;
}) {
  const { curriculum, tablet } = useMemo(() => {
    const items = store.getForDate(date);
    return {
      curriculum: items
        .filter((item) => item.material === "curriculum")
        .map((item) => ({
          id: item.record.id,
          name: item.student.name,
          grade: item.student.grade,
          materials: store
            .getAssignedMaterialIds(item.student.id, date)
            .map((id) => store.getMaterialById(id))
            .filter((m): m is TeachingMaterial => Boolean(m)),
        })),
      tablet: items
        .filter((item) => item.material === "tablet")
        .map((item) => ({
          id: item.record.id,
          name: item.student.name,
          grade: item.student.grade,
        })),
    };
  }, [date, store]);

  // プレビューを開いた時点で固定する
  const [printedAt] = useState(() => new Date());
  const total = curriculum.length + tablet.length;

  /* --- 1枚を使い切るように倍率を自動調整 ------------------------- */
  const bodyRef = useRef<HTMLDivElement>(null);
  const triesRef = useRef(0);
  const lastDataRef = useRef({ curriculum, tablet });
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (
      lastDataRef.current.curriculum !== curriculum ||
      lastDataRef.current.tablet !== tablet
    ) {
      lastDataRef.current = { curriculum, tablet };
      triesRef.current = 0;
    }

    const el = bodyRef.current;
    const frame = el?.parentElement;
    if (!el || !frame) return;

    const avail = frame.clientHeight;
    // el は width:100/scale% で組んであるので、実際の占有高さは scrollHeight × scale
    const used = el.scrollHeight * scale;
    if (!avail || !used) return;

    const overflowing = used > avail;
    if (!overflowing && triesRef.current >= MAX_TRIES) return;
    if (triesRef.current >= MAX_TRIES * 2) return;

    let next = scale * (avail / used);
    if (!overflowing) next = scale + (next - scale) * 0.9;
    next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));

    if (Math.abs(next - scale) > 0.01) {
      triesRef.current += 1;
      setScale(next);
    }
  }, [scale, curriculum, tablet]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id="day-print-portal"
      className="fixed inset-0 z-50 overflow-auto bg-zinc-700/90 p-4"
    >
      {/* 操作バー（印刷時は出さない） */}
      <div className="mx-auto mb-4 flex max-w-[400mm] flex-wrap items-center gap-3 print:hidden">
        <h2 className="text-lg font-bold text-white">
          本日のカリキュラム・タブレット（A3横 印刷プレビュー）
        </h2>
        <span className="rounded bg-white/15 px-2 py-1 text-xs text-white">
          表示倍率 {Math.round(scale * 100)}%
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
          >
            🖨 印刷する
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
        印刷の設定で用紙サイズを「A3」、倍率を「100%（既定）」にしてください。A3が使えない場合は「PDFに保存」してA4→A3の拡大印刷でも使えます。
      </p>

      {scale <= WARN_SCALE && (
        <div className="mx-auto mb-3 max-w-[400mm] rounded-lg bg-amber-100 px-4 py-2 text-xs text-amber-900 print:hidden">
          ⚠ 内容が多く、1枚に収めるとかなり小さくなります（表示倍率{" "}
          {Math.round(scale * 100)}%）。
        </div>
      )}

      {/* A3横1枚ぶんの用紙（印刷時は実寸） */}
      <div
        id="day-print-sheet"
        className="mx-auto bg-white text-black shadow-2xl print:shadow-none"
        style={{ width: `${SHEET_W_MM}mm`, height: `${SHEET_H_MM}mm` }}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* 見出し */}
          <div className="mb-3 flex shrink-0 items-baseline gap-6 border-b-4 border-black pb-2">
            <h1 className="text-[30pt] font-bold leading-none">
              {formatFullDate(date)}
            </h1>
            <span className="text-[16pt] font-semibold">本日の支援教材</span>
            <span className="ml-auto text-right text-[11pt] leading-tight">
              カリキュラム {curriculum.length} 名 ／ タブレット {tablet.length} 名
              <br />
              印刷：{formatFullDate(printedAt)}
            </span>
          </div>

          {total === 0 ? (
            <p className="pt-16 text-center text-[20pt]">
              この日の出席予定はありません。
            </p>
          ) : (
            <div className="min-h-0 flex-1">
              <div
                ref={bodyRef}
                className="grid items-start gap-4"
                style={{
                  gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)",
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: `${100 / scale}%`,
                }}
              >
                {/* 左：カリキュラム */}
                <section className="border-2 border-black">
                  <h2 className="bg-zinc-200 px-3 py-1 text-[20pt] font-bold">
                    カリキュラム
                    <span className="ml-2 text-[14pt] font-normal">
                      {curriculum.length}名
                    </span>
                  </h2>
                  {curriculum.length === 0 ? (
                    <p className="px-3 py-2 text-[14pt]">－</p>
                  ) : (
                    <ul className="grid grid-cols-2">
                      {curriculum.map((row) => (
                        <li
                          key={row.id}
                          className="border-b border-r border-dotted border-black/50 px-3 py-2"
                        >
                          <div className="text-[20pt] font-bold leading-tight">
                            {row.name}
                            {row.grade && (
                              <span className="ml-2 text-[11pt] font-normal">
                                {row.grade}
                              </span>
                            )}
                          </div>
                          {row.materials.length === 0 ? (
                            <p className="text-[12pt] text-black/50">
                              教材未選定
                            </p>
                          ) : (
                            <ol>
                              {row.materials.map((m) => (
                                <li
                                  key={m.id}
                                  className="text-[14pt] leading-snug"
                                >
                                  ・{m.title}
                                  <span className="ml-1 text-[10pt]">
                                    [{TM_TYPE_LABEL[m.type]}]
                                  </span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* 右：タブレット */}
                <section className="border-2 border-black">
                  <h2 className="bg-zinc-200 px-3 py-1 text-[20pt] font-bold">
                    タブレット
                    <span className="ml-2 text-[14pt] font-normal">
                      {tablet.length}名
                    </span>
                  </h2>
                  {tablet.length === 0 ? (
                    <p className="px-3 py-2 text-[14pt]">－</p>
                  ) : (
                    <ul>
                      {tablet.map((row) => (
                        <li
                          key={row.id}
                          className="border-b border-dotted border-black/50 px-3 py-2 text-[20pt] font-bold leading-tight last:border-b-0"
                        >
                          {row.name}
                          {row.grade && (
                            <span className="ml-2 text-[11pt] font-normal">
                              {row.grade}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
