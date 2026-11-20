"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AttendanceStore } from "@/app/hooks/useAttendanceStore";
import { useAuth } from "@/app/components/AuthProvider";
import { StudentSettingsPanel } from "@/app/components/StudentSettingsPanel";
import { HugImportPanel } from "@/app/components/HugImportPanel";
import { MaterialMasterPanel } from "@/app/components/MaterialMasterPanel";
import { SupportProgramMasterPanel } from "@/app/components/SupportProgramMasterPanel";
import { PrepDialog } from "@/app/components/PrepDialog";
import {
  AssessmentSheetPanel,
  isSafeHttpUrl,
} from "@/app/components/AssessmentSheetPanel";
import { startOfDay } from "@/app/lib/date";

export const APP_NAME = "支援アプリ";

/** メイン3ボタン（日常業務）。大きく・濃い色で、サブメニューと一目で区別できるようにする */
const MAIN_BASE =
  "flex min-h-12 items-center justify-center rounded-xl px-5 py-2.5 text-base font-bold shadow-sm transition-colors sm:px-6 sm:text-lg";
const MAIN_IDLE =
  "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-700 dark:hover:bg-sky-600";
const MAIN_ACTIVE =
  "bg-sky-900 text-white ring-2 ring-sky-300 dark:bg-sky-950 dark:ring-sky-500";

/** サブメニュー内の項目 */
const ITEM =
  "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800";

export type AppNavPage = "study" | "floor" | "home";

/**
 * 全ページ共通の上部ナビ。
 *  - 左〜中央：メイン3ボタン（タブレット記録 / 記録担当振り分け / 翌日準備）
 *  - 右：サブメニュー（マスター・ハグデータ・生徒設定・アセスメントシート）
 * サブメニューのパネルと翌日準備はここで開くので、どのページからでも同じ操作になる。
 */
export function AppNav({
  store,
  active,
  prepOpen,
  onPrepOpenChange,
  importDefaultYear,
  importDefaultMonth,
}: {
  store: AttendanceStore;
  active: AppNavPage;
  /** 翌日準備を外から開閉したいとき（省略時は内部で管理） */
  prepOpen?: boolean;
  onPrepOpenChange?: (open: boolean) => void;
  importDefaultYear?: number;
  importDefaultMonth?: number;
}) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [innerPrep, setInnerPrep] = useState(false);
  const prep = prepOpen ?? innerPrep;
  const setPrep = onPrepOpenChange ?? setInnerPrep;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [supportMasterOpen, setSupportMasterOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [today] = useState<Date>(() => startOfDay(new Date()));
  const assessmentReady = isSafeHttpUrl(store.assessmentUrl);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニューの外を押す / Esc で閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const pick = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <>
      <nav
        aria-label="メインナビゲーション"
        className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <Link
          href="/"
          title="トップ（カリキュラム／タブレットの振り分け）へ"
          aria-current={active === "home" ? "page" : undefined}
          className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-base font-extrabold tracking-tight ${
            active === "home"
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
              : "border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          🏠 {APP_NAME}
        </Link>

        {/* メイン3ボタン（日常業務） */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/study"
            aria-current={active === "study" ? "page" : undefined}
            className={`${MAIN_BASE} ${active === "study" ? MAIN_ACTIVE : MAIN_IDLE}`}
          >
            📊 タブレット記録
          </Link>
          <Link
            href="/floor"
            aria-current={active === "floor" ? "page" : undefined}
            className={`${MAIN_BASE} ${active === "floor" ? MAIN_ACTIVE : MAIN_IDLE}`}
          >
            🧭 記録担当振り分け
          </Link>
          <button
            type="button"
            onClick={() => setPrep(true)}
            title="おやつ・カリキュラム／タブレット・17じ18じの3枚を準備します"
            className={`${MAIN_BASE} ${MAIN_IDLE}`}
          >
            📋 翌日準備
          </button>
        </div>

        {/* 右側：サブメニュー（設定・マスター・取り込み） */}
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {user?.email && (
            <span className="hidden max-w-[160px] truncate md:inline" title={user.email}>
              {user.email}
            </span>
          )}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-400 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              ⚙ 設定・マスター {menuOpen ? "▴" : "▾"}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-40 mt-1 w-64 rounded-xl border border-zinc-300 bg-white p-2 text-zinc-800 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <p className="px-3 pb-1 pt-1 text-[11px] font-bold text-zinc-400">マスター</p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={pick(() => setMasterOpen(true))}
                  className={`${ITEM} pl-6`}
                >
                  📚 教材マスター
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={pick(() => setSupportMasterOpen(true))}
                  className={`${ITEM} pl-6`}
                >
                  🧩 専門支援マスター
                </button>
                <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={pick(() => setImportOpen(true))}
                  className={ITEM}
                >
                  ↑ ハグデータ（出席取り込み）
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={pick(() => setSettingsOpen(true))}
                  className={ITEM}
                >
                  ⚙ 生徒設定
                </button>
                {assessmentReady ? (
                  <div className="flex items-center">
                    <a
                      href={store.assessmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      role="menuitem"
                      title="カリキュラムアセスメントシートを別タブで開く"
                      onClick={() => setMenuOpen(false)}
                      className={ITEM}
                    >
                      📋 アセスメントシート ↗
                    </a>
                    <button
                      type="button"
                      onClick={pick(() => setAssessmentOpen(true))}
                      aria-label="アセスメントシートのURLを変更"
                      title="URLを変更"
                      className="shrink-0 rounded-md px-2 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      ⚙
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={pick(() => setAssessmentOpen(true))}
                    className={`${ITEM} text-zinc-500`}
                  >
                    📋 アセスメントシート（URL未登録）
                  </button>
                )}
                <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => signOut()}
                  className={`${ITEM} text-zinc-500`}
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {prep && <PrepDialog store={store} today={today} onClose={() => setPrep(false)} />}
      {settingsOpen && (
        <StudentSettingsPanel
          getStudy={store.getStudy}
          hasStudySetting={store.hasStudySetting}
          students={store.students}
          onChangeType={store.setStudentType}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {importOpen && (
        <HugImportPanel
          store={store}
          defaultYear={importDefaultYear ?? today.getFullYear()}
          defaultMonth={importDefaultMonth ?? today.getMonth() + 1}
          onClose={() => setImportOpen(false)}
        />
      )}
      {masterOpen && <MaterialMasterPanel store={store} onClose={() => setMasterOpen(false)} />}
      {supportMasterOpen && (
        <SupportProgramMasterPanel store={store} onClose={() => setSupportMasterOpen(false)} />
      )}
      {assessmentOpen && (
        <AssessmentSheetPanel
          url={store.assessmentUrl}
          onSave={store.setAssessmentUrl}
          onClose={() => setAssessmentOpen(false)}
        />
      )}
    </>
  );
}
