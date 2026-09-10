"use client";

import { useEffect, useState } from "react";

/**
 * http(s) のURLだけを許可する。
 * javascript: などのスキームをそのまま開かないためのガード。
 */
export function isSafeHttpUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * カリキュラムアセスメントシートのURLを登録・変更するモーダル。
 *
 * シートは教室ごとに別々に作られるため、URLはアプリに直書きせず登録制にしている。
 * 保存先はクラウド（Firestore の workspace）なので、登録すれば全PCで共有される。
 */
export function AssessmentSheetPanel({
  url,
  onSave,
  onClose,
}: {
  url: string;
  onSave: (url: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(url);
  const [error, setError] = useState<string | null>(null);

  // Esc キーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    const trimmed = value.trim();
    if (!isSafeHttpUrl(trimmed)) {
      setError(
        "URLの形式が正しくありません。「https://」から始まるアドレスを貼り付けてください。"
      );
      return;
    }
    onSave(trimmed);
    onClose();
  };

  const clear = () => {
    if (
      window.confirm(
        "登録したURLを削除します。ボタンからシートを開けなくなりますが、よろしいですか？"
      )
    ) {
      onSave("");
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="カリキュラムアセスメントシートの設定"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">カリキュラムアセスメントシート</h2>
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
          シートのURLを登録すると、ヘッダーのボタンから直接開けるようになります。
          シートは教室ごとに別々に作られるため、ここで登録する方式にしています。
          <br />
          登録内容は<strong>クラウドに保存され、全PCで共有</strong>されます。
        </p>

        <label
          htmlFor="assessment-url"
          className="mb-1 block text-sm font-medium"
        >
          シートのURL
        </label>
        <input
          id="assessment-url"
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />

        {error ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="mt-2 text-xs text-zinc-400">
            ブラウザでシートを開き、アドレスバーをコピーして貼り付けてください。
          </p>
        )}

        <div className="mt-5 flex items-center gap-2">
          {url && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-zinc-500 underline underline-offset-2 hover:text-red-600 dark:text-zinc-400"
            >
              登録を削除する
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
