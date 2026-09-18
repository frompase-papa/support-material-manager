"use client";

import { useEffect, useState } from "react";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { isSafeHttpUrl } from "@/app/lib/supportPrograms";

/**
 * 専門支援マスタの管理モーダル。
 *
 * 1件は「名称＋内容（文章）＋参考URL」で構成する。
 * 内容とURLはどちらか片方だけでもよい（名称のみの登録も可）。
 */
export function SupportProgramMasterPanel({
  store,
  onClose,
}: {
  store: AttendanceStore;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Esc キーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reset = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setEditingId(null);
    setError(null);
  };

  const submit = () => {
    const t = title.trim();
    if (!t) {
      setError("名称を入力してください。");
      return;
    }
    const u = url.trim();
    if (u && !isSafeHttpUrl(u)) {
      setError("URLは「https://」から始まるアドレスを入力してください。");
      return;
    }
    const input = { title: t, body: body.trim(), url: u };
    if (editingId) store.updateSupportProgram(editingId, input);
    else store.addSupportProgram(input);
    reset();
  };

  const startEdit = (id: string) => {
    const p = store.getSupportProgramById(id);
    if (!p) return;
    setEditingId(id);
    setTitle(p.title);
    setBody(p.body);
    setUrl(p.url);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="専門支援マスタ"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">専門支援マスタ</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          専門支援として提供する内容を登録します。ここに登録したものを、
          <strong>カリキュラム・タブレットどちらの生徒にも</strong>
          日ごとに割り当てられます。
        </p>

        {/* 登録・編集フォーム */}
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-semibold">
            {editingId ? "内容を編集" : "新しく登録"}
          </h3>
          <div className="flex flex-col gap-2">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="名称（例：感覚統合：バランス運動）"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="内容・進め方（任意）&#10;例：バランスボードに両足で立ち、30秒キープ×3セット。&#10;ふらつく場合は手を添えて支える。"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="参考サイト・資料のURL（任意）"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                onClick={reset}
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400"
              >
                編集をやめる
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {editingId ? "更新する" : "登録する"}
            </button>
          </div>
        </div>

        {/* 登録済み一覧 */}
        <h3 className="mb-2 mt-5 text-sm font-semibold">
          登録済み（{store.supportPrograms.length}件）
        </h3>

        {store.supportPrograms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            まだ登録がありません。上のフォームから追加してください。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...store.supportPrograms]
              .sort((a, b) => a.title.localeCompare(b.title, "ja"))
              .map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{p.title}</div>
                      {p.body && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
                          {p.body}
                        </p>
                      )}
                      {isSafeHttpUrl(p.url) && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block truncate text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
                        >
                          {p.url} ↗
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(p.id)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `「${p.title}」を削除します。割り当て済みのぶんも外れますが、よろしいですか？`
                            )
                          ) {
                            store.deleteSupportProgram(p.id);
                            if (editingId === p.id) reset();
                          }
                        }}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-800 dark:hover:bg-red-950/40"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}

        <div className="mt-5 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
