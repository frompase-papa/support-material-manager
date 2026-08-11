"use client";

import { useEffect, useState } from "react";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import {
  TM_TYPE_LABEL,
  TM_TYPE_OPTIONS,
  tmTypeBadgeClass,
  type TeachingMaterial,
  type TeachingMaterialType,
} from "@/app/lib/teachingMaterials";

/**
 * 教材マスタの登録・編集・削除を行うモーダル。
 */
export function MaterialMasterPanel({
  store,
  onClose,
}: {
  store: AttendanceStore;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<TeachingMaterialType>("free");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreText, setRestoreText] = useState("");
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const handleExport = () => {
    const json = JSON.stringify(store.materials, null, 2);
    const blob = new Blob(["﻿" + json], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "teaching-materials-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleRestore = () => {
    setRestoreMsg(null);
    if (!restoreText.trim()) {
      setRestoreMsg("復元するJSON（教材データ）を貼り付けてください。");
      return;
    }
    try {
      const parsed = JSON.parse(restoreText) as unknown;
      const list = (Array.isArray(parsed) ? parsed : []) as TeachingMaterial[];
      if (list.length === 0) {
        setRestoreMsg("教材データが見つかりませんでした（配列のJSONを貼り付けてください）。");
        return;
      }
      const added = store.importMaterials(list);
      setRestoreMsg(`${added}件を取り込みました（重複は除外）。`);
      setRestoreText("");
    } catch {
      setRestoreMsg("JSONを読み取れませんでした。貼り付け内容をご確認ください。");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setType("free");
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = () => {
    if (!title.trim() || !url.trim()) {
      setError("タイトルとURLを入力してください。");
      return;
    }
    if (editingId) {
      store.updateMaterial(editingId, { title: title.trim(), url: url.trim(), type });
    } else {
      store.addMaterial({ title: title.trim(), url: url.trim(), type });
    }
    resetForm();
  };

  const startEdit = (id: string) => {
    const m = store.getMaterialById(id);
    if (!m) return;
    setTitle(m.title);
    setUrl(m.url);
    setType(m.type);
    setEditingId(id);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="教材マスタ"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">教材マスタ</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* 登録・編集フォーム */}
        <div className="mb-5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-semibold">
            {editingId ? "教材を編集" : "教材を登録"}
          </h3>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトル（例：算数：たし算プリント）"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL（Webサイト or GoogleドライブのPDFリンク等）"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-zinc-500">種別：</label>
              <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
                {TM_TYPE_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    aria-pressed={type === opt.value}
                    className={`px-3 py-1.5 text-xs font-medium ${
                      i > 0 ? "border-l border-zinc-300 dark:border-zinc-700" : ""
                    } ${
                      type === opt.value
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  キャンセル
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {editingId ? "更新" : "追加"}
              </button>
            </div>
          </div>
        </div>

        {/* 一覧 */}
        <h3 className="mb-2 text-sm font-semibold">
          登録済み教材（{store.materials.length}件）
        </h3>
        {store.materials.length === 0 ? (
          <p className="text-xs text-zinc-400">まだ登録がありません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...store.materials]
              .sort((a, b) => a.title.localeCompare(b.title, "ja"))
              .map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tmTypeBadgeClass(
                    m.type
                  )}`}
                >
                  {TM_TYPE_LABEL[m.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    title={m.url}
                  >
                    {m.title} ↗
                  </a>
                  <span className="block truncate text-[11px] text-zinc-400">
                    {m.url}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(m.id)}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`「${m.title}」を削除しますか？`)) {
                      store.deleteMaterial(m.id);
                      if (editingId === m.id) resetForm();
                    }
                  }}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-950/40"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* バックアップ・復元 */}
        <details className="mt-6 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">
            バックアップ・復元
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                ↓ 現在の教材をバックアップ（JSON書き出し）
              </button>
              <span className="text-xs text-zinc-400">
                いつでも保存しておけば、消えても復元できます
              </span>
            </div>

            <div>
              <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                復元：教材データ（JSON配列）を貼り付けて取り込み。既存に統合し、重複は除外します。
              </p>
              <textarea
                value={restoreText}
                onChange={(e) => setRestoreText(e.target.value)}
                rows={4}
                placeholder='[{"id":"...","title":"...","url":"...","type":"free"}, ...]'
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800"
              />
              {restoreMsg && (
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                  {restoreMsg}
                </p>
              )}
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleRestore}
                  className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  取り込む（復元）
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
