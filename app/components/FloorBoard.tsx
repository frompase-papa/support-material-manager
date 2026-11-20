"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/app/components/AppNav";
import { useAttendanceStore } from "@/app/hooks/useAttendanceStore";
import { MATERIAL_LABEL, oppositeMaterial, type Material } from "@/app/lib/attendance";
import { addDays, formatFullDate, startOfDay, toDateKey } from "@/app/lib/date";
import { normalizeName } from "@/app/lib/nameMatch";
import { studyLabel } from "@/app/lib/teachingMaterials";

/**
 * 記録担当振り分け（旧：支援進行ボード）。学習室で「誰がカリキュラム／タブレットか」「誰が記録を担当するか」を見渡す。
 *
 * - 来る生徒とカリキュラム／タブレットは、この支援アプリのもの（切り替えも同じ）
 * - お迎え担当と在室職員は、送迎アプリから取る（/api/day-plan）
 * - 記録担当は、この画面で決めて共有データに保存する。最初はお迎え担当
 * - 活動の記録そのものはHUGで管理するので、ここでは扱わない
 */

type Plan = {
  pickup: Map<string, string>; // 正規化した児童名 -> お迎え担当
  staff: string[]; // 在室職員
  away: Map<string, string>; // 職員名 -> 予定で席を外す時間帯
};

const GROUPS: { material: Material; head: string; card: string }[] = [
  { material: "curriculum", head: "bg-sky-600 text-white", card: "border-sky-300 dark:border-sky-700" },
  { material: "tablet", head: "bg-violet-600 text-white", card: "border-violet-300 dark:border-violet-700" },
];

export function FloorBoard() {
  const store = useAttendanceStore();
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const dateKey = toDateKey(date);
  // 取得結果は日付つきで持つ（日付を変えた直後に、前の日の内容を出さないため）
  const [loaded, setLoaded] = useState<{ dateKey: string; plan: Plan | null; error: string } | null>(null);
  const plan = loaded?.dateKey === dateKey ? loaded.plan : null;
  const error = loaded?.dateKey === dateKey ? loaded.error : "";

  useEffect(() => {
    let cancelled = false;
    const fail = (msg: string) => setLoaded({ dateKey, plan: null, error: msg });
    fetch(`/api/day-plan?date=${dateKey}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          fail(json?.error ?? "送迎アプリの情報を取得できませんでした。");
          return;
        }
        const pickup = new Map<string, string>();
        for (const c of json.children as { name: string; pickupStaffName?: string }[]) {
          if (c.pickupStaffName) pickup.set(normalizeName(c.name), c.pickupStaffName);
        }
        const rows = (json.staff ?? []) as { name: string; away?: string }[];
        const staff = rows.map((s) => s.name);
        const away = new Map(rows.filter((s) => s.away).map((s) => [s.name, s.away as string]));
        setLoaded({ dateKey, plan: { pickup, staff, away }, error: "" });
      })
      .catch(() => {
        if (!cancelled) fail("送迎アプリの情報を取得できませんでした。");
      });
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const { getForDate, getRecorder } = store;
  const { nonRecorders } = store;
  const allStaff = useMemo(() => plan?.staff ?? [], [plan]);
  // 記録をしない職員は、担当の選択肢・初期値・職員別の列から外す
  const staff = useMemo(() => allStaff.filter((n) => !nonRecorders.includes(n)), [allStaff, nonRecorders]);

  const view = useMemo(
    () =>
      getForDate(date).map((r) => {
        const pickup = plan?.pickup.get(normalizeName(r.student.name)) ?? "";
        const saved = getRecorder(r.student.id, date);
        // 保存済みの担当を優先。無ければお迎え担当（在室している人のときだけ）。
        // 「記録しない」にした人は、前に担当に選んでいても外れる（保存した内容は残すので、
        // 「記録する」に戻せば元の担当に戻る）
        const savedValid = saved !== "" && !nonRecorders.includes(saved);
        const recorder = savedValid ? saved : staff.includes(pickup) ? pickup : "";
        return { r, pickup, recorder };
      }),
    [getForDate, getRecorder, date, plan, staff, nonRecorders]
  );

  const count = (m: Material) => view.filter((v) => v.r.material === m).length;

  // 見せ方：活動別（カリキュラム／タブレット）か、記録担当の職員別か
  const [mode, setMode] = useState<"activity" | "staff">("activity");
  const recorderCount = (name: string) => view.filter((v) => v.recorder === name).length;
  // 職員別の列：在室職員 ＋ 在室でないが担当に入っている人 ＋ 未定
  const staffColumns = useMemo(() => {
    const names = [...staff];
    for (const v of view) if (v.recorder && !names.includes(v.recorder)) names.push(v.recorder);
    return names;
  }, [staff, view]);
  const unassigned = view.filter((v) => v.recorder === "");

  const renderCard = (v: (typeof view)[number], withStaffView: boolean) => {
    const { r, pickup, recorder } = v;
    const other = oppositeMaterial(r.material);
    const accent = r.material === "curriculum" ? GROUPS[0].card : GROUPS[1].card;
    return (
      <div key={r.student.id} className={`rounded-lg border-2 bg-white p-2 dark:bg-zinc-900 ${accent}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="break-words text-base font-bold">{r.student.name}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">お迎え：{pickup || "未定"}</div>
            {r.material === "curriculum" && (
              <StudyBadge label={studyLabel(store.getStudy(r.student.id))} hasSST={store.getStudy(r.student.id).hasSST} />
            )}
            {withStaffView && (
              <span
                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
                  r.material === "curriculum"
                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                    : "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                }`}
              >
                {MATERIAL_LABEL[r.material]}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => store.setMaterial(r.student.id, date, other)}
            className="ml-auto shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-2 text-xs font-bold hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            ⇄ {MATERIAL_LABEL[other]}へ
          </button>
        </div>
        <label className="mt-1.5 flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
          記録担当
          <select
            value={recorder}
            onChange={(e) => store.setRecorder(r.student.id, date, e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-800"
          >
            {recorder === "" && <option value="">（未定）</option>}
            {/* 保存済みの担当が、いま在室でなくなっていても消さずに残す */}
            {recorder !== "" && !staff.includes(recorder) && (
              <option value={recorder}>{recorder}（在室でない）</option>
            )}
            {staff.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <AppNav store={store} active="floor" />
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">記録担当振り分け</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="前日"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setDate(startOfDay(new Date()))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="翌日"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              →
            </button>
          </div>
          <span className="text-base font-bold">{formatFullDate(date)}</span>
          <div className="ml-auto flex items-center gap-2 text-sm font-bold">
            <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              カリキュラム {count("curriculum")}人
            </span>
            <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              タブレット {count("tablet")}人
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
            在室職員 {plan ? `${allStaff.length}人（記録をする人 ${staff.length}人）` : ""}
          </span>
          {!plan && !error && <span className="text-xs text-zinc-400">送迎アプリから取得中…</span>}
          {plan && staff.length === 0 && (
            <span className="text-xs text-zinc-400">
              この日の確定した出勤がありません（送迎アプリのシフト表で確定してください）
            </span>
          )}
          {allStaff.map((n) => {
            const records = !nonRecorders.includes(n);
            return (
              <span
                key={n}
                className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-2 pr-1 text-xs font-bold ${
                  records
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                    : "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {n}
                {plan?.away.get(n) && (
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">（{plan.away.get(n)}は不在）</span>
                )}
                {records ? (
                  view.length > 0 && <span className="text-emerald-700 dark:text-emerald-300">記録{recorderCount(n)}人</span>
                ) : (
                  <span>記録しない</span>
                )}
                <button
                  type="button"
                  onClick={() => store.setStaffRecords(n, !records)}
                  title={records ? "この人は記録をしない（ドライバー・パートなど）" : "この人も記録をする"}
                  className="rounded-full border border-current px-1.5 py-0.5 font-medium hover:bg-white/60 dark:hover:bg-black/20"
                >
                  {records ? "記録しない" : "記録する"}
                </button>
              </span>
            );
          })}
          {unassigned.length > 0 && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              担当未定 {unassigned.length}人
            </span>
          )}
        </div>

        <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 text-sm font-bold dark:border-zinc-700">
          {(
            [
              ["activity", "活動別"],
              ["staff", "職員別"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 ${
                mode === m
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}（生徒の表示と切り替えはできますが、お迎え担当と在室職員は出ません）
          </p>
        )}
      </header>

      {!store.hydrated ? (
        <p className="text-sm text-zinc-400">読み込み中…</p>
      ) : view.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          この日に来る生徒がいません。右上のメニューの「ハグデータ（出席取り込み）」から、HUGの出席を取り込んでください。
        </div>
      ) : mode === "activity" ? (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {GROUPS.map((g) => {
            const list = view.filter((v) => v.r.material === g.material);
            return (
              <section
                key={g.material}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h2 className={`flex items-center gap-2 px-3 py-2 text-sm font-bold ${g.head}`}>
                  {MATERIAL_LABEL[g.material]}
                  <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-xs">{list.length}人</span>
                </h2>
                <div className="min-h-24 space-y-2 p-2">
                  {list.length === 0 && <p className="p-2 text-xs text-zinc-400">いません</p>}
                  {list.map((v) => renderCard(v, false))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...staffColumns, ...(unassigned.length > 0 ? [""] : [])].map((name) => {
            const list = view.filter((v) => v.recorder === name);
            const cur = list.filter((v) => v.r.material === "curriculum").length;
            return (
              <section
                key={name || "_unassigned"}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h2
                  className={`flex flex-wrap items-center gap-x-2 px-3 py-2 text-sm font-bold ${
                    name ? "bg-emerald-700 text-white" : "bg-amber-600 text-white"
                  }`}
                >
                  {name || "担当未定"}
                  <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-xs">{list.length}人</span>
                  <span className="basis-full text-xs font-normal opacity-90">
                    カリキュラム {cur}人 ／ タブレット {list.length - cur}人
                  </span>
                </h2>
                <div className="min-h-16 space-y-2 p-2">
                  {list.length === 0 && <p className="p-2 text-xs text-zinc-400">記録の担当はいません</p>}
                  {list.map((v) => renderCard(v, true))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        「〜へ」を押すと反対側に移ります（支援アプリのカリキュラム／タブレットと同じ設定です）。
        記録担当は最初、お迎え担当になっています。活動の記録そのものはHUGに入力します。
      </p>
    </div>
  );
}

/** カリキュラムの生徒の「SSTあり・3枚」などの目印。SSTなしは色を変えて見落とさないようにする */
function StudyBadge({ label, hasSST }: { label: string; hasSST: boolean }) {
  return (
    <span
      className={`mt-0.5 mr-1 inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
        hasSST
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      }`}
    >
      {label}
    </span>
  );
}
