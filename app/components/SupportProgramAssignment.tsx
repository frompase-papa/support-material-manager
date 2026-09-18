"use client";

import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import {
  isSafeHttpUrl,
  type SupportProgram,
} from "@/app/lib/supportPrograms";

/**
 * その日に実施する専門支援を割り当てるUI。
 *
 * 教材選定（MaterialAssignment）と違い、**カリキュラム・タブレットを問わず
 * すべての生徒**に表示する。件数の上限は設けていない。
 */
export function SupportProgramAssignment({
  studentId,
  date,
  store,
  readOnly = false,
}: {
  studentId: string;
  date: Date;
  store: AttendanceStore;
  readOnly?: boolean;
}) {
  const assignedIds = store.getAssignedSupportIds(studentId, date);
  const assigned = assignedIds
    .map((id) => store.getSupportProgramById(id))
    .filter((p): p is SupportProgram => Boolean(p));

  const available = store.supportPrograms.filter(
    (p) => !assignedIds.includes(p.id)
  );

  // 週ビュー等（readOnly）では、割り当てが無ければ場所を取らない。
  // 逆に「今日」ビューでは、マスタが空でも欄は出す（無いと存在に気づけないため）。
  if (readOnly && assigned.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg bg-indigo-50 p-2.5 dark:bg-indigo-950/20">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
          専門支援（{assigned.length}）
        </span>
      </div>

      {assigned.length === 0 ? (
        <p className="text-xs text-zinc-400">
          {readOnly
            ? "なし"
            : store.supportPrograms.length === 0
            ? "ヘッダーの「🧩 専門支援マスタ」から内容を登録すると、ここで選べるようになります。"
            : "下から専門支援を選んでください。"}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assigned.map((p) => (
            <li key={p.id}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {isSafeHttpUrl(p.url) ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
                      title={`${p.title} を別タブで開く`}
                    >
                      {p.title} ↗
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-medium">
                      {p.title}
                    </span>
                  )}
                  {p.body && !readOnly && (
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
                      {p.body}
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() =>
                      store.removeSupportAssignment(studentId, date, p.id)
                    }
                    aria-label={`${p.title} を外す`}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-red-500 dark:hover:bg-zinc-800"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && available.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value)
              store.addSupportAssignment(studentId, date, e.target.value);
          }}
          className="mt-2 w-full rounded-md border border-indigo-300 bg-white px-2 py-1.5 text-sm dark:border-indigo-800 dark:bg-zinc-900"
          aria-label="専門支援を追加"
        >
          <option value="">＋ 専門支援を追加…</option>
          {[...available]
            .sort((a, b) => a.title.localeCompare(b.title, "ja"))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
        </select>
      )}
    </div>
  );
}
