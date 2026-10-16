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
import { useAttendanceStore } from "@/app/hooks/useAttendanceStore";

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
  /** ブリッジが1回の検知ごとに付ける固有番号。重複判定に使う。 */
  eventId: string | null;
  /** その端末のその日の通し番号。欠けていれば送信で失われた回がある（診断用）。 */
  seq: number | null;
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

/**
 * 名前を突き合わせるための正規化。
 * HUGの名簿は「酒井 桃馬」、brain-program は「酒井桃馬」のように
 * 空白の有無が違うので、空白を取り除いてから比べる。
 */
function normalizeName(s: string): string {
  return s.replace(/[\s　]/g, "");
}

export function StudyDashboard() {
  const { user, signOut } = useAuth();
  const store = useAttendanceStore();
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
              eventId: d.eventId ?? null,
              seq: d.seq ?? null,
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

  // 結果（finish）で、実在の生徒のものだけ。
  //
  // 同じ内容が複数並ぶことがある。タブレットに拡張機能・ユーザースクリプト・
  // ブックマークレットが同時に入っていると、それぞれが同じ結果を送るため。
  // 受信API側でも1件にまとめるようにしたが、それ以前に届いたぶんが残るので
  // 表示側でも「同じ生徒・同じ教材・同じ点数」が近い時刻に並んだら1件にする。
  const realFinishes = useMemo(() => {
    const list = events.filter((e) => e.type === "finish" && isRealStudent(e));
    const seen = new Set<string>();
    return list.filter((e) => {
      // ブリッジが付けた固有番号があれば、それだけで判定する。
      // 内容で比べると「同じ教材・同じ点数の2回目」を重複と誤判定して隠してしまい、
      // 8問やったのに7問に見えることがあった。
      // 固有番号が無い古い記録のためだけに、内容での比較を残してある。
      const key = e.eventId
        ? "id:" + e.eventId
        : [
            nameOf(e),
            e.title ?? "",
            e.score ?? "",
            e.cumulative ?? "",
            e.average ?? "",
            e.max ?? "",
            e.studyDate ?? "",
          ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events]);

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
  /**
   * 本日「タブレット」の予定になっている生徒と、実際の記録を突き合わせる。
   *
   * タブレットの生徒は brain-program をやるので、記録が無ければ
   * 「やっていない」か「記録が取れていない」のどちらかで、どちらも見逃せない。
   * 一日の終わりに気づくのでは遅いので、画面の一番上に出す。
   */
  const tabletCheck = useMemo(() => {
    const planned = store
      .getForDate(startOfToday())
      .filter((item) => item.material === "tablet")
      .map((item) => item.student.name);

    const recorded = new Set(realFinishes.map((e) => normalizeName(nameOf(e))));
    const missing = planned.filter((n) => !recorded.has(normalizeName(n)));

    return { planned, missing, done: planned.length - missing.length };
  }, [store, realFinishes]);

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

      {/* 本日タブレット予定の生徒と、実際の記録の突き合わせ */}
      {store.hydrated && tabletCheck.planned.length > 0 && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            tabletCheck.missing.length > 0
              ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          }`}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-bold">
              {tabletCheck.missing.length > 0
                ? "⚠ 記録が無い生徒がいます"
                : "✅ タブレット予定の全員に記録があります"}
            </span>
            <span className="text-xs text-zinc-600 dark:text-zinc-300">
              本日のタブレット予定 {tabletCheck.planned.length}名 ／ 記録あり{" "}
              {tabletCheck.done}名 ／ 記録なし {tabletCheck.missing.length}名
            </span>
          </div>

          {tabletCheck.missing.length > 0 && (
            <>
              <ul className="mt-2 flex flex-wrap gap-2">
                {tabletCheck.missing.map((name) => (
                  <li
                    key={name}
                    className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white"
                  >
                    {name}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-red-800 dark:text-red-300">
                「実施していない」か「記録が取れていない」のどちらかです。
                本人がやったはずであれば、そのタブレットの画面上部に
                <strong>📡 記録中</strong> が出ているか確認してください。
              </p>
            </>
          )}
        </div>
      )}

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
              ブリッジから届いた“生”のデータです。ここに出ていれば「届いている」、
              空なら「そもそも届いていない」の切り分けができます。
              <br />
              <strong>No.</strong> は端末がその日に検知した通し番号です。
              たとえば 8問やったのに 1〜7 までしか無ければ<strong>検知が7回だった</strong>、
              1,2,3,5,6,7,8 のように抜けていれば<strong>送信の途中で失われた</strong>と分かります。
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[680px] border-collapse text-xs">
                <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">受信</th>
                    {/* 端末のその日の通し番号。抜けていれば送信で失われた回がある */}
                    <th className="px-3 py-2 text-right font-medium">No.</th>
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
                        colSpan={7}
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
                        <td className="px-3 py-1.5 text-right text-zinc-500">
                          {e.seq ?? "—"}
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
