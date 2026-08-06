"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/components/AuthProvider";

interface StudyEvent {
  id: string;
  type: "start" | "finish";
  studentId: string;
  studentName: string | null;
  title: string | null;
  score: number | null;
  average: number | null;
  max: number | null;
  cumulative: number | null;
  studyDate: string | null;
  startTime: string | null;
  receivedAt: Date | null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function StudyDashboard() {
  const { user, signOut } = useAuth();
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "studyEvents"),
      where("receivedAt", ">=", Timestamp.fromDate(startOfToday())),
      orderBy("receivedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(
          snap.docs.map((doc) => {
            const d = doc.data() as DocumentData;
            return {
              id: doc.id,
              type: d.type === "finish" ? "finish" : "start",
              studentId: String(d.studentId ?? ""),
              studentName: d.studentName ?? null,
              title: d.title ?? null,
              score: d.score ?? null,
              average: d.average ?? null,
              max: d.max ?? null,
              cumulative: d.cumulative ?? null,
              studyDate: d.studyDate ?? null,
              startTime: d.startTime ?? null,
              receivedAt:
                d.receivedAt && typeof d.receivedAt.toDate === "function"
                  ? d.receivedAt.toDate()
                  : null,
            };
          })
        );
        setReady(true);
      },
      (e) => {
        setError(e.message);
        setReady(true);
      }
    );
    return () => unsub();
  }, []);

  const finishes = useMemo(
    () => events.filter((e) => e.type === "finish"),
    [events]
  );

  // 生徒ごとの最新イベントが start なら「学習中」
  const learningNow = useMemo(() => {
    const latest = new Map<string, StudyEvent>();
    for (const e of events) if (!latest.has(e.studentId)) latest.set(e.studentId, e);
    return [...latest.values()].filter((e) => e.type === "start");
  }, [events]);

  const downloadCsv = () => {
    const header = [
      "実施日",
      "生徒名",
      "タイトル",
      "点数",
      "平均点",
      "最高点",
      "累計ポイント",
      "受信時刻",
    ];
    const rows = finishes.map((e) => [
      e.studyDate ?? "",
      e.studentName ?? e.studentId,
      e.title ?? "",
      e.score ?? "",
      e.average ?? "",
      e.max ?? "",
      e.cumulative ?? "",
      e.receivedAt ? e.receivedAt.toLocaleString("ja-JP") : "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    // utf-8-sig（先頭にBOM）→ Excelで文字化けしない
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const t = new Date();
    const name = `study_${t.getFullYear()}${String(t.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(t.getDate()).padStart(2, "0")}.csv`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            本日のリアルタイム学習状況
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            brain-program の学習開始・結果が自動で反映されます（再読込不要）
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {user?.email && (
              <span className="max-w-[180px] truncate" title={user.email}>
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ログアウト
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ← 出席カレンダー
            </Link>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={finishes.length === 0}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              ↓ 本日の結果をCSV出力
            </button>
          </div>
        </div>
      </header>

      {/* サマリー */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="本日のイベント" value={events.length} />
        <StatTile label="学習中" value={learningNow.length} accent="amber" />
        <StatTile label="完了（結果あり）" value={finishes.length} accent="emerald" />
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          読み込みエラー：{error}
        </p>
      )}

      {/* 学習中 */}
      {learningNow.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            いま学習中
          </h2>
          <div className="flex flex-wrap gap-2">
            {learningNow.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm dark:border-amber-800 dark:bg-amber-950/30"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                {e.studentName ?? e.studentId}
                {e.title && (
                  <span className="text-xs text-zinc-500">／{e.title}</span>
                )}
                <span className="text-xs text-zinc-400">{fmtTime(e.receivedAt)}〜</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 一覧 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          本日の記録
        </h2>
        {!ready ? (
          <p className="py-8 text-center text-sm text-zinc-400">読み込み中…</p>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400 dark:border-zinc-700">
            まだ本日の記録はありません。タブレットで学習が始まると、ここに表示されます。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">時刻</th>
                  <th className="px-3 py-2 font-medium">生徒</th>
                  <th className="px-3 py-2 font-medium">タイトル</th>
                  <th className="px-3 py-2 font-medium">状態</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">点数</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">平均</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">最高</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">累計</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-zinc-100 dark:border-zinc-800/70"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500 tabular-nums">
                      {fmtTime(e.receivedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {e.studentName ?? e.studentId}
                    </td>
                    <td className="px-3 py-2">{e.title ?? "—"}</td>
                    <td className="px-3 py-2">
                      {e.type === "finish" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          終了
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          開始
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {e.score ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">
                      {e.average ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">
                      {e.max ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">
                      {e.cumulative ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber" | "emerald";
}) {
  const valueColor =
    accent === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-zinc-900 dark:text-white";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
