"use client";

import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import {
  TM_TYPE_LABEL,
  TM_TYPE_OPTIONS,
  tmTypeBadgeClass,
  type TeachingMaterial,
} from "@/app/lib/teachingMaterials";

/**
 * 「要教材選定」の生徒に、本日の提供教材（生徒ごとの枚数まで）を割り当てるUI。
 * タイトルはクリックで別タブ（target="_blank"）で開く。
 */
export function MaterialAssignment({
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
  const assignedIds = store.getAssignedMaterialIds(studentId, date);
  const assigned = assignedIds
    .map((id) => store.getMaterialById(id))
    .filter((m): m is TeachingMaterial => Boolean(m));

  // 枚数とSSTの有無は、送迎アプリの児童管理で生徒ごとに決めたもの
  const study = store.getStudy(studentId);
  const max = study.printCount;
  const available = store.materials.filter((m) => !assignedIds.includes(m.id));
  const canAdd = assigned.length < max;

  return (
    <div className="mt-3 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/20">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          教材選定（{assigned.length}/{max}）
        </span>
        <span
          className={`rounded px-2 py-0.5 text-sm font-bold ${
            !store.hasStudySetting(studentId)
              ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              : study.hasSST
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
          }`}
          title={
            store.hasStudySetting(studentId)
              ? "送迎アプリの児童管理で決めた設定です"
              : "送迎アプリから設定が届いていないため、今までどおり「SSTあり・3枚」で扱っています"
          }
        >
          {study.hasSST ? `SSTあり・${max}枚` : `SSTなし・${max}枚`}
          {!store.hasStudySetting(studentId) && "（未受信）"}
        </span>
      </div>

      {assigned.length === 0 ? (
        <p className="text-xs text-zinc-400">
          {readOnly ? "未選定" : "下から教材を選んでください。"}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {assigned.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tmTypeBadgeClass(
                  m.type
                )}`}
              >
                {TM_TYPE_LABEL[m.type]}
              </span>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
                title={`${m.title} を別タブで開く`}
              >
                {m.title} ↗
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => store.removeAssignment(studentId, date, m.id)}
                  aria-label={`${m.title} を外す`}
                  className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-red-500 dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && canAdd && available.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) store.addAssignment(studentId, date, e.target.value);
          }}
          className="mt-2 w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm dark:border-amber-800 dark:bg-zinc-900"
          aria-label="教材を追加"
        >
          <option value="">＋ 教材を追加…</option>
          {TM_TYPE_OPTIONS.map((opt) => {
            const group = available
              .filter((m) => m.type === opt.value)
              .sort((a, b) => a.title.localeCompare(b.title, "ja"));
            if (group.length === 0) return null;
            return (
              <optgroup key={opt.value} label={opt.label}>
                {group.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      )}

      {!readOnly && !canAdd && (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
          上限の{max}枚に達しています。
        </p>
      )}
    </div>
  );
}
