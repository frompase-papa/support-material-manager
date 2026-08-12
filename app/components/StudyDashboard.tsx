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
  receivedAt: Date | null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 表示名（生徒名。無ければ空） */
function nameOf(e: StudyEvent): string {
  return (e.studentName ?? "").trim();
}

/** 実在の生徒か（名前があり、数字だけでない＝動作時に混ざる番号を除外） */
function isRealStudent(e: StudyEvent): boolean {
  const n = nameOf(e);
  return n !== "" && !/^\d+$/.test(n);
}

export function StudyDashboard() {
  const { user, signOut } = useAuth();
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

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

  // 結果（finish）で、実在の生徒のものだけ
  const realFinishes = useMemo(
    () => events.filter((e) => e.type === "finish" && isRealStudent(e)),
    [events]
  );

  // 生徒名で束ねる（各生徒＝やった順＝古い→新しい、生徒の並びは最近やった順）
  const groups = useMemo(() => {
    const map = new Map<string, StudyEvent[]>();
    for (const e of realFinishes) {
      const name = nameOf(e);
      const list = map.get(name);
      if (list) list.push(e);
      else map.set(name, [e]);
    }
    const arr = [...map.entries()].map(([name, list]) => {
      const sorted = [...list].sort(
        (a, b) => (a.receivedAt?.getTime() ?? 0) - (b.receivedAt?.getTime() ?? 0)
      );
      const latest = sorted.reduce(
        (mx, e) => Math.max(mx, e.receivedAt?.getTime() ?? 0),
        0
      );
      return { name, list: sorted, latest };
    });
    arr.sort((a, b) => b.latest - a.latest);
    return arr;
  }, [realFinishes]);

  // 除外された件数（生徒名が取れなかった＝番号などの記録）
  const excludedCount = useMemo(
    () => events.filter((e) => e.type === "finish" && !isRealStudent(e)).length,
    [events]
  );

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
    const rows = realFinishes.map((e) => [
      e.studyDate ?? "",
      nameOf(e),
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            本日の学習状況（生徒別）
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            brain-program の結果が生徒ごとに自動でまとまります（再読込不要）
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
              disabled={realFinishes.length === 0}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              ↓ 本日の結果をCSV出力
            </button>
          </div>
        </div>
      </header>

      {/* サマリー */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="学習した生徒" value={groups.length} />
        <StatTile label="本日の記録数" value={realFinishes.length} accent="emerald" />
        <StatTile label="除外（番号など）" value={excludedCount} accent="muted" />
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          読み込みエラー：{error}
        </p>
      )}

      {!ready ? (
        <p className="py-8 text-center text-sm text-zinc-400">読み込み中…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400 dark:border-zinc-700">
          まだ本日の記録はありません。タブレットで学習の結果が出ると、ここに生徒ごとに表示されます。
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <StudentGroup key={g.name} name={g.name} records={g.list} />
          ))}
        </div>
      )}

      {excludedCount > 0 && (
        <p className="mt-6 text-xs text-zinc-400">
          ※ 生徒名が取得できなかった記録 {excludedCount}
          件（番号のみ等）は一覧から除外しています。
        </p>
      )}

      {/* 診断：本日届いた全イベント（切り分け用） */}
      <div className="mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {showRaw
            ? "診断を隠す"
            : `🐞 診断：本日届いた全データを表示（${events.length}件）`}
        </button>
        {showRaw && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              拡張機能から届いた“生”のデータです。ここに出ていれば「届いている」、
              空なら「そもそも届いていない（拡張未導入・送信エラー等）」の切り分けができます。
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[680px] border-collapse text-xs">
                <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">受信</th>
                    <th className="px-3 py-2 font-medium">種別</th>
                    <th className="px-3 py-2 font-medium">生徒ID</th>
                    <th className="px-3 py-2 font-medium">生徒名</th>
                    <th className="px-3 py-2 font-medium">タイトル</th>
                    <th className="px-3 py-2 text-right font-medium">点数</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-4 text-center text-zinc-400"
                      >
                        本日届いたデータはありません
                      </td>
                    </tr>
                  ) : (
                    events.map((e) => (
                      <tr
                        key={e.id}
                        className="border-t border-zinc-100 dark:border-zinc-800/70"
                      >
                        <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">
                          {fmtDateTime(e.receivedAt)}
                        </td>
                        <td className="px-3 py-1.5">{e.type}</td>
                        <td className="px-3 py-1.5 text-zinc-500">
                          {e.studentId || "—"}
                        </td>
                        <td className="px-3 py-1.5">{e.studentName ?? "（なし）"}</td>
                        <td className="px-3 py-1.5">{e.title ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {e.score ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentGroup({
  name,
  records,
}: {
  name: string;
  records: StudyEvent[];
}) {
  const [copied, setCopied] = useState(false);

  const copyText = () => {
    // タイトル<TAB>点数 を、やった順で。そのままExcel等に貼れる形。
    const text = records
      .map((e) => `${e.title ?? ""}\t${e.score ?? ""}`)
      .join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold">{name}</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {records.length}件
          </span>
        </div>
        <button
          type="button"
          onClick={copyText}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {copied ? "✓ コピーしました" : "📋 コピー"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse text-sm">
          <thead className="text-left text-xs text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">タイトル</th>
              <th className="px-4 py-2 text-right font-medium tabular-nums">点数</th>
            </tr>
          </thead>
          <tbody>
            {records.map((e) => (
              <tr
                key={e.id}
                className="border-t border-zinc-100 dark:border-zinc-800/70"
              >
                <td className="px-4 py-2">{e.title ?? "—"}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {e.score ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "muted";
}) {
  const valueColor =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "muted"
      ? "text-zinc-400"
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
