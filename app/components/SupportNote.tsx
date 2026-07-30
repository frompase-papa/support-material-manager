"use client";

import { useState } from "react";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";

/**
 * 生徒ごとの支援情報メモ（「時計の理解が難しい」等）。
 * 教材選定画面・生徒カード内でいつでも確認・編集できる。
 */
export function SupportNote({
  studentId,
  store,
}: {
  studentId: string;
  store: AttendanceStore;
}) {
  const note = store.getNote(studentId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);

  const startEdit = () => {
    setDraft(store.getNote(studentId));
    setEditing(true);
  };
  const save = () => {
    store.setNote(studentId, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/30">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          autoFocus
          placeholder="例）時計の理解が難しい。お金の計算が苦手。"
          className="w-full resize-y rounded-md border border-blue-200 bg-white p-2 text-sm dark:border-blue-900 dark:bg-zinc-900"
        />
        <div className="mt-1.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        ＋ 支援メモを追加
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
      <span className="shrink-0 text-blue-500" aria-hidden>
        📝
      </span>
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-blue-900 dark:text-blue-200">
        {note}
      </p>
      <button
        type="button"
        onClick={startEdit}
        className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        編集
      </button>
    </div>
  );
}
