"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { formatFullDate, toDateKey } from "@/app/lib/date";
import { normalizeName } from "@/app/lib/nameMatch";

/**
 * 翌日準備のホワイトボード用シート（A3横1枚）。
 *   snack … おやつ確認表（その日来る全員の名前。「済」「OT」は印刷後に手で貼る）
 *   leave … 17じ／18じ表（帰りの送り出発時刻ごと。苗字は漢字・名前はひらがな）
 *
 * 印刷の仕組み（body直下に出す・用紙サイズ）は DayPrintSheet と同じ。
 * globals.css の #day-print-portal / #day-print-sheet をそのまま使う。
 */

export type PrepKind = "snack" | "leave";

type PlanChild = { name: string; furigana: string; leaveTime: string | null };

const SHEET_W_MM = 400;
const SHEET_H_MM = 276;

// 時刻の列の見出し色（17じ=ピンク、18じ=青 の見慣れた並びに合わせる）
const COLUMN_COLORS = ["#f9a8d4", "#93c5fd", "#fde68a", "#86efac", "#c4b5fd"];

const ja = (a: string, b: string) => a.localeCompare(b, "ja");

/**
 * ボードの表記（「山本 なつめ」）に合わせる。苗字は漢字、名前はひらがな。
 * 苗字・名前は空白（半角・全角）で分けてある前提。分けられないときは、ふりがな→漢字名の順で出す
 */
function boardName(c: PlanChild): string {
  const split = (v: string) => v.trim().split(/[\s　]+/).filter(Boolean);
  const kanji = split(c.name);
  const kana = split(c.furigana);
  if (kanji.length >= 2 && kana.length >= 2) return `${kanji[0]} ${kana.slice(1).join("")}`;
  return c.furigana ? kana.join(" ") : c.name;
}

/** 人数に応じて1枚に収まる文字の大きさ（pt） */
function fontPt(count: number): number {
  if (count <= 8) return 34;
  if (count <= 12) return 28;
  if (count <= 18) return 22;
  return 18;
}

export function PrepPrintSheet({
  kind,
  store,
  date,
  onClose,
}: {
  kind: PrepKind;
  store: AttendanceStore;
  date: Date;
  onClose: () => void;
}) {
  const dateKey = toDateKey(date);

  // おやつ表：支援アプリの出席（休みを反映済み）
  const snackNames = useMemo(
    () => store.getForDate(date).map((i) => i.student.name).sort(ja),
    [store, date]
  );

  // 17じ/18じ表：送迎アプリから取る
  const [plan, setPlan] = useState<PlanChild[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (kind !== "leave") return;
    let cancelled = false;
    fetch(`/api/day-plan?date=${dateKey}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setError(json?.error ?? "送迎アプリの情報を取得できませんでした。");
          return;
        }
        setPlan(json.children as PlanChild[]);
      })
      .catch(() => {
        if (!cancelled) setError("送迎アプリの情報を取得できませんでした。");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, dateKey]);

  // 支援アプリの画面で付けた「休み」も反映する（送迎アプリ側だけでは分からないため）
  const visiblePlan = useMemo(() => {
    if (!plan) return null;
    const absent = new Set(store.getAbsentNamesOnDate(date).map(normalizeName));
    return plan.filter((c) => !absent.has(normalizeName(c.name)));
  }, [plan, store, date]);

  const columns = useMemo(() => {
    if (!visiblePlan) return [];
    const byHour = new Map<string, PlanChild[]>();
    for (const c of visiblePlan) {
      const h = c.leaveTime ? String(Number(c.leaveTime.split(":")[0])) : "";
      byHour.set(h, [...(byHour.get(h) ?? []), c]);
    }
    return [...byHour.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : Number(a) - Number(b)))
      .map(([hour, kids]) => ({
        label: hour === "" ? "時刻なし" : `${hour}じ`,
        kids: kids.sort(
          (a, b) => (a.leaveTime ?? "").localeCompare(b.leaveTime ?? "") || ja(a.furigana || a.name, b.furigana || b.name)
        ),
      }));
  }, [visiblePlan]);

  if (typeof document === "undefined") return null;

  const title = kind === "snack" ? "おやつ確認表" : "帰りの送り出発（17じ・18じ）";
  const maxRows =
    kind === "snack" ? Math.ceil(snackNames.length / 2) : Math.max(0, ...columns.map((c) => c.kids.length));
  const pt = fontPt(maxRows);

  return createPortal(
    <div id="day-print-portal" className="fixed inset-0 z-50 overflow-auto bg-zinc-700/90 p-4">
      <div className="mx-auto mb-4 flex max-w-[400mm] flex-wrap items-center gap-3 print:hidden">
        <h2 className="text-lg font-bold text-white">{title}（A3横 印刷プレビュー）</h2>
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
        印刷の設定で用紙サイズを「A3」、倍率を「100%（既定）」にしてください。
        {kind === "snack" && "「済」「OT」などの印は印刷しません。当日、実施してから貼ってください。"}
      </p>
      {kind === "leave" && error && (
        <div className="mx-auto mb-3 max-w-[400mm] rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900 print:hidden">
          ⚠ {error}
        </div>
      )}

      <div
        id="day-print-sheet"
        className="mx-auto bg-white text-black shadow-2xl print:shadow-none"
        style={{ width: `${SHEET_W_MM}mm`, height: `${SHEET_H_MM}mm` }}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="mb-3 flex shrink-0 items-baseline gap-6 border-b-4 border-black pb-2">
            <h1 className="text-[30pt] font-bold leading-none">{formatFullDate(date)}</h1>
            <span className="text-[16pt] font-semibold">{title}</span>
            <span className="ml-auto text-right text-[11pt] leading-tight">
              {kind === "snack" ? `${snackNames.length} 名` : visiblePlan ? `${visiblePlan.length} 名` : ""}
            </span>
          </div>

          {kind === "snack" ? (
            snackNames.length === 0 ? (
              <p className="pt-16 text-center text-[20pt]">この日の出席予定はありません。</p>
            ) : (
              <ul
                className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-16 gap-y-3 pt-2"
                style={{ fontSize: `${pt}pt` }}
              >
                {snackNames.map((n) => (
                  <li key={n} className="border-b-2 border-dotted border-black/40 pb-1 font-bold leading-tight">
                    {n}
                  </li>
                ))}
              </ul>
            )
          ) : !plan && !error ? (
            <p className="pt-16 text-center text-[20pt]">読み込み中…</p>
          ) : columns.length === 0 ? (
            <p className="pt-16 text-center text-[20pt]">この日の送迎の予定はありません。</p>
          ) : (
            <div
              className="grid min-h-0 flex-1 gap-6"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              {columns.map((col, i) => (
                <section key={col.label}>
                  <h2
                    className="mb-2 inline-block px-6 py-1 text-[26pt] font-bold"
                    style={{ backgroundColor: COLUMN_COLORS[i % COLUMN_COLORS.length] }}
                  >
                    {col.label}
                  </h2>
                  <ul style={{ fontSize: `${pt}pt` }}>
                    {col.kids.map((k) => (
                      <li key={k.name} className="border-b-2 border-dotted border-black/40 py-1 font-bold leading-tight">
                        {boardName(k)}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
