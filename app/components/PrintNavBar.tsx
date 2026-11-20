"use client";

import Link from "next/link";

/**
 * 印刷プレビュー上部の操作バー。ボタンは4つに統一する:
 *   タブレット記録 / 記録担当振り分け / 翌日準備 / 印刷
 * （プレビューを閉じるのは「翌日準備」＝一つ前の画面に戻る、で兼ねる）
 */
export function PrintNavBar({
  onPrep,
  extra,
}: {
  /** 翌日準備へ戻る（印刷プレビューを閉じる） */
  onPrep: () => void;
  /** 倍率表示など、ボタン以外の補足 */
  extra?: React.ReactNode;
}) {
  const nav =
    "rounded-lg border border-white/60 px-4 py-2 text-sm font-bold text-white hover:bg-white/10";
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <Link href="/" className={nav}>
        🏠 トップ
      </Link>
      {extra}
      <Link href="/study" className={nav}>
        📊 タブレット記録
      </Link>
      <Link href="/floor" className={nav}>
        🧭 記録担当振り分け
      </Link>
      <button type="button" onClick={onPrep} className={nav}>
        📋 翌日準備
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
      >
        🖨 印刷
      </button>
    </div>
  );
}
