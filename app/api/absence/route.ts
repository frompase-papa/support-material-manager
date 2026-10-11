// 送迎管理アプリから「その日の出欠」を受け取って保存するAPI。
//
// 送迎アプリで送迎表を取り込む／ボードで出欠を変えると、ここが呼ばれる。
// 出欠は送迎アプリを正とするので、こちらの画面では
//   月のカレンダー取込 ＋ 送迎アプリの来る子 − 送迎アプリの休みの子
// として出席を出す。月の予定に無い追加利用の子も出るようになる。
//
// 保存先は workspace ドキュメントの transportAbsences / transportAdditions
// （どちらも dateKey -> 児童名[]）。月のカレンダー取込（presentByDate）とは
// 別の欄にしてある。同じ欄に書くと、月を取り込み直したときに消えてしまい、
// 送迎アプリの出欠が保てないため。
//
// 認証: ヘッダー x-api-key が SHIFT_ATTENDANCE_API_KEY と一致すること
// （送迎アプリから出欠を読むときと同じ合言葉を使う）。

import { getAdminDb } from "@/app/lib/firebaseAdmin";
import { normalizeName } from "@/app/lib/nameMatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACE_ID = "default";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function checkApiKey(req: Request): boolean {
  const key = req.headers.get("x-api-key");
  if (!key) return false;
  const allowed = (process.env.SHIFT_ATTENDANCE_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return allowed.includes(key);
}

export async function POST(req: Request) {
  if (!process.env.SHIFT_ATTENDANCE_API_KEY) {
    return Response.json(
      { ok: false, error: "server not configured (SHIFT_ATTENDANCE_API_KEY)" },
      { status: 503, headers: CORS_HEADERS }
    );
  }
  if (!checkApiKey(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = (await req.json().catch(() => null)) as
    | { date?: string; absentNames?: unknown; presentNames?: unknown }
    | null;
  const date = typeof body?.date === "string" ? body.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { ok: false, error: "date must be YYYY-MM-DD" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const asNames = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((n): n is string => typeof n === "string" && n.trim() !== "") : [];
  const incomingAbsent = asNames(body?.absentNames);
  const incomingPresent = asNames(body?.presentNames);

  const db = getAdminDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "server not configured (FIREBASE_SERVICE_ACCOUNT)" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const ref = db.collection("workspace").doc(WORKSPACE_ID);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let data: Record<string, unknown> = {};
    const raw = snap.exists ? snap.get("json") : null;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // 壊れたデータは触らない（上書きして消さないため）
        return { ok: false as const, error: "stored data is not readable" };
      }
    }

    // 既にこのアプリが持っている児童名にそろえる。
    // 児童名がそのままIDなので、表記が1文字違うと別人として増えてしまう
    const known = new Set<string>();
    for (const key of ["presentByDate", "absentByDate"]) {
      const byDate = data[key] as Record<string, string[]> | undefined;
      for (const list of Object.values(byDate ?? {})) for (const n of list) known.add(n);
    }
    const byNormalized = new Map<string, string>();
    for (const n of known) {
      const k = normalizeName(n);
      if (!byNormalized.has(k)) byNormalized.set(k, n);
    }
    const ja = (a: string, b: string) => a.localeCompare(b, "ja");
    const unmatched: string[] = [];
    // 名簿に無い子は、送迎アプリの名前のまま入れる（追加利用の初日など、
    // まだこのアプリが知らない児童がいるため）。呼び出し側へも返して気づけるようにする
    const fold = (names: string[]): string[] => {
      const out: string[] = [];
      for (const n of names) {
        const hit = byNormalized.get(normalizeName(n));
        if (hit) out.push(hit);
        else { out.push(n); unmatched.push(n); }
      }
      return [...new Set(out)].sort(ja);
    };
    const absent = fold(incomingAbsent);
    const present = fold(incomingPresent);

    // その日ぶんは毎回まるごと置き換える（送迎アプリ側で戻したら、こちらも戻るように）
    const put = (key: string, names: string[]) => {
      const prev = (data[key] as Record<string, string[]> | undefined) ?? {};
      const next = { ...prev };
      if (names.length > 0) next[date] = names;
      else delete next[date];
      return next;
    };

    tx.set(
      ref,
      {
        json: JSON.stringify({
          ...data,
          transportAbsences: put("transportAbsences", absent),
          transportAdditions: put("transportAdditions", present),
        }),
      },
      { merge: true }
    );
    return { ok: true as const, absent, present, unmatched: [...new Set(unmatched)] };
  });

  if (!result.ok) {
    return Response.json(result, { status: 500, headers: CORS_HEADERS });
  }
  return Response.json(
    { ok: true, date, absent: result.absent, present: result.present, unmatched: result.unmatched },
    { headers: CORS_HEADERS }
  );
}
