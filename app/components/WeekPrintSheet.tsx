"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { WEEKDAY_LABELS } from "@/app/lib/date";
import {
  TM_TYPE_LABEL,
  type TeachingMaterial,
} from "@/app/lib/teachingMaterials";

/**
 * A4横（297×210mm）から余白8mmを引いた印刷可能領域。
 * 高さは端数で2枚目に送られないよう1mmだけ余裕を持たせている。
 */
const SHEET_W_MM = 281;
const SHEET_H_MM = 193;

/** 自動倍率の下限・上限（内容が少ないときは拡大して1枚を使い切る） */
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.6;

/** これ以下に縮むと紙で読みづらいので画面上で警告する */
const WARN_SCALE = 0.65;

/** 倍率調整の打ち切り回数（振動しても必ず止まるようにする） */
const MAX_TRIES = 12;

type DayColumn = {
  day: Date;
  /** カリキュラムの生徒（教材選定の対象） */
  curriculum: { name: string; grade?: string; materials: TeachingMaterial[] }[];
  /** タブレットの生徒（名前のみ） */
  tablet: string[];
};

function dayLabel(day: Date): string {
  return `${day.getMonth() + 1}/${day.getDate()}（${
    WEEKDAY_LABELS[day.getDay()]
  }）`;
}

/**
 * 今週のカリキュラム内容を A4横1枚に印刷するシート。
 *
 * - 上段：カリキュラムの生徒と、その日の選定教材
 * - 下段：タブレットの生徒の名前（上段と同じ文字サイズ）
 * - 内容の量に合わせて自動で拡大・縮小し、1枚を使い切る
 * - 印刷時に白紙ページが出ないよう、body 直下（ポータル）に描画する
 */
export function WeekPrintSheet({
  store,
  days,
  onClose,
}: {
  store: AttendanceStore;
  days: Date[];
  onClose: () => void;
}) {
  const columns: DayColumn[] = useMemo(() => {
    return days
      .map((day) => {
        const items = store.getForDate(day);
        return {
          day,
          curriculum: items
            .filter((item) => item.material === "curriculum")
            .map((item) => ({
              name: item.student.name,
              grade: item.student.grade,
              materials: store
                .getAssignedMaterialIds(item.student.id, day)
                .map((id) => store.getMaterialById(id))
                .filter((m): m is TeachingMaterial => Boolean(m)),
            })),
          tablet: items
            .filter((item) => item.material === "tablet")
            .map((item) => item.student.name),
        };
      })
      // カリキュラムが0名でも、タブレットの生徒がいる日は列を残す
      .filter((col) => col.curriculum.length > 0 || col.tablet.length > 0);
  }, [days, store]);

  const rangeLabel = `${dayLabel(days[0])}〜 ${dayLabel(days[6])}`;
  const curriculumCount = columns.reduce((n, c) => n + c.curriculum.length, 0);
  const tabletCount = columns.reduce((n, c) => n + c.tablet.length, 0);
  const hasTablet = tabletCount > 0;
  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`,
  };

  /* --- 1枚を使い切るように倍率を自動調整 ------------------------- */
  const bodyRef = useRef<HTMLDivElement>(null);
  const triesRef = useRef(0);
  const [scale, setScale] = useState(1);

  const lastColumnsRef = useRef(columns);

  useLayoutEffect(() => {
    // 内容が変わったら調整回数だけリセットする（倍率は今の値から詰め直せばよい）
    if (lastColumnsRef.current !== columns) {
      lastColumnsRef.current = columns;
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
    // はみ出しているときは回数に関係なく縮める。拡大は打ち切り回数まで。
    if (!overflowing && triesRef.current >= MAX_TRIES) return;
    if (triesRef.current >= MAX_TRIES * 2) return;

    let next = scale * (avail / used);
    // 拡大は折り返しが増えて跳ね返ることがあるので控えめに寄せる
    if (!overflowing) next = scale + (next - scale) * 0.9;
    next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));

    if (Math.abs(next - scale) > 0.01) {
      triesRef.current += 1;
      setScale(next);
    }
  }, [scale, columns]);

  // ボタン操作で開くコンポーネントなのでSSRでは描画されないが、念のため
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id="week-print-portal"
      className="fixed inset-0 z-50 overflow-auto bg-zinc-700/90 p-4"
    >
      {/* 操作バー（印刷時は出さない） */}
      <div className="mx-auto mb-4 flex max-w-[281mm] flex-wrap items-center gap-3 print:hidden">
        <h2 className="text-lg font-bold text-white">
          今週のカリキュラム内容（印刷プレビュー）
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

      {scale <= WARN_SCALE && (
        <div className="mx-auto mb-3 max-w-[281mm] rounded-lg bg-amber-100 px-4 py-2 text-xs text-amber-900 print:hidden">
          ⚠ 内容が多く、1枚に収めるとかなり小さくなります（表示倍率{" "}
          {Math.round(scale * 100)}%）。日を分けて印刷するか、教材名を短くすることをご検討ください。
        </div>
      )}

      {/* A4横1枚ぶんの用紙 */}
      <div
        id="week-print-sheet"
        className="mx-auto bg-white text-black shadow-2xl print:shadow-none"
        style={{ width: `${SHEET_W_MM}mm`, height: `${SHEET_H_MM}mm` }}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* 見出し */}
          <div className="mb-1.5 flex shrink-0 items-baseline gap-3 border-b-2 border-black pb-1">
            <h1 className="text-[15pt] font-bold">今週のカリキュラム内容</h1>
            <span className="text-[10pt] font-semibold">{rangeLabel}</span>
            <span className="ml-auto text-[8pt]">
              カリキュラム {curriculumCount} 名 ／ タブレット {tabletCount} 名
            </span>
          </div>

          {columns.length === 0 ? (
            <p className="pt-8 text-center text-[10pt]">
              この週の出席予定はありません。
            </p>
          ) : (
            <div className="min-h-0 flex-1">
              {/* 上段・下段まとめて倍率調整の対象にする */}
              <div
                ref={bodyRef}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: `${100 / scale}%`,
                }}
              >
                {/* 上段：カリキュラムの生徒と選定教材 */}
                <div className="grid gap-2" style={gridStyle}>
                  {columns.map((col) => (
                    <div
                      key={col.day.toISOString()}
                      className="border border-black/40"
                    >
                      <div className="border-b border-black/40 bg-zinc-100 px-1.5 py-0.5 text-[10pt] font-bold">
                        {dayLabel(col.day)}
                        <span className="ml-1 text-[8.5pt] font-normal">
                          {col.curriculum.length}名
                        </span>
                      </div>

                      {col.curriculum.length === 0 ? (
                        <p className="px-1.5 py-1 text-[9pt]">カリキュラムなし</p>
                      ) : (
                        <ul>
                          {col.curriculum.map((row, i) => (
                            <li
                              key={`${row.name}-${i}`}
                              className="border-b border-dotted border-black/30 px-1.5 py-[2pt] last:border-b-0"
                            >
                              <div className="text-[9.5pt] font-bold leading-tight">
                                {row.name}
                                {row.grade && (
                                  <span className="ml-1 text-[7.5pt] font-normal">
                                    {row.grade}
                                  </span>
                                )}
                              </div>

                              {row.materials.length > 0 && (
                                <ol>
                                  {row.materials.map((m) => (
                                    <li
                                      key={m.id}
                                      className="text-[8.5pt] leading-tight"
                                    >
                                      ・{m.title}
                                      <span className="ml-1 text-[7pt]">
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
                    </div>
                  ))}
                </div>

                {/* 下段：タブレットの生徒（上段と同じ文字サイズ） */}
                {hasTablet && (
                  <div className="mt-2 border-t-2 border-black pt-1">
                    <div className="mb-1 text-[10pt] font-bold">
                      タブレットの生徒
                    </div>
                    <div className="grid gap-2" style={gridStyle}>
                      {columns.map((col) => (
                        <div
                          key={col.day.toISOString()}
                          className="border border-black/40"
                        >
                          <div className="border-b border-black/40 bg-zinc-100 px-1.5 py-0.5 text-[10pt] font-bold">
                            {dayLabel(col.day)}
                            <span className="ml-1 text-[8.5pt] font-normal">
                              {col.tablet.length}名
                            </span>
                          </div>
                          {col.tablet.length === 0 ? (
                            <p className="px-1.5 py-[2pt] text-[9pt]">－</p>
                          ) : (
                            <ul>
                              {col.tablet.map((name, i) => (
                                <li
                                  key={`${name}-${i}`}
                                  className="border-b border-dotted border-black/30 px-1.5 py-[2pt] text-[9.5pt] font-bold leading-tight last:border-b-0"
                                >
                                  {name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
