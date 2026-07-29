"use client";

import { useMemo, useState } from "react";
import {
  useAttendanceStore,
  type AttendanceStore,
} from "@/app/hooks/useAttendanceStore";
import { type ResolvedAttendance } from "@/app/lib/attendance";
import type { Student } from "@/app/lib/students";
import {
  WEEKDAY_LABELS,
  addDays,
  formatFullDate,
  formatYearMonth,
  getMonthMatrix,
  getWeekDays,
  isSameDay,
  startOfDay,
  toDateKey,
} from "@/app/lib/date";
import { MaterialSelectionBadge, TypeBadge } from "@/app/components/badges";
import { MaterialToggle } from "@/app/components/MaterialToggle";
import { StudentSettingsPanel } from "@/app/components/StudentSettingsPanel";
import { HugImportPanel } from "@/app/components/HugImportPanel";

type ViewMode = "today" | "week" | "month";

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "month", label: "今月" },
];

export default function AttendanceCalendar() {
  const store = useAttendanceStore();
  const [today] = useState<Date>(() => startOfDay(new Date()));
  const [view, setView] = useState<ViewMode>("today");
  const [dayDate, setDayDate] = useState<Date>(() => startOfDay(new Date()));
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            出席カレンダー
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            支援教材管理アプリ ／ HUGの出席データと提供教材を管理できます
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            ↑ HUGデータ取込
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ⚙ 生徒設定
          </button>
        </div>
      </header>

      {store.hydrated && !store.hasData ? (
        <EmptyImportState onImport={() => setImportOpen(true)} />
      ) : (
        <>
          <ViewSwitcher
            view={view}
            onChange={(v) => {
              setView(v);
              setAnchor(today);
              setDayDate(today);
            }}
          />

          <div className="mt-6">
            {view === "today" && (
              <DayView store={store} date={dayDate} today={today} onMove={setDayDate} />
            )}
            {view === "week" && (
              <WeekView store={store} anchor={anchor} today={today} onMove={setAnchor} />
            )}
            {view === "month" && (
              <MonthView store={store} anchor={anchor} today={today} onMove={setAnchor} />
            )}
          </div>

          <Legend students={store.students} onOpenSettings={() => setSettingsOpen(true)} />
        </>
      )}

      {settingsOpen && (
        <StudentSettingsPanel
          students={store.students}
          onChangeType={store.setStudentType}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {importOpen && (
        <HugImportPanel
          store={store}
          defaultYear={anchor.getFullYear()}
          defaultMonth={anchor.getMonth() + 1}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}

type Store = AttendanceStore;

/* ------------------------------------------------------------------ */
/* 空状態（取込前）                                                      */
/* ------------------------------------------------------------------ */

function EmptyImportState({ onImport }: { onImport: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-lg font-semibold">出席データがまだありません</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        HUGの出席カレンダーをコピーして取り込むと、通所予定と提供教材の管理を始められます。
      </p>
      <button
        type="button"
        onClick={onImport}
        className="mt-5 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        ↑ HUGデータを取り込む
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ビュー切り替え                                                       */
/* ------------------------------------------------------------------ */

function ViewSwitcher({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      {VIEW_OPTIONS.map((opt) => {
        const active = view === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 期間移動                                                             */
/* ------------------------------------------------------------------ */

function PeriodNav({
  title,
  onPrev,
  onNext,
  onToday,
  todayLabel,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  todayLabel: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="前へ"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="次へ"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ›
        </button>
        <h2 className="ml-2 text-lg font-semibold">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {todayLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 出席1件の行（生徒情報＋教材トグル）                                   */
/* ------------------------------------------------------------------ */

function AttendanceRow({
  item,
  date,
  store,
  compact = false,
}: {
  item: ResolvedAttendance;
  date: Date;
  store: Store;
  compact?: boolean;
}) {
  const { student } = item;
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${
        compact ? "p-2.5" : "p-4"
      }`}
      style={{ borderLeft: `4px solid ${student.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={compact ? "text-sm font-semibold" : "text-base font-semibold"}
            >
              {student.name}
            </span>
            {student.grade && (
              <span className="text-xs text-zinc-400">{student.grade}</span>
            )}
            {item.requiresSelection && <MaterialSelectionBadge />}
          </div>
          {!compact && student.furigana && (
            <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
              {student.furigana}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!compact && <TypeBadge type={student.type} />}
          <button
            type="button"
            onClick={() => store.removeAttendance(student.id, date)}
            aria-label={`${student.name}を休みにする`}
            title="この日を欠席（休み）にする"
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            休み
          </button>
        </div>
      </div>

      <div className="mt-3">
        <MaterialToggle
          material={item.material}
          isManual={item.isManual}
          isAuto={item.isAuto}
          onSelect={(m) => store.setMaterial(student.id, date, m)}
          onClearToAuto={() => store.clearMaterial(student.id, date)}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 日ビュー（前日・翌日・任意日付を選んで教材選定）                       */
/* ------------------------------------------------------------------ */

function DayView({
  store,
  date,
  today,
  onMove,
}: {
  store: Store;
  date: Date;
  today: Date;
  onMove: (d: Date) => void;
}) {
  const items = store.getForDate(date);
  const pending = items.filter((r) => r.requiresSelection).length;
  const absentNames = store.getAbsentNamesOnDate(date);
  const unattended = store.getUnattendedStudents(date);
  const isToday = isSameDay(date, today);

  return (
    <section>
      {/* 日付ナビ */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(addDays(date, -1))}
            aria-label="前日"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onMove(addDays(date, 1))}
            aria-label="翌日"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ›
          </button>
          <h2 className={`ml-2 text-lg font-semibold ${weekdayColor(date.getDay())}`}>
            {formatFullDate(date)}
          </h2>
          {isToday && (
            <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
              今日
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={toDateKey(date)}
            onChange={(e) => {
              if (e.target.value) onMove(startOfDay(new Date(`${e.target.value}T00:00:00`)));
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="日付を選択"
          />
          <button
            type="button"
            onClick={() => onMove(today)}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            今日へ
          </button>
        </div>
      </div>

      <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        出席 {items.length} 名
        {pending > 0 && (
          <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">
            ／ 要教材選定 {pending} 名
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState message="この日の出席予定はありません（休業日、または未取込の可能性があります）。" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <AttendanceRow key={item.record.id} item={item} date={date} store={store} />
          ))}
        </div>
      )}

      {absentNames.length > 0 && (
        <p className="mt-3 text-xs text-zinc-400">欠席：{absentNames.join("、")}</p>
      )}

      {unattended.length > 0 && (
        <details className="mt-4 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 dark:text-zinc-400">
            ＋ 出席を追加（{unattended.length}名）
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {unattended.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => store.addAttendance(s.id, date)}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 今週ビュー                                                           */
/* ------------------------------------------------------------------ */

function WeekView({
  store,
  anchor,
  today,
  onMove,
}: {
  store: Store;
  anchor: Date;
  today: Date;
  onMove: (d: Date) => void;
}) {
  const days = useMemo(() => getWeekDays(anchor), [anchor]);
  const rangeTitle = `${days[0].getMonth() + 1}/${days[0].getDate()} 〜 ${
    days[6].getMonth() + 1
  }/${days[6].getDate()}`;

  return (
    <section>
      <PeriodNav
        title={rangeTitle}
        onPrev={() => onMove(addDays(anchor, -7))}
        onNext={() => onMove(addDays(anchor, 7))}
        onToday={() => onMove(today)}
        todayLabel="今週へ"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {days.map((day) => {
          const items = store.getForDate(day);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={`rounded-xl border p-3 ${
                isToday
                  ? "border-zinc-900 dark:border-white"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className={`text-sm font-semibold ${weekdayColor(day.getDay())}`}>
                  {day.getMonth() + 1}/{day.getDate()}（{WEEKDAY_LABELS[day.getDay()]}）
                </span>
                {isToday && (
                  <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
                    今日
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-400">
                  {items.length > 0 ? `${items.length}名` : "－"}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="py-2 text-xs text-zinc-300 dark:text-zinc-600">出席なし</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <AttendanceRow
                      key={item.record.id}
                      item={item}
                      date={day}
                      store={store}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 今月ビュー（表示のみ）                                                */
/* ------------------------------------------------------------------ */

function MonthView({
  store,
  anchor,
  today,
  onMove,
}: {
  store: Store;
  anchor: Date;
  today: Date;
  onMove: (d: Date) => void;
}) {
  const matrix = useMemo(() => getMonthMatrix(anchor), [anchor]);
  const month = anchor.getMonth();

  return (
    <section>
      <PeriodNav
        title={formatYearMonth(anchor)}
        onPrev={() => onMove(new Date(anchor.getFullYear(), month - 1, 1))}
        onNext={() => onMove(new Date(anchor.getFullYear(), month + 1, 1))}
        onToday={() => onMove(today)}
        todayLabel="今月へ"
      />

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`py-2 text-center text-xs font-medium ${weekdayColor(i)}`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {matrix.flat().map((day) => {
            const inMonth = day.getMonth() === month;
            const isToday = isSameDay(day, today);
            const items = store.getForDate(day);
            const pending = items.filter((r) => r.requiresSelection).length;

            return (
              <div
                key={day.toISOString()}
                className={`min-h-24 border-b border-r border-zinc-100 p-1.5 dark:border-zinc-800/70 ${
                  inMonth
                    ? "bg-white dark:bg-zinc-950"
                    : "bg-zinc-50/60 dark:bg-zinc-900/40"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-zinc-900 font-bold text-white dark:bg-white dark:text-zinc-900"
                        : inMonth
                        ? weekdayColor(day.getDay())
                        : "text-zinc-300 dark:text-zinc-700"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="text-[10px] text-zinc-400">{items.length}名</span>
                  )}
                </div>

                {pending > 0 && (
                  <span
                    className="inline-block rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950"
                    title={`要教材選定 ${pending} 名`}
                  >
                    ⚠{pending}
                  </span>
                )}

                <div className="mt-1 flex flex-wrap gap-1">
                  {items.map((item) => (
                    <span
                      key={item.record.id}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.student.color }}
                      title={`${item.student.name}（${
                        item.requiresSelection ? "カリキュラム" : "タブレット"
                      }）`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        ※ 月ビューは表示のみです。教材の変更は「今日」「今週」から行えます。
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 補助                                                                 */
/* ------------------------------------------------------------------ */

function weekdayColor(weekday: number): string {
  if (weekday === 0) return "text-red-500 dark:text-red-400";
  if (weekday === 6) return "text-blue-500 dark:text-blue-400";
  return "text-zinc-600 dark:text-zinc-300";
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
      {message}
    </div>
  );
}

function Legend({
  students,
  onOpenSettings,
}: {
  students: Student[];
  onOpenSettings: () => void;
}) {
  const curriculumCount = students.filter((s) => s.type === "curriculum").length;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
        登録児童 {students.length}名
      </span>
      <span className="text-zinc-500 dark:text-zinc-400">
        交互提供 {students.length - curriculumCount}名 ／ カリキュラム固定{" "}
        {curriculumCount}名
      </span>
      <button
        type="button"
        onClick={onOpenSettings}
        className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        提供形態を設定
      </button>
    </div>
  );
}
